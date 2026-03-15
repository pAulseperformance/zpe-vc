/**
 * gesture-map.ts — Configurable mapping from hand landmarks to synth parameters.
 *
 * Supports per-hand gesture detection (pinch, open, fist, spread)
 * and configurable axis→target mappings.
 */

/* ── Types ── */

export type HandTarget = 'pitch' | 'filter' | 'volume' | 'delayMix' | 'reverbMix' | 'none'

export type Gesture = 'pinch' | 'open' | 'fist' | 'spread' | 'neutral'

export interface HandMappingConfig {
  xTarget: HandTarget
  yTarget: HandTarget
  zTarget: HandTarget
  pinchThreshold: number
  smoothing: number
}

export const DEFAULT_HAND_MAPPING: HandMappingConfig = {
  xTarget: 'filter',
  yTarget: 'pitch',
  zTarget: 'volume',
  pinchThreshold: 0.06,
  smoothing: 0.7,
}

export interface HandState {
  x: number
  y: number
  z: number
  pinching: boolean
  gesture: Gesture
  confidence: number
  detected: boolean
}

const EMPTY_STATE: HandState = {
  x: 0.5, y: 0.5, z: 0.5,
  pinching: false, gesture: 'neutral',
  confidence: 0, detected: false,
}

export interface DualHandState {
  left: HandState
  right: HandState
  /** Primary hand = whichever was detected first, or left by default */
  primary: HandState
}

const EMPTY_DUAL: DualHandState = {
  left: { ...EMPTY_STATE },
  right: { ...EMPTY_STATE },
  primary: { ...EMPTY_STATE },
}

/* ── Gesture Detection ── */

/**
 * MediaPipe Hand Landmarks:
 * 0=wrist, 4=thumb_tip, 8=index_tip, 12=middle_tip,
 * 16=ring_tip, 20=pinky_tip
 * MCP joints: 5=index_mcp, 9=middle_mcp, 13=ring_mcp, 17=pinky_mcp
 */
function detectGesture(
  landmarks: Array<{ x: number; y: number; z: number }>,
  pinchThreshold: number,
): Gesture {
  const thumbTip = landmarks[4]
  const indexTip = landmarks[8]

  // Pinch: thumb tip close to index tip
  const dx = thumbTip.x - indexTip.x
  const dy = thumbTip.y - indexTip.y
  const dz = thumbTip.z - indexTip.z
  const pinchDist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (pinchDist < pinchThreshold) return 'pinch'

  // Check finger extension: tip.y < mcp.y means extended (MediaPipe Y = top-down)
  const tips = [8, 12, 16, 20]     // index, middle, ring, pinky tips
  const mcps = [5, 9, 13, 17]      // corresponding MCPs
  let extended = 0
  for (let i = 0; i < 4; i++) {
    if (landmarks[tips[i]].y < landmarks[mcps[i]].y) extended++
  }
  // Thumb: check x distance from wrist (thumb extended = far from wrist)
  const thumbExtended = Math.abs(landmarks[4].x - landmarks[0].x) > 0.12

  // Fist: no fingers extended
  if (extended === 0 && !thumbExtended) return 'fist'

  // Open palm: all fingers extended
  if (extended >= 3 && thumbExtended) {
    // Spread: check splay between fingers
    const indexMiddle = Math.abs(landmarks[8].x - landmarks[12].x)
    const middleRing = Math.abs(landmarks[12].x - landmarks[16].x)
    const avgSpread = (indexMiddle + middleRing) / 2
    if (avgSpread > 0.08) return 'spread'
    return 'open'
  }

  return 'neutral'
}

/* ── GestureMapper ── */

export class GestureMapper {
  private config: HandMappingConfig
  private leftSmoothed: HandState = { ...EMPTY_STATE }
  private rightSmoothed: HandState = { ...EMPTY_STATE }

  constructor(config: HandMappingConfig = DEFAULT_HAND_MAPPING) {
    this.config = { ...config }
  }

  setConfig(config: Partial<HandMappingConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): HandMappingConfig {
    return this.config
  }

  /** Process landmarks for a single hand */
  private processHand(
    landmarks: Array<{ x: number; y: number; z: number }> | null,
    prev: HandState,
  ): HandState {
    if (!landmarks || landmarks.length < 21) {
      const conf = prev.confidence * 0.8
      if (conf < 0.01) return { ...EMPTY_STATE }
      return { ...prev, confidence: conf, detected: false }
    }

    const indexTip = landmarks[8]
    const rawX = 1 - indexTip.x
    const rawY = 1 - indexTip.y
    const rawZ = Math.max(0, Math.min(1, 0.5 - indexTip.z * 5))

    const gesture = detectGesture(landmarks, this.config.pinchThreshold)
    const pinching = gesture === 'pinch'

    const a = this.config.smoothing
    return {
      x: a * prev.x + (1 - a) * rawX,
      y: a * prev.y + (1 - a) * rawY,
      z: a * prev.z + (1 - a) * rawZ,
      pinching,
      gesture,
      confidence: a * prev.confidence + (1 - a) * 1.0,
      detected: true,
    }
  }

  /** Process both hands from a frame result */
  processDual(
    left: Array<{ x: number; y: number; z: number }> | null,
    right: Array<{ x: number; y: number; z: number }> | null,
  ): DualHandState {
    this.leftSmoothed = this.processHand(left, this.leftSmoothed)
    this.rightSmoothed = this.processHand(right, this.rightSmoothed)

    // Primary = left if detected, else right, else empty
    const primary = this.leftSmoothed.detected
      ? this.leftSmoothed
      : this.rightSmoothed.detected
        ? this.rightSmoothed
        : { ...EMPTY_STATE }

    return {
      left: { ...this.leftSmoothed },
      right: { ...this.rightSmoothed },
      primary: { ...primary },
    }
  }

  /** Legacy single-hand process (delegates to left hand) */
  process(
    landmarks: Array<{ x: number; y: number; z: number }> | null,
  ): HandState {
    this.leftSmoothed = this.processHand(landmarks, this.leftSmoothed)
    return { ...this.leftSmoothed }
  }

  getTargetValue(target: HandTarget, state: HandState): number | null {
    if (this.config.xTarget === target) return state.x
    if (this.config.yTarget === target) return state.y
    if (this.config.zTarget === target) return state.z
    return null
  }

  reset(): void {
    this.leftSmoothed = { ...EMPTY_STATE }
    this.rightSmoothed = { ...EMPTY_STATE }
  }
}

export { EMPTY_STATE, EMPTY_DUAL }
