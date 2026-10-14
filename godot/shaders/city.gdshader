// One material for the whole city: vertex colour x an atlas tile chosen per vertex (UV2.x), with
// per-tile normal relief and roughness. Faces wrap their UV inside the tile, so every chunk is one draw call.
shader_type spatial;
render_mode cull_back, diffuse_burley, specular_schlick_ggx;

uniform sampler2D atlas : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
uniform sampler2D atlas_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_disable;
uniform float relief = 1.0;
/// pushes the surface back in depth (terrain) so ground overlays always win
uniform float depth_bias = 0.0;

const float TILES = 4.0;
const float ROUGH[16] = float[16](0.92, 0.88, 0.84, 0.78, 0.7, 0.96, 0.55, 0.74, 0.9, 0.98, 0.95, 0.99, 0.78, 0.95, 0.82, 0.86);

varying float v_tile;

void vertex() {
	v_tile = UV2.x;
	// nudge away from the camera by a tiny fraction of the distance (about 1 cm at 10 m for terrain).
	// POSITION must be written unconditionally: Godot zeroes it for draws that skip the write.
	vec4 vp = MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	vp.xyz *= 1.0 + depth_bias * 0.001;
	POSITION = PROJECTION_MATRIX * vp;
}

void fragment() {
	float t = floor(v_tile + 0.5);
	vec2 origin = vec2(mod(t, TILES), floor(t / TILES)) / TILES;
	// half-texel inset keeps bilinear filtering inside the tile
	vec2 inner = fract(UV) * (1.0 - 2.0 / 256.0) + 1.0 / 256.0;
	vec2 tuv = origin + inner / TILES;
	vec2 gx = dFdx(UV) / TILES;
	vec2 gy = dFdy(UV) / TILES;
	vec3 tex = textureGrad(atlas, tuv, gx, gy).rgb;
	// palette colours are authored as sRGB hex values
	vec3 vc = mix(COLOR.rgb / 12.92, pow((COLOR.rgb + 0.055) / 1.055, vec3(2.4)), step(0.04045, COLOR.rgb));
	ALBEDO = vc * tex;
	int ti = int(clamp(t, 0.0, 15.0));
	ROUGHNESS = ROUGH[ti];
	SPECULAR = 0.35;
	// normal relief: cotangent frame from screen-space derivatives (the meshes carry no tangents)
	vec3 nm = textureGrad(atlas_normal, tuv, gx, gy).rgb * 2.0 - 1.0;
	nm.xy *= relief;
	vec3 dp1 = dFdx(VERTEX);
	vec3 dp2 = dFdy(VERTEX);
	vec2 duv1 = dFdx(UV);
	vec2 duv2 = dFdy(UV);
	vec3 n = normalize(NORMAL);
	vec3 dp2perp = cross(dp2, n);
	vec3 dp1perp = cross(n, dp1);
	vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
	vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
	float invmax = inversesqrt(max(dot(T, T), dot(B, B)) + 1e-12);
	vec3 bent = normalize(T * invmax * nm.x - B * invmax * nm.y + n * max(nm.z, 0.2));
	NORMAL = bent;
}
