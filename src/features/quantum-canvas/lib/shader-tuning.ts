export interface ShaderTuning {
  waveSpeed: number
  waveFreq: number
  waveWidth: number
  emDamping: number
  gravDamping: number
  waveLifetime: number
  maxWaves: number
  lenzStrength: number
  lenzWake: number
  hoverRadius: number
  energyDecay: number
  velocityMult: number
  clickSpike: number
  ripThreshold: number
  parallaxDepth: number
  heatDecay: number
  heatAttack: number   // How quickly heat builds behind EM front (ADSR attack)
  heatIntensity: number
  interferenceBlend: number
  iridescence: number
  paletteMode: number  // 0=physical, 1=artistic, 2=hybrid
  starField: number    // 0=off, 1=full brightness
  wavelength: number   // 0=radio, 1=infrared, 2=visible, 3=xray, 4=gamma
  // Barrier / Diffraction
  barrierEnabled: number  // 0=off, 1=on
  barrierY: number        // Barrier Y position (UV space)
  slitCount: number       // 0=solid wall, 1=single, 2=double, 3=triple
  slitWidth: number       // Aperture width (UV units)
  slitSeparation: number  // Center-to-center slit distance
  diffSamples: number     // Huygens sample count
  // Preset Metadata (not sent to shader)
  autoSim?: {
    active: boolean
    mode: 'single' | 'dual' | 'gravity' | 'cluster' | 'random' | 'spiral'
    rate: number
    clicksOn?: boolean
    mouseOn?: boolean
    separation?: number
    mouseSpeed?: number
    mouseRadius?: number
  }
  ripBlocked?: boolean
  pointerHover?: boolean
  godMode?: boolean
  hoverWarp: number
  spinSpeed: number    // Parallax vortex rotation speed multiplier
  viewScale: number    // Camera zoom: 1.0=default, >1=zoomed out
  zoomMode: number     // 0=manual, 1=adaptive, 2=adaptive+confinement
  // Audio / Synth
  audioEnabled?: boolean
  synthWaveform?: 'sine' | 'sawtooth' | 'square' | 'triangle'
  synthFilterQ?: number
  audioReactive?: boolean
  synthScale?: string   // Scale quantizer: 'continuous' | 'minor-pentatonic' | etc.
  // UI
  hideCursor?: boolean
}

export const DEFAULT_TUNING: ShaderTuning = {
  waveSpeed: 1,
  waveFreq: 150,
  waveWidth: 0.1,
  emDamping: 1.6,
  gravDamping: 1.6,
  waveLifetime: 15,
  maxWaves: 10,
  lenzStrength: 0.12,
  lenzWake: 0.6,
  hoverRadius: 0.05,
  energyDecay: 30,
  velocityMult: 30,
  clickSpike: 20,
  ripThreshold: 200,
  parallaxDepth: 0,
  heatDecay: 0.2,
  heatAttack: 0.00,
  heatIntensity: 0.3,     // Warm but not blown out
  interferenceBlend: 0.1, // Subtle diffraction focus
  iridescence: 1.0,       // Max physical spectrum blending
  paletteMode: 0,         // Physical blackbody
  starField: 0.0,
  wavelength: 2,          // Visible spectrum
  
  // Diffraction Basics
  barrierEnabled: 0.0,
  barrierY: 0.5,
  slitCount: 2.0,
  slitWidth: 0.05,
  slitSeparation: 0.20,
  diffSamples: 8.0,

  // UI State
  pointerHover: true,
  hoverWarp: 0.1,
  spinSpeed: 1.0,
  viewScale: 1.0,
  zoomMode: 0,
  // Audio defaults
  audioEnabled: false,
  synthWaveform: 'sine',
  synthFilterQ: 2.0,
  audioReactive: true,
  synthScale: 'continuous',
  // UI defaults
  hideCursor: true,
}

