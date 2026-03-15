/**
 * gesture-map.ts — Configurable mapping from hand landmarks to synth parameters.
 *
 * The user can swap which axis controls what via HandMappingConfig.
 */

/** Synth targets a hand axis can be mapped to */
export type HandTarget = 'pitch' | 'filter' | 'volume' | 'delayMix' | 'reverbMix' | 'none'

export interface HandMappingConfig {
  xTarget: HandTarget   // What does horizontal hand movement control?
  yTarget: HandTarget   // What does vertical hand movement control?
  zTarget: HandTarget   // What does depth (toward/away from camera) control?
  pinchThreshold: number // Distance below which pinch is detected (0-1)
  smoothing: number      // EMA smoothing factor (0=no smoothing, 0.9=very smooth)
}

export const DEFAULT_HAND_MAPPING: HandMappingConfig = {
  xTarget: 'filter',
  yTarget: 'pitch',
  zTarget: 'volume',
  pinchThreshold: 0.06,
  smoothing: 0.7,
}

/** Processed hand state per frame */
export interface HandState {
  x: number       // 0-1 normalized
  y: number       // 0-1 normalized
  z: number       // 0-1 normalized (0=close to camera, 1=far)
  pinching: boolean
  confidence: number
  detected: boolean
}

const EMPTY_STATE: HandState = {
  x: 0.5, y: 0.5, z: 0.5,
  pinching: false, confidence: 0, detected: false,
}

/**
 * Smooths hand tracking output with exponential moving average
 * and detects pinch gesture from thumb (4) ↔ index (8) distance.
 */
export class GestureMapper {
  private config: HandMappingConfig
  private smoothed: HandState = { ...EMPTY_STATE }

  constructor(config: HandMappingConfig = DEFAULT_HAND_MAPPING) {
    this.config = config
  }

  setConfig(config: Partial<HandMappingConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): HandMappingConfig {
    return this.config
  }

  /**
   * Process raw MediaPipe landmarks into a smoothed HandState.
   * landmarks: array of { x, y, z } in normalized image coords (0-1).
   */
  process(
    landmarks: Array<{ x: number; y: number; z: number }> | null,
  ): HandState {
    if (!landmarks || landmarks.length < 21) {
      // Decay confidence when no hand detected
      this.smoothed.confidence *= 0.8
      if (this.smoothed.confidence < 0.01) {
        this.smoothed = { ...EMPTY_STATE }
      }
      return { ...this.smoothed }
    }

    const indexTip = landmarks[8]   // Index finger tip
    const thumbTip = landmarks[4]   // Thumb tip

    // Raw position from index finger tip (mirror X so moving hand right = right on screen)
    const rawX = 1 - indexTip.x
    const rawY = indexTip.y
    // Z: MediaPipe z is relative depth, scale and clamp to 0-1
    const rawZ = Math.max(0, Math.min(1, 0.5 - indexTip.z * 5))

    // Pinch detection: Euclidean distance between thumb and index tip
    const dx = thumbTip.x - indexTip.x
    const dy = thumbTip.y - indexTip.y
    const dz = thumbTip.z - indexTip.z
    const pinchDist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const pinching = pinchDist < this.config.pinchThreshold

    // EMA smoothing
    const a = this.config.smoothing
    this.smoothed = {
      x: a * this.smoothed.x + (1 - a) * rawX,
      y: a * this.smoothed.y + (1 - a) * rawY,
      z: a * this.smoothed.z + (1 - a) * rawZ,
      pinching,
      confidence: a * this.smoothed.confidence + (1 - a) * 1.0,
      detected: true,
    }

    return { ...this.smoothed }
  }

  /** Get the value for a specific target given current hand state */
  getTargetValue(target: HandTarget, state: HandState): number | null {
    if (this.config.xTarget === target) return state.x
    if (this.config.yTarget === target) return state.y
    if (this.config.zTarget === target) return state.z
    return null
  }

  reset(): void {
    this.smoothed = { ...EMPTY_STATE }
  }
}
