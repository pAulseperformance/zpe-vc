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
  // CATALYST EM WAVES — Interference + Heat Trail
  // ══════════════════════════════════════════
  float waveFieldR = 0.0;  // Signed wave accumulator per channel
  float waveFieldG = 0.0;  // For constructive/destructive interference
  float waveFieldB = 0.0;
  float heatTrail = 0.0;   // Energy residue behind wavefronts
  vec2 lenzDisplacement = vec2(0.0);

  for (int i = 0; i < 10; i++) {
    if (i >= uCatalystCount) break;

    float age = t - uCatalystTimes[i];
    if (age < 0.0 || age > uWaveLifetime) continue;

    vec2 cat = uCatalysts[i];
    cat.x *= aspect;
    cat.x -= (aspect - 1.0) * 0.5;

    // ── Fractal-warped distance ──
    vec2 delta = warpedUV - cat;
    float rawDist = length(delta);
    float warpAngle = atan(delta.y, delta.x);
    float distWarp = snoise(vec2(warpAngle * 3.0, rawDist * 8.0 + age * 2.0)) * 0.04
                   + snoise(vec2(warpAngle * 7.0 + 20.0, rawDist * 15.0 - age * 1.5)) * 0.02
                   + snoise(vec2(warpAngle * 13.0 + 50.0, rawDist * 25.0 + age * 3.0)) * 0.01;
    float dist = rawDist + distWarp;

    float waveFront = age * uWaveSpeed;
    float emDamping = exp(-age * uWaveDamping);
    float lenzDamping = exp(-age * uWaveDamping * 0.35);

    // Wavefront ring
    float frontDist = abs(dist - waveFront);
    float atFront = smoothstep(uWaveWidth, 0.0, frontDist);

    // EM oscillation: SIGNED wave (not abs) for interference
    float n1 = snoise(warpedUV * 40.0 + t * 5.0) * 0.5 + 0.5;
    float n2 = snoise(warpedUV * 80.0 - t * 3.0 + 30.0) * 0.3 + 0.5;
    float emWave = sin(dist * uWaveFreq - age * 30.0) * n1
                 + sin(dist * uWaveFreq * 1.7 + age * 15.0) * n2 * 0.4;
    float signedIntensity = atFront * emWave * emDamping;

    // ── Chromatic dispersion into signed field ──
    float specBase = abs(signedIntensity) * 0.4 + eNorm * 0.25 + age * 0.1;
    float disp = 0.08;
    waveFieldR += signedIntensity * energySpectrum(specBase - disp).r;
    waveFieldG += signedIntensity * energySpectrum(specBase).g;
    waveFieldB += signedIntensity * energySpectrum(specBase + disp).b;

    // ── Heat trail: slow-fading residue behind wavefront ──
    float heatDamping = exp(-age * uWaveDamping * 0.15); // 6× slower decay
    float behindWave = smoothstep(waveFront + 0.02, waveFront - 0.1, rawDist);
    heatTrail += behindWave * heatDamping * 0.08;

    // Lenz's Law
    float collapsePhase = clamp(age * uWaveDamping * 0.5, 0.0, 1.0);
    float effectiveWake = uLenzWake * (1.0 - collapsePhase);
    float behindFront = smoothstep(waveFront, waveFront - max(effectiveWake, 0.001), rawDist);
    float pointCollapse = exp(-rawDist * rawDist * (20.0 + collapsePhase * 300.0));
    float lenzMask = mix(behindFront, pointCollapse, collapsePhase * collapsePhase);
    vec2 dirToCenter = (rawDist > 0.001) ? normalize(cat - warpedUV) : vec2(0.0);
    lenzDisplacement += dirToCenter * lenzMask * lenzDamping * uLenzStrength;
  }

  // Convert signed interference field to color
  // Positive = bright (constructive), negative = dark voids (destructive)
  vec3 catalystColor = vec3(
    max(waveFieldR, 0.0) * 0.5,
    max(waveFieldG, 0.0) * 0.5,
    max(waveFieldB, 0.0) * 0.5
  );
  // Destructive interference: darken underlying dust
  float destructive = -min(min(waveFieldR, waveFieldG), waveFieldB);
  float destMask = clamp(destructive * 0.3, 0.0, 0.5);

  // Heat trail color: fades through spectrum
  vec3 heatColor = energySpectrum(heatTrail * 3.0 + 0.1) * heatTrail;

  warpedUV += lenzDisplacement;

  // ══════════════════════════════════════════
  // QUANTUM DUST — Depth Parallax (3 layers)
  // ══════════════════════════════════════════
  vec3 color = BLACK;
  float localHeat = eNorm * hoverInfluence;

  // Mouse delta for parallax offset
  vec2 parallaxDir = uv - mouse;

  // Layer 1 (NEAR): fine white dust — most parallax
  vec2 uv1 = warpedUV + parallaxDir * 0.04;
  float dust1 = snoise(uv1 * 350.0 + t * speedMult * 0.5);
  float sparks1 = smoothstep(0.78, 0.85, dust1) * 0.07 * brightMult;
  vec3 dust1Color = mix(COLD_WHT, energySpectrum(localHeat * 0.8), localHeat);
  color += dust1Color * sparks1;

  // Layer 2 (MID): violet dust — medium parallax
  vec2 uv2 = warpedUV + parallaxDir * 0.02;
  float dust2 = snoise(uv2 * 500.0 + t * speedMult * 0.7 + 100.0);
  float sparks2 = smoothstep(0.82, 0.88, dust2) * 0.035 * brightMult;
  vec3 dust2Color = mix(VIOLET * 0.6, energySpectrum(localHeat * 0.5 + 0.2), localHeat);
  color += dust2Color * sparks2;

  // Layer 3 (FAR): dense field — minimal parallax
  vec2 uv3 = warpedUV + parallaxDir * 0.008;
  float dust3 = snoise(uv3 * 600.0 - t * speedMult * 0.3 + 50.0);
  float sparks3 = smoothstep(0.84, 0.90, dust3) * 0.025 * brightMult;
  vec3 dust3Color = mix(INDIGO * 0.5, energySpectrum(localHeat * 0.6 + 0.35), localHeat);
  color += dust3Color * sparks3;

  // Layer 4: bright pops — near layer
  vec2 uv4 = warpedUV + parallaxDir * 0.035;
  float popThreshold = mix(0.90, 0.75, localHeat);
  float pop = snoise(uv4 * 250.0 + t * speedMult * 2.2);
  float brightPop = smoothstep(popThreshold, popThreshold + 0.04, pop) * 0.18 * brightMult;
  vec3 popColor = mix(COLD_WHT, energySpectrum(localHeat * 0.9 + 0.4), localHeat);
  color += popColor * brightPop;

  // Apply destructive interference darkening
  color *= (1.0 - destMask);

  // Add heat trail residue
  color += heatColor;

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
