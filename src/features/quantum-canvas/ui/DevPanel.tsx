import { useState } from 'react'
import { useAutoSim } from '../lib/use-auto-sim'
import { MOUSE_SLIDERS, OBJECT_SLIDERS, UNIVERSE_SLIDERS, DEFAULT_TUNING } from '../lib/shader-tuning'
import type { ShaderTuning, SliderDef } from '../lib/shader-tuning'
import { PresetControls } from './PresetControls'
import { AutoSimControls } from './AutoSimControls'
import { BarrierControls } from './BarrierControls'

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
  hideCursor: boolean
  onCursorHideChange: (value: boolean) => void
}

export function DevPanel({ tuning, energy, onChange, energyOverride, onEnergyOverride, onSimClick, wallRip, onWallRipChange, simMouseActive: _simMouseActive, onSimMouseActiveChange, onSimMouseUpdate, audioEnabled, onAudioToggle, hideCursor, onCursorHideChange }: DevPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const sim = useAutoSim({ onSimClick, onSimMouseActiveChange, onSimMouseUpdate })

  const handleChange = (key: keyof ShaderTuning, value: number | boolean) => {
    onChange({ ...tuning, [key]: value } as ShaderTuning)
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

  const GOD_MODE_WAVE_WARN = 200
  const GOD_MODE_WAVE_DANGER = 500
  const GOD_MODE_WAVE_HARD_CAP = 2000

  const renderSliderGroup = (sliders: SliderDef[]) =>
    sliders.map(({ key, label, min, max, step }) => {
      const val = tuning[key] as number
      const isWaveGod = key === 'maxWaves' && tuning.godMode
      const isWaveDanger = isWaveGod && val > GOD_MODE_WAVE_WARN
      const isWaveCritical = isWaveGod && val > GOD_MODE_WAVE_DANGER

      const handleSliderChange = (newVal: number) => {
        if (key === 'maxWaves' && newVal > GOD_MODE_WAVE_HARD_CAP) newVal = GOD_MODE_WAVE_HARD_CAP
        handleChange(key, newVal)
      }

      return (
        <div key={key}>
          <div className="flex items-center gap-2">
            <label className={`text-[0.55rem] w-20 shrink-0 truncate ${isWaveCritical ? 'text-red-400' : isWaveDanger ? 'text-yellow-400' : isWaveGod ? 'text-orange-400' : 'text-cold-white-dim/40'}`}>{label}</label>
            <input
              type="range" min={min} max={tuning.godMode ? (key === 'maxWaves' ? GOD_MODE_WAVE_HARD_CAP : max * 50) : max} step={step}
              value={val}
              onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-electric-purple"
            />
            {tuning.godMode ? (
              <input 
                type="number" 
                value={val} 
                onChange={(e) => handleSliderChange(parseFloat(e.target.value) || 0)}
                className={`text-[0.55rem] w-12 text-right tabular-nums bg-transparent border-b outline-none appearance-none ${isWaveCritical ? 'border-red-400/50 text-red-400' : isWaveDanger ? 'border-yellow-400/50 text-yellow-400' : 'border-electric-purple/50 text-electric-purple'}`}
              />
            ) : (
              <span className="text-[0.55rem] w-10 text-right tabular-nums">
                {val.toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 0)}
              </span>
            )}
          </div>
          {isWaveCritical && (
            <div className="text-[0.5rem] text-red-400 bg-red-400/10 border border-red-400/30 rounded px-1.5 py-0.5 mt-0.5 animate-pulse">
              ☠️ YOU WILL GET REKT — GPU meltdown imminent ({val} waves/pixel/frame)
            </div>
          )}
          {isWaveDanger && !isWaveCritical && (
            <div className="text-[0.5rem] text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded px-1.5 py-0.5 mt-0.5">
              ⚠️ GPU Warning — {val} waves is heavy, frames may drop
            </div>
          )}
          {isWaveGod && !isWaveDanger && (
            <div className="text-[0.5rem] text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded px-1.5 py-0.5 mt-0.5">
              🔥 Max Waves unlocked — increase carefully (hard cap: {GOD_MODE_WAVE_HARD_CAP})
            </div>
          )}
        </div>
      )
    })

  return (
    <div className="fixed top-3 right-3 z-50 w-72 bg-black/90 border border-electric-purple/30 rounded-lg p-3 font-mono text-xs text-cold-white-dim backdrop-blur-sm">
      <PanelHeader
        audioEnabled={audioEnabled}
        onAudioToggle={onAudioToggle}
        onCopy={(btn) => {
          const og = btn.innerText
          navigator.clipboard.writeText(JSON.stringify(tuning, null, 2))
          btn.innerText = 'COPIED'
          btn.classList.add('text-electric-purple')
          setTimeout(() => {
            btn.innerText = og
            btn.classList.remove('text-electric-purple')
          }, 1000)
        }}
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

      {/* God Mode & Pointer Hover Toggles */}
      <div className="flex gap-2 mb-2 w-full">
        <button 
          onClick={() => handleChange('godMode', !tuning.godMode)}
          className={`flex-1 text-[0.6rem] uppercase tracking-wider border px-2 py-1 rounded transition-colors ${tuning.godMode ? 'border-electric-purple bg-electric-purple/20 text-electric-purple shadow-[0_0_10px_rgba(155,81,224,0.3)]' : 'border-cold-white-dim/20 text-cold-white-dim/50 hover:border-cold-white-dim/40'}`}
        >
          ⚡ God Mode
        </button>
        <button 
          onClick={() => onCursorHideChange(!hideCursor)}
          className={`flex-1 text-[0.6rem] uppercase tracking-wider border px-2 py-1 rounded transition-colors ${hideCursor ? 'border-red-400/50 bg-red-400/10 text-red-400' : 'border-cold-white-dim/20 text-cold-white-dim/50 hover:border-cold-white-dim/40'}`}
        >
          {hideCursor ? '🚫 Cursor Off' : '🖱 Cursor On'}
        </button>
      </div>

      {/* Grouped Sliders */}
      <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
        {/* Mouse / God Object */}
        <div className="text-[0.55rem] text-electric-purple/50 uppercase tracking-widest mt-1 mb-0.5 border-b border-electric-purple/10 pb-0.5">🖱 Mouse (God Object)</div>
        <button 
          onClick={() => handleChange('pointerHover', !tuning.pointerHover)}
          className={`text-[0.55rem] w-full text-left px-1 py-0.5 rounded border mb-1 transition-colors ${tuning.pointerHover ? 'border-electric-purple/30 text-electric-purple bg-electric-purple/10' : 'border-cold-white-dim/10 text-cold-white-dim/30'}`}
        >
          {tuning.pointerHover ? '☑ Hover Warp Active' : '☐ Hover Warp Disabled'}
        </button>
        {renderSliderGroup(MOUSE_SLIDERS)}

        {/* Click Object */}
        <div className="text-[0.55rem] text-electric-purple/50 uppercase tracking-widest mt-2 mb-0.5 border-b border-electric-purple/10 pb-0.5">💥 Click Object (EM Waves)</div>
        {renderSliderGroup(OBJECT_SLIDERS)}

        {/* Universe */}
        <div className="text-[0.55rem] text-electric-purple/50 uppercase tracking-widest mt-2 mb-0.5 border-b border-electric-purple/10 pb-0.5">🌌 Universe</div>
        {renderSliderGroup(UNIVERSE_SLIDERS)}
      </div>

      <PresetControls
        tuning={{
          ...tuning,
          ...(sim.simActive ? {
            autoSim: {
              active: sim.simActive,
              mode: sim.simMode,
              rate: sim.simRate
            }
          } : {}),
          ripBlocked: wallRip
        }}
        onChange={(loadedTuning) => {
          onChange(loadedTuning)
          if (loadedTuning.autoSim) {
            sim.setSimActive(loadedTuning.autoSim.active)
            sim.setSimMode(loadedTuning.autoSim.mode)
            sim.setSimRate(loadedTuning.autoSim.rate)
            sim.setSimClicksOn(true)
          } else {
            sim.setSimActive(false)
          }
          if (loadedTuning.ripBlocked !== undefined) {
            onWallRipChange(loadedTuning.ripBlocked)
          }
        }}
      />
      <BarrierControls tuning={tuning} onChange={onChange} />
      <AutoSimControls sim={sim} />
    </div>
  )
}

