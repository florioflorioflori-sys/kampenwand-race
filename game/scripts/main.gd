extends Node3D
## Baut die Spielwelt auf: Gelände, Wald, Licht, Fahrer, Kamera und HUD.

var terrain := TerrainData.new()
var forest: Forest
var bike: Bike
var camera: ChaseCamera
var hud: Hud

var race_time := 0.0
var started := false
var finished := false


func _ready() -> void:
	_setup_input()
	terrain.load_from("res://data")

	var noise := FastNoiseLite.new()
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	noise.frequency = 0.02
	noise.fractal_octaves = 4
	var noise_img := noise.get_seamless_image(512, 512)
	noise_img.generate_mipmaps()
	var noise_tex := ImageTexture.create_from_image(noise_img)

	var forest_noise := FastNoiseLite.new()
	forest_noise.seed = 7
	forest_noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	forest_noise.frequency = 0.012
	forest_noise.fractal_octaves = 3
	var forest_img := forest_noise.get_seamless_image(512, 512)
	var forest_tex := ImageTexture.create_from_image(forest_img)

	_setup_environment()

	forest = Forest.new()
	add_child(forest)
	forest.build(terrain, forest_img)

	var renderer := TerrainRenderer.new()
	add_child(renderer)
	renderer.setup(terrain, noise_tex, forest_tex, forest)

	bike = Bike.new()
	add_child(bike)
	bike.setup(terrain, forest, Color(0.8, 0.1, 0.08), Color(0.95, 0.45, 0.05))
	bike.crashed.connect(_on_crash)

	camera = ChaseCamera.new()
	camera.target = bike
	camera.terrain = terrain
	camera.forest = forest
	camera.far = 20000.0
	camera.near = 0.1
	add_child(camera)
	camera.make_current()
	renderer.follow = camera

	hud = Hud.new()
	hud.bike = bike
	hud.terrain = terrain
	add_child(hud)
	_restart()
	if "--autotest" in OS.get_cmdline_user_args():
		_autotest()
	elif "--shots" in OS.get_cmdline_user_args():
		_shots()


## Standbilder an mehreren Stellen der Strecke nach user://shots/
func _shots() -> void:
	DirAccess.make_dir_recursive_absolute("user://shots")
	bike.player_controlled = false
	var points := [6, 250, 520, 800, 1100, 1370]
	for k in points.size() + 2:
		var idx: int = points[mini(k, points.size() - 1)]
		bike.place_at_route(idx)
		bike.speed = 9.0
		camera.helmet_view = k == points.size()
		camera.snap()
		if k == points.size() + 1:
			# Überblick von oben auf die Bergflanke
			camera.set_process(false)
			var start := terrain.route[0]
			camera.global_position = start + Vector3(-500, 250, -350)
			camera.look_at(terrain.route[terrain.route.size() / 2], Vector3.UP)
			camera.fov = 60
		for f in 4:
			await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("user://shots/shot_%d.png" % k)
		print("SHOT %d idx %d" % [k, idx])
	get_tree().quit()


## Testlauf ohne Spieler: Bot fährt, Protokoll auf der Konsole, Screenshots in user://autotest/
var _auto := false
var _auto_shots := [1.0, 12.0, 30.0, 55.0, 80.0, 110.0, 140.0]
var _auto_next_log := 0.0
var _auto_crashes := 0


func _autotest() -> void:
	_auto = true
	bike.player_controlled = false
	bike.crashed.connect(func(r: String) -> void:
		_auto_crashes += 1
		print("AUTOTEST crash '%s' bei idx %d" % [r, bike.route_index]))
	DirAccess.make_dir_recursive_absolute("user://autotest")


