import { useState } from 'react'
import { useAutoSim } from '../lib/use-auto-sim'
import { SLIDERS, DEFAULT_TUNING } from '../lib/shader-tuning'
import type { ShaderTuning } from '../lib/shader-tuning'
import { PresetControls } from './PresetControls'
import { AutoSimControls } from './AutoSimControls'

export type { ShaderTuning }
export { DEFAULT_TUNING } from '../lib/shader-tuning'
export { usePersistedTuning } from '../lib/use-shader-presets'

interface DevPanelProps {
  tuning: ShaderTuning
  energy: number
  onChange: (tuning: ShaderTuning) => void
  energyOverride: number | null
  onEnergyOverride: (value: number | null) => void
  onSimClick: (x: number, y: number) => void
  wallRip: boolean
  onWallRipChange: (value: boolean) => void
  simMouseActive: boolean
  onSimMouseActiveChange: (value: boolean) => void
  onSimMouseUpdate: (x: number, y: number) => void
  audioEnabled: boolean
  onAudioToggle: (value: boolean) => void
}

export function DevPanel({ tuning, energy, onChange, energyOverride, onEnergyOverride, onSimClick, wallRip, onWallRipChange, simMouseActive: _simMouseActive, onSimMouseActiveChange, onSimMouseUpdate, audioEnabled, onAudioToggle }: DevPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const sim = useAutoSim({ onSimClick, onSimMouseActiveChange, onSimMouseUpdate })

  const handleChange = (key: keyof ShaderTuning, value: number) => {
    onChange({ ...tuning, [key]: value })
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

  return (
    <div className="fixed top-3 right-3 z-50 w-72 bg-black/90 border border-electric-purple/30 rounded-lg p-3 font-mono text-xs text-cold-white-dim backdrop-blur-sm">
      <PanelHeader
        audioEnabled={audioEnabled}
        onAudioToggle={onAudioToggle}
        onLog={() => console.log(JSON.stringify(tuning, null, 2))}
        onReset={() => onChange({ ...DEFAULT_TUNING })}
        onCollapse={() => setCollapsed(true)}
      />

      <EnergyMeter
        energy={energy}
        energyOverride={energyOverride}
        onEnergyOverride={onEnergyOverride}
        ripThreshold={tuning.ripThreshold}
        wallRip={wallRip}
        onWallRipChange={onWallRipChange}
      />

      <PaletteModeToggle tuning={tuning} onChange={onChange} />
      <WavelengthBandSelector tuning={tuning} onChange={onChange} />

      {/* Sliders */}
      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key} className="flex items-center gap-2">
            <label className="text-[0.55rem] text-cold-white-dim/40 w-20 shrink-0 truncate">{label}</label>
            <input
              type="range" min={min} max={max} step={step}
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

      <PresetControls tuning={tuning} onChange={onChange} />
      <AutoSimControls sim={sim} />
    </div>
  )
}

/* ─── Inline sub-components (tightly coupled to DevPanel layout) ─── */

function PanelHeader({ audioEnabled, onAudioToggle, onLog, onReset, onCollapse }: {
  audioEnabled: boolean; onAudioToggle: (v: boolean) => void
  onLog: () => void; onReset: () => void; onCollapse: () => void
}) {
  return (
    <div className="flex justify-between items-center mb-3">
      <span className="text-electric-purple tracking-wider uppercase text-[0.6rem]">⚙ Shader Tuning</span>
      <div className="flex gap-2">
        <button
          onClick={() => onAudioToggle(!audioEnabled)}
          className={`text-[0.7rem] ${audioEnabled ? 'text-electric-purple' : 'text-cold-white-dim/40'} hover:text-electric-purple`}
          title={audioEnabled ? 'Mute audio' : 'Enable audio feedback'}
        >
          {audioEnabled ? '🔊' : '🔇'}
        </button>
        <button onClick={onLog} className="text-cold-white-dim/40 hover:text-cold-white text-[0.6rem] uppercase">Log</button>
        <button onClick={onReset} className="text-cold-white-dim/40 hover:text-cold-white text-[0.6rem] uppercase">Reset</button>
        <button onClick={onCollapse} className="text-cold-white-dim/40 hover:text-cold-white">×</button>
      </div>
    </div>
  )
}