/* ─── Inline sub-components (tightly coupled to DevPanel layout) ─── */

function PanelHeader({ audioEnabled, onAudioToggle, onCopy, onReset, onCollapse }: {
  audioEnabled: boolean; onAudioToggle: (v: boolean) => void
  onCopy: (btn: HTMLButtonElement) => void; onReset: () => void; onCollapse: () => void
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
        <button
          onClick={(e) => onCopy(e.currentTarget)}
          className="text-cold-white-dim/40 hover:text-cold-white text-[0.6rem] uppercase transition-colors"
          title="Copy settings to clipboard"
        >
          Copy JSON
        </button>
        <button onClick={onReset} className="text-cold-white-dim/40 hover:text-cold-white text-[0.6rem] uppercase transition-colors" title="Reset sliders to defaults (does not delete presets)">Reset</button>
        <button onClick={onCollapse} className="text-cold-white-dim/40 hover:text-cold-white tracking-widest text-[0.55rem] uppercase border border-cold-white-dim/20 px-1.5 rounded" title="Hide panel">Hide</button>
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
          className={`text-[0.6rem] ml-1 px-1.5 py-0.5 rounded border transition-colors ${wallRip ? 'text-red-400 border-red-400/50 bg-red-400/10 hover:bg-red-400/20' : 'text-yellow-400/80 border-yellow-400/30 hover:bg-yellow-400/10'}`}
          title={wallRip ? 'Rip zone blocked — click to allow' : 'Rip zone open — click to block'}
        >
          {wallRip ? '🚫 BLOCKED' : '⚡ RIP ON'}
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
