class_name Bike
extends Node3D
## Fahrphysik des Mountainbikes. Arcade-nah, aber mit echter Hangabtriebskraft, Luftwiderstand,
## Rollwiderstand je Untergrund, Haftgrenze in Kurven, Sprüngen und Stürzen.

signal crashed(reason: String)

const G := 9.81
const DRAG := 0.0042            # 0,5 * rho * cw*A / Masse
const ROLL_TRAIL := 0.018
const ROLL_GRASS := 0.07
const ROLL_FOREST := 0.12
const GRIP_TRAIL := 0.95
const GRIP_OFFROAD := 0.7
const PEDAL_ACCEL := 3.2
const PEDAL_MAX_SPEED := 13.0
const BRAKE_DECEL := 7.5
const MAX_STEER := 0.55         # rad Lenkeinschlag
const WHEELBASE := 1.22
const JUMP_SPEED := 3.8
const MAX_LANDING_IMPACT := 11.0
const CRASH_TIME := 2.2

var terrain: TerrainData
var forest: Forest
var model: RiderModel
## true: wird vom Spieler gesteuert, sonst von außen über die Eingabe-Variablen
var player_controlled := true

var in_steer := 0.0
var in_pedal := 0.0
var in_brake := 0.0
var in_jump := false

var pos := Vector3.ZERO
var vel := Vector3.ZERO
var yaw := 0.0
var speed := 0.0
var on_ground := true
var route_index := 0
var crash_timer := 0.0
var air_time := 0.0

var _steer_angle := 0.0
var _lean := 0.0
var _up := Vector3.UP
var _pitch_air := 0.0
var _wheel_spin := 0.0
var _jump_held := false


func setup(t: TerrainData, f: Forest, jersey: Color, frame: Color) -> void:
	terrain = t
	forest = f
	model = RiderModel.new()
	model.jersey_color = jersey
	model.frame_color = frame
	add_child(model)


func forward_flat() -> Vector3:
	return Vector3(-sin(yaw), 0.0, -cos(yaw))


func place_at_route(i: int) -> void:
	route_index = clampi(i, 0, terrain.route.size() - 1)
	var p := terrain.route[route_index]
	var dir := terrain.route_direction(route_index)
	yaw = atan2(-dir.x, -dir.z)
	pos = Vector3(p.x, terrain.height(p.x, p.z), p.z)
	vel = Vector3.ZERO
	speed = 0.0
	on_ground = true
	crash_timer = 0.0
	_lean = 0.0
	_up = terrain.normal(pos.x, pos.z)
	_update_transform(0.0)


func respawn() -> void:
	place_at_route(maxi(route_index - 5, 0))


func is_crashed() -> bool:
	return crash_timer > 0.0


func _read_input() -> void:
	in_steer = Input.get_axis("steer_right", "steer_left")
	in_pedal = Input.get_action_strength("pedal")
	in_brake = Input.get_action_strength("brake")
	in_jump = Input.is_action_pressed("jump")
	if Input.is_action_just_pressed("respawn"):
		respawn()


func _physics_process(dt: float) -> void:
	if terrain == null:
		return
	if crash_timer > 0.0:
		crash_timer -= dt
		if crash_timer <= 0.0:
			respawn()
		_update_transform(dt)
		return
	if player_controlled:
		_read_input()
	else:
		_autopilot()
	if on_ground:
		_ground_step(dt)
	else:
		_air_step(dt)
	_check_trees()
	route_index = terrain.nearest_route_index(pos, route_index)
	_update_transform(dt)


## x = Rollwiderstand, y = Haftreibung
## Einfacher Fahrer-Bot: zielt auf einen Streckenpunkt voraus und regelt die Kurvengeschwindigkeit.
func _autopilot() -> void:
	var look := clampi(route_index + 4 + int(absf(speed) * 0.3), 0, terrain.route.size() - 1)
	var target := terrain.route[look]
	var to := Vector3(target.x - pos.x, 0, target.z - pos.z)
	var err := forward_flat().signed_angle_to(to.normalized(), Vector3.UP)
	in_steer = clampf(err * 2.5, -1.0, 1.0)
	var far_i := clampi(route_index + 25, 0, terrain.route.size() - 1)
	var bend := terrain.route_direction(route_index).angle_to(terrain.route_direction(far_i))
	var safe_speed := lerpf(18.0, 7.0, clampf(bend / 1.2, 0.0, 1.0))
	in_pedal = 1.0 if speed < safe_speed - 2.0 else 0.0
	in_brake = clampf((speed - safe_speed) / 4.0, 0.0, 1.0)
	in_jump = false


func _surface() -> Vector2:
	var d := terrain.trail_distance(pos.x, pos.z)
	if d < 1.8:
		return Vector2(ROLL_TRAIL, GRIP_TRAIL)
	if forest and forest.mask_value(pos.x, pos.z) > Forest.MASK_THRESHOLD:
		return Vector2(ROLL_FOREST, GRIP_OFFROAD)
	return Vector2(ROLL_GRASS, GRIP_OFFROAD)


