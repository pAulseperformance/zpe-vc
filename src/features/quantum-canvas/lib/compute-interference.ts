/**
 * JS-side approximation of EM wave interference at a sample point.
 *
 * Mirrors the shader's interference sine, evaluated with the LIVE tuning rather than the constants
 * that used to be frozen here. `field.ts` holds the phase law and the snippets the shader must carry.
 *
 * Returns 0 (full destructive cancellation) -> 1 (full constructive).
 */

import { waveFrontRadius, wavePhase } from './field'

interface Catalyst {
  x: number
  y: number
  time: number
}

/** The fields this mirror needs, taken from the tuning object so both sides read the same numbers. */
export interface WaveTuning {
  waveFreq: number
  waveSpeed: number
  emDamping: number
}

export function computeInterferenceRatio(
  catalysts: Catalyst[],
  sampleX: number,
  sampleY: number,
  currentTime: number,
  tuning: WaveTuning,
  waveLifetime: number,
): number {
  if (catalysts.length === 0) return 1.0

  let fieldSigned = 0
  let fieldEnvelope = 0

  for (const cat of catalysts) {
    const age = currentTime - cat.time
    if (age < 0 || age > waveLifetime) continue

    const dx = sampleX - cat.x
    const dy = sampleY - cat.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Match shader: emDamping, the wavefront, and the decay behind it (quantum.frag:321, :363-365)
    const emDamping = Math.exp(-age * tuning.emDamping)
    const waveFront = waveFrontRadius(age, tuning.waveSpeed)
    const behindWavefront = dist < waveFront ? 1.0 : 0.0
    const fieldDecay = Math.exp(-Math.max(waveFront - dist, 0) * 3.0)
    const extendedField = behindWavefront * fieldDecay * emDamping

    // Clean sine, the same phase the shader evaluates
    const cleanWave = Math.sin(wavePhase(dist, age, tuning.waveFreq, tuning.waveSpeed))
    fieldSigned += cleanWave * extendedField
    fieldEnvelope += Math.abs(cleanWave) * extendedField
  }

  if (fieldEnvelope < 0.001) return 1.0

  // ratio: 0 = perfect cancellation, 1 = perfect constructive
  return Math.pow(Math.abs(fieldSigned) / fieldEnvelope, 0.3)
}
