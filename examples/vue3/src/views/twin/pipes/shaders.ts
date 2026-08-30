/**
 * 可复用 GLSL 片段（管廊特效用）。
 */

/** 3D 简易 hash 噪声（比 Perlin 便宜，够做流动扰动） */
export const GLSL_NOISE = /* glsl */ `
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise2(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), u.x),
             mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), u.x), u.y);
}
float fbm2(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){ v += a * noise2(p); p *= 2.02; a *= 0.5; }
  return v;
}
`;

/** 菲涅尔边缘光 */
export const GLSL_FRESNEL = /* glsl */ `
float fresnel(vec3 normalW, vec3 viewDirW, float power){
  return pow(1.0 - clamp(dot(normalize(normalW), normalize(viewDirW)), 0.0, 1.0), power);
}
`;