function EnergyMeter({ energy, energyOverride, onEnergyOverride, ripThreshold, wallRip, onWallRipChange }: {
  energy: number; energyOverride: number | null; onEnergyOverride: (v: number | null) => void
  ripThreshold: number; wallRip: boolean; onWallRipChange: (v: boolean) => void
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onEnergyOverride(energyOverride !== null ? null : energy)}
          className={`text-[0.7rem] ${energyOverride !== null ? 'text-electric-purple' : 'text-cold-white-dim/40'} hover:text-electric-purple`}
          title={energyOverride !== null ? 'Unlock energy' : 'Lock energy at current value'}
        >
          {energyOverride !== null ? '🔒' : '🔓'}
        </button>
        <span className="text-[0.6rem] text-cold-white-dim/40 w-12">ENERGY</span>
        <div className="flex-1 h-1.5 bg-cold-white-dim/10 rounded overflow-hidden">
          <div
            className="h-full bg-electric-purple transition-all duration-100"
            style={{ width: `${Math.min(100, ((energyOverride ?? energy) / ripThreshold) * 100)}%` }}
          />
        </div>
        <span className="text-[0.6rem] w-8 text-right">{(energyOverride ?? energy).toFixed(0)}</span>
        <button
          onClick={() => onWallRipChange(!wallRip)}
          className={`text-[0.6rem] ml-1 px-1.5 py-0.5 rounded border ${wallRip ? 'text-red-400 border-red-400/30 bg-red-400/10' : 'text-cold-white-dim/30 border-cold-white-dim/10'}`}
          title={wallRip ? 'Rip zone blocked — click to allow' : 'Rip zone open — click to block'}
        >
          {wallRip ? '🚫' : '⚡'}
        </button>
      </div>
      {energyOverride !== null && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[0.55rem] text-electric-purple/60 w-16">Override</span>
          <input
            type="range" min={0} max={300} step={1}
            value={energyOverride}
            onChange={e => onEnergyOverride(Number(e.target.value))}
            className="flex-1 h-1 accent-electric-purple"
          />
          <span className="text-[0.55rem] text-electric-purple w-8 text-right">{energyOverride.toFixed(0)}</span>
        </div>
      )}
    </div>
  )
}

function PaletteModeToggle({ tuning, onChange }: { tuning: ShaderTuning; onChange: (t: ShaderTuning) => void }) {
  const modes = [
    { mode: 0, label: '🔬 Physical', title: 'Planck blackbody + intensity-only interference' },
    { mode: 1, label: '🎨 Artistic', title: 'Vibrant cosine palette + chromatic dispersion' },
    { mode: 2, label: '⚗️ Hybrid', title: 'Blackbody thermal + artistic wavefronts' },
  ] as const

  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-[0.55rem] text-cold-white-dim/40 w-14 shrink-0">Palette</span>
      {modes.map(({ mode, label, title }) => (
        <button
          key={mode}
          onClick={() => onChange({ ...tuning, paletteMode: mode })}
          title={title}
          className={`text-[0.5rem] px-1.5 py-0.5 rounded border ${
            tuning.paletteMode === mode
              ? 'text-electric-purple border-electric-purple/40 bg-electric-purple/10'
              : 'text-cold-white-dim/30 border-cold-white-dim/10 hover:border-electric-purple/20'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function WavelengthBandSelector({ tuning, onChange }: { tuning: ShaderTuning; onChange: (t: ShaderTuning) => void }) {
  const bands = [
    { mode: 0, label: '📻', title: 'Radio — long wavelength, low energy' },
    { mode: 1, label: '🔴', title: 'Infrared — thermal emission' },
    { mode: 2, label: '👁', title: 'Visible — default human perception' },
    { mode: 3, label: '💎', title: 'X-Ray — high energy penetration' },
    { mode: 4, label: '☢️', title: 'Gamma — extreme energy, pair production' },
  ] as const

  return (
    <div className="flex items-center gap-1 mb-2 flex-wrap">
      <span className="text-[0.55rem] text-cold-white-dim/40 w-14 shrink-0">Band</span>
      {bands.map(({ mode, label, title }) => (
        <button
          key={mode}
          onClick={() => onChange({ ...tuning, wavelength: mode })}
          title={title}
          className={`text-[0.6rem] px-1 py-0.5 rounded border ${
            tuning.wavelength === mode
              ? 'text-electric-purple border-electric-purple/40 bg-electric-purple/10'
              : 'text-cold-white-dim/30 border-cold-white-dim/10 hover:border-electric-purple/20'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
