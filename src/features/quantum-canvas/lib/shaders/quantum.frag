// ═══════════════════════════════════════════════════════════
// ZPE — "The Cosmic Assembly Line" Fragment Shader
// 4-state scroll-morphing: Jitter → Waves → Forge → Awakening
// ═══════════════════════════════════════════════════════════

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform float uProgress;    // 0.0 → 1.0 scroll progress
uniform vec2  uResolution;

// ─── Constants ───
const vec3 VOID_BLACK    = vec3(0.020, 0.020, 0.027);
const vec3 COSMIC_BLUE   = vec3(0.102, 0.102, 0.306);
const vec3 ELECTRIC_PURP = vec3(0.420, 0.130, 0.659);
const vec3 COLD_WHITE    = vec3(0.878, 0.906, 1.000);
const vec3 FORGE_ORANGE  = vec3(0.95, 0.45, 0.15);

// ─── Noise Functions ───
// Simplex-like hash
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,   // (3.0 - sqrt(3.0)) / 6.0
    0.366025403784439,   // 0.5 * (sqrt(3.0) - 1.0)
   -0.577350269189626,   // -1.0 + 2.0 * C.x
    0.024390243902439    // 1.0 / 41.0
  );

  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);

  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x_) - 0.5;
  vec3 ox = floor(x_ + 0.5);
  vec3 a0 = x_ - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

// FBM (Fractal Brownian Motion)
float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Hash for pseudo-random
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// ─── Voronoi for Awakening state ───
vec2 voronoi(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);

  float minDist = 8.0;
  float secondDist = 8.0;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash(n + g), hash(n + g + vec2(17.0, 31.0)));
      o = 0.5 + 0.5 * sin(uTime * 0.3 + 6.2831 * o);

      vec2 r = g + o - f;
      float d = dot(r, r);

      if (d < minDist) {
        secondDist = minDist;
        minDist = d;
      } else if (d < secondDist) {
        secondDist = d;
      }
    }
  }
  return vec2(sqrt(minDist), sqrt(secondDist));
}


// ═══════════════════════════════════════════════════════════
// STATE 1: Quantum Jitter (0% — raw vacuum fluctuations)
// ═══════════════════════════════════════════════════════════
vec3 quantumJitter(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float dist = length(centered);

  // Multi-layered noise for quantum fluctuations
  float n1 = fbm(uv * 8.0 + t * 0.15, 5);
  float n2 = snoise(uv * 20.0 + t * 0.4);
  float n3 = snoise(uv * 50.0 - t * 0.8);

  // Flickering particles — appear and vanish
  float particles = smoothstep(0.65, 0.75, abs(n2 + n3 * 0.3));
  particles *= smoothstep(0.6, 0.0, dist); // Denser at center

  // Subtle energy arcs
  float arcs = smoothstep(0.4, 0.5, abs(sin(n1 * 6.283 + t)));
  arcs *= smoothstep(0.5, 0.1, dist) * 0.15;

  // Base color — deep void with slight noise
  vec3 color = VOID_BLACK;

  // Layer cold-white particle pops
  color += COLD_WHITE * particles * 0.5;

  // Electric purple shimmer in the mid-range
  float purpleZone = smoothstep(0.3, 0.1, dist) * smoothstep(0.0, 0.15, dist);
  color += ELECTRIC_PURP * purpleZone * abs(n1) * 0.25;

  // Cosmic blue haze at center
  color += COSMIC_BLUE * smoothstep(0.4, 0.0, dist) * 0.15;

  // Subtle arc highlights
  color += COLD_WHITE * arcs;

  return color;
}


// ═══════════════════════════════════════════════════════════
// STATE 2: Transverse Waves (33% — organized wave patterns)
// ═══════════════════════════════════════════════════════════
vec3 transverseWaves(vec2 uv, float t) {
  vec2 centered = uv - 0.5;

  // Grid of transverse wave patterns — 90° aligned
  float waveX = sin(centered.x * 25.0 + t * 1.5) * cos(centered.y * 3.0 + t * 0.3);
  float waveY = sin(centered.y * 25.0 - t * 1.2) * cos(centered.x * 3.0 - t * 0.4);

  // Combine as interference pattern
  float interference = (waveX + waveY) * 0.5;

  // Grid lines — aligned mathematical structure
  float gridX = smoothstep(0.02, 0.0, abs(fract(uv.x * 12.0) - 0.5) - 0.47);
  float gridY = smoothstep(0.02, 0.0, abs(fract(uv.y * 12.0) - 0.5) - 0.47);
  float grid = max(gridX, gridY) * 0.08;

  // Wave displacement on the grid
  float wave = smoothstep(0.0, 0.3, abs(interference));

  vec3 color = VOID_BLACK;

  // Wave body
  color += COSMIC_BLUE * wave * 0.6;
  color += COLD_WHITE * smoothstep(0.4, 0.5, abs(interference)) * 0.3;

  // Grid structure — faint
  color += COLD_WHITE * grid;

  // Moving nodes at wave intersections
  float nodes = smoothstep(0.55, 0.6, abs(waveX * waveY));
  color += ELECTRIC_PURP * nodes * 0.5;

  // Vignette
  float dist = length(centered);
  color *= smoothstep(0.8, 0.2, dist);

  return color;
}


