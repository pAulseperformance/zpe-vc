// ═══════════════════════════════════════════════════════════
// ZPE — "The Interactive Sandbox" Fragment Shader
// Mouse/touch-reactive: Idle → Hover → Press → Release
// ═══════════════════════════════════════════════════════════

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;          // Normalized mouse pos (0..1, aspect-corrected)
uniform float uHoverStrength;  // 0→1 smoothly interpolated hover intensity
uniform float uPressStrength;  // 0→1 smoothly interpolated press intensity
uniform float uReleaseAnim;    // 0→1 release shatter animation progress
uniform vec2  uReleaseOrigin;  // Where the press was released

// ─── Palette ───
const vec3 VOID      = vec3(0.0);
const vec3 PURPLE    = vec3(0.260, 0.080, 0.420);
const vec3 DEEP_PURP = vec3(0.120, 0.030, 0.200);
const vec3 BLUE      = vec3(0.080, 0.080, 0.220);
const vec3 WHITE     = vec3(0.878, 0.906, 1.000);
const vec3 FORGE_HOT = vec3(0.95, 0.55, 0.25);

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

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amp * snoise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return value;
}

// Signed distance to regular polygon
float sdPolygon(vec2 p, float r, float n) {
  float a = atan(p.x, p.y) + 3.14159;
  float s = 6.28318 / n;
  return cos(floor(0.5 + a / s) * s - a) * length(p) - r;
}


// ═══════════════════════════════════════════════════════════
// IDLE: Boiling quantum jitter — domain-warped FBM foam
// ═══════════════════════════════════════════════════════════
vec3 idleJitter(vec2 uv, float t) {
  vec2 c = uv - 0.5;
  float dist = length(c);

  float slow = t * 0.06;
  float mid  = t * 0.12;

  vec2 warp1 = vec2(
    fbm(uv * 3.0 + vec2(slow, -slow * 0.7), 4),
    fbm(uv * 3.0 + vec2(-slow * 0.8, slow * 1.1), 4)
  );
  vec2 warp2 = vec2(
    fbm(uv * 3.0 + warp1 * 1.5 + vec2(mid * 0.3, mid), 4),
    fbm(uv * 3.0 + warp1 * 1.5 + vec2(-mid, mid * 0.5), 4)
  );

  float boil = fbm(uv * 4.0 + warp2 * 1.2, 5) * 0.5 + 0.5;

  vec3 color = VOID;
  color += DEEP_PURP * boil * exp(-dist * dist * 3.5) * 0.22;
  color += PURPLE * smoothstep(0.55, 0.75, boil) * exp(-dist * dist * 4.0) * 0.18;
  color += BLUE * smoothstep(0.5, 0.3, boil) * exp(-dist * dist * 5.0) * 0.10;
  color += PURPLE * exp(-dist * dist * 12.0) * 0.08;

  // Particle pops
  float pop = smoothstep(0.80, 0.84, snoise(uv * 60.0 + t * 1.8))
            * smoothstep(0.50, 0.60, boil)
            * exp(-dist * dist * 4.0);
  color += WHITE * pop * 0.25;

  float pop2 = smoothstep(0.86, 0.89, snoise(uv * 100.0 - t * 2.5))
             * exp(-dist * dist * 3.5);
  color += mix(PURPLE, WHITE, 0.6) * pop2 * 0.12;

  return color;
}


// ═══════════════════════════════════════════════════════════
// HOVER: Magnetic field — noise ALIGNS into directional waves
// near the cursor position
// ═══════════════════════════════════════════════════════════
vec3 hoverField(vec2 uv, float t, vec2 mouse) {
  vec2 toMouse = uv - mouse;
  float mouseDist = length(toMouse);
  vec2 mouseDir = normalize(toMouse + 0.001);

  // Influence radius — affects noise direction within this range
  float influence = exp(-mouseDist * mouseDist * 8.0);

  // Directional waves aligned to mouse vector
  float wavePhase = dot(uv - mouse, mouseDir) * 30.0 + t * 2.0;
  float wave = sin(wavePhase) * 0.5 + 0.5;

  // Perpendicular cross-waves for the grid feel
  vec2 perpDir = vec2(-mouseDir.y, mouseDir.x);
  float crossPhase = dot(uv - mouse, perpDir) * 30.0 - t * 1.5;
  float crossWave = sin(crossPhase) * 0.5 + 0.5;

  // Combined grid interference
  float gridPattern = wave * 0.7 + crossWave * 0.3;
  float gridLines = smoothstep(0.45, 0.5, gridPattern);

  vec3 color = VOID;

  // Aligned wave field — blue/white near cursor
  color += BLUE * gridLines * influence * 0.4;
  color += WHITE * smoothstep(0.6, 0.65, gridPattern) * influence * 0.15;

  // Bright point at cursor
  color += PURPLE * exp(-mouseDist * mouseDist * 60.0) * 0.3;

  // Faint connective nodes
  float nodes = smoothstep(0.55, 0.6, wave) * smoothstep(0.55, 0.6, crossWave);
  color += PURPLE * nodes * influence * 0.25;

  return color;
}


