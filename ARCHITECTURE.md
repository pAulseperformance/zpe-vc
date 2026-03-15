# Architecture — ZPE Quantum Shader

## File Structure

```
src/
├── App.tsx                          # Root: state, audio lifecycle, sim wiring
├── main.tsx                         # React entry point
├── glsl.d.ts                        # GLSL import type declarations
│
├── app/
│   └── globals.css                  # Tailwind v4 + design tokens
│
├── features/
│   └── quantum-canvas/
│       ├── index.ts                 # Public API (FSD barrel)
│       ├── lib/
│       │   ├── shaders/
│       │   │   ├── quantum.frag     # Fragment shader (~550 LOC)
│       │   │   └── quantum.vert     # Vertex shader (passthrough)
│       │   ├── use-quantum-audio.ts # WebAudio engine (3 oscillators)
│       │   └── use-scroll-progress.ts
│       └── ui/
│           ├── QuantumCanvas.tsx     # R3F Canvas + ShaderPlane + uniforms
│           └── DevPanel.tsx          # Dev controls + presets + auto-sim
│
├── shared/
│   └── ui/                          # Shared UI primitives
│
└── widgets/
    └── terminal-intake/             # Post-rip terminal UI
```

## Data Flow

```
┌─────────────┐     tuning, energy,     ┌──────────────────┐
│   App.tsx    │ ──── sim state ────────▶│  QuantumCanvas   │
│             │                         │   (R3F Canvas)   │
│  - state    │◀──── onEnergyChange ────│                  │
│  - audio    │                         │  ┌────────────┐  │
│  - sim      │                         │  │ ShaderPlane│  │
└──────┬──────┘                         │  │ useFrame() │  │
       │                                │  │  ↓ uniforms│  │
       │  tuning, toggles              │  └─────┬──────┘  │
       ▼                                │        │         │
┌─────────────┐                         │        ▼         │
│  DevPanel   │                         │  ┌────────────┐  │
│             │                         │  │quantum.frag│  │
│ - sliders   │                         │  │ (GPU)      │  │
│ - presets   │                         │  └────────────┘  │
│ - auto-sim  │                         └──────────────────┘
│ - palette   │
│ - wavelength│
│ - audio 🔊  │
└─────────────┘
```

## Uniform Pipeline

All shader parameters flow through this pipeline:

1. **DevPanel** stores `ShaderTuning` object (persisted to localStorage)
2. **App.tsx** holds tuning state + ephemeral state (energy, sim, audio)
3. **QuantumCanvas** receives tuning as props
4. **ShaderPlane.useFrame()** copies tuning values to GPU uniforms every frame
5. **quantum.frag** reads uniforms and renders

### Uniform Registry

| Uniform | Type | Source | Purpose |
|---------|------|--------|---------|
| `uTime` | float | clock | Animation time |
| `uResolution` | vec2 | viewport | Aspect ratio correction |
| `uMouse` | vec2 | pointer | Cursor UV position |
| `uMouseVelocity` | vec2 | computed | Cursor direction for Doppler |
| `uEnergy` | float | accumulated | Current energy level |
| `uRipFlash` | float | event | Wall rip white flash |
| `uCatalysts[100]` | vec2[] | clicks | Wave source positions |
| `uCatalystTimes[100]` | float[] | clicks | Wave source birth times |
| `uCatalystCount` | int | count | Active wave count |
| `uWaveSpeed` | float | slider | Wavefront propagation speed |
| `uWaveFreq` | float | slider | Spatial oscillation frequency |
| `uWaveWidth` | float | slider | Wavefront ring thickness |
| `uEmDamping` | float | slider | EM amplitude decay rate |
| `uGravDamping` | float | slider | Gravity inverse-square rate |
| `uLenzStrength` | float | slider | Gravitational lensing power |
| `uLenzWake` | float | slider | Wake zone behind wavefront |
| `uHoverRadius` | float | slider | Cursor influence radius |
| `uWaveLifetime` | float | slider | Wave persistence duration |
| `uParallaxDepth` | float | slider | Dust depth parallax factor |
| `uHeatDecay` | float | slider | Heat trail fade rate |
| `uHeatIntensity` | float | slider | Heat trail brightness |
| `uInterferenceBlend` | float | slider | Additive vs interference mix |
| `uHeatField` | float | computed | Persistent global heat level |
| `uIridescence` | float | slider | Thin-film effect strength |
| `uPaletteMode` | float | toggle | 0=physical, 1=artistic, 2=hybrid |
| `uStarField` | float | slider | Star field brightness |
| `uWavelength` | float | toggle | 0=radio…4=gamma |
| `uMouseVelocity` | vec2 | computed | Cursor velocity vector |

## Audio Engine

`use-quantum-audio.ts` creates 3 persistent oscillators:

| Layer | Waveform | Frequency | Volume Driver |
|-------|----------|-----------|---------------|
| Drone | sine | 55-220Hz (energy) | energy level |
| Shimmer | triangle | drone × 3.01 | interference ratio |
| Sub-bass | sine | drone × 0.5 | energy² |

Click transients: one-shot sine (800-1200Hz, 150ms decay) per catalyst.

## Preset System

Presets are stored in `localStorage` under key `zpe-shader-presets`. Active tuning persists under `zpe-shader-active`. The DevPanel provides save/load/delete for named presets.
