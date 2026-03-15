/**
 * audio-recorder.ts — Records the master audio output as WAV.
 *
 * Uses MediaRecorder on a MediaStream from AudioContext.destination.
 * Downloads the recording as a WAV-compatible file.
 */

export class AudioRecorder {
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private _recording = false

  get recording(): boolean { return this._recording }

  /** Start recording from an AudioContext's destination */
  start(ctx: AudioContext): boolean {
    try {
      // Create a MediaStreamDestination node
      const dest = ctx.createMediaStreamDestination()
      // We need to connect the master output to this destination
      // The caller should connect their master gain → this dest
      this.startFromStream(dest.stream)
      return true
    } catch {
      return false
    }
  }

  /** Start recording from a MediaStream directly */
  startFromStream(stream: MediaStream): void {
    this.chunks = []
    // Prefer audio/webm;codecs=opus, fallback to audio/webm  
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    this.recorder = new MediaRecorder(stream, { mimeType })
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.recorder.start(100) // collect in 100ms chunks
    this._recording = true
  }

  /** Stop recording and download the file */
  stop(): void {
    if (!this.recorder || !this._recording) return
    
    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.recorder?.mimeType ?? 'audio/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quantum-synth-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      this.chunks = []
    }

    this.recorder.stop()
    this._recording = false
  }

  destroy(): void {
    if (this._recording) this.stop()
    this.recorder = null
    this.chunks = []
  }
}