export const BUILT_IN_PRESETS: Record<string, ShaderTuning> = {
  'Default': {
    ...DEFAULT_TUNING
  },
  'Stable Nova': {
    ...DEFAULT_TUNING,
    paletteMode: 1,
    wavelength: 2,
    waveSpeed: 0.35,
    waveFreq: 150,
    waveWidth: 0.1,
    emDamping: 3.1,
    gravDamping: 0.05,
    waveLifetime: 1.5,
    maxWaves: 100,
    lenzStrength: 0.5,
    lenzWake: 0.6,
    hoverRadius: 0.05,
    energyDecay: 30,
    velocityMult: 5,
    clickSpike: 5,
    ripThreshold: 30,
    parallaxDepth: 0.15,
    heatDecay: 2.0,
    heatAttack: 0.0,
    heatIntensity: 0.65,
    interferenceBlend: 0.15,
    iridescence: 1.0,
    autoSim: {
      active: true,
      mode: 'single',
      rate: 5.5,
    },
    ripBlocked: true,
  },
  'Purple Nebula': {
    ...DEFAULT_TUNING,
    paletteMode: 0, // Physical
    wavelength: 2,  // Visible
    waveSpeed: 2.00,
    waveFreq: 25,
    waveWidth: 0.100,
    emDamping: 10.00,
    gravDamping: 2.90,
    waveLifetime: 15.00,
    maxWaves: 15,
    lenzStrength: 0.500,
    lenzWake: 0.60,
    hoverRadius: 0.05,
    energyDecay: 2,
    velocityMult: 30,
    clickSpike: 20,
    ripThreshold: 200,
    parallaxDepth: 0.150,
    heatDecay: 0.70,
    heatAttack: 1.00,
    heatIntensity: 1.00,
    interferenceBlend: 0.02,
    iridescence: 1.00,
    autoSim: {
      active: true,
      mode: 'single',
      rate: 10,
    },
    ripBlocked: true,
  },
  'Pulsar': {
    ...DEFAULT_TUNING,
    paletteMode: 0, // Physical
    wavelength: 2,  // Visible / HUMAN
    waveSpeed: 0.10, // Slow creeping phase
    waveFreq: 10,
    waveWidth: 0.005,
    emDamping: 0.10,
    gravDamping: 0.05,
    waveLifetime: 1.00,
    maxWaves: 5,
    lenzStrength: 0.020,
    lenzWake: 0.00,
    hoverRadius: 0.05,
    energyDecay: 2,
    velocityMult: 5,
    clickSpike: 5,
    ripThreshold: 30,
    parallaxDepth: 0.020,
    heatDecay: 0.05,
    heatAttack: 0.00,
    heatIntensity: 0.35,
    interferenceBlend: 0.20,
    iridescence: 0.00,
    starField: 1.00,
    autoSim: {
      active: true,
      mode: 'single',
      rate: 10,
    },
    ripBlocked: true,
  },
  'Starburst': {
    ...DEFAULT_TUNING,
    paletteMode: 1, // Artistic
    wavelength: 2,  // Visible / HUMAN
    waveSpeed: 0.10,
    waveFreq: 7500,
    waveWidth: 5,
    emDamping: 6.7,
    gravDamping: 0.05,
    waveLifetime: 1,
    maxWaves: 40,
    lenzStrength: 0,
    lenzWake: 4.19,
    hoverRadius: 0.7,
    energyDecay: 2,
    velocityMult: 5,
    clickSpike: 5,
    ripThreshold: 30,
    parallaxDepth: 0.86,
    heatDecay: 56,
    heatAttack: 35,
    heatIntensity: 0.45,
    interferenceBlend: 3.65,
    iridescence: 0,
    starField: 19.2,
    hoverWarp: 0,
    spinSpeed: 19.5,
    godMode: true,
    autoSim: {
      active: true,
      mode: 'single',
      rate: 10,
    },
    ripBlocked: true,
  },
  'Singularity': {
    ...DEFAULT_TUNING,
    paletteMode: 1, // Artistic
    wavelength: 2,
    waveSpeed: 0.1,
    waveFreq: 10,
    waveWidth: 0.08,
    emDamping: 6.7,
    gravDamping: 8.2,
    waveLifetime: 1,
    maxWaves: 40,
    lenzStrength: 0,
    lenzWake: 0,
    energyDecay: 2,
    velocityMult: 5,
    clickSpike: 5,
    ripThreshold: 30,
    parallaxDepth: 0.86,
    heatDecay: 56,
    heatAttack: 35,
    heatIntensity: 0.45,
    interferenceBlend: 3.65,
    iridescence: 0,
    starField: 19.2,
    hoverWarp: 0,
    spinSpeed: 19.5,
    godMode: true,
    autoSim: {
      active: true,
      mode: 'single',
      rate: 10,
      clicksOn: true,
      mouseOn: false,
    },
    ripBlocked: true,
  },
  'Prism Star': {
    ...DEFAULT_TUNING,
    paletteMode: 1, // Artistic
    wavelength: 2,
    waveSpeed: 0.1,
    waveFreq: 10,
    waveWidth: 0.215,
    emDamping: 6.7,
    gravDamping: 8.2,
    waveLifetime: 1,
    maxWaves: 40,
    lenzStrength: 0,
    lenzWake: 0,
    energyDecay: 200,
    velocityMult: 0,
    clickSpike: 20,
    ripThreshold: 30,
    parallaxDepth: 0,
    heatDecay: 56,
    heatAttack: 35,
    heatIntensity: 0.45,
    interferenceBlend: 3.65,
    iridescence: 50,
    starField: 19.2,
    hoverWarp: 0,
    spinSpeed: 19.5,
    godMode: true,
    autoSim: {
      active: true,
      mode: 'single',
      rate: 10,
      clicksOn: true,
      mouseOn: false,
    },
    ripBlocked: true,
  },
  'Twin Prism': {
    ...DEFAULT_TUNING,
    paletteMode: 1, // Artistic
    wavelength: 2,
    waveSpeed: 0.1,
    waveFreq: 10,
    waveWidth: 0.215,
    emDamping: 6.7,
    gravDamping: 8.2,
    waveLifetime: 1,
    maxWaves: 40,
    lenzStrength: 0,
    lenzWake: 0,
    energyDecay: 400,
    velocityMult: 0,
    clickSpike: 20,
    ripThreshold: 30,
    parallaxDepth: 0,
    heatDecay: 56,
    heatAttack: 35,
    heatIntensity: 0.45,
    interferenceBlend: 3.65,
    iridescence: 50,
    starField: 19.2,
    hoverWarp: 0,
    spinSpeed: 19.5,
    godMode: true,
    autoSim: {
      active: true,
      mode: 'dual',
      rate: 10,
      clicksOn: true,
      mouseOn: true,
    },
    ripBlocked: true,
  },
  'Orbit': {
    ...DEFAULT_TUNING,
    paletteMode: 0, // Physical
    wavelength: 2,
    waveSpeed: 1.9,
    waveFreq: 150,
    waveWidth: 0.1,
    emDamping: 1.6,
    gravDamping: 1.6,
    waveLifetime: 15,
    maxWaves: 10,
    lenzStrength: 0.12,
    lenzWake: 0.6,
    energyDecay: 30,
    velocityMult: 30,
    clickSpike: 20,
    ripThreshold: 200,
    parallaxDepth: 0,
    heatDecay: 0.75,
    heatAttack: 0,
    heatIntensity: 0.3,
    interferenceBlend: 0.15,
    iridescence: 0.85,
    starField: 0.5,
    hoverWarp: 0.6,
    spinSpeed: 1.9,
    zoomMode: 1, // Adaptive zoom
    autoSim: {
      active: true,
      mode: 'gravity',
      rate: 10,
      clicksOn: true,
      mouseOn: true,
    },
    ripBlocked: true,
  },
  'Galaxy Cluster': {
    ...DEFAULT_TUNING,
    paletteMode: 2, // Hybrid
    waveSpeed: 0.3,
    waveFreq: 150,
    starField: 0.8,
    emDamping: 1.2,
    gravDamping: 0.5,
    viewScale: 2.5,
    zoomMode: 0,
    autoSim: {
      active: true,
      mode: 'cluster',
      rate: 8,
      clicksOn: true,
      mouseOn: false,
    },
    ripBlocked: true,
  },
  'Supermassive': {
    ...DEFAULT_TUNING,
    waveSpeed: 100,
    waveFreq: 7500,
    waveWidth: 5,
    emDamping: 1.6,
    gravDamping: 1.6,
    waveLifetime: 15,
    maxWaves: 85,
    lenzStrength: 0,
    lenzWake: 0,
    hoverRadius: 30,
    energyDecay: 30,
    velocityMult: 30,
    clickSpike: 20,
    ripThreshold: 200,
    parallaxDepth: 0,
    heatDecay: 7.8,
    heatAttack: 24.25,
    heatIntensity: 1.3,
    interferenceBlend: 45.15,
    iridescence: 0.85,
    paletteMode: 0,
    starField: 0.5,
    wavelength: 2,
    barrierEnabled: 0,
    barrierY: 0.5,
    slitCount: 2,
    slitWidth: 0.05,
    slitSeparation: 0.2,
    diffSamples: 8,
    pointerHover: true,
    hoverWarp: 0.6,
    spinSpeed: 250,
    viewScale: 150,
    zoomMode: 0,
    autoSim: {
      active: true,
      mode: 'gravity',
      rate: 10,
      clicksOn: true,
      mouseOn: true,
    },
    ripBlocked: true,
    godMode: true,
  },
  'Hypernova': {
    ...DEFAULT_TUNING,
    waveSpeed: 0.1,
    waveFreq: 375000,
    waveWidth: 0.005,
    emDamping: 0.1,
    gravDamping: 1,
    waveLifetime: 750,
    maxWaves: 50,
    lenzStrength: 2.675,
    lenzWake: 2.25,
    hoverRadius: 0.05,
    energyDecay: 85,
    velocityMult: 5,
    clickSpike: 80,
    ripThreshold: 1160,
    parallaxDepth: 16.65,
    heatDecay: 100,
    heatAttack: 50,
    heatIntensity: 0,
    interferenceBlend: 26.85,
    iridescence: 666.8,
    paletteMode: 0,
    starField: 1,
    wavelength: 2,
    barrierEnabled: 0,
    barrierY: 0.5,
    slitCount: 2,
    slitWidth: 0.05,
    slitSeparation: 0.2,
    diffSamples: 8,
    pointerHover: true,
    hoverWarp: 50,
    spinSpeed: 3,
    viewScale: 2.695555547490532,
    zoomMode: 0,
    autoSim: {
      active: false,
      mode: 'gravity',
      rate: 10,
      clicksOn: true,
      mouseOn: true,
    },
    ripBlocked: true,
    godMode: true,
  },
  'Wobverse': {
    ...DEFAULT_TUNING,
    waveSpeed: 16.9,
    waveFreq: 110710,
    waveWidth: 5,
    emDamping: 10.8,
    gravDamping: 5.95,
    waveLifetime: 406,
    maxWaves: 10,
    lenzStrength: 0,
    lenzWake: 0,
    hoverRadius: 0.1,
    energyDecay: 2,
    velocityMult: 10,
    clickSpike: 20,
    ripThreshold: 610,
    parallaxDepth: 13.4,
    heatDecay: 23.55,
    heatAttack: 14,
    heatIntensity: 0,
    interferenceBlend: 31,
    iridescence: 969,
    paletteMode: 1,
    starField: 5,
    wavelength: 2,
    pointerHover: false,
    hoverWarp: 0,
    spinSpeed: 21.6,
    viewScale: 87.1,
    zoomMode: 0,
    godMode: true,
  },
  'God\'s Eye': {
    ...DEFAULT_TUNING,
    waveSpeed: 16.9,
    waveFreq: 110710,
    waveWidth: 5,
    emDamping: 10.8,
    gravDamping: 5.95,
    waveLifetime: 406,
    maxWaves: 10,
    lenzStrength: 0,
    lenzWake: 0,
    hoverRadius: 0.1,
    energyDecay: 2,
    velocityMult: 10,
    clickSpike: 20,
    ripThreshold: 610,
    parallaxDepth: 13.4,
    heatDecay: 23.55,
    heatAttack: 14,
    heatIntensity: 0,
    interferenceBlend: 31,
    iridescence: 969,
    paletteMode: 1,
    starField: 5,
    wavelength: 2,
    barrierEnabled: 0,
    barrierY: 0.5,
    slitCount: 2,
    slitWidth: 0.05,
    slitSeparation: 0.2,
    diffSamples: 8,
    pointerHover: false,
    hoverWarp: 0,
    spinSpeed: 21.6,
    viewScale: 87.1,
    zoomMode: 0,
    audioEnabled: false,
    synthWaveform: 'sine',
    synthFilterQ: 2,
    audioReactive: true,
    hideCursor: true,
    godMode: true,
  },
}

