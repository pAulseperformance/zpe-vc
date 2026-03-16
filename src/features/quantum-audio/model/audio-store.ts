import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { SynthWaveform, ScaleName } from '@/features/quantum-audio'
import type { ShaderTuning } from '@/features/quantum-canvas/lib/shader-tuning'

interface AudioState {
  // Core
  audioEnabled: boolean
  masterVolume: number
  droneVolume: number
  notesVolume: number

  // Synth
  synthWaveform: SynthWaveform
  synthFilterQ: number
  audioReactive: boolean
  synthScale: ScaleName
  unisonCount: number
  detuneSpread: number

  // FX
  delayTime: number
  delayFeedback: number
  delayMix: number
  reverbMix: number
  reverbDecay: number
  distortion: number
  autoDistortion: boolean

  // Envelope
  envAttack: number
  envDecay: number
  envSustain: number
  envRelease: number

  // FFT feedback loop
  fftSpawnEnabled: boolean
  fftSpawnThreshold: number
  fftSpawnRate: number

  // Actions
  setAudioEnabled: (enabled: boolean) => void
  setMasterVolume: (v: number) => void
  setDroneVolume: (v: number) => void
  setNotesVolume: (v: number) => void
  setSynthWaveform: (wf: SynthWaveform) => void
  setSynthFilterQ: (q: number) => void
  setAudioReactive: (reactive: boolean) => void
  setSynthScale: (scale: ScaleName) => void
  setUnisonCount: (n: number) => void
  setDetuneSpread: (c: number) => void
  setDelayTime: (v: number) => void
  setDelayFeedback: (v: number) => void
  setDelayMix: (v: number) => void
  setReverbMix: (v: number) => void
  setReverbDecay: (v: number) => void
  setDistortion: (v: number) => void
  setAutoDistortion: (v: boolean) => void
  setEnvelope: (a: number, d: number, s: number, r: number) => void
  setEnvAttack: (v: number) => void
  setEnvDecay: (v: number) => void
  setEnvSustain: (v: number) => void
  setEnvRelease: (v: number) => void
  setFftSpawnEnabled: (v: boolean) => void
  setFftSpawnThreshold: (v: number) => void
  setFftSpawnRate: (v: number) => void

  // Bulk hydrate from tuning
  hydrateFromTuning: (tuning: Partial<ShaderTuning>) => void
}

export const useAudioStore = create<AudioState>()(subscribeWithSelector((set) => ({
  // Defaults
  audioEnabled: true,
  masterVolume: 0.8,
  droneVolume: 1,
  notesVolume: 0.8,
  synthWaveform: 'sine' as SynthWaveform,
  synthFilterQ: 10,
  audioReactive: false,
  synthScale: 'minor-pentatonic' as ScaleName,
  unisonCount: 7,
  detuneSpread: 10,
  delayTime: 0.3,
  delayFeedback: 0.4,
  delayMix: 0,
  reverbMix: 0,
  reverbDecay: 2,
  distortion: 0,
  autoDistortion: true,
  envAttack: 0.015,
  envDecay: 0.085,
  envSustain: 0.6,
  envRelease: 0.25,
  fftSpawnEnabled: false,
  fftSpawnThreshold: 0.5,
  fftSpawnRate: 150,

  // Actions — each triggers a subscribe callback that syncs to SynthEngine
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
  setMasterVolume: (v) => set({ masterVolume: v }),
  setDroneVolume: (v) => set({ droneVolume: v }),
  setNotesVolume: (v) => set({ notesVolume: v }),
  setSynthWaveform: (wf) => set({ synthWaveform: wf }),
  setSynthFilterQ: (q) => set({ synthFilterQ: q }),
  setAudioReactive: (reactive) => set({ audioReactive: reactive }),
  setSynthScale: (scale) => set({ synthScale: scale }),
  setUnisonCount: (n) => set({ unisonCount: n }),
  setDetuneSpread: (c) => set({ detuneSpread: c }),
  setDelayTime: (v) => set({ delayTime: v }),
  setDelayFeedback: (v) => set({ delayFeedback: v }),
  setDelayMix: (v) => set({ delayMix: v }),
  setReverbMix: (v) => set({ reverbMix: v }),
  setReverbDecay: (v) => set({ reverbDecay: v }),
  setDistortion: (v) => set({ distortion: v }),
  setAutoDistortion: (v) => set({ autoDistortion: v }),
  setEnvelope: (a, d, s, r) => set({ envAttack: a, envDecay: d, envSustain: s, envRelease: r }),
  setEnvAttack: (v) => set({ envAttack: v }),
  setEnvDecay: (v) => set({ envDecay: v }),
  setEnvSustain: (v) => set({ envSustain: v }),
  setEnvRelease: (v) => set({ envRelease: v }),
  setFftSpawnEnabled: (v) => set({ fftSpawnEnabled: v }),
  setFftSpawnThreshold: (v) => set({ fftSpawnThreshold: v }),
  setFftSpawnRate: (v) => set({ fftSpawnRate: v }),

  hydrateFromTuning: (tuning) => {
    const t = tuning as Partial<ShaderTuning>
    set({
      audioEnabled: (t.audioEnabled as boolean) ?? true,
      masterVolume: (t.masterVolume as number) ?? 0.8,
      droneVolume: (t.droneVolume as number) ?? 1,
      notesVolume: (t.notesVolume as number) ?? 0.8,
      synthWaveform: (t.synthWaveform as SynthWaveform) ?? 'sine',
      synthFilterQ: (t.synthFilterQ as number) ?? 10,
      audioReactive: (t.audioReactive as boolean) ?? false,
      synthScale: (t.synthScale as ScaleName) ?? 'minor-pentatonic',
      unisonCount: (t.unisonCount as number) ?? 7,
      detuneSpread: (t.detuneSpread as number) ?? 10,
      delayTime: (t.delayTime as number) ?? 0.3,
      delayFeedback: (t.delayFeedback as number) ?? 0.4,
      delayMix: (t.delayMix as number) ?? 0,
      reverbMix: (t.reverbMix as number) ?? 0,
      reverbDecay: (t.reverbDecay as number) ?? 2,
      distortion: (t.distortion as number) ?? 0,
      autoDistortion: (t.autoDistortion as boolean) ?? true,
      envAttack: (t.envAttack as number) ?? 0.015,
      envDecay: (t.envDecay as number) ?? 0.085,
      envSustain: (t.envSustain as number) ?? 0.6,
      envRelease: (t.envRelease as number) ?? 0.25,
      fftSpawnEnabled: (t.fftSpawnEnabled as boolean) ?? false,
      fftSpawnThreshold: (t.fftSpawnThreshold as number) ?? 0.5,
      fftSpawnRate: (t.fftSpawnRate as number) ?? 150,
    })
  },
})))
