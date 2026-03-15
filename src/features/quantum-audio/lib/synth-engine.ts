/**
 * SynthEngine — Pure TypeScript Web Audio DSP engine
 *
 * Zero React dependencies. Manages AudioContext, unison voices,
 * filter, analyser, and FFT band extraction.
 *
 * Signal chain (per voice):
 *   Osc[i] → VoicePanner[i] ─┐
 *                              ├→ VoiceGain → Filter → MainPanner → Analyser → MasterGain → Dest
 *   Osc[N] → VoicePanner[N] ─┘
 */

import { snapToScale } from './quantizer'
import type { ScaleName } from './quantizer'
import { FXChain } from './fx-chain'

export type SynthWaveform = 'sine' | 'sawtooth' | 'square' | 'triangle'

export interface FFTBands {
  bass: number   // 0-1
  mid: number    // 0-1
  treble: number // 0-1
}

const MIN_FREQ = 65    // C2
const MAX_FREQ = 523   // C5

interface UnisonVoice {
  osc: OscillatorNode
  panner: StereoPannerNode
}

interface EngineNodes {
  ctx: AudioContext
  masterGain: GainNode
  masterVolume: GainNode
  mainPanner: StereoPannerNode
  voices: UnisonVoice[]
  voiceGain: GainNode
  filter: BiquadFilterNode
  analyser: AnalyserNode
  notesGain: GainNode
  fftData: Uint8Array<ArrayBuffer>
  waveform: SynthWaveform
}

export class SynthEngine {
  private nodes: EngineNodes | null = null
  private _active = false
  private smooth: FFTBands = { bass: 0, mid: 0, treble: 0 }
  private _scale: ScaleName = 'continuous'
  private _unisonCount = 2
  private _detuneSpread = 7 // cents total spread
  private _currentFreq = MIN_FREQ
  private _autoDistortion = false
  private _droneVolumeScale = 0.5
  private _envelope = { attack: 0.015, decay: 0.085, sustain: 0.6, release: 0.25 }
  readonly fx = new FXChain()

  /** Current FFT band levels (read per-frame) */
  fft: FFTBands = { bass: 0, mid: 0, treble: 0 }

  get active(): boolean { return this._active }
  get scale(): ScaleName { return this._scale }

  // ── Lifecycle ──────────────────────────────────────────

  start(): void {
    if (this.nodes) return
    const ctx = new AudioContext()

    // Master volume — user-controlled overall level
    const masterVolume = ctx.createGain()
    masterVolume.gain.value = 0.8
    masterVolume.connect(ctx.destination)

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6
    analyser.connect(masterVolume)
    const fftData = new Uint8Array(analyser.frequencyBinCount)

    // Energy-gated drone gain — continuous voices go through here
    const masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(analyser)

    // Notes gain — always on, for keyboard/click one-shot notes
    const notesGain = ctx.createGain()
    notesGain.gain.value = 1.0
    notesGain.connect(analyser)

    const mainPanner = ctx.createStereoPanner()
    mainPanner.pan.value = 0
    mainPanner.connect(masterGain)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2000
    filter.Q.value = 2.0
    filter.connect(mainPanner)

    const voiceGain = ctx.createGain()
    voiceGain.gain.value = 0

    // FX chain sits between voiceGain and filter
    const { input: fxInput } = this.fx.connect(ctx, filter)
    voiceGain.connect(fxInput)

    const voices = this.buildVoices(ctx, voiceGain, 'sine', MIN_FREQ)

    this.nodes = {
      ctx, masterGain, masterVolume, mainPanner, voices,
      voiceGain, filter, analyser, notesGain, fftData,
      waveform: 'sine',
    }
    this._active = true
    masterGain.gain.setTargetAtTime(0.2, ctx.currentTime, 0.3)
  }

  stop(): void {
    const n = this.nodes
    if (!n) return
    this._active = false

    const now = n.ctx.currentTime
    n.masterGain.gain.setTargetAtTime(0, now, 0.3)
    setTimeout(() => {
      for (const v of n.voices) v.osc.stop()
      n.ctx.close()
      this.nodes = null
    }, 1500)
  }

  // ── Configuration ──────────────────────────────────────

  setWaveform(wf: SynthWaveform): void {
    const n = this.nodes
    if (!n) return
    n.waveform = wf
    for (const v of n.voices) v.osc.type = wf
  }

  setFilterQ(q: number): void {
    const n = this.nodes
    if (!n) return
    n.filter.Q.setTargetAtTime(q, n.ctx.currentTime, 0.05)
  }

  setScale(scale: ScaleName): void { this._scale = scale }

  // FX pass-through setters
  setDelayTime(s: number): void { this.fx.setDelayTime(s) }
  setDelayFeedback(v: number): void { this.fx.setDelayFeedback(v) }
  setDelayMix(v: number): void { this.fx.setDelayMix(v) }
  setReverbMix(v: number): void { this.fx.setReverbMix(v) }
  setReverbDecay(s: number): void { this.fx.setReverbDecay(s) }
  setDistortion(v: number): void { this.fx.setDistortion(v) }
  setAutoDistortion(on: boolean): void { this._autoDistortion = on }