// ═══════════════════════════════════════════════════════════
// STATE 3: The Forge (66% — gravitational compression)
// ═══════════════════════════════════════════════════════════
vec3 theForge(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float dist = length(centered);
  float angle = atan(centered.y, centered.x);

  // Gravitational pull — warp coordinates toward center
  float gravity = 1.0 / (dist * 4.0 + 0.1);
  vec2 warped = centered * (1.0 + gravity * 0.1);

  // Spiraling compression
  float spiral = sin(angle * 5.0 + dist * 20.0 - t * 2.0);
  float spiralBands = smoothstep(0.0, 0.3, abs(spiral)) * smoothstep(0.4, 0.0, dist);

  // Dense core — intense energy
  float core = smoothstep(0.15, 0.0, dist);
  float coreGlow = smoothstep(0.3, 0.0, dist);
  float coreFlicker = 0.9 + 0.1 * sin(t * 8.0 + snoise(uv * 5.0 + t) * 3.0);

  // Accretion-ring-like bands
  float rings = smoothstep(0.02, 0.0, abs(dist - 0.12 - sin(angle * 3.0 + t) * 0.02));
  rings += smoothstep(0.02, 0.0, abs(dist - 0.2 - cos(angle * 5.0 - t * 0.5) * 0.015)) * 0.6;

  // Noise texture on the warped space
  float n = fbm(warped * 8.0 + t * 0.3, 4);

  vec3 color = VOID_BLACK;

  // Spiral bands — cosmic blue
  color += COSMIC_BLUE * spiralBands * 0.5;

  // Core glow — hot transition: purple → orange → white
  vec3 coreColor = mix(ELECTRIC_PURP, FORGE_ORANGE, smoothstep(0.1, 0.0, dist));
  coreColor = mix(coreColor, COLD_WHITE, smoothstep(0.05, 0.0, dist));
  color += coreColor * coreGlow * coreFlicker * 0.8;

  // Accretion rings
  color += mix(COSMIC_BLUE, ELECTRIC_PURP, 0.5) * rings;

  // Infalling matter texture
  color += COLD_WHITE * abs(n) * smoothstep(0.5, 0.1, dist) * 0.1;

  return color;
}


// ═══════════════════════════════════════════════════════════
// STATE 4: The Awakening (100% — fracture and scatter)
// ═══════════════════════════════════════════════════════════
vec3 theAwakening(vec2 uv, float t) {
  vec2 centered = uv - 0.5;
  float dist = length(centered);

  // Voronoi cells — fractured geometric shapes
  vec2 vor = voronoi(uv * 5.0 + t * 0.05);
  float cellEdge = smoothstep(0.05, 0.15, vor.y - vor.x);
  float cellInterior = 1.0 - cellEdge;

  // Each cell drifts slightly
  float cellNoise = snoise(uv * 3.0 + t * 0.1);

  // Hard-edged geometric shimmer
  float geo = step(0.5, fract(vor.x * 8.0 + cellNoise));

  // Fading remnant core
  float remnant = smoothstep(0.2, 0.0, dist) * (0.5 + 0.5 * sin(t * 2.0));

  vec3 color = VOID_BLACK;

  // Cell interiors — faint colored fragments
  vec3 fragColor = mix(COSMIC_BLUE, ELECTRIC_PURP, 0.5 + 0.5 * cellNoise);
  color += fragColor * cellInterior * 0.2;

  // Hard edges — cold white lines (the "structure")
  color += COLD_WHITE * (1.0 - cellEdge) * 0.15 * smoothstep(0.1, 0.12, vor.y - vor.x);

  // Geometric highlights within cells
  color += COLD_WHITE * geo * cellInterior * 0.08;

  // Remnant core glow
  color += mix(FORGE_ORANGE, COLD_WHITE, 0.5) * remnant * 0.3;

  // Subtle overall vignette
  color *= 0.7 + 0.3 * smoothstep(0.8, 0.3, dist);

  return color;
}


// ═══════════════════════════════════════════════════════════
// Main — interpolate between states
// ═══════════════════════════════════════════════════════════
void main() {
  vec2 uv = vUv;

  // Aspect-correct UV
  float aspect = uResolution.x / uResolution.y;
  vec2 corrected = uv;
  corrected.x *= aspect;
  corrected.x -= (aspect - 1.0) * 0.5;

  float t = uTime;
  float p = clamp(uProgress, 0.0, 1.0);

  // State transitions with smooth blending zones
  float s1 = 1.0 - smoothstep(0.20, 0.40, p);    // Jitter fades out
  float s2 = smoothstep(0.20, 0.40, p) * (1.0 - smoothstep(0.50, 0.70, p)); // Waves
  float s3 = smoothstep(0.50, 0.70, p) * (1.0 - smoothstep(0.80, 0.95, p)); // Forge
  float s4 = smoothstep(0.80, 0.95, p);           // Awakening fades in

  vec3 color = vec3(0.0);
  color += quantumJitter(corrected, t) * s1;
  color += transverseWaves(corrected, t) * s2;
  color += theForge(corrected, t) * s3;
  color += theAwakening(corrected, t) * s4;

  // Global tone — ensure deep blacks stay deep
  color = max(color, VOID_BLACK * 0.5);

  gl_FragColor = vec4(color, 1.0);
}
