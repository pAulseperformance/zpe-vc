// ═══════════════════════════════════════════════════════════
// ZPE — "Exciting the Vacuum" Fragment Shader
// LOCALIZED hover + EM Wave Catalysts with Lenz's Law
// All wave constants as uniforms for dev tuning
// ═══════════════════════════════════════════════════════════

precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;
uniform float uEnergy;
uniform float uRipFlash;

// ─── Catalyst Uniforms ───
uniform vec2  uCatalysts[10];
uniform float uCatalystTimes[10];
uniform int   uCatalystCount;

// ─── Tunable Uniforms ───
uniform float uWaveSpeed;
uniform float uWaveFreq;
uniform float uWaveWidth;
uniform float uWaveDamping;
uniform float uLenzStrength;
uniform float uLenzWake;
uniform float uHoverRadius;
uniform float uWaveLifetime;

// ─── Palette ───
const vec3 BLACK     = vec3(0.0);
const vec3 COLD_WHT  = vec3(0.75, 0.78, 0.88);   // Idle dust
const vec3 VIOLET    = vec3(0.45, 0.15, 0.70);
const vec3 INDIGO    = vec3(0.22, 0.08, 0.55);
const vec3 BLUE      = vec3(0.10, 0.25, 0.75);
const vec3 TEAL      = vec3(0.05, 0.60, 0.55);
const vec3 GREEN     = vec3(0.15, 0.75, 0.30);
const vec3 GOLD      = vec3(0.95, 0.75, 0.15);
const vec3 HOT_PINK  = vec3(0.95, 0.20, 0.50);
const vec3 HOT_WHITE = vec3(0.95, 0.97, 1.00);

