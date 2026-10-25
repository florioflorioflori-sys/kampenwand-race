class_name Forest
extends Node3D
## Fichtenwald entlang der Strecke als MultiMesh-Kacheln mit Sichtweitenbegrenzung.

const MASK_SCALE := 2048.0       # Meter, über die sich die Waldmaske wiederholt
const MASK_THRESHOLD := 0.42
const TREE_LINE := 1480.0
const VALLEY_LINE := 640.0
const SPACING := 6.5
const CHUNK := 256.0
const VIEW_DISTANCE := 750.0
const TRAIL_CLEARANCE := 4.5

var mask: Image
## Stammpositionen je Kachel für Kollisionen: Vector2i -> PackedVector2Array
var trunks := {}


func build(data: TerrainData, mask_image: Image) -> void:
	mask = mask_image
	var rng := RandomNumberGenerator.new()
	rng.seed = 4711
	var tree_mesh := _make_spruce_mesh()
	var size := data.near_size_m()
	var chunks := {}
	var y := SPACING * 0.5
	while y < size.y:
		var x := SPACING * 0.5
		while x < size.x:
			var px := x + rng.randf_range(-0.45, 0.45) * SPACING
			var pz := y + rng.randf_range(-0.45, 0.45) * SPACING
			var keep := rng.randf()
			if _is_forest(data, px, pz, keep):
				var key := Vector2i(int(px / CHUNK), int(pz / CHUNK))
				if not chunks.has(key):
					chunks[key] = []
				var s := rng.randf_range(0.7, 1.35)
				var h := data.height(px, pz) - 0.3
				var basis := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.9, 1.15), s))
				chunks[key].append(Transform3D(basis, Vector3(px, h, pz)))
				if not trunks.has(key):
					trunks[key] = PackedVector2Array()
				trunks[key].append(Vector2(px, pz))
			x += SPACING
		y += SPACING
	for key in chunks:
		var list: Array = chunks[key]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = tree_mesh
		mm.instance_count = list.size()
		for i in list.size():
			mm.set_instance_transform(i, list[i])
		var inst := MultiMeshInstance3D.new()
		inst.multimesh = mm
		inst.visibility_range_end = VIEW_DISTANCE
		inst.visibility_range_end_margin = 60.0
		inst.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		add_child(inst)


func mask_value(x: float, z: float) -> float:
	var w := mask.get_width()
	var u := fposmod(x / MASK_SCALE, 1.0) * w
	var v := fposmod(z / MASK_SCALE, 1.0) * w
	return mask.get_pixel(int(u) % w, int(v) % w).r


func _is_forest(data: TerrainData, x: float, z: float, keep: float) -> bool:
	if data.trail_distance(x, z) < TRAIL_CLEARANCE + keep * 2.0:
		return false
	var h := data.height(x, z)
	if h > TREE_LINE + (keep - 0.5) * 60.0 or h < VALLEY_LINE:
		return false
	if data.normal(x, z, 2.0).y < 0.6:
		return false
	var m := mask_value(x, z)
	# am Waldrand lichter
	return m > MASK_THRESHOLD and keep < clampf((m - MASK_THRESHOLD) * 8.0, 0.25, 0.92)


## Kürzester Abstand eines Stamms zur Strecke von a nach b (für die Kamera)
func segment_clearance(a: Vector3, b: Vector3) -> float:
	var best := INF
	var steps := 6
	for i in steps + 1:
		var p := a.lerp(b, float(i) / steps)
		var q := Vector2(p.x, p.z)
		var list: PackedVector2Array = trunks.get(Vector2i(int(p.x / CHUNK), int(p.z / CHUNK)), PackedVector2Array())
		for t in list:
			best = minf(best, t.distance_to(q))
	return best


## Prüft, ob an der Position ein Stamm steht. Gibt den Stamm zurück oder Vector2.INF.
func hit_trunk(p: Vector3, radius: float) -> Vector2:
	var cx := int(p.x / CHUNK)
	var cz := int(p.z / CHUNK)
	var q := Vector2(p.x, p.z)
	for dz in range(-1, 2):
		for dx in range(-1, 2):
			var list: PackedVector2Array = trunks.get(Vector2i(cx + dx, cz + dz), PackedVector2Array())
			for t in list:
				if t.distance_squared_to(q) < radius * radius:
					return t
	return Vector2.INF


func _make_spruce_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var trunk_col := Color(0.25, 0.17, 0.11)
	_cone(st, 0.0, 3.0, 0.22, 0.12, 6, trunk_col, trunk_col)
	# gestufte Nadelkegel
	var layers := [[1.8, 7.0, 2.1], [4.2, 9.5, 1.75], [6.8, 12.0, 1.35], [9.2, 14.5, 0.95], [11.5, 16.5, 0.55]]
	for l in layers:
		var dark := Color(0.09, 0.2, 0.1)
		var light := Color(0.2, 0.36, 0.16)
		_cone(st, l[0], l[1], l[2], 0.0, 9, dark, light)
	st.generate_normals()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.95
	st.set_material(mat)
	return st.commit()


func _cone(st: SurfaceTool, y0: float, y1: float, r0: float, r1: float, segs: int, c0: Color, c1: Color) -> void:
	for i in segs:
		var a0 := TAU * i / segs
		var a1 := TAU * (i + 1) / segs
		var p0 := Vector3(cos(a0) * r0, y0, sin(a0) * r0)
		var p1 := Vector3(cos(a1) * r0, y0, sin(a1) * r0)
		var q0 := Vector3(cos(a0) * r1, y1, sin(a0) * r1)
		var q1 := Vector3(cos(a1) * r1, y1, sin(a1) * r1)
		st.set_color(c0); st.add_vertex(p0)
		st.set_color(c0); st.add_vertex(p1)
		st.set_color(c1); st.add_vertex(q0)
		if r1 > 0.0:
			st.set_color(c0); st.add_vertex(p1)
			st.set_color(c1); st.add_vertex(q1)
			st.set_color(c1); st.add_vertex(q0)
		# Unterseite der Nadelkegel
		if r1 == 0.0:
			var c := Vector3(0, y0 + 0.4, 0)
			st.set_color(c0 * 0.6); st.add_vertex(p0)
			st.set_color(c0 * 0.6); st.add_vertex(c)
			st.set_color(c0 * 0.6); st.add_vertex(p1)
