class_name RiderModel
extends Node3D
## Mountainbike und Fahrer aus Grundkörpern. Vorne ist -Z, Ursprung am Boden zwischen den Rädern.

const WHEEL_R := 0.37
const REAR_AXLE := Vector3(0, WHEEL_R, 0.6)
const FRONT_AXLE := Vector3(0, WHEEL_R, -0.62)
const BB := Vector3(0, 0.34, 0.12)
const CRANK := 0.17

var jersey_color := Color(0.8, 0.1, 0.08)
var frame_color := Color(0.95, 0.45, 0.05)

var _front_wheel: Node3D
var _rear_wheel: Node3D
var _steer: Node3D
var _crank: Node3D
var _rider: Node3D
var _limbs := {}
var _crank_angle := 0.0
var _mats := {}
var _steer_base: Basis
var _steer_base_inv: Transform3D


func _ready() -> void:
	_build()


func _mat(name: String, color: Color, rough: float = 0.6, metal: float = 0.0) -> StandardMaterial3D:
	if not _mats.has(name):
		var m := StandardMaterial3D.new()
		m.albedo_color = color
		m.roughness = rough
		m.metallic = metal
		_mats[name] = m
	return _mats[name]


func _tube(parent: Node3D, a: Vector3, b: Vector3, r: float, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = 1.0
	cm.radial_segments = 10
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = mat
	parent.add_child(mi)
	_place(mi, a, b)
	return mi


func _place(mi: Node3D, a: Vector3, b: Vector3) -> void:
	var d := b - a
	var l := d.length()
	if l < 0.0001:
		return
	var y := d / l
	var x := y.cross(Vector3.FORWARD if absf(y.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT).normalized()
	var z := x.cross(y)
	mi.transform = Transform3D(Basis(x, y * l, z), (a + b) * 0.5)


func _ball(parent: Node3D, p: Vector3, r: float, mat: Material, squash := Vector3.ONE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = r
	sm.height = r * 2.0
	sm.radial_segments = 16
	sm.rings = 8
	mi.mesh = sm
	mi.material_override = mat
	mi.position = p
	mi.scale = squash
	parent.add_child(mi)
	return mi


func _wheel(p: Vector3) -> Node3D:
	var w := Node3D.new()
	w.position = p
	add_child(w)
	var tire := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = WHEEL_R - 0.065
	tm.outer_radius = WHEEL_R
	tm.rings = 32
	tm.ring_segments = 10
	tire.mesh = tm
	tire.material_override = _mat("tire", Color(0.06, 0.06, 0.06), 0.9)
	tire.rotation.z = PI / 2
	w.add_child(tire)
	var rim := MeshInstance3D.new()
	var rm := TorusMesh.new()
	rm.inner_radius = WHEEL_R - 0.085
	rm.outer_radius = WHEEL_R - 0.06
	rm.rings = 32
	rm.ring_segments = 6
	rim.mesh = rm
	rim.material_override = _mat("rim", Color(0.15, 0.15, 0.16), 0.35, 0.8)
	rim.rotation.z = PI / 2
	w.add_child(rim)
	var spoke_mat := _mat("spoke", Color(0.7, 0.7, 0.72), 0.3, 0.9)
	for i in 8:
		var a := TAU * i / 8.0
		_tube(w, Vector3.ZERO, Vector3(0, cos(a), sin(a)) * (WHEEL_R - 0.08), 0.005, spoke_mat)
	# Bremsscheibe
	var disc := MeshInstance3D.new()
	var dm := CylinderMesh.new()
	dm.top_radius = 0.1
	dm.bottom_radius = 0.1
	dm.height = 0.005
	disc.mesh = dm
	disc.material_override = _mat("disc", Color(0.75, 0.75, 0.78), 0.25, 1.0)
	disc.rotation.z = PI / 2
	disc.position.x = -0.07
	w.add_child(disc)
	return w


func _build() -> void:
	var frame := _mat("frame", frame_color, 0.35, 0.3)
	var black := _mat("black", Color(0.08, 0.08, 0.09), 0.5, 0.2)
	var silver := _mat("silver", Color(0.75, 0.75, 0.78), 0.25, 0.9)
	_rear_wheel = _wheel(REAR_AXLE)
	_front_wheel = _wheel(FRONT_AXLE)
	_front_wheel.get_parent().remove_child(_front_wheel)

	var seat_top := Vector3(0, 0.86, 0.33)
	var head_top := Vector3(0, 1.0, -0.42)
	var head_bot := Vector3(0, 0.8, -0.49)
	_tube(self, BB, head_bot, 0.032, frame)
	_tube(self, seat_top + Vector3(0, -0.06, 0.02), head_top + Vector3(0, -0.04, 0.02), 0.026, frame)
	_tube(self, BB, seat_top, 0.028, frame)
	_tube(self, head_bot, head_top, 0.035, frame)
	for s in [-1.0, 1.0]:
		_tube(self, BB + Vector3(0.05 * s, 0, 0), REAR_AXLE + Vector3(0.065 * s, 0, 0), 0.016, frame)
		_tube(self, seat_top + Vector3(0.03 * s, -0.08, 0), REAR_AXLE + Vector3(0.065 * s, 0, 0), 0.014, frame)
	# Dämpfer
	_tube(self, BB + Vector3(0, 0.18, 0.05), seat_top + Vector3(0, -0.2, 0.0), 0.03, silver)
	# Sattel (für Abfahrt abgesenkt)
	_tube(self, seat_top, seat_top + Vector3(0, 0.05, 0.02), 0.015, black)
	var saddle := _ball(self, seat_top + Vector3(0, 0.08, 0.02), 0.13, black, Vector3(0.5, 0.25, 1.0))
	saddle.name = "Saddle"

	# Lenkung: Gabel, Vorderrad, Vorbau, Lenker drehen sich zusammen um die Steuerrohrachse
	_steer = Node3D.new()
	_steer.position = head_bot
	add_child(_steer)
	var axis := (head_top - head_bot).normalized()
	_steer.basis = Basis(Vector3.RIGHT, axis, Vector3.RIGHT.cross(axis)).orthonormalized()
	_steer_base = _steer.basis
	var to_local := _steer.transform.affine_inverse()
	_steer_base_inv = to_local
	_front_wheel.position = to_local * FRONT_AXLE
	_steer.add_child(_front_wheel)
	for s in [-1.0, 1.0]:
		_tube(_steer, to_local * (head_bot + Vector3(0.07 * s, 0.02, 0)), to_local * (FRONT_AXLE + Vector3(0.07 * s, 0, 0)), 0.022, black)
		_tube(_steer, to_local * (head_bot + Vector3(0.07 * s, 0.02, 0)), to_local * (head_bot + Vector3(0.07 * s, 0.22, 0.05)), 0.03, silver)
	var bar_c := Vector3(0, 1.07, -0.38)
	_tube(_steer, to_local * head_top, to_local * bar_c, 0.02, black)
	_tube(_steer, to_local * (bar_c + Vector3(-0.39, 0.01, 0)), to_local * (bar_c + Vector3(0.39, 0.01, 0)), 0.014, black)

	# Kurbel
	_crank = Node3D.new()
	_crank.position = BB
	add_child(_crank)
	_ball(_crank, Vector3.ZERO, 0.06, silver, Vector3(0.3, 1, 1))
	for s in [-1.0, 1.0]:
		var end := Vector3(0.09 * s, CRANK * s, 0)
		_tube(_crank, Vector3(0.06 * s, 0, 0), end, 0.014, black)
		var pedal := _tube(_crank, end, end + Vector3(0.09 * s, 0, 0), 0.03, black)
		pedal.name = "Pedal%d" % int(s)

	# Fahrer
	_rider = Node3D.new()
	add_child(_rider)
	var jersey := _mat("jersey", jersey_color, 0.8)
	var pants := _mat("pants", Color(0.12, 0.12, 0.14), 0.85)
	var skin := _mat("skin", Color(0.85, 0.66, 0.52), 0.7)
	var helmet := _mat("helmet", Color(0.95, 0.95, 0.95), 0.3)
	var visor := _mat("visor", Color(0.05, 0.05, 0.06), 0.1, 0.5)
	var shoe := _mat("shoe", Color(0.15, 0.15, 0.15), 0.8)
	for limb in ["torso", "neck"]:
		_limbs[limb] = _tube(_rider, Vector3.ZERO, Vector3.UP, 0.13 if limb == "torso" else 0.05, jersey if limb == "torso" else skin)
	_limbs["head"] = _ball(_rider, Vector3.ZERO, 0.13, helmet, Vector3(1, 1, 1.15))
	_limbs["visor"] = _ball(_rider, Vector3.ZERO, 0.09, visor, Vector3(1.1, 0.6, 0.6))
	for s in ["L", "R"]:
		_limbs["thigh" + s] = _tube(_rider, Vector3.ZERO, Vector3.UP, 0.075, pants)
		_limbs["shin" + s] = _tube(_rider, Vector3.ZERO, Vector3.UP, 0.055, pants)
		_limbs["foot" + s] = _ball(_rider, Vector3.ZERO, 0.06, shoe, Vector3(0.9, 0.7, 1.9))
		_limbs["upper" + s] = _tube(_rider, Vector3.ZERO, Vector3.UP, 0.055, jersey)
		_limbs["fore" + s] = _tube(_rider, Vector3.ZERO, Vector3.UP, 0.045, jersey)
		_limbs["hand" + s] = _ball(_rider, Vector3.ZERO, 0.045, pants)
	for k in _limbs:
		(_limbs[k] as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	animate(0.0, 0.0, 0.0, 0.0)


## Zwei-Gelenk-IK: liefert die Position des mittleren Gelenks
func _ik(a: Vector3, c: Vector3, l1: float, l2: float, hint: Vector3) -> Vector3:
	var d := c - a
	var dist := clampf(d.length(), 0.01, l1 + l2 - 0.001)
	var dir := d.normalized()
	var x := (l1 * l1 - l2 * l2 + dist * dist) / (2.0 * dist)
	var h := sqrt(maxf(l1 * l1 - x * x, 0.0))
	var side := (hint - dir * hint.dot(dir)).normalized()
	return a + dir * x + side * h


## steer: Lenkeinschlag (rad), wheel_spin: Raddrehung (rad), crouch: 0..1 (tief geduckt), pedal_rate: Kurbel rad/s
func animate(steer: float, wheel_spin: float, crouch: float, pedal_rate: float, delta: float = 0.0) -> void:
	if _steer == null:
		return
	_steer.basis = Basis(_steer_base.y.normalized(), steer) * _steer_base
	_front_wheel.rotation.x = -wheel_spin
	_rear_wheel.rotation.x = -wheel_spin
	_crank_angle = fmod(_crank_angle + pedal_rate * delta, TAU)
	_crank.rotation.x = -_crank_angle

	var hip := Vector3(0, lerpf(1.18, 1.02, crouch), lerpf(0.22, 0.3, crouch))
	var shoulder_c := Vector3(0, lerpf(1.5, 1.33, crouch), lerpf(-0.1, -0.16, crouch))
	_place(_limbs["torso"], hip, shoulder_c)
	var neck_top := shoulder_c + Vector3(0, 0.1, -0.06)
	_place(_limbs["neck"], shoulder_c, neck_top)
	var head_p := neck_top + Vector3(0, 0.1, -0.06)
	_limbs["head"].position = head_p
	_limbs["visor"].position = head_p + Vector3(0, -0.02, -0.11)

	for side in [["L", -1.0], ["R", 1.0]]:
		var s: String = side[0]
		var sx: float = side[1]
		var pedal := BB + Basis(Vector3.RIGHT, -_crank_angle) * Vector3(0.17 * sx, CRANK * sx, 0)
		var foot := pedal + Vector3(0, 0.05, 0)
		var h := hip + Vector3(0.12 * sx, 0, 0)
		var knee := _ik(h, foot, 0.46, 0.46, Vector3(0.25 * sx, 0.2, -1.0))
		_place(_limbs["thigh" + s], h, knee)
		_place(_limbs["shin" + s], knee, foot)
		_limbs["foot" + s].position = foot + Vector3(0, 0, -0.03)
		var hand := _steer.transform * (_steer_base_inv * Vector3(0.33 * sx, 1.08, -0.38))
		var sh := shoulder_c + Vector3(0.2 * sx, -0.02, 0)
		var elbow := _ik(sh, hand, 0.31, 0.3, Vector3(0.9 * sx, 0.3, 0.3))
		_place(_limbs["upper" + s], sh, elbow)
		_place(_limbs["fore" + s], elbow, hand)
		_limbs["hand" + s].position = hand
