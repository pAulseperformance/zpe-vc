import { useState, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { useAutoSim } from '../lib/use-auto-sim'
import { MOUSE_SLIDERS, OBJECT_SLIDERS, UNIVERSE_SLIDERS, DEFAULT_TUNING } from '../lib/shader-tuning'
import type { ShaderTuning } from '../lib/shader-tuning'
import { PresetControls } from './PresetControls'
import { AutoSimControls } from './AutoSimControls'
import { BarrierControls } from './BarrierControls'
import { ExportControls } from './ExportControls'
import { SynthControls } from './SynthControls'
import { FXControls } from './FXControls'
import { SliderGroup } from './SliderGroup'
import type { SynthWaveform, FFTBands, ScaleName } from '@/features/quantum-audio'

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
  gravBodyPositions: MutableRefObject<{click: {x: number, y: number}, mouse: {x: number, y: number}} | null>
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  // Synth controls
  synthWaveform: SynthWaveform
  onSynthWaveform: (wf: SynthWaveform) => void
  synthFilterQ: number
  onSynthFilterQ: (q: number) => void
  audioReactive: boolean
  onAudioReactive: (v: boolean) => void
  synthScale: ScaleName
  onSynthScale: (s: ScaleName) => void
  unisonCount: number
  onUnisonCount: (n: number) => void
  detuneSpread: number
  onDetuneSpread: (c: number) => void
  // FX controls
  delayTime: number; onDelayTime: (v: number) => void
  delayFeedback: number; onDelayFeedback: (v: number) => void
  delayMix: number; onDelayMix: (v: number) => void
  reverbMix: number; onReverbMix: (v: number) => void
  reverbDecay: number; onReverbDecay: (v: number) => void
  distortion: number; onDistortion: (v: number) => void
  autoDistortion: boolean; onAutoDistortion: (v: boolean) => void
  fftRef: MutableRefObject<FFTBands>
}

