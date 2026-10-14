shader_type sky;
render_mode use_half_res_pass;

// Era sky: zenith to horizon gradient (as on the web), a soft sun disc with a halo,
// and slowly drifting procedural clouds for depth.
uniform vec3 zenith : source_color = vec3(0.35, 0.55, 0.85);
uniform vec3 horizon : source_color = vec3(0.75, 0.82, 0.9);
uniform vec3 below : source_color = vec3(0.6, 0.62, 0.6);
uniform vec3 sun_color : source_color = vec3(1.0, 0.95, 0.85);
uniform float cloud_cover = 0.45;
uniform float energy = 1.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
	float v = 0.0, a = 0.5;
	for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
	return v;
}

void sky() {
	vec3 d = EYEDIR;
	float y = d.y;
	vec3 col;
	if (y >= 0.0) col = mix(horizon, zenith, pow(y, 0.55));
	else col = mix(horizon, below, min(1.0, -y * 4.0));

	if (!AT_CUBEMAP_PASS || true) {
		// clouds on a flat layer above the city
		if (y > 0.01) {
			vec2 uv = d.xz / (y + 0.08) * 1.6 + vec2(TIME * 0.006, TIME * 0.002);
			float c = fbm(uv);
			float cov = smoothstep(1.0 - cloud_cover, 1.0 - cloud_cover + 0.35, c);
			float fade = smoothstep(0.01, 0.25, y);
			vec3 cloud = mix(horizon * 1.05, vec3(1.0), 0.6) * (0.85 + 0.25 * fbm(uv * 2.0 + 5.0));
			col = mix(col, cloud, cov * fade * 0.8);
		}
	}

	// sun disc and halo from the first directional light
	if (LIGHT0_ENABLED) {
		float s = max(dot(d, LIGHT0_DIRECTION), 0.0);
		col += sun_color * (pow(s, 900.0) * 6.0 + pow(s, 24.0) * 0.25);
	}
	COLOR = col * energy;
}
