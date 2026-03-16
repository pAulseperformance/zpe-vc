import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { yToFreq } from '@/features/quantum-audio'
import type { ScaleName } from '@/features/quantum-audio'

interface KeyboardSynthDeps {
  audioEnabled: boolean
  isForging: boolean
  audio: {
    playNote: (freq: number, vel: number, sustained?: boolean) => { release: () => void; bend: (f: number) => void }
  }
  synthScale: ScaleName
  simClickQueueRef: MutableRefObject<Array<{x: number, y: number}>>
}

/**
 * Maps keyboard keys to a 3-row chromatic synth.
 * Hold a key to sustain, release to fade out. Polyphonic.
 * Disabled during terminal intake (isForging=true).
 */
export function useKeyboardSynth({
  audioEnabled,
  isForging,
  audio,
  synthScale,
  simClickQueueRef,
}: KeyboardSynthDeps) {
  const activeNotesRef = useRef(new Map<string, { release: () => void }>())

  useEffect(() => {
    if (!audioEnabled || isForging) return

    // C3=130.81, C4=261.63, C5=523.25
    const keyMap: Record<string, number> = {
      // Bottom row: C3 → B3
      z: 130.81, x: 138.59, c: 146.83, v: 155.56, b: 164.81, n: 174.61, m: 185.00,
      // Home row: C4 → B4
      a: 261.63, s: 277.18, d: 293.66, f: 311.13, g: 329.63, h: 349.23, j: 369.99, k: 392.00, l: 415.30,
      // Top row: C5 → E5
      q: 523.25, w: 554.37, e: 587.33, r: 622.25, t: 659.26, y: 698.46, u: 739.99, i: 783.99, o: 830.61, p: 880.00,
    }

    const activeNotes = activeNotesRef.current

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const key = e.key.toLowerCase()
      const rawFreq = keyMap[key]
      if (rawFreq) {
        activeNotes.get(key)?.release()
        const freq = yToFreq(
          (Math.log2(rawFreq) - Math.log2(130.81)) / (Math.log2(880) - Math.log2(130.81)),
          synthScale,
        )
        const handle = audio.playNote(freq, 0.6, true)
        activeNotes.set(key, handle)
        const pitchNorm = (Math.log2(freq) - Math.log2(130.81)) / (Math.log2(880) - Math.log2(130.81))
        const mappedX = 0.1 + pitchNorm * 0.8
        simClickQueueRef.current.push({ x: mappedX, y: 0.3 + Math.random() * 0.4 })
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const handle = activeNotes.get(key)
      if (handle) {
        handle.release()
        activeNotes.delete(key)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      activeNotes.forEach((h) => h.release())
      activeNotes.clear()
    }
  }, [audioEnabled, isForging, audio, synthScale, simClickQueueRef])
}
