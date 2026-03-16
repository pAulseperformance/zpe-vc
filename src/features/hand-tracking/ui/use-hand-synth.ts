/**
 * use-hand-synth.ts — Headless hook encapsulating the hand-tracking → audio
 * bridge, gesture effects, dual-hand note triggering, FFT wave spawning,
 * and energy display throttling.
 *
 * Extracted from App.tsx to bring it under 300 LOC.
 */
import { useRef, useCallback, useState } from 'react'
import type { MutableRefObject } from 'react'
import { yToFreq } from '@/features/quantum-audio'
import type { ScaleName, FFTBands } from '@/features/quantum-audio'
import { Looper, MidiOutput, AudioRecorder } from '@/features/hand-tracking'
import type { HandTarget } from '@/features/hand-tracking'
import { useAudioStore } from '@/features/quantum-audio/model/audio-store'
import { useTuningStore } from '@/features/quantum-canvas/model/tuning-store'

/** Minimal audio engine interface — what we need from useSynth(). */
interface AudioEngine {
  update: (energy: number, threshold: number, interference: number, mx: number, my: number) => void
  playNote: (freq: number, vel: number, sustained?: boolean) => { release: () => void; bend: (f: number) => void }
  setDroneVolume: (v: number) => void
  setFilterQ: (q: number) => void
  setDelayTime: (v: number) => void
  setDelayFeedback: (v: number) => void
  setDelayMix: (v: number) => void
  setReverbMix: (v: number) => void
  setReverbDecay: (v: number) => void
  setDistortion: (v: number) => void
  setDetuneSpread: (v: number) => void
  fftRef: MutableRefObject<FFTBands>
  getRecordingStream: () => MediaStream | null
}

/** Minimal hand tracker interface — what we need from useHandTracker(). */
interface HandTracker {
  active: boolean
  dualRef: MutableRefObject<{
    left: { detected: boolean; x: number; y: number; z: number; pinching: boolean; gesture: string }
    right: { detected: boolean; x: number; y: number; z: number; pinching: boolean; gesture: string }
  }>
  getDualConfig: () => {
    left: { xTarget: string; yTarget: string; zTarget: string }
    right: { xTarget: string; yTarget: string; zTarget: string }
  }
  getTargetValue: (target: HandTarget) => number | null
  getTargetValueForHand: (target: HandTarget, hand: 'left' | 'right') => number | null
}

interface UseHandSynthParams {
  audio: AudioEngine
  hand: HandTracker
  simClickQueueRef: MutableRefObject<Array<{x: number, y: number}>>
}

