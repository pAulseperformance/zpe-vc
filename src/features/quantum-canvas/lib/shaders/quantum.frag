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
uniform vec2  uMouseVelocity;
uniform float uEnergy;
uniform float uRipFlash;

// ─── Catalyst Uniforms ───
uniform vec2  uCatalysts[100];
uniform float uCatalystTimes[100];
uniform int   uCatalystCount;

// ─── Tunable Uniforms ───
uniform float uWaveSpeed;
uniform float uWaveFreq;
uniform float uWaveWidth;
uniform float uEmDamping;
uniform float uGravDamping;
uniform float uLenzStrength;
uniform float uLenzWake;
uniform float uHoverRadius;
uniform float uWaveLifetime;
uniform float uParallaxDepth;
uniform float uHeatDecay;
uniform float uHeatIntensity;
uniform float uInterferenceBlend;
uniform float uHeatField;
uniform float uIridescence;
uniform float uPaletteMode; // 0 = physical, 1 = artistic, 2 = hybrid
uniform float uStarField;   // 0 = off, 1 = full brightness
uniform float uWavelength;  // 0=radio, 1=infrared, 2=visible, 3=xray, 4=gamma

// ─── Barrier / Diffraction Uniforms ───
uniform float uBarrierEnabled;  // 0=off, 1=on
uniform float uBarrierY;        // Barrier Y position (UV space, 0–1)
uniform float uSlitCount;       // 0=solid wall, 1=single, 2=double, 3=triple
uniform float uSlitWidth;       // Aperture width (UV units)
uniform float uSlitSeparation;  // Center-to-center slit distance
uniform float uDiffSamples;     // Huygens sample count (4–16)

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

// Heat trail spectrum: physically accurate cooling radiation
// Fresh heat (1.0) = white-hot → cools through yellow → orange → red → dark ember → black
// Follows Wien's displacement law: peak wavelength increases as temperature drops
vec3 heatTrailSpectrum(float heat) {
  float h = clamp(heat, 0.0, 1.0);
  vec3 col;
  // Black/invisible (h < 0.1) — below visible threshold (infrared)
  col = vec3(0.0);
  // Dark ember (0.1 - 0.25) — just entering visible range (~800K)
  col = mix(col, vec3(0.25, 0.01, 0.0), smoothstep(0.05, 0.2, h));
  // Cherry red (0.25 - 0.4) — ~1500K
  col = mix(col, vec3(0.6, 0.04, 0.0), smoothstep(0.2, 0.4, h));
  // Orange (0.4 - 0.55) — ~2500K
  col = mix(col, vec3(0.9, 0.3, 0.02), smoothstep(0.35, 0.55, h));
  // Yellow-orange (0.55 - 0.7) — ~3500K
  col = mix(col, vec3(1.0, 0.65, 0.1), smoothstep(0.5, 0.7, h));
  // Yellow-white (0.7 - 0.85) — ~5000K
  col = mix(col, vec3(1.0, 0.9, 0.6), smoothstep(0.65, 0.85, h));
  // White-hot (0.85 - 1.0) — ~8000K+ (peak energy)
  col = mix(col, vec3(1.0, 0.97, 0.95), smoothstep(0.8, 1.0, h));
  return col;
}

// Planck blackbody approximation: physically accurate thermal emission
// Maps temperature (0=cold → 1=white-hot) to real stellar colors
// Cold: black → deep red → cherry → orange → yellow → white → blue-white
vec3 planckBlackbody(float temp) {
  float t = clamp(temp, 0.0, 1.0);
  // Perez et al. approximation of CIE color from temperature
  vec3 col;
  // Dark red ember (t < 0.15)
  col = mix(vec3(0.0), vec3(0.4, 0.02, 0.0), smoothstep(0.0, 0.15, t));
  // Cherry red (0.15 - 0.3)
  col = mix(col, vec3(0.7, 0.08, 0.0), smoothstep(0.15, 0.3, t));
  // Orange (0.3 - 0.45)
  col = mix(col, vec3(0.95, 0.35, 0.02), smoothstep(0.3, 0.45, t));
  // Yellow (0.45 - 0.6)
  col = mix(col, vec3(1.0, 0.72, 0.15), smoothstep(0.45, 0.6, t));
  // Near-white (0.6 - 0.8)
  col = mix(col, vec3(1.0, 0.92, 0.80), smoothstep(0.6, 0.8, t));
  // Blue-white (0.8 - 1.0)
  col = mix(col, vec3(0.85, 0.90, 1.0), smoothstep(0.8, 1.0, t));
  return col;
}