// ═══════════════════════════════════════════════════════════
// PRESS: Extreme gravity — particles pulled to cursor
// ═══════════════════════════════════════════════════════════
vec3 pressGravity(vec2 uv, float t, vec2 mouse) {
  vec2 toMouse = uv - mouse;
  float mouseDist = length(toMouse);
  float angle = atan(toMouse.y, toMouse.x);

  // White-hot core at cursor position
  float core = exp(-mouseDist * mouseDist * 300.0);
  float innerGlow = exp(-mouseDist * mouseDist * 50.0);
  float coreFlicker = 0.95 + 0.05 * sin(t * 8.0 + snoise(toMouse * 5.0) * 3.0);

  // Spiral accretion bands pulling into cursor
  float spiral = sin(angle * 4.0 + mouseDist * 25.0 - t * 3.0);
  float spiralBand = smoothstep(0.6, 0.9, spiral) * exp(-mouseDist * mouseDist * 6.0);

  // Radial streaks — matter falling in
  float streaks = pow(abs(sin(angle * 6.0 + t * 0.3)), 12.0);
  streaks *= exp(-mouseDist * 1.5) * 0.12;

  // Purple bloom
  float bloom = exp(-mouseDist * mouseDist * 2.5);

  vec3 color = VOID;

  // Purple atmosphere
  color += PURPLE * bloom * 0.4;
  color += DEEP_PURP * exp(-mouseDist * mouseDist * 1.5) * 0.25;

  // Spiral bands
  color += BLUE * spiralBand * 0.35;

  // Radial streaks
  color += mix(PURPLE, WHITE, 0.3) * streaks;

  // Inner glow
  color += WHITE * innerGlow * 0.7 * coreFlicker;

  // White-hot center
  color += WHITE * core * coreFlicker;

  // Tiny hot particles being pulled in
  float inflowNoise = snoise(vec2(angle * 5.0, mouseDist * 20.0 - t * 5.0));
  float inflowParticles = smoothstep(0.7, 0.8, inflowNoise) * exp(-mouseDist * 3.0);
  color += WHITE * inflowParticles * 0.2;

  return color;
}


// ═══════════════════════════════════════════════════════════
// RELEASE: Core shatters — geometric shapes scatter outward
// ═══════════════════════════════════════════════════════════
vec3 releaseShatter(vec2 uv, float t, vec2 origin, float anim) {
  vec2 c = uv - origin;
  float dist = length(c);

  vec3 color = VOID;

  // Fading remnant glow at release point
  float remnant = exp(-dist * dist * 20.0) * (1.0 - anim) * 0.5;
  color += mix(FORGE_HOT, PURPLE, anim) * remnant;

  // Expanding shockwave ring
  float ringRadius = anim * 0.6;
  float ring = 1.0 - smoothstep(0.0, 0.015, abs(dist - ringRadius));
  ring *= (1.0 - anim * 0.8); // Fades as it expands
  color += WHITE * ring * 0.3;

  // Scattered geometric fragments
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float angle = fi * 0.628 + hash(vec2(fi, 7.0)) * 1.5;
    float speed = 0.2 + hash(vec2(fi, 8.0)) * 0.4;

    // Fragments fly outward from release origin
    float fragRadius = anim * speed;
    vec2 fragPos = origin + vec2(cos(angle), sin(angle)) * fragRadius;

    vec2 local = uv - fragPos;

    // Rotation
    float rot = t * 0.3 + fi * 0.5 + anim * 3.0;
    float cs = cos(rot), sn = sin(rot);
    local = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);

    float size = 0.012 + hash(vec2(fi, 9.0)) * 0.018;
    // Scale down as they fly — shrink with distance
    size *= 1.0 - anim * 0.5;

    float sides = 3.0 + floor(hash(vec2(fi, 10.0)) * 4.0);
    float d = sdPolygon(local, size, sides);

    float shape = 1.0 - smoothstep(-0.001, 0.001, d);
    float edge = 1.0 - smoothstep(0.0, 0.006, abs(d));

    // Fade out over animation duration
    float fragAlpha = 1.0 - anim * 0.7;

    vec3 fragColor = mix(BLUE, PURPLE, hash(vec2(fi, 11.0)));
    color += fragColor * shape * 0.15 * fragAlpha;
    color += mix(BLUE, WHITE, 0.4) * edge * 0.25 * fragAlpha;
  }

  return color;
}


// ═══════════════════════════════════════════════════════════
// Main — blend states based on interaction uniforms
// ═══════════════════════════════════════════════════════════
void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = vUv;
  uv.x *= aspect;
  uv.x -= (aspect - 1.0) * 0.5;

  // Aspect-correct mouse position
  vec2 mouse = uMouse;
  mouse.x *= aspect;
  mouse.x -= (aspect - 1.0) * 0.5;

  float t = uTime;

  // ── Layer the interaction states ──
  vec3 color = vec3(0.0);

  // Base: always-present idle jitter (fades down during press)
  float idleAmount = 1.0 - uPressStrength * 0.7;
  color += idleJitter(uv, t) * idleAmount;

  // Hover: magnetic alignment near cursor
  color += hoverField(uv, t, mouse) * uHoverStrength * (1.0 - uPressStrength);

  // Press: gravity collapse at cursor
  color += pressGravity(uv, t, mouse) * uPressStrength;

  // Release: shatter animation (overlays everything)
  if (uReleaseAnim > 0.01) {
    vec2 releasePos = uReleaseOrigin;
    releasePos.x *= aspect;
    releasePos.x -= (aspect - 1.0) * 0.5;
    color += releaseShatter(uv, t, releasePos, uReleaseAnim);
  }

  // ── Heavy radial vignette — edges pure black ──
  float vDist = length(vUv - 0.5) * 1.4;
  float vignette = 1.0 - pow(vDist, 1.8);
  color *= clamp(vignette, 0.0, 1.0);

  color = max(color, vec3(0.0));
  gl_FragColor = vec4(color, 1.0);
}
