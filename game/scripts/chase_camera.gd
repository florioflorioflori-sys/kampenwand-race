class_name ChaseCamera
extends Camera3D
## Verfolgerkamera mit Trägheit, bleibt über dem Gelände. Taste C wechselt zur Helmkamera.

var target: Bike
var terrain: TerrainData
var forest: Forest
var helmet_view := false
var distance := 4.6
var height_offset := 1.9

var _pos := Vector3.ZERO
var _look := Vector3.ZERO
var _initialized := false
var _dist := 4.6


func _process(dt: float) -> void:
	if target == null:
		return
	if Input.is_action_just_pressed("camera"):
		helmet_view = not helmet_view
	var ff := target.forward_flat()
	var spd := absf(target.speed)
	if helmet_view:
		var head := target.global_transform * Vector3(0, 1.72, -0.35)
		global_position = head
		var look := head + (target.global_transform.basis * Vector3.FORWARD) * 10.0
		look_at(look, target.global_transform.basis.y.lerp(Vector3.UP, 0.7))
		fov = lerpf(fov, 80.0 + spd * 0.5, 1.0 - exp(-3.0 * dt))
		return
	var dist := distance + spd * 0.06
	# Kamera näher heranholen, wenn Bäume zwischen Fahrer und Kamera stehen
	if forest:
		var probe := target.pos - ff * dist + Vector3.UP * height_offset
		var clear := forest.segment_clearance(target.pos, probe)
		if clear < 2.5:
			dist = lerpf(1.8, dist, clampf((clear - 1.0) / 1.5, 0.0, 1.0))
	_dist = lerpf(_dist, dist, 1.0 - exp(-4.0 * dt)) if _initialized else dist
	var desired := target.pos - ff * _dist + Vector3.UP * height_offset
	var look_target := target.pos + ff * 3.0 + Vector3.UP * 0.9
	if not _initialized:
		_pos = desired
		_look = look_target
		_initialized = true
	_pos = _pos.lerp(desired, 1.0 - exp(-5.0 * dt))
	_look = _look.lerp(look_target, 1.0 - exp(-10.0 * dt))
	var ground := terrain.height(_pos.x, _pos.z) + 0.8
	_pos.y = maxf(_pos.y, ground)
	global_position = _pos
	look_at(_look, Vector3.UP)
	fov = lerpf(fov, clampf(68.0 + spd * 0.7, 68.0, 92.0), 1.0 - exp(-3.0 * dt))


func snap() -> void:
	_initialized = false