  setVolume(v: number): void {
    const n = this.nodes
    if (!n) return
    n.masterVolume.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), n.ctx.currentTime, 0.05)
  }

  setDroneVolume(v: number): void {
    this._droneVolumeScale = Math.max(0, Math.min(1, v))
  }

  setNotesVolume(v: number): void {
    const n = this.nodes
    if (!n) return
    n.notesGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), n.ctx.currentTime, 0.05)
  }

  setEnvelope(a: number, d: number, s: number, r: number): void {
    this._envelope = {
      attack: Math.max(0.001, a),
      decay: Math.max(0.01, d),
      sustain: Math.max(0, Math.min(1, s)),
      release: Math.max(0.01, r),
    }
  }

  setUnisonCount(count: number): void {
    const clamped = Math.max(1, Math.min(7, Math.round(count)))
    if (clamped === this._unisonCount) return
    this._unisonCount = clamped
    this.rebuildVoices()
  }

  setDetuneSpread(cents: number): void {
    this._detuneSpread = Math.max(0, Math.min(100, cents))
    this.applyDetune()
  }

  // ── Per-Frame Update ───────────────────────────────────

  update(
    energy: number, maxEnergy: number,
    interferenceRatio: number,
    mouseX = 0.5, mouseY?: number,
  ): void {
    const n = this.nodes
    if (!n || !this._active) return

    const now = n.ctx.currentTime
    const eNorm = Math.min(energy / Math.max(maxEnergy, 1), 1)

    // Pitch: mouse Y → C2-C5 (exponential), quantized to scale
    if (mouseY !== undefined) {
      const yInv = 1.0 - mouseY
      const rawFreq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, yInv)
      const freq = snapToScale(rawFreq, this._scale)
      this._currentFreq = freq
      for (const v of n.voices) {
        v.osc.frequency.setTargetAtTime(freq, now, 0.08)
      }
    }

    // Filter cutoff: mouse X → 200Hz-8kHz
    const cutoff = 200 * Math.pow(40, mouseX)
    n.filter.frequency.setTargetAtTime(cutoff, now, 0.05)

    // Voice volume: energy-gated with interference modulation
    const iRatio = Math.max(0, Math.min(1, interferenceRatio))
    const vol = eNorm * 0.35 * (0.5 + iRatio * 0.5) * this._droneVolumeScale
    n.voiceGain.gain.setTargetAtTime(vol, now, 0.05)

    // Panning
    n.mainPanner.pan.setTargetAtTime((mouseX - 0.5) * 2.0, now, 0.1)

    // Auto-distortion: interference ratio drives waveshaper
    if (this._autoDistortion) {
      this.fx.setDistortion(iRatio * 50)
    }

    this.analyzFFT(n)
  }

  // ── One-Shot Sounds ────────────────────────────────────

  triggerClick(mapX = 0.5): void {
    const n = this.nodes
    if (!n || !this._active) return

    const now = n.ctx.currentTime

    // Tonal click
    const clickOsc = n.ctx.createOscillator()
    const clickGain = n.ctx.createGain()
    clickOsc.type = n.waveform
    clickOsc.frequency.value = 400 + Math.random() * 600
    clickGain.gain.setValueAtTime(0, now)
    clickGain.gain.linearRampToValueAtTime(0.10, now + 0.01)
    clickGain.gain.linearRampToValueAtTime(0.03, now + 0.06)
    clickGain.gain.linearRampToValueAtTime(0, now + 0.16)

    const panner = n.ctx.createStereoPanner()
    panner.pan.value = (mapX - 0.5) * 2.0

    clickOsc.connect(clickGain)
    clickGain.connect(panner)
    panner.connect(n.analyser)
    clickOsc.start(now)
    clickOsc.stop(now + 0.2)

    // Noise burst — adds percussive "click" texture
    this.fireNoiseBurst(n, mapX, 0.04, 0.08)
  }

  /**
   * Play a note. If sustained=true, holds at sustain level until release() is called.
   * If sustained=false (default), auto-releases after attack+decay.
   */
  playNote(freq: number, velocity = 0.8, sustained = false): { release: () => void } {
    const noop = { release: () => {} }
    const n = this.nodes
    if (!n || !this._active) return noop

    const ctx = n.ctx
    const now = ctx.currentTime
    const noteFilter = ctx.createBiquadFilter()
    noteFilter.type = 'lowpass'
    noteFilter.frequency.value = n.filter.frequency.value
    noteFilter.Q.value = n.filter.Q.value

    const gain = ctx.createGain()
    const vol = velocity * 0.4
    const { attack, decay, sustain, release } = this._envelope

    // Attack → Decay → Sustain level
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(vol, now + attack)
    gain.gain.linearRampToValueAtTime(vol * sustain, now + attack + decay)

    // Spawn unison voices for this note
    const count = this._unisonCount
    const oscs: OscillatorNode[] = []
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator()
      osc.type = n.waveform
      osc.frequency.value = freq
      osc.detune.value = this.detuneForIndex(i, count)

      const vPan = ctx.createStereoPanner()
      vPan.pan.value = this.panForIndex(i, count)

      osc.connect(vPan)
      vPan.connect(noteFilter)
      osc.start(now)
      oscs.push(osc)
    }

    noteFilter.connect(gain)
    gain.connect(n.notesGain)

    let released = false
    const doRelease = () => {
      if (released) return
      released = true
      const t = ctx.currentTime
      gain.gain.cancelScheduledValues(t)
      gain.gain.setValueAtTime(gain.gain.value, t)
      gain.gain.linearRampToValueAtTime(0, t + release)
      oscs.forEach(o => { try { o.stop(t + release + 0.05) } catch { /* already stopped */ } })
    }

    if (!sustained) {
      // Auto-release after attack + decay + small hold
      const autoReleaseTime = now + attack + decay + 0.05
      gain.gain.setValueAtTime(vol * sustain, autoReleaseTime)
      gain.gain.linearRampToValueAtTime(0, autoReleaseTime + release)
      oscs.forEach(o => { try { o.stop(autoReleaseTime + release + 0.05) } catch { /* */ } })
    }

    return { release: doRelease }
  }

  // ── Internal: Voice Management ─────────────────────────

  private buildVoices(
    ctx: AudioContext, dest: GainNode,
    waveform: SynthWaveform, freq: number,
  ): UnisonVoice[] {
    const voices: UnisonVoice[] = []
    const count = this._unisonCount

    for (let i = 0; i < count; i++) {
      const panner = ctx.createStereoPanner()
      panner.pan.value = this.panForIndex(i, count)
      panner.connect(dest)

      const osc = ctx.createOscillator()
      osc.type = waveform
      osc.frequency.value = freq
      osc.detune.value = this.detuneForIndex(i, count)
      osc.connect(panner)
      osc.start()

      voices.push({ osc, panner })
    }
    return voices
  }

  private rebuildVoices(): void {
    const n = this.nodes
    if (!n) return
    // Stop old voices
    for (const v of n.voices) {
      v.osc.stop()
      v.osc.disconnect()
      v.panner.disconnect()
    }
    // Build new
    n.voices = this.buildVoices(
      n.ctx, n.voiceGain, n.waveform, this._currentFreq,
    )
  }

  private applyDetune(): void {
    const n = this.nodes
    if (!n) return
    const count = n.voices.length
    for (let i = 0; i < count; i++) {
      n.voices[i].osc.detune.value = this.detuneForIndex(i, count)
      n.voices[i].panner.pan.value = this.panForIndex(i, count)
    }
  }

  /** Detune for voice i out of count total, spread across ±_detuneSpread */
  private detuneForIndex(i: number, count: number): number {
    if (count === 1) return 0
    // Distribute evenly: -spread/2 ... 0 ... +spread/2
    return -this._detuneSpread / 2 + (i / (count - 1)) * this._detuneSpread
  }

  /** Stereo pan for voice i: spread from -0.8 to +0.8 */
  private panForIndex(i: number, count: number): number {
    if (count === 1) return 0
    return -0.8 + (i / (count - 1)) * 1.6
  }

  // ── Internal: Noise ────────────────────────────────────

  private fireNoiseBurst(
    n: EngineNodes, panX: number, volume: number, duration: number,
  ): void {
    const now = n.ctx.currentTime
    const bufferSize = Math.floor(n.ctx.sampleRate * duration)
    const buffer = n.ctx.createBuffer(1, bufferSize, n.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) // decay envelope baked in
    }

    const src = n.ctx.createBufferSource()
    src.buffer = buffer
    const gain = n.ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.linearRampToValueAtTime(0, now + duration)

    const panner = n.ctx.createStereoPanner()
    panner.pan.value = (panX - 0.5) * 2.0

    src.connect(gain)
    gain.connect(panner)
    panner.connect(n.notesGain)
    src.start(now)
    src.stop(now + duration)
  }

  // ── Internal: FFT ──────────────────────────────────────

  private analyzFFT(n: EngineNodes): void {
    n.analyser.getByteFrequencyData(n.fftData)
    const bins = n.fftData
    const numBins = bins.length

    let bassSum = 0
    for (let i = 0; i < Math.min(6, numBins); i++) bassSum += bins[i]
    const bassRaw = bassSum / (6 * 255)

    let midSum = 0
    for (let i = 6; i < Math.min(31, numBins); i++) midSum += bins[i]
    const midRaw = midSum / (25 * 255)

    let trebleSum = 0
    for (let i = 31; i < Math.min(64, numBins); i++) trebleSum += bins[i]
    const trebleRaw = trebleSum / (33 * 255)

    this.smooth.bass = this.smooth.bass * 0.7 + bassRaw * 0.3
    this.smooth.mid = this.smooth.mid * 0.7 + midRaw * 0.3
    this.smooth.treble = this.smooth.treble * 0.7 + trebleRaw * 0.3

    this.fft = { bass: this.smooth.bass, mid: this.smooth.mid, treble: this.smooth.treble }
  }
}
