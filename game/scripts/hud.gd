class_name Hud
extends CanvasLayer
## Anzeige: Geschwindigkeit, Höhe, Zeit, Fortschritt, Meldungen.

var bike: Bike
var terrain: TerrainData

var _speed: Label
var _info: Label
var _message: Label
var _help: Label
var _message_timer := 0.0


func _ready() -> void:
	_speed = _label(64, HORIZONTAL_ALIGNMENT_RIGHT)
	_speed.anchor_left = 1.0
	_speed.anchor_right = 1.0
	_speed.anchor_top = 1.0
	_speed.anchor_bottom = 1.0
	_speed.offset_left = -360
	_speed.offset_right = -40
	_speed.offset_top = -120
	_speed.offset_bottom = -30
	_info = _label(24, HORIZONTAL_ALIGNMENT_LEFT)
	_info.position = Vector2(30, 24)
	_message = _label(56, HORIZONTAL_ALIGNMENT_CENTER)
	_message.anchor_right = 1.0
	_message.offset_top = 180
	_help = _label(18, HORIZONTAL_ALIGNMENT_LEFT)
	_help.anchor_top = 1.0
	_help.anchor_bottom = 1.0
	_help.offset_left = 30
	_help.offset_top = -120
	_help.text = "W/RT treten · S/LT bremsen · A D/Stick lenken\nLeertaste/A springen · R/Y zurücksetzen · C/Select Kamera · Enter/Start neu starten"


func _label(size: int, align: HorizontalAlignment) -> Label:
	var l := Label.new()
	l.horizontal_alignment = align
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", Color.WHITE)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("outline_size", maxi(4, size / 8))
	add_child(l)
	return l


func show_message(text: String, seconds: float = 2.0) -> void:
	_message.text = text
	_message_timer = seconds


func update_race(time: float, finished: bool) -> void:
	if bike == null:
		return
	_speed.text = "%d km/h" % int(round(absf(bike.speed) * 3.6 if bike.on_ground else bike.vel.length() * 3.6))
	var progress := float(bike.route_index) / float(terrain.route.size() - 1)
	var to_go := terrain.route_length * (1.0 - progress)
	_info.text = "Zeit %s\nHöhe %d m\nZiel in %d m" % [format_time(time), int(bike.pos.y), int(to_go)]
	if finished:
		_info.text = "Zeit %s  ·  im Ziel!" % format_time(time)


func _process(dt: float) -> void:
	if _message_timer > 0.0:
		_message_timer -= dt
		if _message_timer <= 0.0:
			_message.text = ""


static func format_time(t: float) -> String:
	var m := int(t / 60.0)
	var s := t - m * 60.0
	return "%d:%05.2f" % [m, s]
