import { useState, useEffect } from 'react'

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
  heatIntensity: number
  interferenceBlend: number
}

export const DEFAULT_TUNING: ShaderTuning = {
  waveSpeed: 1.15,
  waveFreq: 150,
  waveWidth: 0.1,
  emDamping: 0.5,
  gravDamping: 0.2,
  waveLifetime: 15,
  maxWaves: 10,
  lenzStrength: 0.5,
  lenzWake: 0.6,
  hoverRadius: 0.05,
  energyDecay: 30,
  velocityMult: 30,
  clickSpike: 10,
  ripThreshold: 200,
  parallaxDepth: 0.15,
  heatDecay: 0.2,
  heatIntensity: 1,
  interferenceBlend: 1,
}

const STORAGE_KEY = 'zpe-shader-presets'
const ACTIVE_KEY = 'zpe-shader-active'

interface SliderDef {
  key: keyof ShaderTuning
  label: string
  min: number
  max: number
  step: number
}

const SLIDERS: SliderDef[] = [
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
  { key: 'heatDecay', label: 'Heat Decay', min: 0.2, max: 5.0, step: 0.1 },
  { key: 'heatIntensity', label: 'Heat Intensity', min: 0.0, max: 1.0, step: 0.05 },
  { key: 'interferenceBlend', label: 'Interference', min: 0.0, max: 1.0, step: 0.05 },
]

/* ─── Preset helpers ─── */
type PresetMap = Record<string, ShaderTuning>

function loadPresets(): PresetMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PresetMap) : {}
  } catch {
    return {}
  }
}

function savePresets(presets: PresetMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

function loadActive(): ShaderTuning | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    return raw ? (JSON.parse(raw) as ShaderTuning) : null
  } catch {
    return null
  }
}

function saveActive(tuning: ShaderTuning) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(tuning))
}

/* ─── Hook: persist active tuning across refresh ─── */
export function usePersistedTuning() {
  const [tuning, setTuning] = useState<ShaderTuning>(
    () => ({ ...DEFAULT_TUNING, ...(loadActive() ?? {}) })
  )

  useEffect(() => {
    saveActive(tuning)
  }, [tuning])

  return [tuning, setTuning] as const
}

/* ─── DevPanel ─── */

interface DevPanelProps {
  tuning: ShaderTuning
  energy: number
  onChange: (tuning: ShaderTuning) => void
}

export function DevPanel({ tuning, energy, onChange }: DevPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [presets, setPresets] = useState<PresetMap>(loadPresets)
  const [presetName, setPresetName] = useState('')

  const handleChange = (key: keyof ShaderTuning, value: number) => {
    onChange({ ...tuning, [key]: value })
  }

  const handleReset = () => onChange({ ...DEFAULT_TUNING })

  const handleLog = () => {
    console.log('=== LOCKED TUNING ===')
    console.log(JSON.stringify(tuning, null, 2))
  }

  const handleSave = () => {
    const name = presetName.trim() || `preset-${Date.now()}`
    const updated = { ...presets, [name]: { ...tuning } }
    setPresets(updated)
    savePresets(updated)
    setPresetName('')
  }

  const handleLoad = (name: string) => {
    const preset = presets[name]
    if (preset) onChange({ ...preset })
  }

  const handleDelete = (name: string) => {
    const updated = { ...presets }
    delete updated[name]
    setPresets(updated)
    savePresets(updated)
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed top-3 right-3 z-50 bg-black/80 border border-electric-purple/30 text-cold-white-dim font-mono text-xs px-3 py-1 rounded hover:border-electric-purple/60"
      >
        ⚙ DEV
      </button>
    )
  }

  const presetNames = Object.keys(presets)

  return (
    <div className="fixed top-3 right-3 z-50 w-72 bg-black/90 border border-electric-purple/30 rounded-lg p-3 font-mono text-xs text-cold-white-dim backdrop-blur-sm">
      <div className="flex justify-between items-center mb-3">
        <span className="text-electric-purple tracking-wider uppercase text-[0.6rem]">
          ⚙ Shader Tuning
        </span>
        <div className="flex gap-2">
          <button onClick={handleLog} className="text-cold-white-dim/40 hover:text-cold-white text-[0.6rem] uppercase">Log</button>
          <button onClick={handleReset} className="text-cold-white-dim/40 hover:text-cold-white text-[0.6rem] uppercase">Reset</button>
          <button onClick={() => setCollapsed(true)} className="text-cold-white-dim/40 hover:text-cold-white">×</button>
        </div>
      </div>

      {/* Energy meter */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[0.6rem] text-cold-white-dim/40 w-16">ENERGY</span>
        <div className="flex-1 h-1.5 bg-cold-white-dim/10 rounded overflow-hidden">
          <div
            className="h-full bg-electric-purple transition-all duration-100"
            style={{ width: `${Math.min(100, (energy / tuning.ripThreshold) * 100)}%` }}
          />
        </div>
        <span className="text-[0.6rem] w-8 text-right">{energy.toFixed(0)}</span>
      </div>

      {/* Sliders */}
      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-[0.55rem] text-cold-white-dim/40 w-20 shrink-0 truncate">{label}</label>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={tuning[key]}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              className="flex-1 h-1 accent-electric-purple"
            />
            <span className="text-[0.55rem] w-10 text-right tabular-nums">
              {tuning[key].toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 0)}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Presets ─── */}
      <div className="mt-3 pt-3 border-t border-cold-white-dim/10">
        <span className="text-[0.6rem] text-electric-purple/60 tracking-wider uppercase">Presets</span>

        {/* Save */}
        <div className="flex items-center gap-1 mt-2">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="preset name..."
            className="flex-1 bg-cold-white-dim/5 border border-cold-white-dim/10 rounded px-2 py-0.5 text-[0.6rem] text-cold-white outline-none focus:border-electric-purple/40"
          />
          <button
            onClick={handleSave}
            className="text-[0.6rem] text-electric-purple/60 hover:text-electric-purple uppercase px-2 py-0.5 border border-electric-purple/20 rounded hover:border-electric-purple/40"
          >
            Save
          </button>
        </div>

        {/* Preset list */}
        {presetNames.length > 0 && (
          <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
            {presetNames.map(name => (
              <div key={name} className="flex items-center justify-between group">
                <button
                  onClick={() => handleLoad(name)}
                  className="text-[0.55rem] text-cold-white-dim/50 hover:text-cold-white truncate flex-1 text-left"
                >
                  ▸ {name}
                </button>
                <button
                  onClick={() => handleDelete(name)}
                  className="text-[0.55rem] text-cold-white-dim/20 hover:text-red-400 opacity-0 group-hover:opacity-100 ml-2"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
