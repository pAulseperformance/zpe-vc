/**
 * The wave field's contract, checked against the shader source itself.
 *
 * The GPU cannot import `field.ts`, so these tests read `shaders/quantum.frag` off disk and assert
 * that the phase expressions it carries are the ones this module defines. A crest tracked through
 * time must move at `waveSpeed`, the same speed as the wavefront ring.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { computeInterferenceRatio } from './compute-interference'
import {
  crestAt,
  crestSpacing,
  GRAV_PHASE_GLSL,
  gravPhase,
  HARMONIC_PHASE_GLSL,
  harmonicPhase,
  WAVE_PHASE_GLSL,
  waveFrontRadius,
  wavePhase,
} from './field'

const FRAG = readFileSync(new URL('./shaders/quantum.frag', import.meta.url), 'utf8')

/** Bisect the distance at which `phaseFn` hits `phase`, then measure how far it moved per second. */
function crestSpeed(
  phaseFn: (dist: number, age: number, waveFreq: number, waveSpeed: number) => number,
  waveFreq: number,
  waveSpeed: number,
  phase = 0.7,
  t0 = 1,
  t1 = 2,
): number {
  const solve = (age: number): number => {
    let lo = 0
    let hi = 4
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2
      if (phaseFn(mid, age, waveFreq, waveSpeed) - phase < 0) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  return (solve(t1) - solve(t0)) / (t1 - t0)
}

describe('the shader carries the phase law field.ts defines', () => {
  it.each([
    ['base wave', WAVE_PHASE_GLSL],
    ['second harmonic', HARMONIC_PHASE_GLSL],
    ['gravitational swell', GRAV_PHASE_GLSL],
  ])('contains the %s', (_name, snippet) => {
    expect(FRAG).toContain(snippet)
  })

  it('carries no frozen temporal frequency', () => {
    expect(FRAG).not.toMatch(/age \* 30\.0/)
    expect(FRAG).not.toMatch(/age \* 15\.0/)
    expect(FRAG).not.toMatch(/age \* 10\.0/)
  })

  it('no longer calls the wake an inverse-square law', () => {
    expect(FRAG).not.toMatch(/1\/r/)
  })
})

describe('crests travel at the wave speed', () => {
  it.each([
    ['default preset', 150, 1],
    ['slow creeping phase preset', 10, 0.1],
  ])('%s', (_name, waveFreq, waveSpeed) => {
    // The base wave moves outward at exactly waveSpeed.
    expect(crestSpeed(wavePhase, waveFreq, waveSpeed)).toBeCloseTo(waveSpeed, 3)
    // The gravitational swell travels with it: one medium, one speed.
    expect(crestSpeed(gravPhase, waveFreq, waveSpeed)).toBeCloseTo(waveSpeed, 3)
    // The harmonic keeps the inward direction the shader wrote, at the same speed. Its phase runs
    // ahead of the base wave, so track a crest that has not yet reached the source.
    expect(
      crestSpeed(harmonicPhase, waveFreq, waveSpeed, 4 * 1.7 * waveFreq * waveSpeed),
    ).toBeCloseTo(-waveSpeed, 3)
    // Spacing is what waveFreq controls.
    expect(crestSpacing(waveFreq)).toBeCloseTo((2 * Math.PI) / waveFreq, 9)
    expect(waveFrontRadius(2, waveSpeed)).toBeCloseTo(2 * waveSpeed, 9)
    // The closed form agrees with the numeric tracking.
    expect(crestAt(0.7, 1, waveFreq, waveSpeed)).toBeCloseTo(
      crestAt(0.7, 2, waveFreq, waveSpeed) - waveSpeed,
      6,
    )
  })
})

describe('the interference ratio follows the live tuning', () => {
  const cats = [
    { x: 0.3, y: 0.5, time: 0 },
    { x: 0.5, y: 0.62, time: 0.2 },
  ]
  // Sampled where the two waves arrive out of phase, so the ratio depends on their weights.
  const SAMPLE_X = 0.362
  const SAMPLE_Y = 0.5
  const ratio = (emDamping: number, waveSpeed: number) =>
    computeInterferenceRatio(cats, SAMPLE_X, SAMPLE_Y, 1, { waveFreq: 150, waveSpeed, emDamping }, 15)

  it('returns full constructive for an empty field', () => {
    expect(computeInterferenceRatio([], 0.5, 0.5, 1, { waveFreq: 150, waveSpeed: 1, emDamping: 1.6 }, 15)).toBe(1)
  })

  it('moves when the damping moves, which the frozen copy could not do', () => {
    expect(Math.abs(ratio(0.5, 1) - ratio(3.1, 1))).toBeGreaterThan(1e-4)
  })

  it('moves when the wave speed moves, since it holds the front back', () => {
    // At a slow speed the second source is still outside its own wavefront, so it goes unheard.
    expect(Math.abs(ratio(1.6, 1) - ratio(1.6, 0.1))).toBeGreaterThan(1e-3)
  })

  it('stays inside 0 to 1', () => {
    for (const damping of [0.1, 1.6, 10]) {
      const value = ratio(damping, 1)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})