export function DevPanel({ tuning, energy, onChange, energyOverride, onEnergyOverride, onSimClick, wallRip, onWallRipChange, simMouseActive: _simMouseActive, onSimMouseActiveChange, onSimMouseUpdate, audioEnabled, onAudioToggle, hideCursor, onCursorHideChange, gravBodyPositions, canvasRef, synthWaveform, onSynthWaveform, synthFilterQ, onSynthFilterQ, audioReactive, onAudioReactive, synthScale, onSynthScale, unisonCount, onUnisonCount, detuneSpread, onDetuneSpread, delayTime, onDelayTime, delayFeedback, onDelayFeedback, delayMix, onDelayMix, reverbMix, onReverbMix, reverbDecay, onReverbDecay, distortion, onDistortion, autoDistortion, onAutoDistortion, fftRef }: DevPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const sim = useAutoSim({ onSimClick, onSimMouseActiveChange, onSimMouseUpdate, zoomMode: tuning.zoomMode })

  // Bridge gravity body positions to parent for adaptive zoom
  useEffect(() => {
    if (sim.simMode === 'gravity' && sim.simActive) {
      const interval = setInterval(() => {
        gravBodyPositions.current = {
          click: { ...sim.gravState.current.clickPos },
          mouse: { ...sim.gravState.current.mousePos },
        }
      }, 16) // ~60fps sync
      return () => {
        clearInterval(interval)
        gravBodyPositions.current = null
      }
    } else {
      gravBodyPositions.current = null
    }
  }, [sim.simMode, sim.simActive, sim.gravState, gravBodyPositions])

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

  return (
    <div className="fixed top-3 right-3 z-50 w-72 max-h-[85vh] flex flex-col bg-black/90 border border-electric-purple/30 rounded-lg p-3 font-mono text-xs text-cold-white-dim backdrop-blur-sm">
      <PanelHeader
        audioEnabled={audioEnabled}
        onAudioToggle={onAudioToggle}
        onCopy={(btn) => {
          const og = btn.innerText
          // Full snapshot: shader tuning + all synth/FX state
          const fullState = {
            ...tuning,
            audioEnabled,
            synthWaveform,
            synthFilterQ,
            audioReactive,
            synthScale,
            unisonCount,
            detuneSpread,
            delayTime, delayFeedback, delayMix,
            reverbMix, reverbDecay,
            distortion, autoDistortion,
            hideCursor,
          }
          navigator.clipboard.writeText(JSON.stringify(fullState, null, 2))
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

      {audioEnabled && (
        <>
        <SynthControls
          waveform={synthWaveform}
          onWaveformChange={onSynthWaveform}
          filterQ={synthFilterQ}
          onFilterQChange={onSynthFilterQ}
          audioReactive={audioReactive}
          onAudioReactiveChange={onAudioReactive}
          scale={synthScale}
          onScaleChange={onSynthScale}
          unisonCount={unisonCount}
          onUnisonCountChange={onUnisonCount}
          detuneSpread={detuneSpread}
          onDetuneSpreadChange={onDetuneSpread}
          fftRef={fftRef}
        />
        <FXControls
          delayTime={delayTime} onDelayTimeChange={onDelayTime}
          delayFeedback={delayFeedback} onDelayFeedbackChange={onDelayFeedback}
          delayMix={delayMix} onDelayMixChange={onDelayMix}
          reverbMix={reverbMix} onReverbMixChange={onReverbMix}
          reverbDecay={reverbDecay} onReverbDecayChange={onReverbDecay}
          distortion={distortion} onDistortionChange={onDistortion}
          autoDistortion={autoDistortion} onAutoDistortionChange={onAutoDistortion}
        />
        </>
      )}

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

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
        {/* Mouse / God Object */}
        <div className="text-[0.55rem] text-electric-purple/50 uppercase tracking-widest mt-1 mb-0.5 border-b border-electric-purple/10 pb-0.5">🖱 Mouse (God Object)</div>
        <button 
          onClick={() => handleChange('pointerHover', !tuning.pointerHover)}
          className={`text-[0.55rem] w-full text-left px-1 py-0.5 rounded border mb-1 transition-colors ${tuning.pointerHover ? 'border-electric-purple/30 text-electric-purple bg-electric-purple/10' : 'border-cold-white-dim/10 text-cold-white-dim/30'}`}
        >
          {tuning.pointerHover ? '☑ Hover Warp Active' : '☐ Hover Warp Disabled'}
        </button>
        <SliderGroup sliders={MOUSE_SLIDERS} tuning={tuning} onChange={handleChange} />

        {/* Click Object */}
        <div className="text-[0.55rem] text-electric-purple/50 uppercase tracking-widest mt-2 mb-0.5 border-b border-electric-purple/10 pb-0.5">💥 Click Object (EM Waves)</div>
        <SliderGroup sliders={OBJECT_SLIDERS} tuning={tuning} onChange={handleChange} />

        {/* Universe */}
        <div className="text-[0.55rem] text-electric-purple/50 uppercase tracking-widest mt-2 mb-0.5 border-b border-electric-purple/10 pb-0.5">🌌 Universe</div>
        <SliderGroup sliders={UNIVERSE_SLIDERS} tuning={tuning} onChange={handleChange} />

        {/* Zoom Mode Toggle */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[0.55rem] text-cold-white-dim/40 w-14 shrink-0">Zoom</span>
          <button
            onClick={() => {
              const next = ((tuning.zoomMode ?? 0) + 1) % 3
              onChange({ ...tuning, zoomMode: next })
            }}
            className="text-[0.55rem] text-cold-white-dim/50 hover:text-electric-purple border border-cold-white-dim/10 rounded px-2 py-0.5"
          >
            {(tuning.zoomMode ?? 0) === 0 ? '🔧 Manual' : (tuning.zoomMode ?? 0) === 1 ? '🔭 Adaptive' : '🔭 Adaptive + Walls'}
          </button>
        </div>

      <PresetControls
        tuning={{
          ...tuning,
          ...(sim.simActive ? {
            autoSim: {
              active: sim.simActive,
              mode: sim.simMode,
              rate: sim.simRate,
              clicksOn: sim.simClicksOn,
              mouseOn: sim.simMouseOn,
              separation: sim.simSeparation,
              mouseSpeed: sim.simMouseSpeed,
              mouseRadius: sim.simMouseRadius,
            }
          } : {}),
          ripBlocked: wallRip,
          audioEnabled,
          synthWaveform,
          synthFilterQ,
          audioReactive,
          synthScale,
          unisonCount,
          detuneSpread,
          delayTime, delayFeedback, delayMix,
          reverbMix, reverbDecay,
          distortion, autoDistortion,
          hideCursor,
        }}
        onChange={(loadedTuning) => {
          onChange(loadedTuning)
          if (loadedTuning.autoSim) {
            sim.setSimActive(loadedTuning.autoSim.active)
            sim.setSimMode(loadedTuning.autoSim.mode)
            sim.setSimRate(loadedTuning.autoSim.rate)
            sim.setSimClicksOn(loadedTuning.autoSim.clicksOn ?? true)
            sim.setSimMouseOn(loadedTuning.autoSim.mouseOn ?? false)
            sim.setSimSeparation(loadedTuning.autoSim.separation ?? 0.2)
            sim.setSimMouseSpeed(loadedTuning.autoSim.mouseSpeed ?? 0.5)
            sim.setSimMouseRadius(loadedTuning.autoSim.mouseRadius ?? 0.15)
          } else {
            sim.setSimActive(false)
          }
          if (loadedTuning.ripBlocked !== undefined) {
            onWallRipChange(loadedTuning.ripBlocked)
          }
          // Restore audio settings
          if (loadedTuning.audioEnabled !== undefined) onAudioToggle(loadedTuning.audioEnabled)
          if (loadedTuning.synthWaveform) onSynthWaveform(loadedTuning.synthWaveform)
          if (loadedTuning.synthFilterQ !== undefined) onSynthFilterQ(loadedTuning.synthFilterQ)
          if (loadedTuning.audioReactive !== undefined) onAudioReactive(loadedTuning.audioReactive)
          if (loadedTuning.synthScale) onSynthScale(loadedTuning.synthScale as ScaleName)
          if (loadedTuning.unisonCount !== undefined) onUnisonCount(loadedTuning.unisonCount)
          if (loadedTuning.detuneSpread !== undefined) onDetuneSpread(loadedTuning.detuneSpread)
          // FX
          if (loadedTuning.delayTime !== undefined) onDelayTime(loadedTuning.delayTime)
          if (loadedTuning.delayFeedback !== undefined) onDelayFeedback(loadedTuning.delayFeedback)
          if (loadedTuning.delayMix !== undefined) onDelayMix(loadedTuning.delayMix)
          if (loadedTuning.reverbMix !== undefined) onReverbMix(loadedTuning.reverbMix)
          if (loadedTuning.reverbDecay !== undefined) onReverbDecay(loadedTuning.reverbDecay)
          if (loadedTuning.distortion !== undefined) onDistortion(loadedTuning.distortion)
          if (loadedTuning.autoDistortion !== undefined) onAutoDistortion(loadedTuning.autoDistortion)
          if (loadedTuning.hideCursor !== undefined) onCursorHideChange(loadedTuning.hideCursor)
        }}
        canvasRef={canvasRef}
      />
      <ExportControls canvasRef={canvasRef} />
      <BarrierControls tuning={tuning} onChange={onChange} />
      <AutoSimControls sim={sim} />

      {/* Gravity body position indicators */}
      {sim.simMode === 'gravity' && sim.simActive && (
        <div className="mt-2 border-t border-cold-white-dim/10 pt-1.5">
          <span className="text-[0.55rem] text-cold-white-dim/30">Gravity Bodies: </span>
          <span className="text-[0.55rem] text-cyan-400">● Mouse ({sim.gravState.current.mousePos.x.toFixed(2)}, {sim.gravState.current.mousePos.y.toFixed(2)})</span>
          <span className="text-[0.55rem] text-cold-white-dim/20"> │ </span>
          <span className="text-[0.55rem] text-fuchsia-400">● Click ({sim.gravState.current.clickPos.x.toFixed(2)}, {sim.gravState.current.clickPos.y.toFixed(2)})</span>
        </div>
      )}
      </div>
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