export interface SliderDef {
  key: keyof Omit<ShaderTuning, 'autoSim' | 'ripBlocked' | 'pointerHover' | 'godMode' | 'zoomMode'>
  label: string
  min: number
  max: number
  step: number
}

export const MOUSE_SLIDERS: SliderDef[] = [
  { key: 'hoverRadius', label: 'Hover Radius', min: 0.05, max: 0.6, step: 0.05 },
  { key: 'hoverWarp', label: 'Hover Warp', min: 0.0, max: 50.0, step: 0.1 },
]

export const OBJECT_SLIDERS: SliderDef[] = [
  { key: 'waveSpeed', label: 'Wave Speed', min: 0.1, max: 100.0, step: 0.05 },
  { key: 'waveFreq', label: 'Wave Freq', min: 10, max: 500000, step: 100 },
  { key: 'waveWidth', label: 'Wave Width', min: 0.005, max: 5.0, step: 0.005 },
  { key: 'emDamping', label: 'EM Damping', min: 0.1, max: 20, step: 0.1 },
  { key: 'gravDamping', label: 'Grav Damping', min: 0.05, max: 20, step: 0.05 },
  { key: 'waveLifetime', label: 'Wave Life (s)', min: 1, max: 1000, step: 5 },
  { key: 'maxWaves', label: 'Max Waves', min: 5, max: 100, step: 5 },
  { key: 'lenzStrength', label: 'Lenz Strength', min: 0.0, max: 5.0, step: 0.05 },
  { key: 'lenzWake', label: 'Lenz Wake', min: 0.0, max: 5.0, step: 0.05 },
  { key: 'energyDecay', label: 'Energy Decay/s', min: 2, max: 100, step: 1 },
  { key: 'velocityMult', label: 'Velocity Mult', min: 5, max: 60, step: 5 },
  { key: 'clickSpike', label: 'Click Spike', min: 5, max: 100, step: 5 },
  { key: 'ripThreshold', label: 'Rip Threshold', min: 30, max: 2000, step: 10 },
  { key: 'heatDecay', label: 'Heat Decay', min: 0.05, max: 100.0, step: 0.5 },
  { key: 'heatAttack', label: 'Heat Attack', min: 0.0, max: 50.0, step: 0.5 },
  { key: 'heatIntensity', label: 'Heat Intensity', min: 0.0, max: 5.0, step: 0.05 },
  { key: 'interferenceBlend', label: 'Interference', min: 0.0, max: 50.0, step: 0.5 },
]

export const UNIVERSE_SLIDERS: SliderDef[] = [
  { key: 'parallaxDepth', label: 'Parallax', min: 0, max: 20.0, step: 0.1 },
  { key: 'spinSpeed', label: 'Spin Speed', min: 0, max: 250, step: 0.1 },
  { key: 'iridescence', label: 'Iridescence', min: 0, max: 1000, step: 1 },
  { key: 'starField', label: 'Star Field', min: 0, max: 20, step: 0.1 },
  { key: 'viewScale', label: 'View Scale', min: 0.5, max: 150, step: 0.1 },
]

/** All sliders combined (backward compat) */
export const SLIDERS: SliderDef[] = [...MOUSE_SLIDERS, ...OBJECT_SLIDERS, ...UNIVERSE_SLIDERS]
