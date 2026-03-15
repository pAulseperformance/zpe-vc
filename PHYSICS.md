# Physics Implementation — ZPE Quantum Shader

Detailed notes on how each physical phenomenon is implemented in `quantum.frag`.

---

## 1. EM Wave Propagation

**Real physics:** Maxwell's equations describe electromagnetic wave propagation. Waves expand spherically from a point source at speed c, with amplitude decaying over distance.

**Implementation:**
- Each catalyst (click) creates a wavefront expanding at `uWaveSpeed`
- Distance is fractal-warped via 3 octaves of simplex noise → organic, non-circular wavefronts
- EM amplitude decays exponentially with age: `exp(-age * uEmDamping)`
- Wavefront ring is a sharp `smoothstep` band around `dist == waveFront`
- Multi-octave oscillation for visual complexity: two noise-modulated sine waves

```glsl
float emWaveSigned = sin(dist * uWaveFreq - age * 30.0) * n1
                   + sin(dist * uWaveFreq * 1.7 + age * 15.0) * n2 * 0.4;
```

---

## 2. Wave Interference

**Real physics:** When two coherent waves overlap, they superpose. Where crests align → constructive (bright). Where crest meets trough → destructive (dark).

**Implementation:**
- **Extended field**: Wave EM field persists behind the wavefront (not just at the ring), decaying exponentially: `exp(-max(waveFront - dist, 0.0) * 3.0)`
- **Clean sine for interference**: A separate pure sine wave (no noise, no harmonics) prevents self-interference artifacts from a single source
- **Signed accumulation**: `waveFieldSigned += cleanWave * extendedField` — fields add algebraically
- **Envelope accumulation**: `waveFieldEnvelope += abs(cleanWave) * extendedField` — maximum possible brightness
- **Interference factor**: `|signed| / envelope` = 1.0 at constructive, 0.0 at destructive
- **Quantum tunneling**: `tunnelLeak = 0.05` — destructive voids never go fully black (5% leak)

**Why clean sine matters:** Multi-octave noise causes `sin(d*f) + sin(d*f*1.7)` to self-interfere within a single source. The clean sine ensures interference only appears between spatially distinct sources.

---

## 3. Gravitational Lensing

**Real physics:** Mass-energy curves spacetime (General Relativity). Light passing near massive objects follows curved geodesics, appearing to bend toward the mass.

**Implementation:**
- `lenzDisplacement` accumulates a UV offset vector pointing toward each catalyst center
- **Collapse phase**: Young waves have a wake-shaped gravity zone. As waves age, gravity collapses to a point (simulating gravitational collapse from extended object → compact remnant)
- **Energy-proportional**: `lenzMag * (0.3 + eNorm * 0.7)` — E=mc² means more energy = stronger curvature
- **Inverse-square decay**: `1.0 / (1.0 + age² * uGravDamping²)` — real gravity doesn't decay exponentially

```glsl
// Young wave: gravity follows wavefront wake
float behindFront = smoothstep(waveFront, waveFront - effectiveWake, rawDist);
// Old wave: gravity collapses to point source
float pointCollapse = exp(-rawDist² * (20.0 + collapsePhase * 300.0));
// Transition from distributed → point
float lenzMask = mix(behindFront, pointCollapse, collapsePhase²);
```

---

## 4. Gravitational Wave Interference

**Real physics:** LIGO detected gravitational wave interference in 2015. Gravitational waves, like EM waves, superpose — two sources can cancel each other's spacetime curvature at specific locations.

**Implementation:**
- Mirrors EM interference: `gravFieldSigned` / `gravFieldEnvelope` accumulation
- Lower frequency than EM: `uWaveFreq * 0.3` (real gravitational wavelengths are much longer)
- Softer power curve: `pow(ratio, 0.5)` vs EM's `pow(ratio, 0.3)` — gravity is weaker
- Applied multiplicatively to `lenzDisplacement` — cancelled gravity = no lensing at that point

---

## 5. Gravitational Redshift

**Real physics:** Photons climbing out of a gravity well lose energy → wavelength increases → color shifts red. First predicted by Einstein (1907), confirmed by Pound-Rebka experiment (1959).

**Implementation:**
- `redshift = lenzMask * collapsePhase * 0.3`
- Subtracts from `specBase`, shifting the color palette index toward lower (redder) values
- Strongest near collapse zones where both lensing and collapse phase are high
- Combined with Doppler shift for total spectral modification

---

## 6. Doppler Shift

**Real physics:** Waves from an approaching source are compressed (blueshift), from a receding source are stretched (redshift). Follows Special Relativity.

