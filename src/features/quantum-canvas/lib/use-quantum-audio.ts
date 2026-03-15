import { useRef, useCallback } from 'react'

/**
 * Quantum Synth Engine — DSP synthesizer with FFT analysis
 *
 * Signal chain:
 *   OscA (detuned +7¢) ─┐
 *                        ├→ Filter (lowpass) → Panner → AnalyserNode → MasterGain → Destination
 *   OscB (detuned -7¢) ─┘
 *
 * Mouse Y → pitch (C2-C5 exponential)
 * Mouse X → filter cutoff (200Hz-8kHz)
 * FFT → bass/mid/treble bands exported per-frame
 */

export type SynthWaveform = 'sine' | 'sawtooth' | 'square' | 'triangle'

interface SynthState {
  ctx: AudioContext
  masterGain: GainNode
  mainPanner: StereoPannerNode
  // Dual-voice oscillator bank
  oscA: OscillatorNode
  oscB: OscillatorNode
  voiceGain: GainNode
  // Lowpass filter
  filter: BiquadFilterNode
  // FFT analysis
  analyser: AnalyserNode
  fftData: Uint8Array<ArrayBuffer>
  // Current waveform
  waveform: SynthWaveform
}

export interface FFTBands {
  bass: number   // 0-1
  mid: number    // 0-1
  treble: number // 0-1
}

const MIN_FREQ = 65    // C2
const MAX_FREQ = 523   // C5
const DETUNE_CENTS = 7

