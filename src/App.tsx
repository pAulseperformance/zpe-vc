import { useState, useCallback, useRef, useEffect, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
const QuantumCanvas = lazy(() => import('@/features/quantum-canvas/ui/QuantumCanvas'))
const DevPanel = lazy(() => import('@/features/quantum-canvas/ui/DevPanel').then(m => ({ default: m.DevPanel })))
import { TerminalIntake } from '@/widgets/terminal-intake'
import { DevModeButton } from '@/widgets/dev-mode-button/DevModeButton'
import { useSynth, yToFreq } from '@/features/quantum-audio'
import type { ScaleName } from '@/features/quantum-audio'
import { useHandTracker, NoteOverlay } from '@/features/hand-tracking'
import { useHandSynth } from '@/features/hand-tracking/ui/use-hand-synth'
import { useTuningStore } from '@/features/quantum-canvas/model/tuning-store'
import { useAudioStore } from '@/features/quantum-audio/model/audio-store'
import { useUIStore } from '@/shared/model/ui-store'
import { useKeyboardSynth } from '@/features/quantum-audio/ui/use-keyboard-synth'

export default function App() {
  // ── Stores ──
  const tuning = useTuningStore((s) => s.tuning)

  const audioEnabled = useAudioStore((s) => s.audioEnabled)
  const synthScale = useAudioStore((s) => s.synthScale) as ScaleName
  const audioReactive = useAudioStore((s) => s.audioReactive)

  const isForging = useUIStore((s) => s.isForging)
  const setIsForging = useUIStore((s) => s.setIsForging)
  const devUnlocked = useUIStore((s) => s.devUnlocked)
  const setDevUnlocked = useUIStore((s) => s.setDevUnlocked)
  const showDevPanel = useUIStore((s) => s.showDevPanel)
  const setShowDevPanel = useUIStore((s) => s.setShowDevPanel)
  const performanceMode = useUIStore((s) => s.performanceMode)
  const setPerformanceMode = useUIStore((s) => s.setPerformanceMode)
  const hideCursor = useUIStore((s) => s.hideCursor)

  // ── Refs ──
  const [energyOverride, setEnergyOverride] = useState<number | null>(null)
  const simClickQueueRef = useRef<Array<{x: number, y: number}>>([])
  const [wallRip, setWallRip] = useState(false)
  const [simMouseActive, setSimMouseActive] = useState(false)
  const simMousePosRef = useRef({ x: 0.5, y: 0.5 })
  const gravBodyPositionsRef = useRef<{click: {x: number, y: number}, mouse: {x: number, y: number}} | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseNoteRef = useRef<{ release: () => void; bend: (f: number) => void } | null>(null)

  // ── Audio engine ──
  const audio = useSynth()

  // ── Hand tracking ──
  const hand = useHandTracker()

  // ── Hand synth bridge (extracted hook) ──
  const handSynth = useHandSynth({ audio, hand, simClickQueueRef })

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
  const forgeTokenRef = useRef<string | null>(null)

  const onRip = useCallback(async () => {
    if (wallRip) return
    try {
      const res = await fetch('/api/forge/token', { method: 'POST' })
      if (res.ok) {
        const { token } = await res.json() as { token: string }
        forgeTokenRef.current = token
      }
    } catch { /* forge will show error state */ }
    setIsForging(true)
  }, [wallRip, setIsForging])

  const handleSimClick = useCallback((x: number, y: number) => {
    simClickQueueRef.current.push({ x, y })
    const freq = yToFreq(y, synthScale)
    audio.playNote(freq, 0.6)
  }, [audio, synthScale])

  const handleSimMouseUpdate = useCallback((x: number, y: number) => {
    simMousePosRef.current = { x, y }
  }, [])

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
      {/* CSS starfield — instant visual, z-0 base layer */}
      <div className="starfield absolute inset-0 z-0">
        <div className="starfield-nebula" />
      </div>

      <motion.div
        className="absolute inset-0 z-10"
        animate={{ opacity: isForging ? 0 : 1 }}
        transition={{ duration: 1.5, delay: isForging ? 0.3 : 0 }}
        style={{ pointerEvents: isForging ? 'none' : 'auto', cursor: hideCursor ? 'none' : 'crosshair' }}
      >
        <Suspense fallback={null}>
          <QuantumCanvas
            onRip={onRip}
            tuning={tuning}
            onEnergyChange={handSynth.handleEnergyChange}
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
            onManualDrag={(_x, y) => {
              if (mouseNoteRef.current) {
                const freq = yToFreq(y, synthScale)
                mouseNoteRef.current.bend(freq)
              }
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
        freq={handSynth.currentFreq}
        active={hand.active}
        pinching={hand.handState.pinching}
        gesture={hand.handState.gesture ?? 'neutral'}
      />

      <AnimatePresence>
        {isForging && <TerminalIntake onBootDone={handleBootDone} forgeToken={forgeTokenRef.current} />}
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
          energy={handSynth.energyDisplay}
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
              recording: handSynth.looper.recording,
              playing: handSynth.looper.playing,
              eventCount: handSynth.looper.ref.current.eventCount,
              onRecord: () => {
                if (handSynth.looper.recording) {
                  handSynth.looper.ref.current.stopRecording()
                  handSynth.looper.setRecording(false)
                } else {
                  handSynth.looper.ref.current.startRecording()
                  handSynth.looper.setRecording(true)
                }
              },
              onPlay: () => {
                if (handSynth.looper.playing) {
                  handSynth.looper.ref.current.stopPlayback()
                  handSynth.looper.setPlaying(false)
                } else {
                  let activeNote: { release: () => void; bend: (f: number) => void } | null = null
                  handSynth.looper.ref.current.startPlayback((event) => {
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
                  handSynth.looper.setPlaying(true)
                }
              },
              onClear: () => {
                handSynth.looper.ref.current.clear()
                handSynth.looper.setRecording(false)
                handSynth.looper.setPlaying(false)
              },
            },
          }}
          performance={{
            midiEnabled: handSynth.midi.enabled,
            onMidiToggle: async () => {
              if (handSynth.midi.enabled) {
                handSynth.midi.ref.current.allNotesOff()
                handSynth.midi.setEnabled(false)
              } else {
                const ok = await handSynth.midi.ref.current.init()
                handSynth.midi.setEnabled(ok)
              }
            },
            isRecording: handSynth.recorder.isRecording,
            onRecordToggle: () => {
              if (handSynth.recorder.isRecording) {
                handSynth.recorder.ref.current.stop()
                handSynth.recorder.setIsRecording(false)
              } else {
                const stream = audio.getRecordingStream()
                if (stream) {
                  handSynth.recorder.ref.current.startFromStream(stream)
                  handSynth.recorder.setIsRecording(true)
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