**Implementation:**
- `uMouseVelocity` (vec2) gives cursor direction and speed per frame
- `dot(waveDir, uMouseVelocity)` = positive when wave propagates toward cursor motion
- Positive dot → adds to `specBase` (blueshift). Negative → subtracts (redshift)
- Multiplied by 2.0 for visual prominence

---

## 7. Thermal Radiation (Blackbody)

**Real physics:** All objects with temperature > 0K emit thermal radiation. The spectrum follows Planck's law. Wien's displacement law: peak wavelength ∝ 1/temperature.

### `planckBlackbody(temp)` — Physical palette mode
Approximates CIE color matching for blackbody emitters:
- 0.0: black (cold)
- 0.15: dark red ember (~800K — first visible radiation)
- 0.3: cherry red (~1500K)
- 0.45: orange (~2500K)
- 0.6: yellow (~3500K)
- 0.8: near-white (~5000K — like our Sun)
- 1.0: blue-white (~8000K+ — hot stars like Sirius)

### `heatTrailSpectrum(heat)` — Artistic mode heat trails
Follows the same Wien's law progression but tuned for visual impact as heat trails cool:
- Fresh energy deposit → white-hot
- Cooling → yellow → orange → cherry red → dark ember → black (infrared)

### `energySpectrum(intensity)` — Artistic palette mode
Cosine palette (Inigo Quilez technique) that cycles through vibrant rainbow colors. Not physically accurate but visually striking.

---

## 8. Thin-Film Iridescence

**Real physics:** Thin transparent films (soap bubbles, oil slicks) create color by constructive/destructive interference between reflections from the front and back surfaces. Color depends on film thickness and viewing angle.

**Implementation:**
```glsl
float filmThickness = 0.5 + 0.5 * sin(
  mouseDist * 25.0 + waveFieldEnvelope * 8.0 + t * 0.3
);
```
- Film thickness varies with distance from cursor and wave field state
- Color mapped through `energySpectrum(filmThickness)`
- Strength modulated by energy and proximity: fades with distance from cursor
- `uIridescence` slider controls overall effect intensity

---

## 9. Multi-Wavelength Rendering

**Real physics:** Astronomers observe the same object at different wavelengths to see different physics. Radio telescopes see synchrotron radiation, infrared sees thermal dust, X-ray sees accretion disks.

**Implementation:** `wavelengthRemap(color, intensity)` transforms the final color buffer:

| Band | Method | What it emphasizes |
|------|--------|-------------------|
| Radio (📻) | Luminance → warm red | Large-scale diffuse structure |
| Infrared (🔴) | Luminance → orange-amber | Thermal emission |
| Visible (👁) | Passthrough | Default human perception |
| X-Ray (💎) | Luminance^0.6 → blue-white | High-energy dense regions |
| Gamma (☢️) | Luminance^0.4 → violet/magenta | Extreme energy events |

Applied to the entire scene after compositing, before vignette.

---

## 10. Background Star Field

**Real physics:** Background stars are gravitationally lensed by foreground mass — this is how Einstein rings and gravitational arcs are observed.

**Implementation:**
- 80×80 grid with pseudo-random hash per cell (deterministic positions)
- `starUV = vUv + lenzDisplacement * 3.0` — stars are displaced by gravity field
- 35% of cells contain stars, 5% contain rare bright "anchor" stars
- Varying sizes (0.02-0.06 radius) and twinkling via time-modulated sine
- Color temperature varies from warm-white to blue-white per star

---

## Shader Render Pipeline

```
1. Aspect ratio correction → UV, mouse
2. Energy normalization → eNorm
3. Hover influence → warp, brightness, speed
4. Per-catalyst loop (max 100):
   a. Fractal-warped distance
   b. Wavefront ring (visual)
   c. Extended EM field (interference)
   d. Clean sine accumulation (signed + envelope)
   e. Lenz collapse (wake → point)
   f. Gravitational redshift + Doppler → specBase
   g. Wave color (chromatic dispersion)
   h. Heat trail accumulation
   i. Gravitational field accumulation
   j. Lenz displacement accumulation
5. Gravity interference → modulate lenz displacement
6. EM interference → constructive/destructive compositing
7. Quantum tunneling → void leak
8. Palette mode branching → catalyst color
9. 4 dust layers (parallax depth)
10. Cursor aura (fractal, breathing)
11. Catalyst color composite
12. Thin-film iridescence
13. Background stars (gravitationally lensed)
14. Multi-wavelength remap
15. Vignette
16. Rip flash overlay
17. gl_FragColor output
```