export function useQuantumAudio() {
  const audioRef = useRef<SynthState | null>(null)
  const activeRef = useRef(false)
  const fftRef = useRef<FFTBands>({ bass: 0, mid: 0, treble: 0 })
  const smoothRef = useRef<FFTBands>({ bass: 0, mid: 0, treble: 0 })

  const start = useCallback(() => {
    if (audioRef.current) return

    const ctx = new AudioContext()

    // Master output
    const masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(ctx.destination)

    // FFT analyzer (sits between synth and master)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6
    analyser.connect(masterGain)
    const fftData = new Uint8Array(analyser.frequencyBinCount) // 128 bins

    // Stereo panner
    const mainPanner = ctx.createStereoPanner()
    mainPanner.pan.value = 0
    mainPanner.connect(analyser)

    // Lowpass filter
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2000
    filter.Q.value = 2.0
    filter.connect(mainPanner)

    // Voice gain (controls drone volume)
    const voiceGain = ctx.createGain()
    voiceGain.gain.value = 0
    voiceGain.connect(filter)

    // Oscillator A (+7 cents detune)
    const oscA = ctx.createOscillator()
    oscA.type = 'sine'
    oscA.frequency.value = MIN_FREQ
    oscA.detune.value = DETUNE_CENTS
    oscA.connect(voiceGain)
    oscA.start()

    // Oscillator B (-7 cents detune)
    const oscB = ctx.createOscillator()
    oscB.type = 'sine'
    oscB.frequency.value = MIN_FREQ
    oscB.detune.value = -DETUNE_CENTS
    oscB.connect(voiceGain)
    oscB.start()

    audioRef.current = {
      ctx, masterGain, mainPanner,
      oscA, oscB, voiceGain,
      filter, analyser, fftData,
      waveform: 'sine',
    }
    activeRef.current = true

    // Fade in master
    masterGain.gain.setTargetAtTime(0.2, ctx.currentTime, 0.3)
  }, [])

  const stop = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    activeRef.current = false

    const now = a.ctx.currentTime
    a.masterGain.gain.setTargetAtTime(0, now, 0.3)
    setTimeout(() => {
      a.oscA.stop()
      a.oscB.stop()
      a.ctx.close()
      audioRef.current = null
    }, 1500)
  }, [])

  /** Set oscillator waveform */
  const setWaveform = useCallback((wf: SynthWaveform) => {
    const a = audioRef.current
    if (!a) return
    a.waveform = wf
    a.oscA.type = wf
    a.oscB.type = wf
  }, [])

  /** Set filter resonance (Q) */
  const setFilterQ = useCallback((q: number) => {
    const a = audioRef.current
    if (!a) return
    a.filter.Q.setTargetAtTime(q, a.ctx.currentTime, 0.05)
  }, [])

  /**
   * Update synth per frame
   * @param energy - Current energy level (0-300)
   * @param maxEnergy - Rip threshold
   * @param interferenceRatio - 0=destructive, 1=constructive
   * @param mouseX - 0-1 horizontal position (filter cutoff + panning)
   * @param mouseY - 0-1 vertical position (pitch)
   */
  const update = useCallback((energy: number, maxEnergy: number, interferenceRatio: number, mouseX: number = 0.5, mouseY?: number) => {
    const a = audioRef.current
    if (!a || !activeRef.current) return

    const now = a.ctx.currentTime
    const eNorm = Math.min(energy / Math.max(maxEnergy, 1), 1)

    // Pitch: mouse Y maps C2→C5 (exponential for musical feel)
    if (mouseY !== undefined) {
      const yInv = 1.0 - mouseY // invert: top of screen = high pitch
      const freq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, yInv)
      a.oscA.frequency.setTargetAtTime(freq, now, 0.08)
      a.oscB.frequency.setTargetAtTime(freq, now, 0.08)
    }

    // Filter cutoff: mouse X maps 200Hz→8kHz (exponential)
    const cutoff = 200 * Math.pow(40, mouseX) // 200 * 40^x = 200→8000
    a.filter.frequency.setTargetAtTime(cutoff, now, 0.05)

    // Voice volume: energy-gated with interference modulation
    const iRatio = Math.max(0, Math.min(1, interferenceRatio))
    const vol = eNorm * 0.35 * (0.5 + iRatio * 0.5)
    a.voiceGain.gain.setTargetAtTime(vol, now, 0.05)

    // Panning
    const panTarget = (mouseX - 0.5) * 2.0
    a.mainPanner.pan.setTargetAtTime(panTarget, now, 0.1)

    // ── FFT Analysis ──
    a.analyser.getByteFrequencyData(a.fftData)
    const bins = a.fftData
    const numBins = bins.length // 128

    // Bass: bins 0-5 (~0-340Hz)
    let bassSum = 0
    for (let i = 0; i < Math.min(6, numBins); i++) bassSum += bins[i]
    const bassRaw = bassSum / (6 * 255)

    // Mid: bins 6-30 (~340Hz-4kHz)
    let midSum = 0
    for (let i = 6; i < Math.min(31, numBins); i++) midSum += bins[i]
    const midRaw = midSum / (25 * 255)

    // Treble: bins 31-63 (~4kHz-11kHz)
    let trebleSum = 0
    for (let i = 31; i < Math.min(64, numBins); i++) trebleSum += bins[i]
    const trebleRaw = trebleSum / (33 * 255)

    // Exponential smoothing
    const s = smoothRef.current
    s.bass = s.bass * 0.7 + bassRaw * 0.3
    s.mid = s.mid * 0.7 + midRaw * 0.3
    s.treble = s.treble * 0.7 + trebleRaw * 0.3

    fftRef.current = { bass: s.bass, mid: s.mid, treble: s.treble }
  }, [])

  /** Fire a click transient — bypasses filter for full harmonic character */
  const triggerClick = useCallback((mapX: number = 0.5) => {
    const a = audioRef.current
    if (!a || !activeRef.current) return

    const now = a.ctx.currentTime
    const clickOsc = a.ctx.createOscillator()
    const clickGain = a.ctx.createGain()

    clickOsc.type = a.waveform
    clickOsc.frequency.value = 400 + Math.random() * 600

    // ADSR envelope
    clickGain.gain.setValueAtTime(0, now)
    clickGain.gain.linearRampToValueAtTime(0.12, now + 0.01)
    clickGain.gain.linearRampToValueAtTime(0.04, now + 0.06)
    clickGain.gain.linearRampToValueAtTime(0, now + 0.16)

    const panner = a.ctx.createStereoPanner()
    panner.pan.value = (mapX - 0.5) * 2.0

    clickOsc.connect(clickGain)
    clickGain.connect(panner)
    panner.connect(a.analyser)

    clickOsc.start(now)
    clickOsc.stop(now + 0.2)
  }, [])

  /**
   * Play a pitched note — uses current waveform + filter
   * @param freq - Frequency in Hz
   * @param velocity - 0-1 volume scaling
   */
  const playNote = useCallback((freq: number, velocity: number = 0.8) => {
    const a = audioRef.current
    if (!a || !activeRef.current) return

    const now = a.ctx.currentTime
    const osc = a.ctx.createOscillator()
    const oscB = a.ctx.createOscillator()
    const gain = a.ctx.createGain()
    const noteFilter = a.ctx.createBiquadFilter()

    osc.type = a.waveform
    osc.frequency.value = freq
    osc.detune.value = DETUNE_CENTS

    oscB.type = a.waveform
    oscB.frequency.value = freq
    oscB.detune.value = -DETUNE_CENTS

    noteFilter.type = 'lowpass'
    noteFilter.frequency.value = a.filter.frequency.value
    noteFilter.Q.value = a.filter.Q.value

    const vol = velocity * 0.2
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.015)
    gain.gain.linearRampToValueAtTime(vol * 0.6, now + 0.1)
    gain.gain.setValueAtTime(vol * 0.6, now + 0.25)
    gain.gain.linearRampToValueAtTime(0, now + 0.5)

    osc.connect(noteFilter)
    oscB.connect(noteFilter)
    noteFilter.connect(gain)
    gain.connect(a.analyser)

    osc.start(now)
    oscB.start(now)
    osc.stop(now + 0.55)
    oscB.stop(now + 0.55)
  }, [])

  return {
    start, stop, update, triggerClick, playNote,
    setWaveform, setFilterQ,
    activeRef, fftRef,
  }
}
