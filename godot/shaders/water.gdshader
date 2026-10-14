shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_disabled, specular_schlick_ggx;

// Era water: shallow colour near the shore, deeper colour in open water, animated ripples,
// fresnel sky reflection. Depth comes from the scene depth buffer so shorelines fade softly.
uniform vec3 water_color : source_color = vec3(0.2, 0.4, 0.67);
uniform vec3 deep_color : source_color = vec3(0.1, 0.22, 0.37);
uniform float opacity = 0.86;
uniform float wave_scale = 0.06;
uniform float wave_strength = 0.35;
uniform sampler2D depth_tex : hint_depth_texture, filter_linear;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;

varying vec3 world_pos;

vec2 hash22(vec2 p) {
	p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
	return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}

float gnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(dot(hash22(i), f), dot(hash22(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
	           mix(dot(hash22(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash22(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}

float waves(vec2 p, float t) {
	float h = gnoise(p + vec2(t * 0.35, t * 0.2)) * 0.6;
	h += gnoise(p * 2.3 - vec2(t * 0.5, -t * 0.3)) * 0.3;
	h += gnoise(p * 5.1 + vec2(-t * 0.8, t * 0.6)) * 0.12;
	return h;
}

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float t = TIME;
	vec2 p = world_pos.xz * wave_scale;
	float e = 0.08;
	float h = waves(p, t);
	float hx = waves(p + vec2(e, 0.0), t);
	float hz = waves(p + vec2(0.0, e), t);
	vec3 n_world = normalize(vec3(-(hx - h) / e * wave_strength, 1.0, -(hz - h) / e * wave_strength));
	NORMAL = normalize((VIEW_MATRIX * vec4(n_world, 0.0)).xyz);

	// water column thickness from the depth buffer
	float d = texture(depth_tex, SCREEN_UV).r;
	vec4 ndc = vec4(SCREEN_UV * 2.0 - 1.0, d, 1.0);
	vec4 vpos = INV_PROJECTION_MATRIX * ndc;
	vpos.xyz /= vpos.w;
	float thickness = clamp(-vpos.z - (-VERTEX.z), 0.0, 60.0);
	float deep = smoothstep(0.0, 9.0, thickness);

	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 4.0);
	vec3 col = mix(water_color, deep_color, deep);
	// a touch of refraction: distort what is beneath the surface near the shore
	vec3 under = textureLod(screen_tex, SCREEN_UV + n_world.xz * 0.012, 0.0).rgb;
	col = mix(under * water_color * 1.4, col, clamp(deep * 1.4 + 0.35, 0.0, 1.0));
	ALBEDO = col;
	ROUGHNESS = 0.06;
	METALLIC = 0.0;
	SPECULAR = 0.6;
	ALPHA = clamp(mix(opacity, 1.0, max(deep * 0.6, fres)) * smoothstep(0.0, 0.35, thickness), 0.0, 1.0);
}
