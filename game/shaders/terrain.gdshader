shader_type spatial;
render_mode cull_back;

// Höhendaten: 16 bit als RG8 (R = low byte, G = high byte), immer per texelFetch gelesen
uniform sampler2D near_tex : filter_nearest, repeat_disable;
uniform sampler2D far_tex : filter_nearest, repeat_disable;
uniform sampler2D trail_tex : filter_linear, repeat_disable;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform sampler2D forest_tex : filter_linear, repeat_enable;

uniform vec2 near_size_px;
uniform float near_cell = 2.0;
uniform vec2 far_size_px;
uniform float far_cell = 8.0;
uniform vec2 far_origin;
uniform float h_min;
uniform float h_range;
uniform float trail_unit = 0.25;
uniform float edge_blend = 80.0;
uniform float forest_scale = 2048.0;
uniform float forest_threshold = 0.5;
uniform float tree_line = 1480.0;
uniform float valley_line = 640.0;

varying vec3 world_pos;

float decode_h(vec4 c) {
	return (round(c.r * 255.0) + round(c.g * 255.0) * 256.0) / 65535.0 * h_range + h_min;
}

float grid_h(sampler2D tex, vec2 size, vec2 t) {
	t = clamp(t, vec2(0.0), size - 1.001);
	ivec2 i = ivec2(floor(t));
	vec2 f = t - vec2(i);
	float a = decode_h(texelFetch(tex, i, 0));
	float b = decode_h(texelFetch(tex, i + ivec2(1, 0), 0));
	float c = decode_h(texelFetch(tex, i + ivec2(0, 1), 0));
	float d = decode_h(texelFetch(tex, i + ivec2(1, 1), 0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float terrain_h(vec2 p) {
	float fh = grid_h(far_tex, far_size_px, (p - far_origin) / far_cell);
	vec2 size = (near_size_px - 1.0) * near_cell;
	float edge = min(min(p.x, p.y), min(size.x - p.x, size.y - p.y));
	float blend = clamp(edge / edge_blend, 0.0, 1.0);
	if (blend <= 0.0) {
		return fh;
	}
	return mix(fh, grid_h(near_tex, near_size_px, p / near_cell), blend);
}

vec3 terrain_n(vec2 p, float e) {
	float hx = terrain_h(p + vec2(e, 0.0)) - terrain_h(p - vec2(e, 0.0));
	float hz = terrain_h(p + vec2(0.0, e)) - terrain_h(p - vec2(0.0, e));
	return normalize(vec3(-hx, 2.0 * e, -hz));
}

void vertex() {
	vec2 p = VERTEX.xz + MODEL_MATRIX[3].xz;
	VERTEX.y = terrain_h(p);
	world_pos = vec3(p.x, VERTEX.y, p.y);
	NORMAL = terrain_n(p, 2.0);
}

void fragment() {
	vec2 p = world_pos.xz;
	float dist = length(world_pos - CAMERA_POSITION_WORLD);
	vec3 n = terrain_n(p, dist < 150.0 ? 1.0 : 4.0);

	// Rauschen in mehreren Maßstäben
	float n_big = texture(noise_tex, p / 400.0).r;
	float n_mid = texture(noise_tex, p / 37.0).r;
	float n_small = texture(noise_tex, p / 5.3).r;
	float n_tiny = texture(noise_tex, p / 0.9).r;

	float slope = 1.0 - n.y;
	float h = world_pos.y;

	// Wiese
	vec3 grass_a = vec3(0.15, 0.24, 0.07);
	vec3 grass_b = vec3(0.27, 0.32, 0.11);
	vec3 col = mix(grass_a, grass_b, smoothstep(0.3, 0.7, n_big * 0.6 + n_mid * 0.4));
	col *= 0.85 + 0.3 * n_small;
	// Almwiese höher oben: blasser, gelblicher
	col = mix(col, vec3(0.42, 0.44, 0.22), smoothstep(1350.0, 1550.0, h + n_mid * 60.0) * 0.6);

	// Waldboden unter den Bäumen
	float forest = texture(forest_tex, p / forest_scale).r;
	float in_forest = smoothstep(forest_threshold - 0.04, forest_threshold + 0.04, forest)
		* (1.0 - smoothstep(tree_line - 30.0, tree_line + 30.0, h))
		* smoothstep(valley_line - 20.0, valley_line + 20.0, h);
	vec3 forest_floor = mix(vec3(0.12, 0.10, 0.06), vec3(0.16, 0.20, 0.08), n_small);
	// aus der Ferne sieht man statt Waldboden die dunklen Baumkronen
	vec3 canopy = mix(vec3(0.05, 0.11, 0.05), vec3(0.09, 0.16, 0.07), n_mid);
	forest_floor = mix(forest_floor, canopy, smoothstep(450.0, 800.0, dist));
	col = mix(col, forest_floor, in_forest * 0.9);

	// Fels an steilen Stellen und am Gipfel
	float rock = smoothstep(0.45, 0.65, slope + (n_mid - 0.5) * 0.25);
	rock = max(rock, smoothstep(1560.0, 1620.0, h + n_mid * 40.0) * smoothstep(0.15, 0.35, slope + n_small * 0.2));
	vec3 rock_col = mix(vec3(0.48, 0.47, 0.44), vec3(0.66, 0.65, 0.61), n_small) * (0.8 + 0.3 * n_tiny);
	col = mix(col, rock_col, rock);

	// Trail: verdichteter Erdboden mit ausgefranstem Rand und Fahrspuren
	float td = texture(trail_tex, p / near_cell / near_size_px + 0.5 / near_size_px).r * 255.0 * trail_unit;
	float edge_noise = (n_small - 0.5) * 0.9 + (n_tiny - 0.5) * 0.3;
	float trail = 1.0 - smoothstep(1.3, 2.0, td + edge_noise);
	vec3 dirt = mix(vec3(0.30, 0.22, 0.14), vec3(0.42, 0.33, 0.22), n_tiny);
	// ausgefahrene, dunklere Mitte
	dirt *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 1.0, td)) * (0.6 + 0.4 * n_small);
	col = mix(col, dirt, trail);

	ALBEDO = col;
	ROUGHNESS = mix(0.95, 0.85, trail);
	SPECULAR = 0.25;
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);
}
