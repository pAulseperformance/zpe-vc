/**
 * JS-side approximation of EM wave interference at a sample point.
 *
 * Mirrors the shader's `cleanWave = sin(dist * freq - age * 30)` formula
 * to estimate the interference ratio without GPU readback.
 *
 * Returns 0 (full destructive cancellation) → 1 (full constructive).
 */

interface Catalyst {
  x: number
  y: number
  time: number
}

export function computeInterferenceRatio(
  catalysts: Catalyst[],
  sampleX: number,
  sampleY: number,
  currentTime: number,
  waveFreq: number,
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

    // Match shader: emDamping and extended field decay
    const emDamping = Math.exp(-age * 0.5)
    const waveFront = age * 1.15 // waveSpeed default
    const behindWavefront = dist < waveFront ? 1.0 : 0.0
    const fieldDecay = Math.exp(-Math.max(waveFront - dist, 0) * 3.0)
    const extendedField = behindWavefront * fieldDecay * emDamping

    // Clean sine — exact match to shader's interference formula
    const cleanWave = Math.sin(dist * waveFreq - age * 30.0)
    fieldSigned += cleanWave * extendedField
    fieldEnvelope += Math.abs(cleanWave) * extendedField
  }

  if (fieldEnvelope < 0.001) return 1.0

  // ratio: 0 = perfect cancellation, 1 = perfect constructive
  return Math.pow(Math.abs(fieldSigned) / fieldEnvelope, 0.3)
}
