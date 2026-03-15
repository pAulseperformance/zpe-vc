// ═══════════════════════════════════════════════════════════
// ZPE — "The Interactive Sandbox" Fragment Shader v3
// ULTRA-MINIMAL: 90% pure black, microscopic cosmic dust
// ═══════════════════════════════════════════════════════════

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;
uniform float uHoverStrength;
uniform float uPressStrength;
uniform float uReleaseAnim;
uniform vec2  uReleaseOrigin;

// ─── Palette (extremely muted) ───
const vec3 BLACK     = vec3(0.0);
const vec3 PURPLE    = vec3(0.35, 0.12, 0.55);  // Electric purple — used at <5% opacity
const vec3 WHITE     = vec3(0.88, 0.91, 1.00);   // Cold white — particle pops only
const vec3 BLUE      = vec3(0.15, 0.15, 0.35);   // Faint cosmic blue

// ─── Noise ───
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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// Signed distance to regular polygon
float sdPolygon(vec2 p, float r, float n) {
  float a = atan(p.x, p.y) + 3.14159;
  float s = 6.28318 / n;
  return cos(floor(0.5 + a / s) * s - a) * length(p) - r;
}


// ═══════════════════════════════════════════════════════════
// IDLE: Vast, microscopic cosmic dust — barely visible
// 90% pure black. Faint points flicker in/out like stars
// ═══════════════════════════════════════════════════════════
vec3 idleJitter(vec2 uv, float t) {
  vec3 color = BLACK;

  // Layer 1: Microscopic white dust — high frequency
  float dust1 = snoise(uv * 350.0 + t * 0.5);
  float sparks = smoothstep(0.78, 0.85, dust1) * 0.07;
  color += WHITE * sparks;

  // Layer 2: Even finer purple-tinted dust
  float dust2 = snoise(uv * 500.0 + t * 0.7 + 100.0);
  float purpleSparks = smoothstep(0.82, 0.88, dust2) * 0.035;
  color += PURPLE * purpleSparks;

  // Layer 3: Microscopic depth variation (NOT haze blobs)
  // High freq so it reads as dense star field, not camouflage
  float field = snoise(uv * 600.0 - t * 0.3 + 50.0);
  float fieldSparks = smoothstep(0.84, 0.90, field) * 0.025;
  color += mix(PURPLE, WHITE, 0.4) * fieldSparks;

  // Layer 4: Rare bright virtual particle pops
  float pop = snoise(uv * 250.0 + t * 2.2);
  float brightPop = smoothstep(0.90, 0.94, pop) * 0.18;
  color += WHITE * brightPop;

  return color;
}


// ═══════════════════════════════════════════════════════════
// HOVER: Dust subtly aligns near cursor — like iron filings
// near a magnet. No hard shapes. Just directional bias.
// ═══════════════════════════════════════════════════════════
vec3 hoverField(vec2 uv, float t, vec2 mouse) {
  vec3 color = BLACK;

  vec2 toMouse = uv - mouse;
  float mouseDist = length(toMouse);

  // Influence falloff — how close to cursor
  float influence = exp(-mouseDist * mouseDist * 12.0);

  // ── PARALLEL TRANSVERSE WAVES — NOT RADIAL ──
  // Fixed wave direction that slowly rotates with time
  float waveAngle = t * 0.15;
  vec2 waveDir = vec2(cos(waveAngle), sin(waveAngle));
  vec2 perpDir = vec2(-waveDir.y, waveDir.x);

  // Project UV onto wave direction — creates PARALLEL lines
  float para = dot(uv, waveDir);
  float perp = dot(uv, perpDir);

  // Primary parallel wave — clean sine, NOT radial
  float wave1 = sin(para * 50.0 + t * 2.0) * 0.5 + 0.5;
  float waveLine = smoothstep(0.7, 0.8, wave1) * influence * 0.07;
  color += WHITE * waveLine;

  // Secondary perpendicular wave — creates grid-like interference
  float wave2 = sin(perp * 50.0 - t * 1.5) * 0.5 + 0.5;
  float crossLine = smoothstep(0.75, 0.85, wave2) * influence * 0.04;
  color += BLUE * crossLine;

  // Microscopic aligned dust within the influence zone
  float alignedDust = snoise(vec2(para * 200.0, perp * 400.0) + t);
  float dustSparks = smoothstep(0.75, 0.85, alignedDust) * influence * 0.05;
  color += mix(PURPLE, WHITE, 0.6) * dustSparks;

  return color;
}


