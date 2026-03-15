// ═══════════════════════════════════════════════════════════
// ZPE — "Exciting the Vacuum" Fragment Shader
// Single u_energy uniform drives everything:
//   speed, brightness, UV warp near cursor
// ═══════════════════════════════════════════════════════════

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;       // Normalized 0..1 mouse position
uniform float uEnergy;      // 0..100+ accumulated energy
uniform float uRipFlash;    // 0..1 white flash on threshold rip

// ─── Palette ───
const vec3 BLACK  = vec3(0.0);
const vec3 PURPLE = vec3(0.35, 0.12, 0.55);
const vec3 WHITE  = vec3(0.88, 0.91, 1.00);

// ─── Simplex Noise ───
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m * m * m * m;
  vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x_) - 0.5;
  vec3 ox = floor(x_ + 0.5);
  vec3 a0 = x_ - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}


void main() {
  // Aspect-correct UV
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = vUv;
  uv.x *= aspect;
  uv.x -= (aspect - 1.0) * 0.5;

  // Aspect-correct mouse
  vec2 mouse = uMouse;
  mouse.x *= aspect;
  mouse.x -= (aspect - 1.0) * 0.5;

  float t = uTime;

  // ── Energy-derived values (0..100 range) ──
  float e = clamp(uEnergy, 0.0, 120.0);
  float eNorm = e / 100.0;                    // 0..1 normalized
  float speedMult = 1.0 + eNorm * 8.0;        // Time speed: 1x → 9x
  float brightMult = 1.0 + eNorm * 4.0;       // Brightness: 1x → 5x
  float warpStrength = eNorm * 0.08;           // UV warp: 0 → 0.08

  // ── UV warp near cursor (spoon through water) ──
  vec2 toMouse = uv - mouse;
  float mouseDist = length(toMouse);
  float warpFalloff = exp(-mouseDist * mouseDist * 10.0);

  // Turbulent warp — noise-based displacement near cursor
  vec2 warpOffset = vec2(
    snoise(uv * 15.0 + t * speedMult * 0.3),
    snoise(uv * 15.0 + t * speedMult * 0.3 + 50.0)
  );
  vec2 warpedUV = uv + warpOffset * warpStrength * warpFalloff;

  // ── Quantum dust (use warped UVs) ──
  vec3 color = BLACK;

  // Layer 1: Fine white dust — speed increases with energy
  float dust1 = snoise(warpedUV * 350.0 + t * speedMult * 0.5);
  float sparks1 = smoothstep(0.78, 0.85, dust1) * 0.07 * brightMult;
  color += WHITE * sparks1;

  // Layer 2: Purple micro-dust
  float dust2 = snoise(warpedUV * 500.0 + t * speedMult * 0.7 + 100.0);
  float sparks2 = smoothstep(0.82, 0.88, dust2) * 0.035 * brightMult;
  color += PURPLE * sparks2;

  // Layer 3: Dense star field
  float dust3 = snoise(warpedUV * 600.0 - t * speedMult * 0.3 + 50.0);
  float sparks3 = smoothstep(0.84, 0.90, dust3) * 0.025 * brightMult;
  color += mix(PURPLE, WHITE, 0.4) * sparks3;

  // Layer 4: Rare bright pops — more frequent at high energy
  float popThreshold = mix(0.90, 0.75, eNorm); // Easier to trigger
  float pop = snoise(warpedUV * 250.0 + t * speedMult * 2.2);
  float brightPop = smoothstep(popThreshold, popThreshold + 0.04, pop) * 0.18 * brightMult;
  color += WHITE * brightPop;

  // ── Cursor glow — brighter with energy ──
  float cursorGlow = exp(-mouseDist * mouseDist * 60.0) * eNorm * 0.15;
  color += mix(PURPLE, WHITE, eNorm * 0.8) * cursorGlow;

  // ── Click burst halo — visible at high energy ──
  float burstGlow = exp(-mouseDist * mouseDist * 20.0) * max(eNorm - 0.3, 0.0) * 0.1;
  color += WHITE * burstGlow;

  // ── Heavy vignette ──
  float vDist = length(vUv - 0.5) * 1.6;
  float vignette = 1.0 - pow(vDist, 1.5);
  color *= clamp(vignette, 0.0, 1.0);

  // ── Center darkening for text ──
  float centerDist = length(vUv - vec2(0.5, 0.5));
  float textZone = smoothstep(0.0, 0.25, centerDist);
  color *= mix(0.3, 1.0, textZone);

  // ── Rip flash (white screen slam) ──
  color = mix(color, WHITE, uRipFlash);

  color = max(color, BLACK);
  gl_FragColor = vec4(color, 1.0);
}
