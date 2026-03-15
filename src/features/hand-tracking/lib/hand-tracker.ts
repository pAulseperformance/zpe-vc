/**
 * hand-tracker.ts — MediaPipe HandLandmarker wrapper.
 *
 * Supports 2-hand detection with handedness classification.
 * MediaPipe is dynamically imported to code-split the ~530KB WASM bundle.
 */

// Dynamic import types — actual module loaded lazily in init()
type HandLandmarkerType = import('@mediapipe/tasks-vision').HandLandmarker

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export type HandLandmarks = Array<{ x: number; y: number; z: number }>

export interface FrameResult {
  left: HandLandmarks | null
  right: HandLandmarks | null
}

export type OnFrameCallback = (result: FrameResult) => void

export class HandTracker {
  private landmarker: HandLandmarkerType | null = null
  private video: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private rafId = 0
  private onFrame: OnFrameCallback = () => {}
  private _ready = false
  private lastTime = -1

  get ready(): boolean { return this._ready }

  async init(): Promise<void> {
    if (this.landmarker) return

    // Dynamic import — code-splits MediaPipe into its own chunk
    const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
    )

    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    this._ready = true
  }

  async start(
    videoEl: HTMLVideoElement,
    onFrame: OnFrameCallback,
  ): Promise<void> {
    this.onFrame = onFrame
    this.video = videoEl

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 320, height: 240 },
    })

    videoEl.srcObject = this.stream
    videoEl.muted = true

    await new Promise<void>((resolve) => {
      videoEl.onloadeddata = () => resolve()
    })
    videoEl.play()

    if (!this.landmarker) await this.init()

    this.lastTime = -1
    this.detect()
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop())
      this.stream = null
    }
    if (this.video) {
      this.video.srcObject = null
      this.video = null
    }
  }

  private detect = (): void => {
    if (!this.video || !this.landmarker) return

    const now = performance.now()
    if (now === this.lastTime) {
      this.rafId = requestAnimationFrame(this.detect)
      return
    }
    this.lastTime = now

    const result = this.landmarker.detectForVideo(this.video, now)

    // Sort landmarks by handedness
    // MediaPipe handedness is from camera's perspective, mirror it
    const frame: FrameResult = { left: null, right: null }
    if (result.landmarks && result.handedness) {
      for (let i = 0; i < result.landmarks.length; i++) {
        const label = result.handedness[i]?.[0]?.categoryName
        // Mirror: MediaPipe "Left" (camera POV) = user's right hand
        if (label === 'Left') {
          frame.right = result.landmarks[i] as HandLandmarks
        } else {
          frame.left = result.landmarks[i] as HandLandmarks
        }
      }
    }

    this.onFrame(frame)
    this.rafId = requestAnimationFrame(this.detect)
  }

  destroy(): void {
    this.stop()
    this.landmarker?.close()
    this.landmarker = null
    this._ready = false
  }
}