// Multi-wavelength color remapping
// Simulates observing the same physics at different EM bands
vec3 wavelengthRemap(vec3 color, float intensity) {
  if (uWavelength < 0.5) {
    // Radio: warm red tones, large-scale diffuse emission
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    return vec3(lum * 1.2, lum * 0.3, lum * 0.05) * 1.5;
  } else if (uWavelength < 1.5) {
    // Infrared: orange-amber thermal view
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    return vec3(lum * 1.0, lum * 0.55, lum * 0.1) * 1.3;
  } else if (uWavelength < 2.5) {
    // Visible: pass through (default human perception)
    return color;
  } else if (uWavelength < 3.5) {
    // X-Ray: blue-white, high contrast, emphasizes dense regions
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    float boosted = pow(lum, 0.6); // boost faint details
    return vec3(boosted * 0.5, boosted * 0.7, boosted * 1.2);
  } else {
    // Gamma: violet/magenta, extreme energy events only
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    float boosted = pow(lum, 0.4); // strong boost for faint signals
    return vec3(boosted * 0.9, boosted * 0.2, boosted * 1.0) * 1.4;
  }
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

// ═══════════════════════════════════════
// HUYGENS-FRESNEL DIFFRACTION
// ═══════════════════════════════════════
// Numerical Huygens' principle: sample secondary sources across slit apertures.
// Returns (signedField, envelope) — drops into existing interference compositing.

// Check if a point is inside any slit aperture
// Returns 0.0 if blocked by barrier, 1.0 if in a slit
float isInSlit(float x) {
  float cx = 0.5; // barrier center X (always centered)
  int slits = int(uSlitCount);
  float halfW = uSlitWidth * 0.5;

  for (int s = 0; s < 4; s++) {
    if (s >= slits) break;
    // Slit center: evenly spaced around cx
    float offset = (float(s) - (float(slits) - 1.0) * 0.5) * uSlitSeparation;
    float slitCenter = cx + offset;
    if (abs(x - slitCenter) < halfW) return 1.0;
  }
  return 0.0;
}

// Compute Huygens diffracted wave at pixel position from a single catalyst
// through all slit apertures. Returns vec2(signedField, envelope).
vec2 huygensDiffraction(vec2 pixelUV, vec2 catUV, float freq, float age, float speed) {
  float barrierYScaled = uBarrierY;
  int slits = int(uSlitCount);
  int samples = int(uDiffSamples);
  float cx = 0.5;
  float halfW = uSlitWidth * 0.5;
  float signedSum = 0.0;
  float envelopeSum = 0.0;
  float totalSamples = 0.0;

  // For each slit aperture, sample secondary sources
  for (int s = 0; s < 4; s++) {
    if (s >= slits) break;
    float offset = (float(s) - (float(slits) - 1.0) * 0.5) * uSlitSeparation;
    float slitCenter = cx + offset;
    float slitLeft = slitCenter - halfW;

    for (int n = 0; n < 16; n++) {
      if (n >= samples) break;
      // Sample point along slit aperture
      float frac = (float(n) + 0.5) / float(samples);
      float sampleX = slitLeft + frac * uSlitWidth;
      vec2 slitPoint = vec2(sampleX, barrierYScaled);

      // Distance: catalyst → slit point → pixel (Huygens' path)
      float d1 = distance(catUV, slitPoint);
      float d2 = distance(slitPoint, pixelUV);
      float totalDist = d1 + d2;

      // Wave must have reached the slit point
      float waveFront = age * speed;
      if (d1 > waveFront) continue;

      // Secondary source: same phase as arriving wave, re-emits spherically
      float wave = sin(totalDist * freq - age * 30.0);

      // Amplitude falls off with total path length
      float amp = 1.0 / (1.0 + totalDist * 8.0);

      signedSum += wave * amp;
      envelopeSum += abs(wave) * amp;
      totalSamples += 1.0;
    }
  }

  // Normalize by sample count to keep intensity consistent
  if (totalSamples > 0.0) {
    signedSum /= totalSamples;
    envelopeSum /= totalSamples;
    // Scale up to compensate for diffraction spreading
    signedSum *= float(slits);
    envelopeSum *= float(slits);
  }

  return vec2(signedSum, envelopeSum);
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
  // CATALYST EM WAVES — Interference + Lenz + Heat
  // ══════════════════════════════════════════
  vec3 catalystColorAdditive = BLACK;  // Old-style additive
  float waveFieldSigned = 0.0;        // Signed EM field for interference
  float waveFieldEnvelope = 0.0;      // EM brightness envelope
  float gravFieldSigned = 0.0;        // Signed gravitational field for grav-wave interference
  float gravFieldEnvelope = 0.0;      // Gravitational field envelope
  float heatResidual = 0.0;           // Energy memory trail
  vec2 lenzDisplacement = vec2(0.0);
  float spectrumAccum = 0.0;          // For chromatic dispersion base

  for (int i = 0; i < 100; i++) {
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
    float distWarp = snoise(vec2(warpAngle * 3.0, rawDist * 8.0 + age * 2.0)) * 0.04
                   + snoise(vec2(warpAngle * 7.0 + 20.0, rawDist * 15.0 - age * 1.5)) * 0.02
                   + snoise(vec2(warpAngle * 13.0 + 50.0, rawDist * 25.0 + age * 3.0)) * 0.01;
    float dist = rawDist + distWarp;

    float waveFront = age * uWaveSpeed;

    float emDamping = exp(-age * uEmDamping);
    // Inverse-square gravitational decay (1/r² law, not exponential)
    float lenzDamping = 1.0 / (1.0 + age * age * uGravDamping * uGravDamping);

    // Wavefront ring (sharp visual)
    float frontDist = abs(dist - waveFront);
    float atFront = smoothstep(uWaveWidth, 0.0, frontDist);

    // EM oscillation: multi-octave
    float n1 = snoise(warpedUV * 40.0 + t * 5.0) * 0.5 + 0.5;
    float n2 = snoise(warpedUV * 80.0 - t * 3.0 + 30.0) * 0.3 + 0.5;
    float emWaveSigned = sin(dist * uWaveFreq - age * 30.0) * n1
                       + sin(dist * uWaveFreq * 1.7 + age * 15.0) * n2 * 0.4;
    float emIntensity = atFront * abs(emWaveSigned) * emDamping;

    // ── Extended field for interference ──
    // Wave exists everywhere the wavefront has already swept past (dist < waveFront)
    // Decays with distance behind the front and with age
    float behindWavefront = smoothstep(waveFront + 0.01, waveFront - 0.01, dist);
    float fieldDecay = exp(-max(waveFront - dist, 0.0) * 3.0); // decay behind front
    float extendedField = behindWavefront * fieldDecay * emDamping;

    // ── Clean sine for interference — no noise, no harmonics ──
    // Single source: abs(sin(d*f)) / abs(sin(d*f)) = 1.0 everywhere → no self-interference
    // Two sources: sin(d1*f) + sin(d2*f) cancels where d1-d2 = λ/2 → visible dark bands
    float cleanWave = sin(dist * uWaveFreq - age * 30.0);

    // ── Barrier diffraction ──
    // If barrier is enabled: check if wave path crosses the barrier
    if (uBarrierEnabled > 0.5) {
      bool catAbove = cat.y > uBarrierY;
      bool pixAbove = warpedUV.y > uBarrierY;
      bool crosses = (catAbove != pixAbove); // path crosses barrier

      if (crosses) {
        if (uSlitCount < 0.5) {
          // Solid wall — full shadow (no wave passes)
          cleanWave = 0.0;
          extendedField *= 0.02; // tiny tunneling leak
        } else {
          // Huygens-Fresnel diffraction through slits
          float emDamp = exp(-age * uEmDamping);
          vec2 huygens = huygensDiffraction(
            warpedUV, cat, uWaveFreq, age, uWaveSpeed
          );
          cleanWave = huygens.x;
          // Modulate extended field by diffracted amplitude
          extendedField *= max(huygens.y, 0.01) * emDamp;
        }
      }
    }

    waveFieldSigned += cleanWave * extendedField;
    waveFieldEnvelope += abs(cleanWave) * extendedField;

    // ── Lenz collapse (computed first for redshift dependency) ──
    float collapsePhase = clamp(age * uGravDamping * 0.5, 0.0, 1.0);
    float effectiveWake = uLenzWake * (1.0 - collapsePhase);
    float behindFront = smoothstep(waveFront, waveFront - max(effectiveWake, 0.001), rawDist);
    float pointCollapse = exp(-rawDist * rawDist * (20.0 + collapsePhase * 300.0));
    float lenzMask = mix(behindFront, pointCollapse, collapsePhase * collapsePhase);

    // ── Additive color (uses sharp ring for visual wavefront) ──
    // Gravitational redshift: waves near collapse zones shift toward red
    float redshift = lenzMask * collapsePhase * 0.3;
    // Doppler shift: approaching waves blueshift, receding waves redshift
    vec2 waveDir = (rawDist > 0.001) ? normalize(delta) : vec2(0.0);
    float dopplerShift = dot(waveDir, uMouseVelocity) * 2.0; // positive = approaching = blue
    float specBase = emIntensity * 0.4 + eNorm * 0.25 + age * 0.1 - redshift + dopplerShift;
    float disp = 0.08;
    vec3 waveColor = vec3(
      energySpectrum(specBase - disp).r,
      energySpectrum(specBase).g,
      energySpectrum(specBase + disp).b
    );
    catalystColorAdditive += waveColor * emIntensity * 0.5;
    spectrumAccum += specBase * emIntensity;
    // ── Heat trail: thermal wake BEHIND the EM wavefront ──
    // Physics: EM wave sweeps past → energy absorbed → delayed heating
    float thermalDelay = 0.05; // Heat wake lags behind EM front
    float thermalFront = waveFront - thermalDelay;

    // Thermal wake has reached this pixel? (full area behind thermal front)
    float thermalPassed = smoothstep(thermalFront + 0.01, thermalFront - 0.01, rawDist);

    // Spatial cooling: hottest near thermal front, cooling further inside
    float distBehindThermal = max(thermalFront - rawDist, 0.0);
    float thermalGradient = exp(-distBehindThermal * 2.5);

    // Accumulate: thermal wake gate × spatial gradient × age decay
    float heatContrib = thermalPassed * thermalGradient * exp(-age * uHeatDecay);

    // Barrier blocks heat
    float heatBarrierFactor = 1.0;
    if (uBarrierEnabled > 0.5) {
      bool hCatAbove = cat.y > uBarrierY;
      bool hPixAbove = warpedUV.y > uBarrierY;
      if (hCatAbove != hPixAbove) {
        if (uSlitCount < 0.5) {
          heatBarrierFactor = 0.02;
        } else {
          vec2 hHuygens = huygensDiffraction(warpedUV, cat, uWaveFreq, age, uWaveSpeed);
          heatBarrierFactor = clamp(hHuygens.y, 0.02, 1.0);
        }
      }
    }
    heatResidual = max(heatResidual, heatContrib * heatBarrierFactor);

    // ── Lenz displacement ──
    vec2 dirToCenter = (rawDist > 0.001) ? normalize(cat - warpedUV) : vec2(0.0);
    // Energy-proportional lensing: E=mc² → more energy = stronger curvature
    float lenzMag = lenzMask * lenzDamping * uLenzStrength * (0.3 + eNorm * 0.7);
    lenzDisplacement += dirToCenter * lenzMag;

    // ── Gravitational wave interference field ──
    // Lower frequency than EM (gravitational waves have much longer wavelength)
    float gravWave = sin(dist * uWaveFreq * 0.3 - age * 10.0);
    gravFieldSigned += gravWave * lenzMag;
    gravFieldEnvelope += abs(gravWave) * lenzMag;
  }

  // ── Gravitational wave interference ──
  // Two gravity sources can cancel, creating gravitational standing waves
  float gravInterference = abs(gravFieldSigned);
  float gravInterferenceFactor = (gravFieldEnvelope > 0.001)
    ? pow(gravInterference / gravFieldEnvelope, 0.5) // Softer than EM (gravity is weaker)
    : 1.0;
  // Apply gravitational interference to lenz displacement (modulated by blend)
  lenzDisplacement *= mix(1.0, gravInterferenceFactor, uInterferenceBlend);

  // ── EM Wave interference compositing ──
  float interference = abs(waveFieldSigned);
  float cancellation = max(waveFieldEnvelope - interference, 0.0);

  float avgSpec = (waveFieldEnvelope > 0.001) ? spectrumAccum / waveFieldEnvelope : 0.0;
  float disp2 = 0.08;

  // Interference color depends on palette mode
  vec3 interferenceColor;
  if (uPaletteMode < 0.5) {
    // Physical: monochromatic — interference only modulates brightness
    float thermalTemp = clamp(avgSpec * 1.5, 0.0, 1.0);
    interferenceColor = planckBlackbody(thermalTemp);
  } else {
    // Artistic / Hybrid: chromatic dispersion
    interferenceColor = vec3(
      energySpectrum(avgSpec - disp2).r,
      energySpectrum(avgSpec).g,
      energySpectrum(avgSpec + disp2).b
    );
  }

  // Constructive zones: bright. Destructive zones: dark voids.
  float interferenceFactor = (waveFieldEnvelope > 0.001)
    ? pow(interference / waveFieldEnvelope, 0.3)
    : 0.0;

  vec3 catalystColorInterference = interferenceColor * interferenceFactor * waveFieldEnvelope * 0.6;

  float voidStrength = (waveFieldEnvelope > 0.01)
    ? smoothstep(0.0, 0.5, cancellation / waveFieldEnvelope)
    : 0.0;

  // Additive path color also respects palette mode
  // Quantum tunneling: small probability of energy leaking through void barriers
  float tunnelLeak = 0.05; // 5% tunneling probability
  vec3 catalystColor;
  if (uPaletteMode < 0.5) {
    catalystColor = mix(catalystColorAdditive, catalystColorInterference, uInterferenceBlend);
    float voidDarken = max(1.0 - voidStrength * 0.9, tunnelLeak);
    catalystColor *= mix(1.0, voidDarken, uInterferenceBlend);
  } else {
    catalystColor = mix(catalystColorAdditive, catalystColorInterference, uInterferenceBlend);
    float voidDarken = max(1.0 - voidStrength * 0.8, tunnelLeak);
    catalystColor *= mix(1.0, voidDarken, uInterferenceBlend);
  }

  // Clamp heat residual
  heatResidual = clamp(heatResidual, 0.0, 1.0);

  warpedUV += lenzDisplacement;

  // ── Quantum dust (depth parallax + heat trail + energy colors) ──
  vec3 color = BLACK;

  // Local energy intensity — drives dust brightness with heat
  float localHeat = eNorm * hoverInfluence + heatResidual * uHeatIntensity * 2.0 + uHeatField * 0.3;

  // Per-layer depth parallax: shifts UV based on cursor offset × depth
  vec2 cursorOffset = uv - mouse;

  // Layer 1: fine white dust — FAR (depth 0.3)
  vec2 uv1 = warpedUV + cursorOffset * 0.3 * uParallaxDepth;
  float speed1 = speedMult * 0.65;
  float dust1 = snoise(uv1 * 350.0 + t * speed1 * 0.5);
  float sparks1 = smoothstep(0.78, 0.85, dust1) * 0.07 * brightMult;
  // Heated particles glow brighter — luminosity scales with temperature
  sparks1 *= (1.0 + clamp(localHeat, 0.0, 1.0) * 2.0);
  // Dust color depends on palette mode
  vec3 dust1Color;
  vec3 heatColor;
  // Color mapping — uses 1× multiplier so full spectrum is visible
  // (heatResidual 0.1=ember, 0.3=cherry, 0.5=orange, 0.7=yellow, 0.9=white)
  float heatTintRaw = heatResidual * uHeatIntensity + uHeatField * 0.2;
  float heatTint = clamp(heatTintRaw, 0.0, 1.0);
  if (uPaletteMode < 0.5) {
    // Physical: Planck blackbody for all thermal emission
    dust1Color = mix(COLD_WHT * 0.5, planckBlackbody(localHeat * 0.8), localHeat);
    heatColor = planckBlackbody(heatTint);
  } else if (uPaletteMode < 1.5) {
    // Artistic: heat trail spectrum drives BOTH dust tint and heat color
    // Cold dust stays white, heated dust shifts through full Wien's cooling palette
    dust1Color = mix(COLD_WHT, heatTrailSpectrum(localHeat), clamp(localHeat, 0.0, 1.0));
    heatColor = heatTrailSpectrum(heatTint);
  } else {
    // Hybrid: blackbody thermal + artistic wavefronts
    dust1Color = mix(COLD_WHT * 0.7, planckBlackbody(localHeat * 0.9), localHeat);
    heatColor = planckBlackbody(heatTint);
  }
  // Heat color strongly dominates where waves have deposited energy
  dust1Color = mix(dust1Color, heatColor, clamp(heatTintRaw, 0.0, 0.95));
  color += dust1Color * sparks1;

  // Layer 2: violet dust — MID (depth 0.5)
  vec2 uv2 = warpedUV + cursorOffset * 0.5 * uParallaxDepth;
  float speed2 = speedMult * 0.8;
  float dust2 = snoise(uv2 * 500.0 + t * speed2 * 0.7 + 100.0);
  float sparks2 = smoothstep(0.82, 0.88, dust2) * 0.035 * brightMult;
  vec3 dust2Color;
  if (uPaletteMode < 0.5) {
    dust2Color = mix(vec3(0.15, 0.05, 0.08) * 0.6, planckBlackbody(localHeat * 0.5 + 0.2), localHeat);
  } else {
    dust2Color = mix(VIOLET * 0.6, energySpectrum(localHeat * 0.5 + 0.2), localHeat);
  }
  color += dust2Color * sparks2;

  // Layer 3: dense field — NEAR-MID (depth 0.7)
  vec2 uv3 = warpedUV + cursorOffset * 0.7 * uParallaxDepth;
  float speed3 = speedMult * 0.9;
  float dust3 = snoise(uv3 * 600.0 - t * speed3 * 0.3 + 50.0);
  float sparks3 = smoothstep(0.84, 0.90, dust3) * 0.025 * brightMult;
  vec3 dust3Color;
  if (uPaletteMode < 0.5) {
    dust3Color = mix(vec3(0.08, 0.02, 0.05) * 0.5, planckBlackbody(localHeat * 0.6 + 0.35), localHeat);
  } else {
    dust3Color = mix(INDIGO * 0.5, energySpectrum(localHeat * 0.6 + 0.35), localHeat);
  }
  color += dust3Color * sparks3;

  // Layer 4: bright pops — NEAR (depth 1.0)
  vec2 uv4 = warpedUV + cursorOffset * 1.0 * uParallaxDepth;
  float speed4 = speedMult;
  float popThreshold = mix(0.90, 0.75, localHeat);
  float pop = snoise(uv4 * 250.0 + t * speed4 * 2.2);
  float brightPop = smoothstep(popThreshold, popThreshold + 0.04, pop) * 0.18 * brightMult;
  vec3 popColor = mix(COLD_WHT, energySpectrum(localHeat * 0.9 + 0.4), localHeat);
  color += popColor * brightPop;

  // ══════════════════════════════════════════
  // THERMAL GLOW — continuous heat wake behind EM front
  // ══════════════════════════════════════════
  // Unlike sparse dust particles, this is a broad diffuse glow filling
  // the entire wave-swept area. Creates the visible thermal wake.
  float thermalGlow = heatResidual * uHeatIntensity;
  if (thermalGlow > 0.01) {
    // Wien's spectrum color based on local temperature
    vec3 glowColor;
    if (uPaletteMode < 0.5) {
      glowColor = planckBlackbody(heatTint);
    } else if (uPaletteMode < 1.5) {
      glowColor = heatTrailSpectrum(heatTint);
    } else {
      glowColor = planckBlackbody(heatTint);
    }
    // Diffuse glow — visible, continuous, not dependent on particle noise
    color += glowColor * thermalGlow * 0.2;
  }

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

  // ── Thin-film iridescence (soap-bubble / oil-slick physics) ──
  float filmThickness = 0.5 + 0.5 * sin(
    mouseDist * 25.0 + waveFieldEnvelope * 8.0 + t * 0.3
  );
  vec3 iridColor = energySpectrum(filmThickness);
  float iriStrength = smoothstep(0.0, 0.2, eNorm + uHeatField * 0.3)
                    * (1.0 - smoothstep(0.0, uHoverRadius * 3.0, mouseDist));
  color = mix(color, color * iridColor * 1.6, iriStrength * uIridescence);

  // ── Background star field with gravitational lensing ──
  // Stars are lensed by gravity sources → Einstein ring effect near catalysts
  vec2 starUV = vUv + lenzDisplacement * 3.0; // amplify lensing for visible distortion
  float starGrid = 80.0; // star density (lower = bigger cells = more visible)
  vec2 starCell = floor(starUV * starGrid);
  vec2 starFrac = fract(starUV * starGrid);
  // Pseudo-random hash per cell (deterministic star positions)
  float starHash = fract(sin(dot(starCell, vec2(127.1, 311.7))) * 43758.5453);
  float starHash2 = fract(sin(dot(starCell, vec2(269.5, 183.3))) * 76195.6397);
  // Star position within cell
  vec2 starPos = vec2(fract(starHash * 13.37), fract(starHash2 * 7.41));
  float starDist = length(starFrac - starPos);
  // Star brightness: varying sizes, subtle twinkle
  float twinkle = sin(t * (1.0 + starHash * 3.0) + starHash * 6.28) * 0.2 + 0.8;
  float starSize = 0.02 + starHash2 * 0.04; // varying star sizes
  float starBright = smoothstep(starSize, starSize * 0.2, starDist)
                   * step(0.65, starHash) // 35% of cells have stars
                   * twinkle;
  // Extra-bright stars (rare, large)
  float bigStar = smoothstep(0.06, 0.01, starDist) * step(0.95, starHash) * 2.0;
  starBright += bigStar;
  // Star color temperature: warm white to blue-white
  vec3 starColor = mix(vec3(1.0, 0.95, 0.85), vec3(0.85, 0.92, 1.0), starHash2);
  color += starColor * starBright * 0.8 * uStarField;

  // ── Multi-wavelength rendering ──
  float totalLum = dot(color, vec3(0.299, 0.587, 0.114));
  color = wavelengthRemap(color, totalLum);

  float vDist = length(vUv - 0.5) * 1.6;
  float vignette = 1.0 - pow(vDist, 1.5);
  color *= clamp(vignette, 0.0, 1.0);

  color = mix(color, HOT_WHITE, uRipFlash);
  color = max(color, BLACK);
  gl_FragColor = vec4(color, 1.0);
}