export function useHandSynth({ audio, hand, simClickQueueRef }: UseHandSynthParams) {
  // ── State selected from stores ──
  const audioEnabled = useAudioStore((s) => s.audioEnabled)
  const synthScale = useAudioStore((s) => s.synthScale) as ScaleName
  const fftSpawnEnabled = useAudioStore((s) => s.fftSpawnEnabled)
  const fftSpawnThreshold = useAudioStore((s) => s.fftSpawnThreshold)
  const fftSpawnRate = useAudioStore((s) => s.fftSpawnRate)
  const distortion = useAudioStore((s) => s.distortion)
  const reverbMix = useAudioStore((s) => s.reverbMix)

  // ── Internal refs ──
  const energyRef = useRef(0)
  const [energyDisplay, setEnergyDisplay] = useState(0)
  const lastUpdateRef = useRef(0)
  const fftSpawnCooldownRef = useRef(0)

  // Hand note refs
  const handNoteRef = useRef<{ release: () => void; bend: (f: number) => void } | null>(null)
  const rightNoteRef = useRef<{ release: () => void; bend: (f: number) => void } | null>(null)
  const wasPinchingRef = useRef(false)
  const wasRightPinchingRef = useRef(false)
  const prevGestureRef = useRef<string>('neutral')
  const gestureResetRef = useRef<{ distortion?: number; reverbMix?: number; waveSpeed?: number } | null>(null)
  const [currentFreq, setCurrentFreq] = useState(0)

  // Looper / MIDI / Recorder
  const looperRef = useRef(new Looper())
  const [looperRecording, setLooperRecording] = useState(false)
  const [looperPlaying, setLooperPlaying] = useState(false)
  const midiRef = useRef(new MidiOutput())
  const recorderRef = useRef(new AudioRecorder())
  const [midiEnabled, setMidiEnabled] = useState(false)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)

  const patchTuning = useTuningStore((s) => s.patchTuning)

  // ── Main per-frame callback (called from QuantumCanvas every frame) ──
  const handleEnergyChange = useCallback((energy: number, interferenceRatio: number, mouseX: number, mouseY: number) => {
    energyRef.current = energy
    const now = Date.now()
    if (now - lastUpdateRef.current > 100) {
      lastUpdateRef.current = now
      setEnergyDisplay(energy)
    }

    const tuning = useTuningStore.getState().tuning

    // Update synth per frame — use hand mappings if active, else mouse
    const dual = hand.dualRef.current
    const leftH = dual.left
    const rightH = dual.right
    const useHand = hand.active && (leftH.detected || rightH.detected)
    let synthX = mouseX
    let synthY = mouseY

    if (useHand) {
      const primary = leftH.detected ? leftH : rightH

      // Universal per-hand target routing
      const applyHandTarget = (target: string, value: number) => {
        switch (target) {
          case 'volume': audio.setDroneVolume(value); break
          case 'filterQ': audio.setFilterQ(1 + value * 20); break
          case 'delayTime': audio.setDelayTime(value * 0.5); break
          case 'delayFeedback': audio.setDelayFeedback(value); break
          case 'delayMix': audio.setDelayMix(value); break
          case 'reverbMix': audio.setReverbMix(value); break
          case 'reverbDecay': audio.setReverbDecay(0.5 + value * 4); break
          case 'distortion': audio.setDistortion(value); break
          case 'detuneSpread': audio.setDetuneSpread(value * 50); break
          case 'waveSpeed': patchTuning({ waveSpeed: 0.1 + value * 16 }); break
          case 'waveFreq': patchTuning({ waveFreq: 1 + value * 50 }); break
          case 'waveWidth': patchTuning({ waveWidth: value * 0.3 }); break
          case 'ripThreshold': patchTuning({ ripThreshold: 0.5 + value * 4 }); break
        }
      }

      // Route all mapped targets from both hands
      for (const which of ['left', 'right'] as const) {
        const hs = which === 'left' ? leftH : rightH
        if (!hs.detected) continue
        for (const axis of ['x', 'y', 'z'] as const) {
          const dualCfg = hand.getDualConfig()
          const target = dualCfg[which][`${axis}Target`]
          if (target === 'none') continue
          const val = axis === 'x' ? hs.x : axis === 'y' ? hs.y : hs.z
          applyHandTarget(target, val)
        }
      }

      // Synth X/Y from primary hand pitch/filter mappings
      const filterVal = hand.getTargetValue('filter')
      const pitchVal = hand.getTargetValue('pitch')
      synthX = filterVal ?? 0.5
      synthY = pitchVal ?? 0.5

      // Gesture effects (from either hand) — audio + visual
      const gesture = primary.gesture
      if (gesture !== prevGestureRef.current) {
        if (gestureResetRef.current) {
          if (gestureResetRef.current.distortion !== undefined)
            audio.setDistortion(gestureResetRef.current.distortion)
          if (gestureResetRef.current.reverbMix !== undefined)
            audio.setReverbMix(gestureResetRef.current.reverbMix)
          if (gestureResetRef.current.waveSpeed !== undefined)
            patchTuning({ waveSpeed: gestureResetRef.current.waveSpeed })
          gestureResetRef.current = null
        }
        if (gesture === 'fist') {
          gestureResetRef.current = { distortion }
          audio.setDistortion(Math.min(1, distortion + 0.6))
          for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2
            simClickQueueRef.current.push({
              x: primary.x + Math.cos(angle) * 0.03,
              y: primary.y + Math.sin(angle) * 0.03,
            })
          }
        } else if (gesture === 'spread') {
          gestureResetRef.current = { reverbMix }
          audio.setReverbMix(Math.min(1, reverbMix + 0.5))
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2
            simClickQueueRef.current.push({
              x: primary.x + Math.cos(angle) * 0.08,
              y: primary.y + Math.sin(angle) * 0.08,
            })
          }
        } else if (gesture === 'open') {
          gestureResetRef.current = { waveSpeed: tuning.waveSpeed }
          audio.setDroneVolume(0)
          patchTuning({ waveSpeed: 0.01 })
        }
        prevGestureRef.current = gesture
      }
    }

    audio.update(energy, tuning.ripThreshold, interferenceRatio, synthX, synthY)

    // Two-hand split — each hand triggers independent notes
    if (useHand && audioEnabled) {
      if (leftH.detected) {
        const pitchVal = hand.getTargetValueForHand('pitch', 'left')
        const notePitch = pitchVal ?? leftH.y
        const freq = yToFreq(notePitch, synthScale)
        if (leftH.pinching && !wasPinchingRef.current) {
          handNoteRef.current?.release()
          handNoteRef.current = audio.playNote(freq, 0.8, true)
          simClickQueueRef.current.push({ x: leftH.x, y: leftH.y })
          setCurrentFreq(freq)
          if (midiEnabled) midiRef.current.noteOn(freq)
          if (looperRecording) looperRef.current.record({ type: 'noteOn', freq, x: leftH.x, y: leftH.y })
        } else if (!leftH.pinching && wasPinchingRef.current) {
          handNoteRef.current?.release()
          handNoteRef.current = null
          if (!rightH.pinching) setCurrentFreq(0)
          if (midiEnabled) midiRef.current.noteOff()
          if (looperRecording) looperRef.current.record({ type: 'noteOff' })
        } else if (leftH.pinching && handNoteRef.current) {
          handNoteRef.current.bend(freq)
          setCurrentFreq(freq)
          if (midiEnabled) midiRef.current.pitchBend(freq)
          if (looperRecording) looperRef.current.record({ type: 'bend', freq })
        }
        wasPinchingRef.current = leftH.pinching
      }

      if (rightH.detected) {
        const pitchVal = hand.getTargetValueForHand('pitch', 'right')
        const notePitch = pitchVal ?? rightH.y
        const freq = yToFreq(notePitch, synthScale)
        if (rightH.pinching && !wasRightPinchingRef.current) {
          rightNoteRef.current?.release()
          rightNoteRef.current = audio.playNote(freq, 0.6, true)
          simClickQueueRef.current.push({ x: rightH.x, y: rightH.y })
          if (!leftH.pinching) setCurrentFreq(freq)
          if (looperRecording) looperRef.current.record({ type: 'noteOn', freq, x: rightH.x, y: rightH.y })
        } else if (!rightH.pinching && wasRightPinchingRef.current) {
          rightNoteRef.current?.release()
          rightNoteRef.current = null
          if (!leftH.pinching) setCurrentFreq(0)
          if (looperRecording) looperRef.current.record({ type: 'noteOff' })
        } else if (rightH.pinching && rightNoteRef.current) {
          rightNoteRef.current.bend(freq)
          if (!leftH.pinching) setCurrentFreq(freq)
          if (looperRecording) looperRef.current.record({ type: 'bend', freq })
        }
        wasRightPinchingRef.current = rightH.pinching
      }

    }

    // FFT → Wave Spawning
    if (fftSpawnEnabled && audioEnabled) {
      const bass = audio.fftRef.current.bass
      if (bass > fftSpawnThreshold && now - fftSpawnCooldownRef.current > fftSpawnRate) {
        fftSpawnCooldownRef.current = now
        const spawnX = 0.2 + Math.random() * 0.6
        const spawnY = 0.2 + Math.random() * 0.6
        simClickQueueRef.current.push({ x: spawnX, y: spawnY })
        const freq = yToFreq(spawnY, synthScale)
        audio.playNote(freq, 0.3)
      }
    }
  }, [audio, fftSpawnEnabled, fftSpawnThreshold, fftSpawnRate, audioEnabled, synthScale, distortion, reverbMix, patchTuning, hand, midiEnabled, looperRecording])

  return {
    handleEnergyChange,
    energyDisplay,
    energyRef,
    currentFreq,
    // Looper controls (exposed for DevPanel)
    looper: {
      ref: looperRef,
      recording: looperRecording,
      playing: looperPlaying,
      setRecording: setLooperRecording,
      setPlaying: setLooperPlaying,
    },
    // MIDI controls
    midi: {
      ref: midiRef,
      enabled: midiEnabled,
      setEnabled: setMidiEnabled,
    },
    // Audio recording
    recorder: {
      ref: recorderRef,
      isRecording: isRecordingAudio,
      setIsRecording: setIsRecordingAudio,
    },
  }
}
