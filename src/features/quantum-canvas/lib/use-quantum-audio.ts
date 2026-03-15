import { useRef, useCallback } from 'react'

/**
 * Quantum Audio Engine — WebAudio feedback tied to shader state
 *
 * Uses 3 oscillator layers:
 * 1. Base drone: low sine tied to energy level (pitch rises with energy)
 * 2. Harmonic shimmer: higher oscillator modulated by interference pattern
 * 3. Click transient: short burst when catalyst is added
 *
 * All volumes are energy-gated: silence when energy = 0
 */

interface AudioState {
  ctx: AudioContext
  masterGain: GainNode
  // Layer 1: base drone
  droneOsc: OscillatorNode
  droneGain: GainNode
  // Layer 2: harmonic shimmer
  shimmerOsc: OscillatorNode
  shimmerGain: GainNode
  // Layer 3: sub-bass pulse
  subOsc: OscillatorNode
  subGain: GainNode
}

const BASE_FREQ = 55 // A1 — low drone fundamental
const MAX_DRONE_FREQ = 220 // A3 — max drone frequency at full energy
const SHIMMER_RATIO = 3.01 // Slightly detuned 3rd harmonic for beating

export function useQuantumAudio() {
  const audioRef = useRef<AudioState | null>(null)
  const activeRef = useRef(false)

  const start = useCallback(() => {
    if (audioRef.current) return

    const ctx = new AudioContext()
    const masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(ctx.destination)

    // Layer 1: base drone (sine)
    const droneOsc = ctx.createOscillator()
    const droneGain = ctx.createGain()
    droneOsc.type = 'sine'
    droneOsc.frequency.value = BASE_FREQ
    droneGain.gain.value = 0
    droneOsc.connect(droneGain)
    droneGain.connect(masterGain)
    droneOsc.start()

    // Layer 2: harmonic shimmer (triangle — softer harmonics)
    const shimmerOsc = ctx.createOscillator()
    const shimmerGain = ctx.createGain()
    shimmerOsc.type = 'triangle'
    shimmerOsc.frequency.value = BASE_FREQ * SHIMMER_RATIO
    shimmerGain.gain.value = 0
    shimmerOsc.connect(shimmerGain)
    shimmerGain.connect(masterGain)
    shimmerOsc.start()

    // Layer 3: sub-bass pulse (sine, very low)
    const subOsc = ctx.createOscillator()
    const subGain = ctx.createGain()
    subOsc.type = 'sine'
    subOsc.frequency.value = BASE_FREQ * 0.5
    subGain.gain.value = 0
    subOsc.connect(subGain)
    subGain.connect(masterGain)
    subOsc.start()

    audioRef.current = {
      ctx, masterGain,
      droneOsc, droneGain,
      shimmerOsc, shimmerGain,
      subOsc, subGain,
    }
    activeRef.current = true

    // Fade in master
    masterGain.gain.setTargetAtTime(0.15, ctx.currentTime, 0.3)
  }, [])

  const stop = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    activeRef.current = false

    // Fade out then cleanup
    const now = a.ctx.currentTime
    a.masterGain.gain.setTargetAtTime(0, now, 0.3)
    setTimeout(() => {
      a.droneOsc.stop()
      a.shimmerOsc.stop()
      a.subOsc.stop()
      a.ctx.close()
      audioRef.current = null
    }, 1500)
  }, [])

  /**
   * Update audio state per frame
   * @param energy - Current energy level (0-300)
   * @param maxEnergy - Rip threshold for normalization
   * @param interferenceRatio - 0=full cancellation, 1=full constructive (from shader)
   */
  const update = useCallback((energy: number, maxEnergy: number, interferenceRatio: number) => {
    const a = audioRef.current
    if (!a || !activeRef.current) return

    const now = a.ctx.currentTime
    const eNorm = Math.min(energy / Math.max(maxEnergy, 1), 1)
    const iRatio = Math.max(0, Math.min(1, interferenceRatio))

    // Drone: pitch rises with energy (A1 → A3)
    const droneFreq = BASE_FREQ + (MAX_DRONE_FREQ - BASE_FREQ) * eNorm
    a.droneOsc.frequency.setTargetAtTime(droneFreq, now, 0.1)
    a.droneGain.gain.setTargetAtTime(eNorm * 0.4, now, 0.05)

    // Shimmer: volume follows interference (constructive = loud, destructive = silent)
    const shimmerFreq = droneFreq * SHIMMER_RATIO
    a.shimmerOsc.frequency.setTargetAtTime(shimmerFreq, now, 0.1)
    a.shimmerGain.gain.setTargetAtTime(iRatio * eNorm * 0.2, now, 0.08)

    // Sub-bass: pulses with energy, detuned slightly for organic feel
    a.subOsc.frequency.setTargetAtTime(droneFreq * 0.5 + Math.sin(now * 0.3) * 2, now, 0.2)
    a.subGain.gain.setTargetAtTime(eNorm * eNorm * 0.15, now, 0.1)
  }, [])

  /** Fire a click transient — short burst on catalyst creation */
  const triggerClick = useCallback(() => {
    const a = audioRef.current
    if (!a || !activeRef.current) return

    const now = a.ctx.currentTime
    const clickOsc = a.ctx.createOscillator()
    const clickGain = a.ctx.createGain()
    clickOsc.type = 'sine'
    clickOsc.frequency.value = 800 + Math.random() * 400
    clickGain.gain.value = 0.1
    clickGain.gain.setTargetAtTime(0, now + 0.02, 0.04) // fast decay
    clickOsc.connect(clickGain)
    clickGain.connect(a.masterGain)
    clickOsc.start(now)
    clickOsc.stop(now + 0.15)
  }, [])

  return { start, stop, update, triggerClick, activeRef }
}
