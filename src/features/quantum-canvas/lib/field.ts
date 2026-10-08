/**
 * The wave field, defined once.
 *
 * The fragment shader cannot import this file, so the contract is textual: `WAVE_PHASE_GLSL` and its
 * two siblings below are the exact expressions `shaders/quantum.frag` must contain, and
 * `field.test.ts` reads the shader off disk and fails if any of them drifts.
 *
 * Phase is `dist * k - age * omega`, with `k = waveFreq` in radians per UV unit and
 * `omega = k * waveSpeed`. The crests therefore travel at exactly `waveSpeed`, the same speed as the
 * wavefront ring, and `waveFreq` changes the spacing rather than the speed.
 */

/** The base wave, and the interference sine the CPU mirror evaluates. */
export const WAVE_PHASE_GLSL = 'dist * uWaveFreq - age * uWaveFreq * uWaveSpeed'

/** Second EM harmonic: same speed, travelling inward, as the shader wrote it. */
export const HARMONIC_PHASE_GLSL = 'dist * uWaveFreq * 1.7 + age * uWaveFreq * 1.7 * uWaveSpeed'

/** The long gravitational swell, again the same speed. */
export const GRAV_PHASE_GLSL = 'dist * uWaveFreq * 0.3 - age * uWaveFreq * 0.3 * uWaveSpeed'

export function wavePhase(dist: number, age: number, waveFreq: number, waveSpeed: number): number {
  return dist * waveFreq - age * waveFreq * waveSpeed
}

export function harmonicPhase(dist: number, age: number, waveFreq: number, waveSpeed: number): number {
  return dist * waveFreq * 1.7 + age * waveFreq * 1.7 * waveSpeed
}

export function gravPhase(dist: number, age: number, waveFreq: number, waveSpeed: number): number {
  return dist * waveFreq * 0.3 - age * waveFreq * 0.3 * waveSpeed
}

/** Distance between neighbouring crests, in UV units. */
export function crestSpacing(waveFreq: number): number {
  return (2 * Math.PI) / waveFreq
}

/** How far the ringing front has reached after `age` seconds. */
export function waveFrontRadius(age: number, waveSpeed: number): number {
  return age * waveSpeed
}

/** The distance at which the given phase sits, for tracking a crest. */
export function crestAt(phase: number, age: number, waveFreq: number, waveSpeed: number): number {
  return (phase + age * waveFreq * waveSpeed) / waveFreq
}
