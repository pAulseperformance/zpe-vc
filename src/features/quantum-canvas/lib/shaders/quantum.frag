// ═══════════════════════════════════════════════════════════
// ZPE — "The Cosmic Assembly Line" Fragment Shader v2
// Refined from Stitch visual references
// 4-state scroll-morphing: Jitter → Waves → Forge → Awakening
// ═══════════════════════════════════════════════════════════

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uProgress;    // 0.0 → 1.0 scroll progress
uniform vec2  uResolution;

// ─── Palette ───
const vec3 VOID      = vec3(0.020, 0.020, 0.027);
const vec3 PURPLE    = vec3(0.260, 0.080, 0.420);
const vec3 DEEP_PURP = vec3(0.120, 0.030, 0.200);
const vec3 BLUE      = vec3(0.080, 0.080, 0.220);
const vec3 WHITE     = vec3(0.878, 0.906, 1.000);

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

// FBM — multi-octave turbulence
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

// ═══════════════════════════════════════════════════════════
// STATE 1: Quantum Jitter — dark, ethereal boiling quantum vacuum
// Zero-point energy: restless churning foam of virtual particles
// ═══════════════════════════════════════════════════════════
vec3 quantumJitter(vec2 uv, float t) {
  vec2 c = uv - 0.5;
  float dist = length(c);

  // ── Domain-warped FBM: the "boiling soup" ──
  // Feed noise into noise for organic, churning turbulence
  float slow = t * 0.06;
  float mid  = t * 0.12;

  // First warp layer — large-scale flow direction
  vec2 warp1 = vec2(
    fbm(uv * 3.0 + vec2(slow, -slow * 0.7), 4),
    fbm(uv * 3.0 + vec2(-slow * 0.8, slow * 1.1), 4)
  );

  // Second warp — feed first warp back in (creates organic churn)
  vec2 warp2 = vec2(
    fbm(uv * 3.0 + warp1 * 1.5 + vec2(mid * 0.3, mid), 4),
    fbm(uv * 3.0 + warp1 * 1.5 + vec2(-mid, mid * 0.5), 4)
  );

  // Final turbulence field — the boiling texture
  float boil = fbm(uv * 4.0 + warp2 * 1.2, 5);
  boil = boil * 0.5 + 0.5; // Remap to 0..1

  // ── Color the boiling soup ──
  vec3 color = VOID;

  // Deep purple undulation — the primary churning layer
  float purpleIntensity = boil * exp(-dist * dist * 3.5) * 0.22;
  color += DEEP_PURP * purpleIntensity;

  // Brighter purple in the bubble peaks
  float peaks = smoothstep(0.55, 0.75, boil) * exp(-dist * dist * 4.0);
  color += PURPLE * peaks * 0.18;

  // Cosmic blue in the troughs — creates depth between bubbles
  float troughs = smoothstep(0.5, 0.3, boil) * exp(-dist * dist * 5.0);
  color += BLUE * troughs * 0.10;

  // Subtle center glow — the heart of the quantum foam
  color += PURPLE * exp(-dist * dist * 12.0) * 0.08;

  // ── Virtual particle pops — secondary to the churning ──
  // Tiny sparkles that appear at the peaks of turbulence
  float sparkle = snoise(uv * 60.0 + t * 1.8);
  float pop = smoothstep(0.80, 0.84, sparkle) * smoothstep(0.50, 0.60, boil);
  pop *= exp(-dist * dist * 4.0);
  color += WHITE * pop * 0.20;

  // Even tinier purple-white flickers
  float sparkle2 = snoise(uv * 100.0 - t * 2.5);
  float pop2 = smoothstep(0.86, 0.89, sparkle2);
  pop2 *= exp(-dist * dist * 3.5);
  color += mix(PURPLE, WHITE, 0.6) * pop2 * 0.10;

  // ── Faint energy arcs — ephemeral connections ──
  float arc = abs(snoise(uv * 12.0 + warp1 * 2.0 + t * 0.15));
  float arcLine = smoothstep(0.45, 0.48, arc) * (1.0 - smoothstep(0.48, 0.51, arc));
  arcLine *= exp(-dist * dist * 3.0) * 0.06;
  color += WHITE * arcLine;

  return color;
}


