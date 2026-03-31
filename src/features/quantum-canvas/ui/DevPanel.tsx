import { useState, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { HandTarget } from '@/features/hand-tracking'
import { useAutoSim } from '../lib/use-auto-sim'
import { DEFAULT_TUNING } from '../lib/shader-tuning'
import type { ShaderTuning } from '../lib/shader-tuning'
import { PresetControls } from './PresetControls'
import { AutoSimControls } from './AutoSimControls'
import { BarrierControls } from './BarrierControls'
import { ExportControls } from './ExportControls'
import { SynthControls } from './SynthControls'
import { FXControls } from './FXControls'
import { EnvelopeControls } from './EnvelopeControls'
import { HandTrackingPanel } from './HandTrackingPanel'
import { TuningSliders } from './TuningSliders'
import type { FFTBands } from '@/features/quantum-audio'
import { useTuningStore } from '../model/tuning-store'
import { useAudioStore } from '@/features/quantum-audio/model/audio-store'
import { useUIStore } from '@/shared/model/ui-store'

export type { ShaderTuning }
export { DEFAULT_TUNING } from '../lib/shader-tuning'

interface DevPanelProps {
  energy: number
  energyOverride: number | null
  onEnergyOverride: (value: number | null) => void
  onSimClick: (x: number, y: number) => void
  wallRip: boolean
  onWallRipChange: (value: boolean) => void
  onSimMouseActiveChange: (value: boolean) => void
  onSimMouseUpdate: (x: number, y: number) => void
  gravBodyPositionsRef: MutableRefObject<{click: {x: number, y: number}, mouse: {x: number, y: number}} | null>
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  fftRef: MutableRefObject<FFTBands>
  handTracking: {
    active: boolean
    loading: boolean
    toggle: () => void
    handState: { x: number; y: number; z: number; pinching: boolean; confidence: number; detected: boolean; gesture?: string }
    dualState: {
      left: { detected: boolean; gesture?: string; pinching: boolean; confidence: number }
      right: { detected: boolean; gesture?: string; pinching: boolean; confidence: number }
    }
    setMapping: (axis: 'x' | 'y' | 'z', target: HandTarget) => void
    setHandMapping: (hand: 'left' | 'right', axis: 'x' | 'y' | 'z', target: HandTarget) => void
    setSmoothing: (v: number) => void
    setPinchThreshold: (v: number) => void
    getConfig: () => { xTarget: HandTarget; yTarget: HandTarget; zTarget: HandTarget; pinchThreshold: number; smoothing: number }
    getDualConfig: () => { left: { xTarget: HandTarget; yTarget: HandTarget; zTarget: HandTarget }; right: { xTarget: HandTarget; yTarget: HandTarget; zTarget: HandTarget } }
    looper?: {
      recording: boolean
      playing: boolean
      onRecord: () => void
      onPlay: () => void
      onClear: () => void
      eventCount: number
    }
  }
  performance?: {
    midiEnabled: boolean
    onMidiToggle: () => void
    isRecording: boolean
    onRecordToggle: () => void
    performanceMode: boolean
    onPerformanceToggle: () => void
  }
}

export function DevPanel({ energy, energyOverride, onEnergyOverride, onSimClick, wallRip, onWallRipChange, onSimMouseActiveChange, onSimMouseUpdate, gravBodyPositionsRef, canvasRef, fftRef, handTracking, performance }: DevPanelProps) {
  // ── Read from stores ──
  const tuning = useTuningStore((s) => s.tuning)
  const setTuning = useTuningStore((s) => s.setTuning)

  const audioEnabled = useAudioStore((s) => s.audioEnabled)
  const setAudioEnabled = useAudioStore((s) => s.setAudioEnabled)
  const masterVolume = useAudioStore((s) => s.masterVolume)
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume)
  const droneVolume = useAudioStore((s) => s.droneVolume)
  const setDroneVolume = useAudioStore((s) => s.setDroneVolume)
  const notesVolume = useAudioStore((s) => s.notesVolume)
  const setNotesVolume = useAudioStore((s) => s.setNotesVolume)
  const synthWaveform = useAudioStore((s) => s.synthWaveform)
  const setSynthWaveform = useAudioStore((s) => s.setSynthWaveform)
  const synthFilterQ = useAudioStore((s) => s.synthFilterQ)
  const setSynthFilterQ = useAudioStore((s) => s.setSynthFilterQ)
  const audioReactive = useAudioStore((s) => s.audioReactive)
  const setAudioReactive = useAudioStore((s) => s.setAudioReactive)
  const synthScale = useAudioStore((s) => s.synthScale)
  const setSynthScale = useAudioStore((s) => s.setSynthScale)
  const unisonCount = useAudioStore((s) => s.unisonCount)
  const setUnisonCount = useAudioStore((s) => s.setUnisonCount)
  const detuneSpread = useAudioStore((s) => s.detuneSpread)
  const setDetuneSpread = useAudioStore((s) => s.setDetuneSpread)
  const delayTime = useAudioStore((s) => s.delayTime)
  const setDelayTime = useAudioStore((s) => s.setDelayTime)
  const delayFeedback = useAudioStore((s) => s.delayFeedback)
  const setDelayFeedback = useAudioStore((s) => s.setDelayFeedback)
  const delayMix = useAudioStore((s) => s.delayMix)
  const setDelayMix = useAudioStore((s) => s.setDelayMix)
  const reverbMix = useAudioStore((s) => s.reverbMix)
  const setReverbMix = useAudioStore((s) => s.setReverbMix)
  const reverbDecay = useAudioStore((s) => s.reverbDecay)
  const setReverbDecay = useAudioStore((s) => s.setReverbDecay)
  const distortion = useAudioStore((s) => s.distortion)
  const setDistortion = useAudioStore((s) => s.setDistortion)
  const autoDistortion = useAudioStore((s) => s.autoDistortion)
  const setAutoDistortion = useAudioStore((s) => s.setAutoDistortion)
  const fftSpawnEnabled = useAudioStore((s) => s.fftSpawnEnabled)
  const setFftSpawnEnabled = useAudioStore((s) => s.setFftSpawnEnabled)
  const fftSpawnThreshold = useAudioStore((s) => s.fftSpawnThreshold)
  const setFftSpawnThreshold = useAudioStore((s) => s.setFftSpawnThreshold)
  const fftSpawnRate = useAudioStore((s) => s.fftSpawnRate)
  const setFftSpawnRate = useAudioStore((s) => s.setFftSpawnRate)
  const envAttack = useAudioStore((s) => s.envAttack)
  const setEnvAttack = useAudioStore((s) => s.setEnvAttack)
  const envDecay = useAudioStore((s) => s.envDecay)
  const setEnvDecay = useAudioStore((s) => s.setEnvDecay)
  const envSustain = useAudioStore((s) => s.envSustain)
  const setEnvSustain = useAudioStore((s) => s.setEnvSustain)
  const envRelease = useAudioStore((s) => s.envRelease)
  const setEnvRelease = useAudioStore((s) => s.setEnvRelease)
  const hydrateFromTuning = useAudioStore((s) => s.hydrateFromTuning)

  const hideCursor = useUIStore((s) => s.hideCursor)
  const setHideCursor = useUIStore((s) => s.setHideCursor)

  const [collapsed, setCollapsed] = useState(false)
  const sim = useAutoSim({ onSimClick, onSimMouseActiveChange, onSimMouseUpdate, zoomMode: tuning.zoomMode })

  // Bridge gravity body positions to parent for adaptive zoom
  useEffect(() => {
    if (sim.simMode === 'gravity' && sim.simActive) {
      const bridge = {
        click: { x: sim.gravState.current.clickPos.x, y: sim.gravState.current.clickPos.y },
        mouse: { x: sim.gravState.current.mousePos.x, y: sim.gravState.current.mousePos.y },
      }
      gravBodyPositionsRef.current = bridge

      let frameId = 0
      const sync = () => {
        bridge.click.x = sim.gravState.current.clickPos.x
        bridge.click.y = sim.gravState.current.clickPos.y
        bridge.mouse.x = sim.gravState.current.mousePos.x
        bridge.mouse.y = sim.gravState.current.mousePos.y
        frameId = requestAnimationFrame(sync)
      }
      frameId = requestAnimationFrame(sync)

      return () => {
        cancelAnimationFrame(frameId)
        gravBodyPositionsRef.current = null
      }
    } else {
      gravBodyPositionsRef.current = null
    }
  }, [sim.simMode, sim.simActive, sim.gravState, gravBodyPositionsRef])

  const handleChange = (key: keyof ShaderTuning, value: number | boolean) => {
    setTuning({ ...tuning, [key]: value } as ShaderTuning)
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
    <div className="fixed top-3 right-3 z-50 w-72 max-h-[85vh] flex flex-col bg-black/90 border border-electric-purple/30 rounded-lg font-mono text-xs text-cold-white-dim backdrop-blur-sm">
      {/* Pinned header */}
      <div className="flex-shrink-0 p-3 pb-0">
      <PanelHeader
        audioEnabled={audioEnabled}
        onAudioToggle={setAudioEnabled}
        onCopy={(btn) => {
          const og = btn.innerText
          const audioState = useAudioStore.getState()
          const fullState = { ...tuning, ...audioState, hideCursor }
          navigator.clipboard.writeText(JSON.stringify(fullState, null, 2))
          btn.innerText = 'COPIED'
          btn.classList.add('text-electric-purple')
          setTimeout(() => { btn.innerText = og; btn.classList.remove('text-electric-purple') }, 1000)
        }}
        onReset={() => {
          setTuning({ ...DEFAULT_TUNING })
          hydrateFromTuning(DEFAULT_TUNING)
        }}
        onCollapse={() => setCollapsed(true)}
      />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 pt-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(168,85,247,0.2) transparent' }}>

      {audioEnabled && (
        <>
        <SynthControls
          waveform={synthWaveform} onWaveformChange={setSynthWaveform}
          filterQ={synthFilterQ} onFilterQChange={setSynthFilterQ}
          audioReactive={audioReactive} onAudioReactiveChange={setAudioReactive}
          scale={synthScale} onScaleChange={setSynthScale}
          unisonCount={unisonCount} onUnisonCountChange={setUnisonCount}
          detuneSpread={detuneSpread} onDetuneSpreadChange={setDetuneSpread}
          volume={masterVolume} onVolumeChange={setMasterVolume}
          droneVolume={droneVolume} onDroneVolumeChange={setDroneVolume}
          notesVolume={notesVolume} onNotesVolumeChange={setNotesVolume}
          fftRef={fftRef}
        />
        <FXControls
          delayTime={delayTime} onDelayTimeChange={setDelayTime}
          delayFeedback={delayFeedback} onDelayFeedbackChange={setDelayFeedback}
          delayMix={delayMix} onDelayMixChange={setDelayMix}
          reverbMix={reverbMix} onReverbMixChange={setReverbMix}
          reverbDecay={reverbDecay} onReverbDecayChange={setReverbDecay}
          distortion={distortion} onDistortionChange={setDistortion}
          autoDistortion={autoDistortion} onAutoDistortionChange={setAutoDistortion}
        />
        <FeedbackControls
          fftSpawnEnabled={fftSpawnEnabled} onToggle={() => setFftSpawnEnabled(!fftSpawnEnabled)}
          fftSpawnThreshold={fftSpawnThreshold} onThresholdChange={setFftSpawnThreshold}
          fftSpawnRate={fftSpawnRate} onRateChange={setFftSpawnRate}
        />
        <EnvelopeControls
          attack={envAttack} onAttackChange={setEnvAttack}
          decay={envDecay} onDecayChange={setEnvDecay}
          sustain={envSustain} onSustainChange={setEnvSustain}
          release={envRelease} onReleaseChange={setEnvRelease}
        />
        </>
      )}

      <HandTrackingPanel handTracking={handTracking} performance={performance} />

      <EnergyMeter
        energy={energy} energyOverride={energyOverride} onEnergyOverride={onEnergyOverride}
        ripThreshold={tuning.ripThreshold} wallRip={wallRip} onWallRipChange={onWallRipChange}
      />

      <TuningSliders tuning={tuning} onTuningChange={setTuning} onFieldChange={handleChange} />

      <PresetControls
        tuning={{
          ...tuning,
          ...(sim.simActive ? {
            autoSim: { active: sim.simActive, mode: sim.simMode, rate: sim.simRate, clicksOn: sim.simClicksOn, mouseOn: sim.simMouseOn, separation: sim.simSeparation, mouseSpeed: sim.simMouseSpeed, mouseRadius: sim.simMouseRadius }
          } : {}),
          ripBlocked: wallRip, audioEnabled, synthWaveform, synthFilterQ, audioReactive, synthScale,
          unisonCount, detuneSpread, delayTime, delayFeedback, delayMix, reverbMix, reverbDecay,
          distortion, autoDistortion, hideCursor,
        }}
        onChange={(loadedTuning) => {
          setTuning(loadedTuning)
          if (loadedTuning.autoSim) {
            sim.setSimActive(loadedTuning.autoSim.active)
            sim.setSimMode(loadedTuning.autoSim.mode)
            sim.setSimRate(loadedTuning.autoSim.rate)
            sim.setSimClicksOn(loadedTuning.autoSim.clicksOn ?? true)
            sim.setSimMouseOn(loadedTuning.autoSim.mouseOn ?? false)
            sim.setSimSeparation(loadedTuning.autoSim.separation ?? 0.2)
            sim.setSimMouseSpeed(loadedTuning.autoSim.mouseSpeed ?? 0.5)
            sim.setSimMouseRadius(loadedTuning.autoSim.mouseRadius ?? 0.15)
          } else { sim.setSimActive(false) }
          if (loadedTuning.ripBlocked !== undefined) onWallRipChange(loadedTuning.ripBlocked)
          hydrateFromTuning(loadedTuning)
          if (loadedTuning.hideCursor !== undefined) setHideCursor(loadedTuning.hideCursor)
        }}
        canvasRef={canvasRef}
      />
      <ExportControls canvasRef={canvasRef} />
      <BarrierControls tuning={tuning} onChange={setTuning} />
      <AutoSimControls sim={sim} />

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

/* ─── Inline sub-components ─── */

function PanelHeader({ audioEnabled, onAudioToggle, onCopy, onReset, onCollapse }: {
  audioEnabled: boolean; onAudioToggle: (v: boolean) => void
  onCopy: (btn: HTMLButtonElement) => void; onReset: () => void; onCollapse: () => void
}) {
  return (
    <div className="flex justify-between items-center mb-3">
      <span className="text-electric-purple tracking-wider uppercase text-[0.6rem]">⚙ Shader Tuning</span>
      <div className="flex gap-2">
        <button onClick={() => onAudioToggle(!audioEnabled)} className={`text-[0.7rem] ${audioEnabled ? 'text-electric-purple' : 'text-cold-white-dim/40'} hover:text-electric-purple`} title={audioEnabled ? 'Mute audio' : 'Enable audio feedback'}>{audioEnabled ? '🔊' : '🔇'}</button>
        <button onClick={(e) => onCopy(e.currentTarget)} className="text-cold-white-dim/40 hover:text-cold-white text-[0.6rem] uppercase transition-colors" title="Copy settings to clipboard">Copy JSON</button>
        <button onClick={onReset} className="text-cold-white-dim/40 hover:text-cold-white text-[0.6rem] uppercase transition-colors" title="Reset sliders to defaults">Reset</button>
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
        <button onClick={() => onEnergyOverride(energyOverride !== null ? null : energy)} className={`text-[0.7rem] ${energyOverride !== null ? 'text-electric-purple' : 'text-cold-white-dim/40'} hover:text-electric-purple`} title={energyOverride !== null ? 'Unlock energy' : 'Lock energy at current value'}>{energyOverride !== null ? '🔒' : '🔓'}</button>
        <span className="text-[0.6rem] text-cold-white-dim/40 w-12">ENERGY</span>
        <div className="flex-1 h-1.5 bg-cold-white-dim/10 rounded overflow-hidden">
          <div className="h-full bg-electric-purple transition-all duration-100" style={{ width: `${Math.min(100, ((energyOverride ?? energy) / ripThreshold) * 100)}%` }} />
        </div>
        <span className="text-[0.6rem] w-8 text-right">{(energyOverride ?? energy).toFixed(0)}</span>
        <button onClick={() => onWallRipChange(!wallRip)} className={`text-[0.6rem] ml-1 px-1.5 py-0.5 rounded border transition-colors ${wallRip ? 'text-red-400 border-red-400/50 bg-red-400/10 hover:bg-red-400/20' : 'text-yellow-400/80 border-yellow-400/30 hover:bg-yellow-400/10'}`} title={wallRip ? 'Rip zone blocked — click to allow' : 'Rip zone open — click to block'}>{wallRip ? '🚫 BLOCKED' : '⚡ RIP ON'}</button>
      </div>
      {energyOverride !== null && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[0.55rem] text-electric-purple/60 w-16">Override</span>
          <input type="range" min={0} max={300} step={1} value={energyOverride} onChange={e => onEnergyOverride(Number(e.target.value))} className="flex-1 h-1 accent-electric-purple" />
          <span className="text-[0.55rem] text-electric-purple w-8 text-right">{energyOverride.toFixed(0)}</span>
        </div>
      )}
    </div>
  )
}

function FeedbackControls({ fftSpawnEnabled, onToggle, fftSpawnThreshold, onThresholdChange, fftSpawnRate, onRateChange }: {
  fftSpawnEnabled: boolean; onToggle: () => void
  fftSpawnThreshold: number; onThresholdChange: (v: number) => void
  fftSpawnRate: number; onRateChange: (v: number) => void
}) {
  return (
    <div className="mt-3 pt-3 border-t border-cold-white-dim/10">
      <span className="text-[0.6rem] text-electric-purple/60 tracking-wider uppercase">Feedback</span>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Bass→Wave</span>
        <button onClick={onToggle} className={`text-[0.55rem] px-2 py-0.5 rounded border transition-colors ${fftSpawnEnabled ? 'text-electric-purple border-electric-purple/40 bg-electric-purple/10' : 'text-cold-white-dim/40 border-cold-white-dim/10'}`}>{fftSpawnEnabled ? '⚡ ON' : '⏸ OFF'}</button>
      </div>
      {fftSpawnEnabled && (
        <>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Thresh</span>
            <input type="range" min={0.1} max={0.9} step={0.05} value={fftSpawnThreshold} onChange={e => onThresholdChange(Number(e.target.value))} className="flex-1 h-1 accent-electric-purple" />
            <span className="text-[0.55rem] w-8 text-right">{(fftSpawnThreshold * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Rate</span>
            <input type="range" min={50} max={500} step={25} value={fftSpawnRate} onChange={e => onRateChange(Number(e.target.value))} className="flex-1 h-1 accent-electric-purple" />
            <span className="text-[0.55rem] w-10 text-right">{fftSpawnRate}ms</span>
          </div>
        </>
      )}
    </div>
  )
}
