/**
 * Scale Quantizer
 *
 * Provides musical scales and frequency snapping logic.
 */

export type ScaleName = 'continuous' | 'minor-pentatonic' | 'major-pentatonic' | 'harmonic-minor' | 'lydian' | 'dorian'

// Scale intervals in semitones from root
const SCALES: Record<Exclude<ScaleName, 'continuous'>, number[]> = {
  'minor-pentatonic': [0, 3, 5, 7, 10], // e.g., C, Eb, F, G, Bb
  'major-pentatonic': [0, 2, 4, 7, 9],  // e.g., C, D, E, G, A
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11], // e.g., C, D, Eb, F, G, Ab, B
  'lydian': [0, 2, 4, 6, 7, 9, 11], // e.g., C, D, E, F#, G, A, B
  'dorian': [0, 2, 3, 5, 7, 9, 10], // e.g., C, D, Eb, F, G, A, Bb
}

// Base C2 = ~65.41 Hz
const ROOT_FREQ = 65.40639

// Generate a lookup table of frequencies for each scale across 8 octaves
const FREQ_TABLES: Partial<Record<Exclude<ScaleName, 'continuous'>, number[]>> = {}

for (const [scaleName, intervals] of Object.entries(SCALES)) {
  const freqs: number[] = []
  for (let octave = 0; octave < 8; octave++) {
    for (const interval of intervals) {
      // freq = root * 2^( (interval + octave * 12) / 12 )
      const semitones = interval + octave * 12
      freqs.push(ROOT_FREQ * Math.pow(2, semitones / 12))
    }
  }
  FREQ_TABLES[scaleName as keyof typeof SCALES] = freqs
}

export function snapToScale(frequency: number, scale: ScaleName): number {
  if (scale === 'continuous') return frequency

  const freqs = FREQ_TABLES[scale]
  if (!freqs) return frequency

  // Binary search or simple linear scan to find closest frequency
  let closest = freqs[0]
  let minDiff = Math.abs(frequency - closest)

  for (let i = 1; i < freqs.length; i++) {
    const diff = Math.abs(frequency - freqs[i])
    if (diff < minDiff) {
      minDiff = diff
      closest = freqs[i]
    } else {
      // Since array is sorted, we can break early when diff starts increasing
      break
    }
  }

  return closest
}

/** Map a 0-1 Y position to a scale-quantized frequency (C2-C5) */
export function yToFreq(y: number, scale: ScaleName): number {
  const MIN = 65    // C2
  const MAX = 523   // C5
  const yInv = 1.0 - Math.max(0, Math.min(1, y))
  const rawFreq = MIN * Math.pow(MAX / MIN, yInv)
  return snapToScale(rawFreq, scale)
}