// ═══════════════════════════════════════════════════════════
// STATE 2: Transverse Waves — faint thin grid lines
// Reference: very dark, subtle orthogonal grid, center-visible
// ═══════════════════════════════════════════════════════════
vec3 transverseWaves(vec2 uv, float t) {
  vec2 c = uv - 0.5;
  float dist = length(c);

  // Grid lines — very thin, very faint
  float gridFreq = 16.0;
  float lineX = abs(fract(uv.x * gridFreq) - 0.5);
  float lineY = abs(fract(uv.y * gridFreq) - 0.5);

  // Sharp thin lines
  float gridX = 1.0 - smoothstep(0.0, 0.015, lineX);
  float gridY = 1.0 - smoothstep(0.0, 0.015, lineY);
  float grid = max(gridX, gridY);

  // Wave displacement on the grid — subtle undulation
  float waveX = sin(c.y * 20.0 + t * 0.8) * 0.003;
  float waveY = sin(c.x * 20.0 - t * 0.6) * 0.003;
  float lineXw = abs(fract((uv.x + waveX) * gridFreq) - 0.5);
  float lineYw = abs(fract((uv.y + waveY) * gridFreq) - 0.5);
  float gridXw = 1.0 - smoothstep(0.0, 0.015, lineXw);
  float gridYw = 1.0 - smoothstep(0.0, 0.015, lineYw);
  float gridWave = max(gridXw, gridYw);

  // Use wave-displaced grid
  grid = gridWave;

  // Center-weighted visibility — grid fades at edges
  float visibility = exp(-dist * dist * 4.0);
  grid *= visibility;

  // Intersection nodes glow slightly brighter
  float nodeX = 1.0 - smoothstep(0.0, 0.03, lineXw);
  float nodeY = 1.0 - smoothstep(0.0, 0.03, lineYw);
  float nodes = nodeX * nodeY * visibility;

  vec3 color = VOID;
  color += BLUE * grid * 0.25;           // Faint blue grid lines
  color += WHITE * grid * 0.04;          // Slight white highlight
  color += PURPLE * nodes * 0.15;        // Purple at intersections

  // Very subtle background glow
  color += DEEP_PURP * exp(-dist * dist * 10.0) * 0.03;

  return color;
}


// ═══════════════════════════════════════════════════════════
// STATE 3: The Forge — focused white-hot core with purple glow
// Reference: bright white sphere at center, purple radial bloom
// ═══════════════════════════════════════════════════════════
vec3 theForge(vec2 uv, float t) {
  vec2 c = uv - 0.5;
  float dist = length(c);

  // White-hot core — tight, intense
  float coreFlicker = 0.95 + 0.05 * sin(t * 6.0 + snoise(c * 3.0 + t) * 2.0);
  float core = exp(-dist * dist * 200.0) * coreFlicker;

  // Inner glow ring — white bleeding out
  float innerGlow = exp(-dist * dist * 40.0) * 0.8;

  // Purple bloom — wide, soft
  float purpleBloom = exp(-dist * dist * 3.0) * 0.35;

  // Accretion streaks — subtle diagonal light rays
  float angle = atan(c.y, c.x);
  float rays = pow(abs(sin(angle * 3.0 + t * 0.2)), 16.0);
  rays *= exp(-dist * 0.8) * 0.08;

  // Spiral suggestion
  float spiral = sin(angle * 2.0 + dist * 15.0 - t * 1.5);
  float spiralLine = smoothstep(0.8, 1.0, spiral) * exp(-dist * dist * 8.0) * 0.08;

  vec3 color = VOID;

  // Wide purple atmosphere
  color += PURPLE * purpleBloom;
  color += DEEP_PURP * exp(-dist * dist * 2.0) * 0.2;

  // Light rays
  color += mix(PURPLE, WHITE, 0.3) * rays;

  // Spiral bands
  color += BLUE * spiralLine;

  // Inner white glow
  color += WHITE * innerGlow;

  // White-hot center
  color += WHITE * core;

  return color;
}


