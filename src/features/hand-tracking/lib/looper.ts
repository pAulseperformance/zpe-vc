/**
 * looper.ts — Records and replays hand performance events.
 *
 * Supports BPM-quantized recording, multi-layer loops,
 * and timestamped event capture with wrap-around playback.
 */

export interface LoopEvent {
  time: number           // ms offset from loop start
  type: 'noteOn' | 'noteOff' | 'bend'
  freq?: number
  velocity?: number
  x?: number
  y?: number
}

interface LoopLayer {
  events: LoopEvent[]
  muted: boolean
}

export class Looper {
  private layers: LoopLayer[] = []
  private activeLayer = 0
  private recording = false
  private playing = false
  private _bpm = 120
  private _beats = 4       // beats per loop
  private _quantize = false // snap events to beat grid
  private startTime = 0
  private playStartTime = 0
  private playRafId = 0
  private prevElapsed = 0
  private onEvent: (event: LoopEvent) => void = () => {}

  get isRecording(): boolean { return this.recording }
  get isPlaying(): boolean { return this.playing }
  get layerCount(): number { return this.layers.length }
  get bpm(): number { return this._bpm }
  get beats(): number { return this._beats }
  get quantize(): boolean { return this._quantize }

  /** Loop length in ms, derived from BPM and beats */
  get length(): number {
    return (60000 / this._bpm) * this._beats
  }

  get eventCount(): number {
    return this.layers.reduce((sum, l) => sum + l.events.length, 0)
  }

  setBpm(bpm: number): void {
    this._bpm = Math.max(30, Math.min(300, bpm))
  }

  setBeats(beats: number): void {
    this._beats = Math.max(1, Math.min(32, beats))
  }

  setQuantize(on: boolean): void {
    this._quantize = on
  }

  /** Quantize a time value to the nearest beat subdivision (16th note) */
  private quantizeTime(timeMs: number): number {
    if (!this._quantize) return timeMs
    const subdivMs = (60000 / this._bpm) / 4 // 16th note
    return Math.round(timeMs / subdivMs) * subdivMs
  }

  startRecording(): void {
    // Add a new layer if the current one has events, or reuse empty
    if (this.layers.length === 0 || this.layers[this.activeLayer]?.events.length > 0) {
      this.layers.push({ events: [], muted: false })
      this.activeLayer = this.layers.length - 1
    }
    this.recording = true
    this.startTime = performance.now()
  }

  stopRecording(): void {
    this.recording = false
  }

  /** Record an event (called per-frame while recording) */
  record(event: Omit<LoopEvent, 'time'>): void {
    if (!this.recording) return
    const rawTime = (performance.now() - this.startTime) % this.length
    const time = this.quantizeTime(rawTime)
    const layer = this.layers[this.activeLayer]
    if (layer) {
      layer.events.push({ ...event, time })
    }
  }

  /** Toggle mute on a specific layer */
  toggleLayerMute(index: number): void {
    if (index >= 0 && index < this.layers.length) {
      this.layers[index].muted = !this.layers[index].muted
    }
  }

  /** Delete a specific layer */
  deleteLayer(index: number): void {
    if (index >= 0 && index < this.layers.length) {
      this.layers.splice(index, 1)
      if (this.activeLayer >= this.layers.length) {
        this.activeLayer = Math.max(0, this.layers.length - 1)
      }
    }
  }

  /** Get layer info for UI display */
  getLayerInfo(): Array<{ events: number; muted: boolean }> {
    return this.layers.map(l => ({ events: l.events.length, muted: l.muted }))
  }

  /** Start playback loop. Calls onEvent for each replayed event. */
  startPlayback(onEvent: (event: LoopEvent) => void): void {
    const totalEvents = this.layers.reduce((s, l) => s + l.events.length, 0)
    if (totalEvents === 0) return
    this.onEvent = onEvent
    this.playing = true
    this.playStartTime = performance.now()
    this.prevElapsed = 0
    // Sort each layer's events by time
    this.layers.forEach(l => l.events.sort((a, b) => a.time - b.time))
    this.playLoop()
  }

  stopPlayback(): void {
    this.playing = false
    if (this.playRafId) cancelAnimationFrame(this.playRafId)
    this.playRafId = 0
  }

  clear(): void {
    this.stopPlayback()
    this.layers = []
    this.activeLayer = 0
  }

  private playLoop = (): void => {
    if (!this.playing) return

    const loopLen = this.length
    const elapsed = (performance.now() - this.playStartTime) % loopLen

    // Fire events from all unmuted layers
    for (const layer of this.layers) {
      if (layer.muted) continue
      for (const e of layer.events) {
        if (this.isEventDue(e.time, elapsed)) {
          this.onEvent(e)
        }
      }
    }

    this.prevElapsed = elapsed
    this.playRafId = requestAnimationFrame(this.playLoop)
  }

  private isEventDue(eventTime: number, elapsed: number): boolean {
    const prev = this.prevElapsed
    if (elapsed >= prev) {
      return eventTime >= prev && eventTime < elapsed
    } else {
      // Wrapped around
      return eventTime >= prev || eventTime < elapsed
    }
  }
}
