import { useRef, useCallback, type MutableRefObject } from 'react'
import { SynthEngine } from '../lib/synth-engine'
import type { SynthWaveform, FFTBands } from '../lib/synth-engine'
import type { ScaleName } from '../lib/quantizer'

/**
 * Thin React wrapper around the pure-TS SynthEngine.
 *
 * Holds the engine in a ref so it survives re-renders,
 * and exposes stable callbacks for the component tree.
 */
export function useSynth() {
  const engineRef = useRef<SynthEngine | null>(null)
  const activeRef = useRef(false)
  const fftRef = useRef<FFTBands>({ bass: 0, mid: 0, treble: 0 })

  const getEngine = (): SynthEngine => {
    if (!engineRef.current) {
      engineRef.current = new SynthEngine()
    }
    return engineRef.current
  }

  const start = useCallback(() => {
    getEngine().start()
    activeRef.current = true
  }, [])

  const stop = useCallback(() => {
    getEngine().stop()
    activeRef.current = false
  }, [])

  const setWaveform = useCallback((wf: SynthWaveform) => {
    getEngine().setWaveform(wf)
  }, [])

  const setFilterQ = useCallback((q: number) => {
    getEngine().setFilterQ(q)
  }, [])

  const setScale = useCallback((scale: ScaleName) => {
    getEngine().setScale(scale)
  }, [])

  const setUnisonCount = useCallback((count: number) => {
    getEngine().setUnisonCount(count)
  }, [])

  const setDetuneSpread = useCallback((cents: number) => {
    getEngine().setDetuneSpread(cents)
  }, [])

  // FX setters
  const setDelayTime = useCallback((s: number) => { getEngine().setDelayTime(s) }, [])
  const setDelayFeedback = useCallback((v: number) => { getEngine().setDelayFeedback(v) }, [])
  const setDelayMix = useCallback((v: number) => { getEngine().setDelayMix(v) }, [])
  const setReverbMix = useCallback((v: number) => { getEngine().setReverbMix(v) }, [])
  const setReverbDecay = useCallback((s: number) => { getEngine().setReverbDecay(s) }, [])
  const setDistortion = useCallback((v: number) => { getEngine().setDistortion(v) }, [])
  const setAutoDistortion = useCallback((on: boolean) => { getEngine().setAutoDistortion(on) }, [])
  const setEnvelope = useCallback((a: number, d: number, s: number, r: number) => {
    getEngine().setEnvelope(a, d, s, r)
  }, [])

  const update = useCallback((
    energy: number,
    maxEnergy: number,
    interferenceRatio: number,
    mouseX?: number,
    mouseY?: number,
  ) => {
    const engine = getEngine()
    engine.update(energy, maxEnergy, interferenceRatio, mouseX, mouseY)
    // Sync FFT ref from engine for consumers reading per-frame
    fftRef.current = engine.fft
  }, [])

  const triggerClick = useCallback((mapX?: number) => {
    getEngine().triggerClick(mapX)
  }, [])

  const playNote = useCallback((freq: number, velocity?: number, sustained?: boolean) => {
    return getEngine().playNote(freq, velocity, sustained)
  }, [])

  return {
    start, stop, update, triggerClick, playNote,
    setWaveform, setFilterQ, setScale,
    setUnisonCount, setDetuneSpread,
    setDelayTime, setDelayFeedback, setDelayMix,
    setReverbMix, setReverbDecay,
    setDistortion, setAutoDistortion, setEnvelope,
    activeRef,
    fftRef: fftRef as MutableRefObject<FFTBands>,
  }
}

export type { SynthWaveform, FFTBands, ScaleName }