// ═══════════════════════════════════════════════════════════
// STATE 4: The Awakening — hard-edged geometric shapes, scattered
// Reference: distinct polygons/hexagons drifting against black
// ═══════════════════════════════════════════════════════════

// Signed distance to a regular polygon
float sdPolygon(vec2 p, float r, float n) {
  float a = atan(p.x, p.y) + 3.14159;
  float s = 6.28318 / n;
  return cos(floor(0.5 + a / s) * s - a) * length(p) - r;
}

vec3 theAwakening(vec2 uv, float t) {
  vec2 c = uv - 0.5;
  float dist = length(c);

  vec3 color = VOID;

  // Remnant center glow — faint memory of the forge
  color += DEEP_PURP * exp(-dist * dist * 6.0) * 0.12;

  // Scattered geometric fragments
  // Each fragment: position, size, rotation, polygon sides, drift speed
  for (int i = 0; i < 12; i++) {
    float fi = float(i);

    // Pseudo-random placement in a ring/scatter pattern
    float angle = fi * 0.52 + hash(vec2(fi, 0.0)) * 2.0;
    float radius = 0.15 + hash(vec2(fi, 1.0)) * 0.3;

    // Slow outward drift
    float drift = t * (0.005 + hash(vec2(fi, 2.0)) * 0.008);
    radius += drift;

    // Wrap radius to keep fragments on screen
    radius = mod(radius, 0.55);

    vec2 center = vec2(cos(angle), sin(angle)) * radius;

    // Slow rotation per fragment
    float rot = t * (0.1 + hash(vec2(fi, 3.0)) * 0.2);

    vec2 local = c - center;
    // Rotate
    float cs = cos(rot), sn = sin(rot);
    local = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);

    // Fragment size — small
    float size = 0.015 + hash(vec2(fi, 4.0)) * 0.025;

    // Polygon type: 3 (triangle), 4 (square), 5 (pentagon), 6 (hexagon)
    float sides = 3.0 + floor(hash(vec2(fi, 5.0)) * 4.0);

    float d = sdPolygon(local, size, sides);

    // Hard edge
    float shape = 1.0 - smoothstep(-0.002, 0.002, d);

    // Edge outline glow
    float edge = 1.0 - smoothstep(0.0, 0.008, abs(d));

    // Color varies per fragment
    vec3 fragColor = mix(BLUE, PURPLE, hash(vec2(fi, 6.0)));

    // Subtle inner fill
    color += fragColor * shape * 0.12;

    // Brighter edge wireframe
    color += mix(BLUE, WHITE, 0.3) * edge * 0.2;
  }

  return color;
}


// ═══════════════════════════════════════════════════════════
// Main — smooth cross-fade between states
// ═══════════════════════════════════════════════════════════
void main() {
  // Aspect-correct UV
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = vUv;
  uv.x *= aspect;
  uv.x -= (aspect - 1.0) * 0.5;

  float t = uTime;
  float p = clamp(uProgress, 0.0, 1.0);

  // State blending with overlap zones
  float s1 = 1.0 - smoothstep(0.20, 0.38, p);
  float s2 = smoothstep(0.20, 0.38, p) * (1.0 - smoothstep(0.50, 0.68, p));
  float s3 = smoothstep(0.50, 0.68, p) * (1.0 - smoothstep(0.80, 0.95, p));
  float s4 = smoothstep(0.80, 0.95, p);

  vec3 color = vec3(0.0);
  color += quantumJitter(uv, t) * s1;
  color += transverseWaves(uv, t) * s2;
  color += theForge(uv, t) * s3;
  color += theAwakening(uv, t) * s4;

  // Ensure deep blacks
  color = max(color, VOID * 0.5);

  gl_FragColor = vec4(color, 1.0);
}
