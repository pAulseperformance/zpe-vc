/**
 * gesture-map.ts — Configurable mapping from hand landmarks to synth parameters.
 *
 * Supports per-hand gesture detection (pinch, open, fist, spread)
 * and configurable per-hand axis→target mappings for ALL UI params.
 */

/* ── Types ── */

export type HandTarget =
  // Audio
  | 'pitch' | 'filter' | 'filterQ' | 'volume'
  | 'delayTime' | 'delayFeedback' | 'delayMix'
  | 'reverbMix' | 'reverbDecay' | 'distortion' | 'detuneSpread'
  // Visual
  | 'waveSpeed' | 'waveFreq' | 'waveWidth' | 'ripThreshold'
  // None
  | 'none'

export const HAND_TARGET_LIST: HandTarget[] = [
  'pitch', 'filter', 'filterQ', 'volume',
  'delayTime', 'delayFeedback', 'delayMix',
  'reverbMix', 'reverbDecay', 'distortion', 'detuneSpread',
  'waveSpeed', 'waveFreq', 'waveWidth', 'ripThreshold',
  'none',
]

export const HAND_TARGET_LABELS: Record<HandTarget, string> = {
  pitch: '🎵 Pitch', filter: '🔊 Filter', filterQ: '🔉 Filter Q', volume: '📢 Volume',
  delayTime: '⏱ Delay Time', delayFeedback: '🔁 Delay FB', delayMix: '⏱ Delay Mix',
  reverbMix: '🏔 Reverb', reverbDecay: '🏔 Rev Decay', distortion: '🔥 Distortion',
  detuneSpread: '🎛 Detune',
  waveSpeed: '🌊 Wave Speed', waveFreq: '〰 Wave Freq', waveWidth: '📐 Wave Width',
  ripThreshold: '💥 Rip Threshold',
  none: '— None',
}

export type Gesture = 'pinch' | 'open' | 'fist' | 'spread' | 'neutral'

export interface HandMappingConfig {
  xTarget: HandTarget
  yTarget: HandTarget
  zTarget: HandTarget
  pinchThreshold: number
  smoothing: number
}

export interface DualMappingConfig {
  left: HandMappingConfig
  right: HandMappingConfig
}

export const DEFAULT_HAND_MAPPING: HandMappingConfig = {
  xTarget: 'filter',
  yTarget: 'pitch',
  zTarget: 'volume',
  pinchThreshold: 0.06,
  smoothing: 0.7,
}

export const DEFAULT_DUAL_MAPPING: DualMappingConfig = {
  left: { ...DEFAULT_HAND_MAPPING },
  right: {
    xTarget: 'delayMix',
    yTarget: 'reverbMix',
    zTarget: 'distortion',
    pinchThreshold: 0.06,
    smoothing: 0.7,
  },
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
  private dualConfig: DualMappingConfig
  private leftSmoothed: HandState = { ...EMPTY_STATE }
  private rightSmoothed: HandState = { ...EMPTY_STATE }

  constructor(config?: DualMappingConfig) {
    this.dualConfig = config ? { left: { ...config.left }, right: { ...config.right } }
      : { left: { ...DEFAULT_DUAL_MAPPING.left }, right: { ...DEFAULT_DUAL_MAPPING.right } }
  }

  /** Set config for a specific hand */
  setHandConfig(hand: 'left' | 'right', config: Partial<HandMappingConfig>): void {
    this.dualConfig[hand] = { ...this.dualConfig[hand], ...config }
  }

  /** Legacy: set config for left hand (primary) */
  setConfig(config: Partial<HandMappingConfig>): void {
    this.setHandConfig('left', config)
  }

  getConfig(): HandMappingConfig {
    return this.dualConfig.left
  }

  getDualConfig(): DualMappingConfig {
    return { left: { ...this.dualConfig.left }, right: { ...this.dualConfig.right } }
  }

  getHandConfig(hand: 'left' | 'right'): HandMappingConfig {
    return { ...this.dualConfig[hand] }
  }

  /** Process landmarks for a single hand */
  private processHand(
    landmarks: Array<{ x: number; y: number; z: number }> | null,
    prev: HandState,
    cfg: HandMappingConfig,
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

    const gesture = detectGesture(landmarks, cfg.pinchThreshold)
    const pinching = gesture === 'pinch'

    const a = cfg.smoothing
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
    this.leftSmoothed = this.processHand(left, this.leftSmoothed, this.dualConfig.left)
    this.rightSmoothed = this.processHand(right, this.rightSmoothed, this.dualConfig.right)

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
    this.leftSmoothed = this.processHand(landmarks, this.leftSmoothed, this.dualConfig.left)
    return { ...this.leftSmoothed }
  }

  /** Get target value using the LEFT hand config (primary/legacy) */
  getTargetValue(target: HandTarget, state: HandState): number | null {
    return this.getTargetValueWithConfig(target, state, this.dualConfig.left)
  }

  /** Get target value using a specific hand's config */
  getTargetValueForHand(target: HandTarget, which: 'left' | 'right', state: HandState): number | null {
    return this.getTargetValueWithConfig(target, state, this.dualConfig[which])
  }

  private getTargetValueWithConfig(target: HandTarget, state: HandState, cfg: HandMappingConfig): number | null {
    if (cfg.xTarget === target) return state.x
    if (cfg.yTarget === target) return state.y
    if (cfg.zTarget === target) return state.z
    return null
  }

  reset(): void {
    this.leftSmoothed = { ...EMPTY_STATE }
    this.rightSmoothed = { ...EMPTY_STATE }
  }
}

export { EMPTY_STATE, EMPTY_DUAL }

