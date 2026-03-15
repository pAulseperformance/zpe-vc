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
    mode: 'single' | 'dual'
    rate: number
  }
  ripBlocked?: boolean
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
  heatAttack: 0.65,
  heatIntensity: 0.3,
  interferenceBlend: 0,
  iridescence: 0.6,
  paletteMode: 0,   // Default: physical
  starField: 0,
  wavelength: 2,     // Visible light
  barrierEnabled: 0,
  barrierY: 0.27,
  slitCount: 3,
  slitWidth: 0.04,
  slitSeparation: 0.15,
  diffSamples: 12,
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
  }
}

export interface SliderDef {
  key: keyof Omit<ShaderTuning, 'autoSim' | 'ripBlocked'>
  label: string
  min: number
  max: number
  step: number
}

export const SLIDERS: SliderDef[] = [
  { key: 'waveSpeed', label: 'Wave Speed', min: 0.1, max: 2.0, step: 0.05 },
  { key: 'waveFreq', label: 'Wave Freq', min: 10, max: 150, step: 5 },
  { key: 'waveWidth', label: 'Wave Width', min: 0.005, max: 0.1, step: 0.005 },
  { key: 'emDamping', label: 'EM Damping', min: 0.1, max: 10, step: 0.1 },
  { key: 'gravDamping', label: 'Grav Damping', min: 0.05, max: 5, step: 0.05 },
  { key: 'waveLifetime', label: 'Wave Life (s)', min: 1, max: 15, step: 0.5 },
  { key: 'maxWaves', label: 'Max Waves', min: 5, max: 100, step: 5 },
  { key: 'lenzStrength', label: 'Lenz Strength', min: 0.0, max: 0.5, step: 0.005 },
  { key: 'lenzWake', label: 'Lenz Wake', min: 0.0, max: 0.6, step: 0.01 },
  { key: 'hoverRadius', label: 'Hover Radius', min: 0.05, max: 0.6, step: 0.05 },
  { key: 'energyDecay', label: 'Energy Decay/s', min: 2, max: 30, step: 1 },
  { key: 'velocityMult', label: 'Velocity Mult', min: 5, max: 60, step: 5 },
  { key: 'clickSpike', label: 'Click Spike', min: 5, max: 50, step: 5 },
  { key: 'ripThreshold', label: 'Rip Threshold', min: 30, max: 200, step: 10 },
  { key: 'parallaxDepth', label: 'Parallax', min: 0.0, max: 0.15, step: 0.005 },
  { key: 'heatDecay', label: 'Heat Decay', min: 0.05, max: 2.0, step: 0.05 },
  { key: 'heatAttack', label: 'Heat Attack', min: 0.0, max: 1.0, step: 0.05 },
  { key: 'heatIntensity', label: 'Heat Intensity', min: 0.0, max: 1.0, step: 0.05 },
  { key: 'interferenceBlend', label: 'Interference', min: 0.0, max: 1.0, step: 0.05 },
  { key: 'iridescence', label: 'Iridescence', min: 0.0, max: 1.0, step: 0.05 },
  { key: 'starField', label: 'Star Field', min: 0.0, max: 1.0, step: 0.05 },
]
