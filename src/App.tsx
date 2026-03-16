import { useState, useCallback, useRef, useEffect, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
const QuantumCanvas = lazy(() => import('@/features/quantum-canvas/ui/QuantumCanvas'))
const DevPanel = lazy(() => import('@/features/quantum-canvas/ui/DevPanel').then(m => ({ default: m.DevPanel })))
import { TerminalIntake } from '@/widgets/terminal-intake'
import { DevModeButton } from '@/widgets/dev-mode-button/DevModeButton'
import { useSynth, yToFreq } from '@/features/quantum-audio'
import type { ScaleName } from '@/features/quantum-audio'
import { useHandTracker, NoteOverlay, Looper, MidiOutput, AudioRecorder } from '@/features/hand-tracking'
import { useTuningStore } from '@/features/quantum-canvas/model/tuning-store'
import { useAudioStore } from '@/features/quantum-audio/model/audio-store'
import { useUIStore } from '@/shared/model/ui-store'
import { useKeyboardSynth } from '@/features/quantum-audio/ui/use-keyboard-synth'

export default function App() {
  // ── Stores ──
  const tuning = useTuningStore((s) => s.tuning)
  const patchTuning = useTuningStore((s) => s.patchTuning)

  const audioEnabled = useAudioStore((s) => s.audioEnabled)
  const synthScale = useAudioStore((s) => s.synthScale) as ScaleName
  const audioReactive = useAudioStore((s) => s.audioReactive)
  const fftSpawnEnabled = useAudioStore((s) => s.fftSpawnEnabled)
  const fftSpawnThreshold = useAudioStore((s) => s.fftSpawnThreshold)
  const fftSpawnRate = useAudioStore((s) => s.fftSpawnRate)
  const distortion = useAudioStore((s) => s.distortion)
  const reverbMix = useAudioStore((s) => s.reverbMix)

  const isForging = useUIStore((s) => s.isForging)
  const setIsForging = useUIStore((s) => s.setIsForging)
  const devUnlocked = useUIStore((s) => s.devUnlocked)
  const setDevUnlocked = useUIStore((s) => s.setDevUnlocked)
  const showDevPanel = useUIStore((s) => s.showDevPanel)
  const setShowDevPanel = useUIStore((s) => s.setShowDevPanel)
  const performanceMode = useUIStore((s) => s.performanceMode)
  const setPerformanceMode = useUIStore((s) => s.setPerformanceMode)
  const hideCursor = useUIStore((s) => s.hideCursor)

  // ── Refs (not state — no re-renders) ──
  const energyRef = useRef(0)
  const [energyDisplay, setEnergyDisplay] = useState(0)
  const [energyOverride, setEnergyOverride] = useState<number | null>(null)
  const simClickQueueRef = useRef<Array<{x: number, y: number}>>([])
  const [wallRip, setWallRip] = useState(false)
  const [simMouseActive, setSimMouseActive] = useState(false)
  const simMousePosRef = useRef({ x: 0.5, y: 0.5 })
  const gravBodyPositionsRef = useRef<{click: {x: number, y: number}, mouse: {x: number, y: number}} | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // ── Audio engine ──
  const audio = useSynth()

  // ── Hand tracking ──
  const hand = useHandTracker()
  const handNoteRef = useRef<{ release: () => void; bend: (f: number) => void } | null>(null)
  const mouseNoteRef = useRef<{ release: () => void; bend: (f: number) => void } | null>(null)
  const rightNoteRef = useRef<{ release: () => void; bend: (f: number) => void } | null>(null)
  const wasPinchingRef = useRef(false)
  const wasRightPinchingRef = useRef(false)
  const prevGestureRef = useRef<string>('neutral')
  const gestureResetRef = useRef<{ distortion?: number; reverbMix?: number; waveSpeed?: number } | null>(null)
  const handTrailRef = useRef(0)
  const [currentFreq, setCurrentFreq] = useState(0)

  // ── Looper / MIDI / Recorder ──
  const looperRef = useRef(new Looper())
  const [looperRecording, setLooperRecording] = useState(false)
  const [looperPlaying, setLooperPlaying] = useState(false)
  const midiRef = useRef(new MidiOutput())
  const recorderRef = useRef(new AudioRecorder())
  const [midiEnabled, setMidiEnabled] = useState(false)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)

  // ── Audio engine lifecycle ──
  useEffect(() => {
    if (audioEnabled) {
      audio.start()
      const unlockAudio = () => audio.resumeIfSuspended()
      window.addEventListener('pointerdown', unlockAudio)
      window.addEventListener('keydown', unlockAudio)
      return () => {
        window.removeEventListener('pointerdown', unlockAudio)
        window.removeEventListener('keydown', unlockAudio)
      }
    } else {
      audio.stop()
    }
  }, [audioEnabled, audio])

  // ── Audio store → SynthEngine sync ──
  useEffect(() => {
    const unsubs = [
      useAudioStore.subscribe((s) => s.masterVolume, (v) => audio.setVolume(v)),
      useAudioStore.subscribe((s) => s.droneVolume, (v) => audio.setDroneVolume(v)),
      useAudioStore.subscribe((s) => s.notesVolume, (v) => audio.setNotesVolume(v)),
      useAudioStore.subscribe((s) => s.synthWaveform, (wf) => audio.setWaveform(wf)),
      useAudioStore.subscribe((s) => s.synthFilterQ, (q) => audio.setFilterQ(q)),
      useAudioStore.subscribe((s) => s.synthScale, (s) => audio.setScale(s)),
      useAudioStore.subscribe((s) => s.unisonCount, (n) => audio.setUnisonCount(n)),
      useAudioStore.subscribe((s) => s.detuneSpread, (c) => audio.setDetuneSpread(c)),
      useAudioStore.subscribe((s) => s.delayTime, (v) => audio.setDelayTime(v)),
      useAudioStore.subscribe((s) => s.delayFeedback, (v) => audio.setDelayFeedback(v)),
      useAudioStore.subscribe((s) => s.delayMix, (v) => audio.setDelayMix(v)),
      useAudioStore.subscribe((s) => s.reverbMix, (v) => audio.setReverbMix(v)),
      useAudioStore.subscribe((s) => s.reverbDecay, (v) => audio.setReverbDecay(v)),
      useAudioStore.subscribe((s) => s.distortion, (v) => audio.setDistortion(v)),
      useAudioStore.subscribe((s) => s.autoDistortion, (v) => audio.setAutoDistortion(v)),
      useAudioStore.subscribe((s) => s.envAttack, (a) => {
        const s = useAudioStore.getState()
        audio.setEnvelope(a, s.envDecay, s.envSustain, s.envRelease)
      }),
      useAudioStore.subscribe((s) => s.envDecay, (d) => {
        const s = useAudioStore.getState()
        audio.setEnvelope(s.envAttack, d, s.envSustain, s.envRelease)
      }),
      useAudioStore.subscribe((s) => s.envSustain, (su) => {
        const s = useAudioStore.getState()
        audio.setEnvelope(s.envAttack, s.envDecay, su, s.envRelease)
      }),
      useAudioStore.subscribe((s) => s.envRelease, (r) => {
        const s = useAudioStore.getState()
        audio.setEnvelope(s.envAttack, s.envDecay, s.envSustain, r)
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [audio])

  // ── Keyboard synth (extracted hook) ──
  useKeyboardSynth({ audioEnabled, isForging, audio, synthScale, simClickQueueRef })

  // ── Callbacks ──
  const onRip = useCallback(() => {
    if (!wallRip) setIsForging(true)
  }, [wallRip, setIsForging])

  const handleSimClick = useCallback((x: number, y: number) => {
    simClickQueueRef.current.push({ x, y })
    const freq = yToFreq(y, synthScale)
    audio.playNote(freq, 0.6)
  }, [audio, synthScale])

  const handleSimMouseUpdate = useCallback((x: number, y: number) => {
    simMousePosRef.current = { x, y }
  }, [])

  // ── Energy + Hand tracking frame callback ──
  const lastUpdateRef = useRef(0)
  const fftSpawnCooldownRef = useRef(0)
  const handleEnergyChange = useCallback((energy: number, interferenceRatio: number, mouseX: number, mouseY: number) => {
    energyRef.current = energy
    const now = Date.now()
    if (now - lastUpdateRef.current > 100) {
      lastUpdateRef.current = now
      setEnergyDisplay(energy)
    }
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

      const trailHand = leftH.detected ? leftH : rightH
      if (trailHand.detected && now - handTrailRef.current > 80) {
        handTrailRef.current = now
        simClickQueueRef.current.push({ x: trailHand.x, y: trailHand.y })
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
  }, [audio, tuning.ripThreshold, tuning.waveSpeed, fftSpawnEnabled, fftSpawnThreshold, fftSpawnRate, audioEnabled, synthScale, distortion, reverbMix, patchTuning, hand, midiEnabled, looperRecording])

  const handleZoomChange = useCallback((delta: number) => {
    useTuningStore.setState((state) => {
      const current = state.tuning.viewScale ?? 1.0
      const next = current + delta
      if (next <= 0.01) return state
      if (next === current) return state
      return { tuning: { ...state.tuning, viewScale: next, zoomMode: 0 } }
    })
  }, [])

  const handleBootDone = useCallback(() => {
    setDevUnlocked(true)
  }, [setDevUnlocked])

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      <motion.div
        className="absolute inset-0 z-0"
        animate={{ opacity: isForging ? 0 : 1 }}
        transition={{ duration: 1.5, delay: isForging ? 0.3 : 0 }}
        style={{ pointerEvents: isForging ? 'none' : 'auto', cursor: hideCursor ? 'none' : 'crosshair' }}
      >
        <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
          <QuantumCanvas
            onRip={onRip}
            tuning={tuning}
            onEnergyChange={handleEnergyChange}
            energyOverride={energyOverride}
            simClickQueue={simClickQueueRef}
            simMouseActive={simMouseActive}
            simMousePos={simMousePosRef}
            gravBodyPositions={gravBodyPositionsRef}
            onZoomChange={handleZoomChange}
            onManualClick={(_x, y) => {
              mouseNoteRef.current?.release()
              const freq = yToFreq(y, synthScale)
              mouseNoteRef.current = audio.playNote(freq, 0.6, true)
            }}
            onManualRelease={() => {
              mouseNoteRef.current?.release()
              mouseNoteRef.current = null
            }}
            onCanvasReady={(c) => { canvasRef.current = c }}
            audioBands={audioReactive ? audio.fftRef : undefined}
            handTrackingActive={hand.active}
            handTrackingPos={hand.stateRef}
          />
        </Suspense>
      </motion.div>

      <NoteOverlay
        freq={currentFreq}
        active={hand.active}
        pinching={hand.handState.pinching}
        gesture={hand.handState.gesture ?? 'neutral'}
      />

      <AnimatePresence>
        {isForging && <TerminalIntake onBootDone={handleBootDone} />}
      </AnimatePresence>

      <AnimatePresence>
        {devUnlocked && !showDevPanel && !performanceMode && (
          <DevModeButton onClick={() => {
            setShowDevPanel(true)
            setIsForging(false)
          }} />
        )}
      </AnimatePresence>

      {showDevPanel && !performanceMode && (
        <Suspense fallback={null}>
        <DevPanel
          energy={energyDisplay}
          energyOverride={energyOverride}
          onEnergyOverride={setEnergyOverride}
          onSimClick={handleSimClick}
          wallRip={wallRip}
          onWallRipChange={setWallRip}
          simMouseActive={simMouseActive}
          onSimMouseActiveChange={setSimMouseActive}
          onSimMouseUpdate={handleSimMouseUpdate}
          gravBodyPositions={gravBodyPositionsRef}
          canvasRef={canvasRef}
          fftRef={audio.fftRef}
          audio={audio}
          handTracking={{
            ...hand,
            looper: {
              recording: looperRecording,
              playing: looperPlaying,
              eventCount: looperRef.current.eventCount,
              onRecord: () => {
                if (looperRecording) {
                  looperRef.current.stopRecording()
                  setLooperRecording(false)
                } else {
                  looperRef.current.startRecording()
                  setLooperRecording(true)
                }
              },
              onPlay: () => {
                if (looperPlaying) {
                  looperRef.current.stopPlayback()
                  setLooperPlaying(false)
                } else {
                  let activeNote: { release: () => void; bend: (f: number) => void } | null = null
                  looperRef.current.startPlayback((event) => {
                    if (event.type === 'noteOn' && event.freq) {
                      activeNote?.release()
                      activeNote = audio.playNote(event.freq, 0.8, true)
                      if (event.x !== undefined && event.y !== undefined) {
                        simClickQueueRef.current.push({ x: event.x, y: event.y })
                      }
                    } else if (event.type === 'noteOff') {
                      activeNote?.release()
                      activeNote = null
                    } else if (event.type === 'bend' && event.freq && activeNote) {
                      activeNote.bend(event.freq)
                    }
                  })
                  setLooperPlaying(true)
                }
              },
              onClear: () => {
                looperRef.current.clear()
                setLooperRecording(false)
                setLooperPlaying(false)
              },
            },
          }}
          performance={{
            midiEnabled,
            onMidiToggle: async () => {
              if (midiEnabled) {
                midiRef.current.allNotesOff()
                setMidiEnabled(false)
              } else {
                const ok = await midiRef.current.init()
                setMidiEnabled(ok)
              }
            },
            isRecording: isRecordingAudio,
            onRecordToggle: () => {
              if (isRecordingAudio) {
                recorderRef.current.stop()
                setIsRecordingAudio(false)
              } else {
                const stream = audio.getRecordingStream()
                if (stream) {
                  recorderRef.current.startFromStream(stream)
                  setIsRecordingAudio(true)
                }
              }
            },
            performanceMode,
            onPerformanceToggle: () => setPerformanceMode(!performanceMode),
          }}
        />
        </Suspense>
      )}

      {performanceMode && (
        <button
          onClick={() => setPerformanceMode(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setPerformanceMode(false) }}
          className="fixed top-4 right-4 z-[200] px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur border border-purple-500/30 text-purple-400 text-xs font-bold hover:bg-black/80 transition-colors"
        >
          ESC — Exit Performance
        </button>
      )}
    </div>
  )
}