func _autotest_tick() -> void:
	if race_time >= _auto_next_log:
		_auto_next_log += 10.0
		print("AUTOTEST t=%.1f idx=%d/%d %.1f km/h y=%.0f trail=%.1f m" % [race_time, bike.route_index, terrain.route.size(), bike.speed * 3.6, bike.pos.y, terrain.trail_distance(bike.pos.x, bike.pos.z)])
	var headless := DisplayServer.get_name() == "headless"
	if not headless and not _auto_shots.is_empty() and race_time >= _auto_shots[0]:
		var i := 7 - _auto_shots.size()
		_auto_shots.pop_front()
		camera.helmet_view = i == 3
		var path := "user://autotest/shot_%d.png" % i
		get_viewport().get_texture().get_image().save_png(path)
	if finished or race_time > 400.0:
		print("AUTOTEST ende: ziel=%s zeit=%s stuerze=%d" % [finished, Hud.format_time(race_time), _auto_crashes])
		get_tree().quit()


func _restart() -> void:
	bike.place_at_route(2)
	camera.snap()
	race_time = 0.0
	started = false
	finished = false
	hud.show_message("Kampenwand – Bergstation\nLos geht's!", 3.0)


func _process(dt: float) -> void:
	if Input.is_action_just_pressed("restart"):
		_restart()
	if not started and absf(bike.speed) > 0.5:
		started = true
	if started and not finished:
		race_time += dt
		if bike.route_index >= terrain.route.size() - 3:
			finished = true
			hud.show_message("Ziel! %s" % Hud.format_time(race_time), 6.0)
	hud.update_race(race_time, finished)
	if _auto:
		_autotest_tick()


func _on_crash(reason: String) -> void:
	hud.show_message(reason, 2.0)


func _setup_environment() -> void:
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.22, 0.42, 0.78)
	sky_mat.sky_horizon_color = Color(0.68, 0.78, 0.9)
	sky_mat.ground_horizon_color = Color(0.6, 0.68, 0.75)
	sky_mat.ground_bottom_color = Color(0.25, 0.3, 0.25)
	sky_mat.sun_angle_max = 20.0
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.9
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	env.ssao_enabled = true
	env.ssao_radius = 1.5
	env.ssao_intensity = 1.5
	env.glow_enabled = true
	env.glow_intensity = 0.4
	env.glow_bloom = 0.05
	env.fog_enabled = true
	env.fog_light_color = Color(0.68, 0.76, 0.86)
	env.fog_density = 0.00007
	env.fog_aerial_perspective = 0.8
	env.fog_sky_affect = 0.2
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.0
	env.adjustment_contrast = 1.05
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-38.0, 210.0, 0.0)
	sun.light_energy = 1.25
	sun.light_color = Color(1.0, 0.96, 0.88)
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_max_distance = 350.0
	sun.directional_shadow_blend_splits = true
	sun.shadow_bias = 0.05
	sun.shadow_normal_bias = 1.5
	add_child(sun)


func _setup_input() -> void:
	var actions := {
		"steer_left": [KEY_A, KEY_LEFT],
		"steer_right": [KEY_D, KEY_RIGHT],
		"pedal": [KEY_W, KEY_UP],
		"brake": [KEY_S, KEY_DOWN],
		"jump": [KEY_SPACE],
		"respawn": [KEY_R],
		"camera": [KEY_C],
		"restart": [KEY_ENTER],
	}
	for action in actions:
		if not InputMap.has_action(action):
			InputMap.add_action(action, 0.15)
		for key in actions[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = key
			InputMap.action_add_event(action, ev)
	_add_axis("steer_left", JOY_AXIS_LEFT_X, -1.0)
	_add_axis("steer_right", JOY_AXIS_LEFT_X, 1.0)
	_add_axis("pedal", JOY_AXIS_TRIGGER_RIGHT, 1.0)
	_add_axis("brake", JOY_AXIS_TRIGGER_LEFT, 1.0)
	_add_button("jump", JOY_BUTTON_A)
	_add_button("respawn", JOY_BUTTON_Y)
	_add_button("camera", JOY_BUTTON_BACK)
	_add_button("restart", JOY_BUTTON_START)


func _add_axis(action: String, axis: JoyAxis, dir: float) -> void:
	var ev := InputEventJoypadMotion.new()
	ev.axis = axis
	ev.axis_value = dir
	InputMap.action_add_event(action, ev)


func _add_button(action: String, button: JoyButton) -> void:
	var ev := InputEventJoypadButton.new()
	ev.button_index = button
	InputMap.action_add_event(action, ev)