// Full energy spectrum: smooth cosine palette (no banding)
// Based on Inigo Quilez's cosine color grading
vec3 energySpectrum(float intensity) {
  float i = clamp(intensity, 0.0, 1.0);
  // a + b * cos(2π(c*t + d)) — carefully tuned for full rainbow
  vec3 a = vec3(0.5, 0.5, 0.5);
  vec3 b = vec3(0.55, 0.55, 0.55);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.0, 0.15, 0.40); // Phase offsets create rainbow
  return a + b * cos(6.28318 * (c * i + d));
}

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
  float aspect = uResolution.x / uResolution.y;
  vec2 uv = vUv;
  uv.x *= aspect;
  uv.x -= (aspect - 1.0) * 0.5;

  vec2 mouse = uMouse;
  mouse.x *= aspect;
  mouse.x -= (aspect - 1.0) * 0.5;

  float t = uTime;

  // ── Energy ──
  float e = clamp(uEnergy, 0.0, 120.0);
  float eNorm = e / 100.0;

  // ── LOCALIZED HOVER ──
  float mouseDist = distance(uv, mouse);
  float hoverInfluence = smoothstep(uHoverRadius, 0.0, mouseDist);

  float speedMult = 1.0 + eNorm * 8.0 * hoverInfluence;
  float brightMult = 1.0 + eNorm * 4.0 * hoverInfluence;
  float localWarp = eNorm * 0.08 * hoverInfluence;

  vec2 hoverWarpOffset = vec2(
    snoise(uv * 15.0 + t * speedMult * 0.3),
    snoise(uv * 15.0 + t * speedMult * 0.3 + 50.0)
  );
  vec2 warpedUV = uv + hoverWarpOffset * localWarp;

  // ══════════════════════════════════════════
  // CATALYST EM WAVES — Lenz's Law
  // ══════════════════════════════════════════
  vec3 catalystColor = BLACK;
  vec2 lenzDisplacement = vec2(0.0);

  for (int i = 0; i < 10; i++) {
    if (i >= uCatalystCount) break;

    float age = t - uCatalystTimes[i];
    if (age < 0.0 || age > uWaveLifetime) continue;

    vec2 cat = uCatalysts[i];
    cat.x *= aspect;
    cat.x -= (aspect - 1.0) * 0.5;

    // ── Fractal-warped distance (organic, not circular) ──
    vec2 delta = warpedUV - cat;
    float rawDist = length(delta);
    float warpAngle = atan(delta.y, delta.x);
    // 3 octaves of angular noise distort the ring shape
    float distWarp = snoise(vec2(warpAngle * 3.0, rawDist * 8.0 + age * 2.0)) * 0.04
                   + snoise(vec2(warpAngle * 7.0 + 20.0, rawDist * 15.0 - age * 1.5)) * 0.02
                   + snoise(vec2(warpAngle * 13.0 + 50.0, rawDist * 25.0 + age * 3.0)) * 0.01;
    float dist = rawDist + distWarp;

    float waveFront = age * uWaveSpeed;

    // Two decay curves: fast for EM visuals, slow for Lenz collapse
    float emDamping = exp(-age * uWaveDamping);
    float lenzDamping = exp(-age * uWaveDamping * 0.35);

    // Wavefront ring (now organic due to warped dist)
    float frontDist = abs(dist - waveFront);
    float atFront = smoothstep(uWaveWidth, 0.0, frontDist);

    // EM oscillation: multi-octave for chaotic texture
    float n1 = snoise(warpedUV * 40.0 + t * 5.0) * 0.5 + 0.5;
    float n2 = snoise(warpedUV * 80.0 - t * 3.0 + 30.0) * 0.3 + 0.5;
    float emWave = sin(dist * uWaveFreq - age * 30.0) * n1
                 + sin(dist * uWaveFreq * 1.7 + age * 15.0) * n2 * 0.4;
    float emIntensity = atFront * abs(emWave) * emDamping;

    // ── Chromatic dispersion: sample spectrum at 3 offsets ──
    // Leading edge = higher frequency (blue-shifted)
    // Trailing edge = lower frequency (red-shifted)
    float spectrumBase = emIntensity * 0.4 + eNorm * 0.25 + age * 0.1;
    float dispersion = 0.08; // Spectral spread between channels
    vec3 waveColor = vec3(
      energySpectrum(spectrumBase - dispersion).r,  // Red channel: trailing
      energySpectrum(spectrumBase).g,                // Green channel: center
      energySpectrum(spectrumBase + dispersion).b    // Blue channel: leading
    );
    catalystColor += waveColor * emIntensity * 0.5;

    // Lenz's Law: inward drag that collapses to catalyst origin
    // Uses rawDist (actual geometry, not warped visual distance)
    float collapsePhase = clamp(age * uWaveDamping * 0.5, 0.0, 1.0);
    float effectiveWake = uLenzWake * (1.0 - collapsePhase);
    float behindFront = smoothstep(waveFront, waveFront - max(effectiveWake, 0.001), rawDist);

    float pointCollapse = exp(-rawDist * rawDist * (20.0 + collapsePhase * 300.0));

    float lenzMask = mix(behindFront, pointCollapse, collapsePhase * collapsePhase);

    vec2 dirToCenter = (rawDist > 0.001) ? normalize(cat - warpedUV) : vec2(0.0);
    lenzDisplacement += dirToCenter * lenzMask * lenzDamping * uLenzStrength;
  }

  warpedUV += lenzDisplacement;

  // ── Quantum dust (visible at rest, energy-reactive colors) ──
  vec3 color = BLACK;

  // Local energy intensity for color mapping
  float localHeat = eNorm * hoverInfluence;

  // Layer 1: fine white dust — always visible, shifts color with energy
  float dust1 = snoise(warpedUV * 350.0 + t * speedMult * 0.5);
  float sparks1 = smoothstep(0.78, 0.85, dust1) * 0.07 * brightMult;
  vec3 dust1Color = mix(COLD_WHT, energySpectrum(localHeat * 0.8), localHeat);
  color += dust1Color * sparks1;

  // Layer 2: violet dust — visible at rest, shifts through spectrum
  float dust2 = snoise(warpedUV * 500.0 + t * speedMult * 0.7 + 100.0);
  float sparks2 = smoothstep(0.82, 0.88, dust2) * 0.035 * brightMult;
  vec3 dust2Color = mix(VIOLET * 0.6, energySpectrum(localHeat * 0.5 + 0.2), localHeat);
  color += dust2Color * sparks2;

  // Layer 3: dense field — faint at rest
  float dust3 = snoise(warpedUV * 600.0 - t * speedMult * 0.3 + 50.0);
  float sparks3 = smoothstep(0.84, 0.90, dust3) * 0.025 * brightMult;
  vec3 dust3Color = mix(INDIGO * 0.5, energySpectrum(localHeat * 0.6 + 0.35), localHeat);
  color += dust3Color * sparks3;

  // Layer 4: bright pops — white at rest, hottest spectrum at high energy
  float popThreshold = mix(0.90, 0.75, localHeat);
  float pop = snoise(warpedUV * 250.0 + t * speedMult * 2.2);
  float brightPop = smoothstep(popThreshold, popThreshold + 0.04, pop) * 0.18 * brightMult;
  vec3 popColor = mix(COLD_WHT, energySpectrum(localHeat * 0.9 + 0.4), localHeat);
  color += popColor * brightPop;

  // ══════════════════════════════════════════
  // LIVING CURSOR AURA — pattern-undetectable
  // Uses irrational time offsets so cycles never sync
  // ══════════════════════════════════════════
  vec2 cursorDelta = uv - mouse;
  float angle = atan(cursorDelta.y, cursorDelta.x);

  // Irrational constants — incommensurate periods = no visible repetition
  const float PHI   = 1.6180339887;  // Golden ratio
  const float SQRT2 = 1.4142135624;
  const float SQRT3 = 1.7320508076;

  // ── Fractal shape distortion (3 octaves, never repeats) ──
  float shapeWarp = snoise(vec2(angle * 2.0, t * PHI)) * 0.035
                  + snoise(vec2(angle * 5.0 + 30.0, t * SQRT2 * 0.7)) * 0.02
                  + snoise(vec2(angle * 11.0 + 70.0, t * SQRT3 * 0.4)) * 0.01;
  float warpedMouseDist = mouseDist + shapeWarp * eNorm;

  // ── Breathing: three incommensurate sine waves ──
  float breath = 1.0
    + sin(t * PHI * 1.3) * 0.12
    + sin(t * SQRT2 * 2.1) * 0.08
    + sin(t * 3.14159 * 0.7) * 0.05;

  // ── Core glow — organic, breathing ──
  float auraCore = exp(-warpedMouseDist * warpedMouseDist * 45.0 / breath) * eNorm * 0.10;

  // ── Inner corona: counter-rotating noise layer ──
  float corona = snoise(vec2(angle * 7.0 - t * SQRT3 * 1.1, mouseDist * 30.0 + t * PHI));
  float coronaMask = smoothstep(0.4, 0.85, corona) * exp(-mouseDist * 12.0) * eNorm * 0.06;

  // ── Tendrils: radial filaments at different time scales ──
  float t1 = snoise(vec2(angle * 4.0 + t * PHI * 0.8, mouseDist * 18.0 - t * SQRT2 * 1.5));
  float t2 = snoise(vec2(angle * 9.0 - t * SQRT3 * 0.6, mouseDist * 25.0 + t * 1.1));
  float tendrils = (smoothstep(0.3, 0.8, t1) * 0.6 + smoothstep(0.4, 0.85, t2) * 0.4)
                 * exp(-mouseDist * 7.0) * eNorm * 0.07;

  // ── Deep aurora wisps: slow, large-scale, barely there ──
  float aurora = snoise(vec2(angle * 1.5 + t * 0.3, mouseDist * 8.0 - t * PHI * 0.2));
  float auroraWisp = smoothstep(0.5, 0.9, aurora)
                   * exp(-mouseDist * 4.0)
                   * smoothstep(0.0, 0.15, mouseDist)  // Hollow center
                   * eNorm * 0.04;

  // ── Spark constellation: high-frequency, sparse, flickering ──
  float sparks = snoise(vec2(angle * 17.0, t * SQRT2 * 5.0 + mouseDist * 50.0));
  float sparkRing = smoothstep(0.88, 0.94, sparks)
                  * smoothstep(0.35, 0.06, mouseDist)
                  * smoothstep(0.015, 0.05, mouseDist)
                  * eNorm * 0.12;

  // ── Sub-threshold whisper: only appears when energy > 0 ──
  float whisper = snoise(vec2(angle * 3.0 + t * 0.5, mouseDist * 12.0))
                * exp(-mouseDist * mouseDist * 80.0) * 0.015 * eNorm;

  // ── Gravitational lensing: bend UV near cursor (energy-gated) ──
  float lensStrength = eNorm * 0.005 * exp(-mouseDist * 6.0);
  vec2 lensDir = normalize(cursorDelta + 0.0001);
  float lensNoise = snoise(vec2(angle * 2.0, t * PHI * 0.5)) * 0.3 + 0.7;
  float lensBend = snoise((warpedUV + lensDir * lensStrength * lensNoise) * 350.0 + t * 0.5);
  float lensContrib = smoothstep(0.82, 0.88, lensBend) * lensStrength * 8.0;

  // ── Aura color: energy spectrum + noise drift ──
  float hue1 = snoise(vec2(t * PHI * 0.4, mouseDist * 3.0)) * 0.5 + 0.5;
  float hue2 = snoise(vec2(t * SQRT2 * 0.3 + 20.0, angle * 2.0)) * 0.5 + 0.5;
  float auraHeat = eNorm * 0.6 + hue1 * 0.2;
  vec3 auraColor = energySpectrum(auraHeat);
  vec3 coronaColor = energySpectrum(auraHeat * 0.7 + hue2 * 0.15);

  // ── Composite: entire aura block is zero when eNorm = 0 ──
  float auraGate = smoothstep(0.0, 0.05, eNorm); // Hard zero below threshold
  color += (auraColor * (auraCore + tendrils + auroraWisp)
         + coronaColor * coronaMask
         + HOT_WHITE * (sparkRing + lensContrib)
         + mix(VIOLET, HOT_WHITE, 0.5) * max(whisper, 0.0)) * auraGate;

  color += catalystColor;

  float vDist = length(vUv - 0.5) * 1.6;
  float vignette = 1.0 - pow(vDist, 1.5);
  color *= clamp(vignette, 0.0, 1.0);

  color = mix(color, HOT_WHITE, uRipFlash);
  color = max(color, BLACK);
  gl_FragColor = vec4(color, 1.0);
}
