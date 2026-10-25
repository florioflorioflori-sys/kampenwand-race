class_name TerrainRenderer
extends MeshInstance3D
## Gitter, das der Kamera folgt: in der Mitte 2 m Maschenweite, nach außen immer gröber.
## Die Höhe kommt im Vertex-Shader aus den Höhentexturen.

const GRID_VERTS := 640
const CENTER_SPACING := 2.0
const RADIUS := 9000.0

var follow: Node3D


func setup(data: TerrainData, noise_tex: Texture2D, forest_tex: Texture2D, forest: Forest) -> void:
	mesh = _build_mesh()
	custom_aabb = AABB(Vector3(-RADIUS, -1000.0, -RADIUS), Vector3(RADIUS * 2.0, 5000.0, RADIUS * 2.0))
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/terrain.gdshader")
	mat.set_shader_parameter("near_tex", data.make_height_texture(false))
	mat.set_shader_parameter("far_tex", data.make_height_texture(true))
	mat.set_shader_parameter("trail_tex", data.make_trail_texture())
	mat.set_shader_parameter("noise_tex", noise_tex)
	mat.set_shader_parameter("forest_tex", forest_tex)
	mat.set_shader_parameter("near_size_px", Vector2(data.near_w, data.near_h))
	mat.set_shader_parameter("near_cell", data.near_cell)
	mat.set_shader_parameter("far_size_px", Vector2(data.far_w, data.far_h))
	mat.set_shader_parameter("far_cell", data.far_cell)
	mat.set_shader_parameter("far_origin", data.far_origin)
	mat.set_shader_parameter("h_min", data.h_min)
	mat.set_shader_parameter("h_range", data.h_range)
	mat.set_shader_parameter("trail_unit", data.trail_unit)
	mat.set_shader_parameter("edge_blend", TerrainData.EDGE_BLEND)
	mat.set_shader_parameter("forest_scale", Forest.MASK_SCALE)
	mat.set_shader_parameter("forest_threshold", Forest.MASK_THRESHOLD)
	mat.set_shader_parameter("tree_line", Forest.TREE_LINE)
	mat.set_shader_parameter("valley_line", Forest.VALLEY_LINE)
	material_override = mat


func _process(_delta: float) -> void:
	if follow:
		var p := follow.global_position
		global_position = Vector3(snappedf(p.x, CENTER_SPACING), 0.0, snappedf(p.z, CENTER_SPACING))


func _warp(u: float) -> float:
	# lineare Mitte mit CENTER_SPACING, nach außen mit u^4 bis RADIUS
	var a := CENTER_SPACING * (GRID_VERTS - 1) / 2.0
	var b := RADIUS - a
	var s := absf(u)
	return signf(u) * (a * s + b * s * s * s * s)


func _build_mesh() -> ArrayMesh:
	var n := GRID_VERTS
	var coords := PackedFloat32Array()
	coords.resize(n)
	for i in n:
		coords[i] = _warp(float(i) / (n - 1) * 2.0 - 1.0)
	var verts := PackedVector3Array()
	verts.resize(n * n)
	for j in n:
		for i in n:
			verts[j * n + i] = Vector3(coords[i], 0.0, coords[j])
	var idx := PackedInt32Array()
	idx.resize((n - 1) * (n - 1) * 6)
	var k := 0
	for j in n - 1:
		for i in n - 1:
			var a := j * n + i
			idx[k] = a
			idx[k + 1] = a + 1
			idx[k + 2] = a + n
			idx[k + 3] = a + 1
			idx[k + 4] = a + n + 1
			idx[k + 5] = a + n
			k += 6
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return m
