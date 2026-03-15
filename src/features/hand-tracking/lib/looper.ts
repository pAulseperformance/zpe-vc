/**
 * looper.ts — Records and replays hand performance events.
 *
 * Captures timestamped note triggers and parameter changes,
 * then plays them back in a loop.
 */

export interface LoopEvent {
  time: number           // ms offset from loop start
  type: 'noteOn' | 'noteOff' | 'bend'
  freq?: number
  velocity?: number
  x?: number
  y?: number
}

export class Looper {
  private events: LoopEvent[] = []
  private recording = false
  private playing = false
  private loopLength = 4000  // ms (default 4 seconds)
  private startTime = 0
  private playStartTime = 0
  private playRafId = 0
  private lastPlayIdx = 0
  private onEvent: (event: LoopEvent) => void = () => {}

  get isRecording(): boolean { return this.recording }
  get isPlaying(): boolean { return this.playing }
  get eventCount(): number { return this.events.length }
  get length(): number { return this.loopLength }

  setLength(ms: number): void {
    this.loopLength = Math.max(500, Math.min(16000, ms))
  }

  startRecording(): void {
    this.events = []
    this.recording = true
    this.startTime = performance.now()
  }

  stopRecording(): void {
    this.recording = false
  }

  /** Record an event (called per-frame while recording) */
  record(event: Omit<LoopEvent, 'time'>): void {
    if (!this.recording) return
    const time = (performance.now() - this.startTime) % this.loopLength
    this.events.push({ ...event, time })
  }

  /** Start playback loop. Calls onEvent for each replayed event. */
  startPlayback(onEvent: (event: LoopEvent) => void): void {
    if (this.events.length === 0) return
    this.onEvent = onEvent
    this.playing = true
    this.playStartTime = performance.now()
    this.lastPlayIdx = 0
    // Sort events by time for correct playback order
    this.events.sort((a, b) => a.time - b.time)
    this.playLoop()
  }

  stopPlayback(): void {
    this.playing = false
    if (this.playRafId) cancelAnimationFrame(this.playRafId)
    this.playRafId = 0
  }

  clear(): void {
    this.stopPlayback()
    this.events = []
  }

  private playLoop = (): void => {
    if (!this.playing) return

    const elapsed = (performance.now() - this.playStartTime) % this.loopLength
    // Find all events that should fire this frame
    // Handle wrap-around: if lastPlayIdx was near end and we're near start, we wrapped
    const evts = this.events
    let idx = this.lastPlayIdx

    // Simple approach: scan from last position to current time
    for (let i = 0; i < evts.length; i++) {
      const eidx = (idx + i) % evts.length
      const e = evts[eidx]
      // Check if this event's time is between last frame and current frame
      // (accounting for wrap-around)
      if (this.isEventDue(e.time, elapsed)) {
        this.onEvent(e)
      }
    }

    this.lastPlayIdx = this.findClosestIdx(elapsed)
    this.playRafId = requestAnimationFrame(this.playLoop)
  }

  private prevElapsed = 0

  private isEventDue(eventTime: number, elapsed: number): boolean {
    const prev = this.prevElapsed
    this.prevElapsed = elapsed

    if (elapsed >= prev) {
      // Normal case: no wrap
      return eventTime >= prev && eventTime < elapsed
    } else {
      // Wrapped around
      return eventTime >= prev || eventTime < elapsed
    }
  }

  private findClosestIdx(time: number): number {
    let closest = 0
    let minDiff = Infinity
    for (let i = 0; i < this.events.length; i++) {
      const diff = Math.abs(this.events[i].time - time)
      if (diff < minDiff) {
        minDiff = diff
        closest = i
      }
    }
    return closest
  }
}
