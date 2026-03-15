/**
 * SynthEngine — Pure TypeScript Web Audio DSP engine
 *
 * Zero React dependencies. Manages the AudioContext, oscillators,
 * filter, analyser, and FFT band extraction.
 *
 * Signal chain:
 *   OscA (+7¢) ─┐
 *                ├→ VoiceGain → Filter → Panner → Analyser → MasterGain → Destination
 *   OscB (-7¢) ─┘
 */

export type SynthWaveform = 'sine' | 'sawtooth' | 'square' | 'triangle'

export interface FFTBands {
  bass: number   // 0-1
  mid: number    // 0-1
  treble: number // 0-1
}

const MIN_FREQ = 65    // C2
const MAX_FREQ = 523   // C5
const DETUNE_CENTS = 7

interface EngineNodes {
  ctx: AudioContext
  masterGain: GainNode
  mainPanner: StereoPannerNode
  oscA: OscillatorNode
  oscB: OscillatorNode
  voiceGain: GainNode
  filter: BiquadFilterNode
  analyser: AnalyserNode
  fftData: Uint8Array<ArrayBuffer>
  waveform: SynthWaveform
}

export class SynthEngine {
  private nodes: EngineNodes | null = null
  private _active = false
  private smooth: FFTBands = { bass: 0, mid: 0, treble: 0 }

  /** Current FFT band levels (read per-frame) */
  fft: FFTBands = { bass: 0, mid: 0, treble: 0 }

  get active(): boolean { return this._active }

  // ── Lifecycle ──────────────────────────────────────────

  start(): void {
    if (this.nodes) return

    const ctx = new AudioContext()

    const masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(ctx.destination)

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.6
    analyser.connect(masterGain)
    const fftData = new Uint8Array(analyser.frequencyBinCount)

    const mainPanner = ctx.createStereoPanner()
    mainPanner.pan.value = 0
    mainPanner.connect(analyser)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2000
    filter.Q.value = 2.0
    filter.connect(mainPanner)

    const voiceGain = ctx.createGain()
    voiceGain.gain.value = 0
    voiceGain.connect(filter)

    const oscA = ctx.createOscillator()
    oscA.type = 'sine'
    oscA.frequency.value = MIN_FREQ
    oscA.detune.value = DETUNE_CENTS
    oscA.connect(voiceGain)
    oscA.start()

    const oscB = ctx.createOscillator()
    oscB.type = 'sine'
    oscB.frequency.value = MIN_FREQ
    oscB.detune.value = -DETUNE_CENTS
    oscB.connect(voiceGain)
    oscB.start()

    this.nodes = {
      ctx, masterGain, mainPanner,
      oscA, oscB, voiceGain,
      filter, analyser, fftData,
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
      n.oscA.stop()
      n.oscB.stop()
      n.ctx.close()
      this.nodes = null
    }, 1500)
  }

  // ── Configuration ──────────────────────────────────────

  setWaveform(wf: SynthWaveform): void {
    const n = this.nodes
    if (!n) return
    n.waveform = wf
    n.oscA.type = wf
    n.oscB.type = wf
  }

  setFilterQ(q: number): void {
    const n = this.nodes
    if (!n) return
    n.filter.Q.setTargetAtTime(q, n.ctx.currentTime, 0.05)
  }

  // ── Per-Frame Update ───────────────────────────────────

  update(
    energy: number,
    maxEnergy: number,
    interferenceRatio: number,
    mouseX = 0.5,
    mouseY?: number,
  ): void {
    const n = this.nodes
    if (!n || !this._active) return

    const now = n.ctx.currentTime
    const eNorm = Math.min(energy / Math.max(maxEnergy, 1), 1)

    // Pitch: mouse Y → C2-C5 (exponential)
    if (mouseY !== undefined) {
      const yInv = 1.0 - mouseY
      const freq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, yInv)
      n.oscA.frequency.setTargetAtTime(freq, now, 0.08)
      n.oscB.frequency.setTargetAtTime(freq, now, 0.08)
    }

    // Filter cutoff: mouse X → 200Hz-8kHz
    const cutoff = 200 * Math.pow(40, mouseX)
    n.filter.frequency.setTargetAtTime(cutoff, now, 0.05)

    // Voice volume: energy-gated with interference modulation
    const iRatio = Math.max(0, Math.min(1, interferenceRatio))
    const vol = eNorm * 0.35 * (0.5 + iRatio * 0.5)
    n.voiceGain.gain.setTargetAtTime(vol, now, 0.05)

    // Panning
    const panTarget = (mouseX - 0.5) * 2.0
    n.mainPanner.pan.setTargetAtTime(panTarget, now, 0.1)

    // FFT analysis
    this.analyzFFT(n)
  }

  // ── One-Shot Sounds ────────────────────────────────────

  triggerClick(mapX = 0.5): void {
    const n = this.nodes
    if (!n || !this._active) return

    const now = n.ctx.currentTime
    const clickOsc = n.ctx.createOscillator()
    const clickGain = n.ctx.createGain()

    clickOsc.type = n.waveform
    clickOsc.frequency.value = 400 + Math.random() * 600

    clickGain.gain.setValueAtTime(0, now)
    clickGain.gain.linearRampToValueAtTime(0.12, now + 0.01)
    clickGain.gain.linearRampToValueAtTime(0.04, now + 0.06)
    clickGain.gain.linearRampToValueAtTime(0, now + 0.16)

    const panner = n.ctx.createStereoPanner()
    panner.pan.value = (mapX - 0.5) * 2.0

    clickOsc.connect(clickGain)
    clickGain.connect(panner)
    panner.connect(n.analyser)

    clickOsc.start(now)
    clickOsc.stop(now + 0.2)
  }

  playNote(freq: number, velocity = 0.8): void {
    const n = this.nodes
    if (!n || !this._active) return

    const now = n.ctx.currentTime
    const osc = n.ctx.createOscillator()
    const oscB = n.ctx.createOscillator()
    const gain = n.ctx.createGain()
    const noteFilter = n.ctx.createBiquadFilter()

    osc.type = n.waveform
    osc.frequency.value = freq
    osc.detune.value = DETUNE_CENTS

    oscB.type = n.waveform
    oscB.frequency.value = freq
    oscB.detune.value = -DETUNE_CENTS

    noteFilter.type = 'lowpass'
    noteFilter.frequency.value = n.filter.frequency.value
    noteFilter.Q.value = n.filter.Q.value

    const vol = velocity * 0.2
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.015)
    gain.gain.linearRampToValueAtTime(vol * 0.6, now + 0.1)
    gain.gain.setValueAtTime(vol * 0.6, now + 0.25)
    gain.gain.linearRampToValueAtTime(0, now + 0.5)

    osc.connect(noteFilter)
    oscB.connect(noteFilter)
    noteFilter.connect(gain)
    gain.connect(n.analyser)

    osc.start(now)
    oscB.start(now)
    osc.stop(now + 0.55)
    oscB.stop(now + 0.55)
  }

  // ── Internal ───────────────────────────────────────────

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