func _ground_step(dt: float) -> void:
	var n := terrain.normal(pos.x, pos.z)
	var ff := forward_flat()
	var f := (ff - n * ff.dot(n)).normalized()
	var surf := _surface()

	# Längsdynamik
	var a := -G * f.y
	a -= surf.x * G * n.y * signf(speed)
	a -= DRAG * speed * absf(speed)
	if speed < PEDAL_MAX_SPEED:
		a += in_pedal * PEDAL_ACCEL * (1.0 - maxf(speed, 0.0) / PEDAL_MAX_SPEED)
	var brake := in_brake * BRAKE_DECEL * dt
	speed += a * dt
	if absf(speed) <= brake:
		speed = 0.0
	else:
		speed -= brake * signf(speed)
	speed = maxf(speed, -1.5)

	# Lenkung mit Haftgrenze: Querbeschleunigung v^2/R darf mu*g nicht übersteigen
	var target_steer := in_steer * MAX_STEER / (1.0 + absf(speed) * 0.12)
	_steer_angle = move_toward(_steer_angle, target_steer, 3.0 * dt)
	var yaw_rate := speed * tan(_steer_angle) / WHEELBASE
	var max_rate := surf.y * G / maxf(absf(speed), 0.5)
	yaw_rate = clampf(yaw_rate, -max_rate, max_rate)
	yaw += yaw_rate * dt
	var target_lean := atan(speed * yaw_rate / G)
	_lean = lerpf(_lean, target_lean, 1.0 - exp(-8.0 * dt))

	# Fortbewegung entlang des Hangs
	ff = forward_flat()
	f = (ff - n * ff.dot(n)).normalized()
	var next := pos + f * speed * dt
	var hg := terrain.height(next.x, next.z)
	var free_fall_y := next.y - 0.5 * G * dt * dt * 1.2
	if speed > 4.0 and free_fall_y > hg + 0.02:
		# Gelände fällt schneller ab als freier Fall: abheben
		vel = f * speed
		pos = next
		on_ground = false
		air_time = 0.0
		_pitch_air = 0.0
		return
	pos = Vector3(next.x, hg, next.z)
	vel = f * speed
	_up = _up.lerp(n, 1.0 - exp(-12.0 * dt)).normalized()

	if in_jump and not _jump_held:
		vel = f * speed + n * JUMP_SPEED
		pos += n * 0.05
		on_ground = false
		air_time = 0.0
	_jump_held = in_jump


func _air_step(dt: float) -> void:
	air_time += dt
	vel.y -= G * dt
	vel -= vel * vel.length() * DRAG * dt
	# in der Luft leicht drehbar
	yaw += in_steer * 2.0 * dt
	_lean = lerpf(_lean, 0.0, 1.0 - exp(-3.0 * dt))
	pos += vel * dt
	_jump_held = in_jump
	var hg := terrain.height(pos.x, pos.z)
	if pos.y <= hg:
		pos.y = hg
		var n := terrain.normal(pos.x, pos.z)
		var impact := -vel.dot(n)
		var ff := forward_flat()
		var f := (ff - n * ff.dot(n)).normalized()
		var hv := Vector3(vel.x, 0, vel.z)
		var misalign := 0.0
		if hv.length() > 3.0:
			misalign = rad_to_deg(ff.angle_to(hv.normalized()))
		on_ground = true
		_up = n
		if impact > MAX_LANDING_IMPACT:
			_crash("Zu harte Landung")
		elif misalign > 55.0:
			_crash("Quer gelandet")
		else:
			speed = maxf(vel.dot(f), 0.0) * (1.0 - clampf(impact / 40.0, 0.0, 0.3))


func _check_trees() -> void:
	if forest == null:
		return
	var t := forest.hit_trunk(pos, 0.55)
	if t == Vector2.INF:
		return
	if absf(speed) > 5.0 or vel.length() > 6.0:
		_crash("Baum!")
	else:
		var away := (Vector2(pos.x, pos.z) - t).normalized()
		pos.x = t.x + away.x * 0.6
		pos.z = t.y + away.y * 0.6
		speed = 0.0


func _crash(reason: String) -> void:
	crash_timer = CRASH_TIME
	speed = 0.0
	vel = Vector3.ZERO
	on_ground = true
	crashed.emit(reason)


func _update_transform(dt: float) -> void:
	var ff := forward_flat()
	var up := _up
	if not on_ground and crash_timer <= 0.0:
		# Nase folgt in der Luft langsam der Flugbahn
		var target_pitch := atan2(vel.y, Vector2(vel.x, vel.z).length())
		_pitch_air = lerpf(_pitch_air, target_pitch, 1.0 - exp(-2.5 * dt))
		var right := ff.cross(Vector3.UP).normalized()
		up = Vector3.UP.rotated(right, _pitch_air)
	var fwd := (ff - up * ff.dot(up)).normalized()
	var right := fwd.cross(up).normalized()
	var b := Basis(right, up, -fwd)
	var lean := _lean
	if crash_timer > 0.0:
		lean = lerpf(1.45, 0.0, clampf(crash_timer - (CRASH_TIME - 0.4), 0.0, 0.4) / 0.4)
	b = b * Basis(Vector3.BACK, lean)
	transform = Transform3D(b, pos)
	_wheel_spin = fmod(_wheel_spin + speed * dt / RiderModel.WHEEL_R, TAU)
	if model:
		var crouch := clampf((speed - 6.0) / 12.0, 0.0, 1.0)
		if not on_ground:
			crouch = 0.6
		var pedal_rate := 0.0
		if in_pedal > 0.1 and on_ground:
			pedal_rate = 5.0 + speed * 0.4
		model.animate(_steer_angle * 0.8, _wheel_spin, crouch, pedal_rate, dt)
