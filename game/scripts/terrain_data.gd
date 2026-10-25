class_name TerrainData
extends RefCounted
## Höhendaten der Kampenwand: Detailgelände (2 m) um die Strecke und Ferngelände (8 m).
## Die Höhenabfrage hier rechnet exakt wie der Terrain-Shader, damit Fahrphysik und Grafik übereinstimmen.

const EDGE_BLEND := 80.0

var h_min: float
var h_range: float

var near_w: int
var near_h: int
var near_cell: float
var near_bytes: PackedByteArray
var trail_bytes: PackedByteArray
var trail_unit: float

var far_w: int
var far_h: int
var far_cell: float
var far_origin: Vector2
var far_bytes: PackedByteArray

## Streckenpunkte in Weltkoordinaten (alle 2 m)
var route: PackedVector3Array
var route_length: float


func load_from(dir: String) -> void:
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(dir + "/terrain.json"))
	h_min = meta.height_min
	h_range = meta.height_max - meta.height_min
	near_w = meta.near.width
	near_h = meta.near.height
	near_cell = meta.near.cell
	far_w = meta.far.width
	far_h = meta.far.height
	far_cell = meta.far.cell
	far_origin = Vector2(meta.far.origin[0], meta.far.origin[1])
	trail_unit = meta.trail_unit
	near_bytes = _load_zlib(dir + "/near_height.bin", near_w * near_h * 2)
	far_bytes = _load_zlib(dir + "/far_height.bin", far_w * far_h * 2)
	trail_bytes = _load_zlib(dir + "/near_trail.bin", near_w * near_h)
	route = PackedVector3Array()
	for p in meta.route:
		route.append(Vector3(p[0], p[1], p[2]))
	route_length = 0.0
	for i in range(1, route.size()):
		route_length += route[i].distance_to(route[i - 1])


func _load_zlib(path: String, size: int) -> PackedByteArray:
	return FileAccess.get_file_as_bytes(path).decompress(size, FileAccess.COMPRESSION_DEFLATE)


func near_size_m() -> Vector2:
	return Vector2((near_w - 1) * near_cell, (near_h - 1) * near_cell)


func _decode(bytes: PackedByteArray, idx: int) -> float:
	return float(bytes.decode_u16(idx * 2)) / 65535.0 * h_range + h_min


func _grid_height(bytes: PackedByteArray, w: int, h: int, t: Vector2) -> float:
	t.x = clampf(t.x, 0.0, w - 1.001)
	t.y = clampf(t.y, 0.0, h - 1.001)
	var i := int(t.x)
	var j := int(t.y)
	var fx := t.x - i
	var fy := t.y - j
	var a := _decode(bytes, j * w + i)
	var b := _decode(bytes, j * w + i + 1)
	var c := _decode(bytes, (j + 1) * w + i)
	var d := _decode(bytes, (j + 1) * w + i + 1)
	return lerpf(lerpf(a, b, fx), lerpf(c, d, fx), fy)


func height(x: float, z: float) -> float:
	var p := Vector2(x, z)
	var fh := _grid_height(far_bytes, far_w, far_h, (p - far_origin) / far_cell)
	var size := near_size_m()
	var edge := minf(minf(x, z), minf(size.x - x, size.y - z))
	var blend := clampf(edge / EDGE_BLEND, 0.0, 1.0)
	if blend <= 0.0:
		return fh
	var nh := _grid_height(near_bytes, near_w, near_h, p / near_cell)
	return lerpf(fh, nh, blend)


func normal(x: float, z: float, e: float = 1.0) -> Vector3:
	var hx := height(x + e, z) - height(x - e, z)
	var hz := height(x, z + e) - height(x, z - e)
	return Vector3(-hx, 2.0 * e, -hz).normalized()


## Abstand zur Trailmitte in Metern (außerhalb des Detailgeländes: groß)
func trail_distance(x: float, z: float) -> float:
	var i := int(round(x / near_cell))
	var j := int(round(z / near_cell))
	if i < 0 or j < 0 or i >= near_w or j >= near_h:
		return 999.0
	return trail_bytes[j * near_w + i] * trail_unit


## Index des nächstgelegenen Streckenpunkts, Suche um einen Startindex herum
func nearest_route_index(p: Vector3, around: int = -1, window: int = 60) -> int:
	var lo := 0
	var hi := route.size() - 1
	if around >= 0:
		lo = maxi(0, around - window)
		hi = mini(route.size() - 1, around + window)
	var best := lo
	var best_d := INF
	for i in range(lo, hi + 1):
		var d := Vector2(route[i].x - p.x, route[i].z - p.z).length_squared()
		if d < best_d:
			best_d = d
			best = i
	return best


func route_direction(i: int) -> Vector3:
	var a := route[clampi(i - 2, 0, route.size() - 1)]
	var b := route[clampi(i + 2, 0, route.size() - 1)]
	var d := b - a
	d.y = 0.0
	return d.normalized()


func make_height_texture(far: bool) -> ImageTexture:
	var img: Image
	if far:
		img = Image.create_from_data(far_w, far_h, false, Image.FORMAT_RG8, far_bytes)
	else:
		img = Image.create_from_data(near_w, near_h, false, Image.FORMAT_RG8, near_bytes)
	return ImageTexture.create_from_image(img)


func make_trail_texture() -> ImageTexture:
	var img := Image.create_from_data(near_w, near_h, false, Image.FORMAT_R8, trail_bytes)
	return ImageTexture.create_from_image(img)
