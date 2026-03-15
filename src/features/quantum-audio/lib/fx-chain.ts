/**
 * FX Chain — Delay, Reverb, and Distortion
 *
 * Pure Web Audio processing chain. Zero React dependencies.
 * Plugs between VoiceGain and Filter in the SynthEngine signal chain.
 *
 * Chain: Input → Distortion → Delay → Reverb → Output
 */

export interface FXConfig {
  delayTime: number    // seconds (0-1)
  delayFeedback: number // 0-0.95
  delayMix: number     // wet/dry 0-1
  reverbMix: number    // wet/dry 0-1
  reverbDecay: number  // seconds (0.5-5)
  distortion: number   // drive amount 0-100
}

export const DEFAULT_FX: FXConfig = {
  delayTime: 0.3,
  delayFeedback: 0.4,
  delayMix: 0,
  reverbMix: 0,
  reverbDecay: 2,
  distortion: 0,
}

export class FXChain {
  private ctx: AudioContext | null = null
  private input: GainNode | null = null
  private output: GainNode | null = null

  // Delay nodes
  private delayNode: DelayNode | null = null
  private delayFeedbackGain: GainNode | null = null
  private delayWetGain: GainNode | null = null
  private delayDryGain: GainNode | null = null

  // Reverb nodes
  private reverbConvolver: ConvolverNode | null = null
  private reverbWetGain: GainNode | null = null
  private reverbDryGain: GainNode | null = null

  // Distortion
  private waveshaper: WaveShaperNode | null = null

  private config: FXConfig = { ...DEFAULT_FX }

  /** Connect input → FX chain → output destination */
  connect(ctx: AudioContext, destination: AudioNode): { input: GainNode } {
    this.ctx = ctx

    // Chain: Input → WaveShaper → DelayDry/Wet → ReverbDry/Wet → Output
    this.input = ctx.createGain()
    this.output = ctx.createGain()
    this.output.connect(destination)

    // ── Distortion (waveshaper) ─────────────────────────
    this.waveshaper = ctx.createWaveShaper()
    this.waveshaper.oversample = '2x'
    this.applyDistortionCurve(this.config.distortion)

    // ── Delay ───────────────────────────────────────────
    this.delayNode = ctx.createDelay(2.0)
    this.delayNode.delayTime.value = this.config.delayTime

    this.delayFeedbackGain = ctx.createGain()
    this.delayFeedbackGain.gain.value = this.config.delayFeedback

    this.delayWetGain = ctx.createGain()
    this.delayWetGain.gain.value = this.config.delayMix

    this.delayDryGain = ctx.createGain()
    this.delayDryGain.gain.value = 1.0

    // Delay feedback loop
    this.delayNode.connect(this.delayFeedbackGain)
    this.delayFeedbackGain.connect(this.delayNode)
    this.delayNode.connect(this.delayWetGain)

    // ── Reverb (impulse response) ───────────────────────
    this.reverbConvolver = ctx.createConvolver()
    this.buildImpulse(this.config.reverbDecay)

    this.reverbWetGain = ctx.createGain()
    this.reverbWetGain.gain.value = this.config.reverbMix

    this.reverbDryGain = ctx.createGain()
    this.reverbDryGain.gain.value = 1.0

    // ── Wire the chain ──────────────────────────────────
    // Input → WaveShaper
    this.input.connect(this.waveshaper)

    // WaveShaper → Delay dry/wet split
    this.waveshaper.connect(this.delayNode)
    this.waveshaper.connect(this.delayDryGain)

    // Delay mix → Reverb dry/wet split
    const delayMerge = ctx.createGain()
    this.delayWetGain.connect(delayMerge)
    this.delayDryGain.connect(delayMerge)

    delayMerge.connect(this.reverbConvolver)
    delayMerge.connect(this.reverbDryGain)
    this.reverbConvolver.connect(this.reverbWetGain)

    // Reverb mix → Output
    this.reverbWetGain.connect(this.output)
    this.reverbDryGain.connect(this.output)

    return { input: this.input }
  }

  // ── Runtime controls ───────────────────────────────────

  setDelayTime(seconds: number): void {
    this.config.delayTime = seconds
    if (this.delayNode && this.ctx) {
      this.delayNode.delayTime.setTargetAtTime(seconds, this.ctx.currentTime, 0.05)
    }
  }

  setDelayFeedback(value: number): void {
    this.config.delayFeedback = Math.min(0.95, value)
    if (this.delayFeedbackGain && this.ctx) {
      this.delayFeedbackGain.gain.setTargetAtTime(this.config.delayFeedback, this.ctx.currentTime, 0.05)
    }
  }

  setDelayMix(value: number): void {
    this.config.delayMix = value
    if (this.delayWetGain && this.ctx) {
      const now = this.ctx.currentTime
      this.delayWetGain.gain.setTargetAtTime(value, now, 0.05)
    }
  }

  setReverbMix(value: number): void {
    this.config.reverbMix = value
    if (this.reverbWetGain && this.ctx) {
      this.reverbWetGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05)
    }
  }

  setReverbDecay(seconds: number): void {
    this.config.reverbDecay = seconds
    this.buildImpulse(seconds)
  }

  setDistortion(amount: number): void {
    this.config.distortion = amount
    this.applyDistortionCurve(amount)
  }

  // ── Internal ───────────────────────────────────────────

  private buildImpulse(decay: number): void {
    if (!this.ctx || !this.reverbConvolver) return
    const rate = this.ctx.sampleRate
    const length = Math.floor(rate * decay)
    const impulse = this.ctx.createBuffer(2, length, rate)

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    this.reverbConvolver.buffer = impulse
  }

  private applyDistortionCurve(amount: number): void {
    if (!this.waveshaper) return
    if (amount <= 0) {
      this.waveshaper.curve = null
      return
    }
    const samples = 256
    const curve = new Float32Array(samples)
    const k = amount
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x))
    }
    this.waveshaper.curve = curve
  }
}
