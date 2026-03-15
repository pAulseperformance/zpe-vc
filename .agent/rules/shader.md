# GLSL Shader Rules

- Use `max()` not `+=` for heat accumulation — additive saturates to white and loses spatial gradients.
- Gate ALL contributions from a control uniform through the slider value — including secondary terms (e.g., `uHeatField * 0.3` must be `uHeatField * uHeatIntensity * 0.3`). Forgetting ungated terms causes "slider doesn't work" bugs.
- Use squared (`x*x`) brightness curves, not linear — linear makes residual values visible too long. Squared creates sharper perceptual thresholds (0.1→0.01 invisible, 0.5→0.25 visible).
- Heat physics uses ADSR envelope: `heatAttack` controls thermal wake delay and onset ramp behind EM wavefront, `heatDecay` controls tail fade via exponential cooling.
- Never add flat color overlay layers ("thermal glow") as a substitute for heating the particles themselves. Heat should modify particle color and brightness, not add a separate layer.
- Use `heatTrailSpectrum()` / `planckBlackbody()` for heat colors only on layer 1 (mixed via heatColor). Layers 2-4 use `energySpectrum()` for base color to avoid `BLACK` at `localHeat=0`.