// ═══════════════════════════════════════════════════════════
// PRESS: Particles pulled toward cursor — gravity well
// Dense concentration at cursor, sparse elsewhere
// ═══════════════════════════════════════════════════════════
vec3 pressGravity(vec2 uv, float t, vec2 mouse) {
  vec3 color = BLACK;

  vec2 toMouse = uv - mouse;
  float mouseDist = length(toMouse);
  float angle = atan(toMouse.y, toMouse.x);

  // Tight white-hot pinpoint at cursor — very small
  float core = exp(-mouseDist * mouseDist * 500.0) * 0.9;
  color += WHITE * core;

  // Tiny inner glow
  float glow = exp(-mouseDist * mouseDist * 80.0) * 0.15;
  color += mix(PURPLE, WHITE, 0.7) * glow;

  // Particles spiraling inward — microscopic and sparse
  float spiralPhase = angle * 3.0 + mouseDist * 40.0 - t * 4.0;
  float spiral = snoise(vec2(spiralPhase, mouseDist * 60.0));
  float spiralParticles = smoothstep(0.75, 0.85, spiral)
                        * exp(-mouseDist * 4.0)
                        * 0.12;
  color += WHITE * spiralParticles;

  // Faint inflow streaks — particles falling in
  float inflowPhase = angle * 5.0;
  float inflow = pow(abs(sin(inflowPhase + t * 0.2)), 20.0);
  inflow *= exp(-mouseDist * 2.5) * 0.04;
  color += mix(PURPLE, WHITE, 0.5) * inflow;

  return color;
}


// ═══════════════════════════════════════════════════════════
// RELEASE: Core disperses — faint geometric fragments drift
// ═══════════════════════════════════════════════════════════
vec3 releaseShatter(vec2 uv, float t, vec2 origin, float anim) {
  vec3 color = BLACK;

  vec2 c = uv - origin;
  float dist = length(c);

  // Fading pinpoint remnant
  float remnant = exp(-dist * dist * 100.0) * (1.0 - anim) * 0.3;
  color += WHITE * remnant;

  // Expanding faint ring — barely visible
  float ringRadius = anim * 0.5;
  float ring = 1.0 - smoothstep(0.0, 0.008, abs(dist - ringRadius));
  ring *= (1.0 - anim) * 0.08;
  color += WHITE * ring;

  // Sparse geometric fragments — small, faint wireframes
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float angle = fi * 0.785 + hash(vec2(fi, 7.0)) * 1.5;
    float speed = 0.15 + hash(vec2(fi, 8.0)) * 0.35;
    float fragRadius = anim * speed;

    vec2 fragPos = origin + vec2(cos(angle), sin(angle)) * fragRadius;
    vec2 local = uv - fragPos;

    float rot = t * 0.2 + fi * 0.5 + anim * 2.0;
    float cs = cos(rot), sn = sin(rot);
    local = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);

    float size = 0.008 + hash(vec2(fi, 9.0)) * 0.012;
    size *= 1.0 - anim * 0.6;

    float sides = 3.0 + floor(hash(vec2(fi, 10.0)) * 4.0);
    float d = sdPolygon(local, size, sides);

    // Wireframe only — no fill
    float edge = 1.0 - smoothstep(0.0, 0.003, abs(d));
    float fragAlpha = (1.0 - anim * 0.8);

    color += mix(BLUE, PURPLE, hash(vec2(fi, 11.0))) * edge * 0.10 * fragAlpha;
  }

  return color;
}


// ═══════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════
void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = vUv;
  uv.x *= aspect;
  uv.x -= (aspect - 1.0) * 0.5;

  vec2 mouse = uMouse;
  mouse.x *= aspect;
  mouse.x -= (aspect - 1.0) * 0.5;

  float t = uTime;

  // ── All states are additive on BLACK ──
  vec3 color = BLACK;

  // Idle jitter — always present, fades slightly during press
  color += idleJitter(uv, t) * (1.0 - uPressStrength * 0.5);

  // Hover field — additive near cursor
  color += hoverField(uv, t, mouse) * uHoverStrength * (1.0 - uPressStrength);

  // Press gravity — additive at cursor
  color += pressGravity(uv, t, mouse) * uPressStrength;

  // Release shatter
  if (uReleaseAnim > 0.01) {
    vec2 releasePos = uReleaseOrigin;
    releasePos.x *= aspect;
    releasePos.x -= (aspect - 1.0) * 0.5;
    color += releaseShatter(uv, t, releasePos, uReleaseAnim);
  }

  // ── Heavy vignette — edges absolutely black ──
  float vDist = length(vUv - 0.5) * 1.6;
  float vignette = 1.0 - pow(vDist, 1.5);
  color *= clamp(vignette, 0.0, 1.0);

  // ── Center darkening for text legibility ──
  // Subtle darkzone in the center where text sits
  float centerDist = length(vUv - vec2(0.5, 0.5));
  float textZone = smoothstep(0.0, 0.25, centerDist);
  color *= mix(0.3, 1.0, textZone);

  color = max(color, BLACK);
  gl_FragColor = vec4(color, 1.0);
}
