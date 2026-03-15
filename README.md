# ZPE — Zero-Point Energy

Interactive quantum vacuum fluctuation visualizer for [zpe.vc](https://zpe.vc). A WebGL fragment shader that simulates EM wave propagation, gravitational lensing, wave interference, Doppler shift, and thermal radiation — all rendered in real-time with physically grounded color models.

## Quick Start

```sh
npm install
npm run dev
# Open http://localhost:5173
```

In dev mode, click the **⚙** icon (top-right) to open the **Shader Tuning** panel.

## What You're Looking At

The dark canvas is a quantum vacuum — not empty, but seething with zero-point energy fluctuations. Move your mouse to excite the field. Click to create **catalyst events** (EM wave sources). Rapid movement builds energy; enough energy triggers a **wall rip** — a phase transition.

### Physics Simulated

| Phenomenon | Real Physics | Implementation |
|-----------|--------------|----------------|
| EM wave propagation | Maxwell's equations | Fractal-warped wavefronts with multi-octave noise |
| Wave interference | Superposition principle | Signed field accumulation — constructive/destructive |
| Gravitational lensing | General Relativity | UV displacement toward mass/energy sources |
| Gravitational waves | LIGO (2015) | Signed gravity field interference between sources |
| Gravitational redshift | GR time dilation | Spectral shift near collapse zones |
| Doppler shift | Special Relativity | Color shift based on source-observer velocity |
| Quantum tunneling | QM barrier penetration | 5% energy leak through destructive voids |
| Blackbody radiation | Planck's law | Temperature-mapped stellar emission colors |
| Thermal cooling | Wien's displacement law | White-hot → yellow → orange → red → infrared |
| Thin-film iridescence | Wave optics | Film thickness modulation via mouse proximity |
| Energy-mass equivalence | E=mc² | Lensing strength scales with accumulated energy |
| Inverse-square gravity | Newton's law | 1/(1+r²) gravitational decay |

## Dev Panel Controls

Only visible in development mode (`npm run dev`).

### Mode Selectors

| Control | Options | What it does |
|---------|---------|-------------|
| **Palette** | 🔬 Physical / 🎨 Artistic / ⚗️ Hybrid | Color model for all layers |
| **Band** | 📻 Radio / 🔴 IR / 👁 Visible / 💎 X-Ray / ☢️ Gamma | Multi-wavelength observation mode |
| **Audio** | 🔊 / 🔇 | WebAudio feedback tied to energy + interference |

### Sliders (18 parameters)

| Slider | Range | Physics Control |
|--------|-------|----------------|
| Wave Speed | 0.1 – 2.0 | Wavefront propagation velocity |
| Wave Freq | 10 – 150 | Spatial frequency of EM oscillation |
| Wave Width | 0.005 – 0.1 | Wavefront ring thickness |
| EM Damping | 0.1 – 10 | Exponential wave amplitude decay rate |
| Grav Damping | 0.05 – 5 | Inverse-square gravity falloff rate |
| Wave Life | 1 – 15s | How long waves persist |
| Max Waves | 5 – 100 | Catalyst buffer size |
| Lenz Strength | 0 – 0.5 | Gravitational lensing magnitude |
| Lenz Wake | 0 – 0.6 | Wake size behind wavefront |
| Hover Radius | 0.05 – 0.6 | Cursor influence radius |
| Energy Decay/s | 2 – 30 | Energy dissipation rate |
| Velocity Mult | 5 – 60 | Mouse velocity → energy conversion |
| Click Spike | 5 – 50 | Energy added per click |
| Rip Threshold | 30 – 200 | Energy needed for wall rip |
| Parallax | 0 – 0.15 | Dust layer depth offset |
| Heat Decay | 0.2 – 5.0 | Thermal trail fade rate |
| Heat Intensity | 0 – 1.0 | Heat trail brightness |
| Interference | 0 – 1.0 | Blend between additive and interference modes |
| Iridescence | 0 – 1.0 | Thin-film color effect strength |
| Star Field | 0 – 1.0 | Background star brightness |

### Simulation Tools

- **Energy Lock**: 🔒 Pin energy at a fixed value for testing
- **Wall Rip Toggle**: Prevent entering rip zone during development
- **Auto-Sim Clicks**: Dual-origin simultaneous emission for interference testing
- **Auto-Sim Mouse**: Figure-8 cursor movement pattern

## Tech Stack

- **React 19** + TypeScript (strict)
- **Three.js** via React Three Fiber (R3F)
- **GLSL** fragment shader (custom, ~550 LOC)
- **Vite** for dev/build
- **Tailwind CSS v4** for UI
- **WebAudio API** for audio feedback
- **Cloudflare Workers** for hosting

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for file structure and data flow.
See [PHYSICS.md](./PHYSICS.md) for detailed physics implementation notes.

## Deploy

Connected to Cloudflare via GitHub integration. Push to `main` triggers auto-deploy to `zpe.vc`.

```sh
npm run build    # tsc + vite build
```
