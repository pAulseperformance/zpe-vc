import { useState, useCallback, useRef, useEffect, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
const QuantumCanvas = lazy(() => import('@/features/quantum-canvas/ui/QuantumCanvas'))
import { DevPanel, usePersistedTuning } from '@/features/quantum-canvas/ui/DevPanel'
import { TerminalIntake } from '@/widgets/terminal-intake'
import { DevModeButton } from '@/widgets/dev-mode-button/DevModeButton'
import { useSynth, yToFreq } from '@/features/quantum-audio'
import type { SynthWaveform, ScaleName } from '@/features/quantum-audio'
import { useHandTracker, NoteOverlay, Looper, MidiOutput, AudioRecorder } from '@/features/hand-tracking'

const IS_DEV = import.meta.env.DEV

export default function App() {
  const [isForging, setIsForging] = useState(false)
  const [tuning, setTuning] = usePersistedTuning()
  const energyRef = useRef(0)
  const [energyDisplay, setEnergyDisplay] = useState(0)
  const [energyOverride, setEnergyOverride] = useState<number | null>(null)
  const simClickQueueRef = useRef<Array<{x: number, y: number}>>([])
  const [wallRip, setWallRip] = useState(false)
  const [simMouseActive, setSimMouseActive] = useState(false)
  const simMousePosRef = useRef({ x: 0.5, y: 0.5 })
  // Start/stop audio based on toggle
  const [audioEnabled, setAudioEnabled] = useState(tuning.audioEnabled ?? false)
  const [hideCursor, setHideCursor] = useState(tuning.hideCursor ?? true)
  const audio = useSynth()
  const gravBodyPositionsRef = useRef<{click: {x: number, y: number}, mouse: {x: number, y: number}} | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Hand tracking
  const hand = useHandTracker()
  const handNoteRef = useRef<{ release: () => void; bend: (f: number) => void } | null>(null)
  const rightNoteRef = useRef<{ release: () => void; bend: (f: number) => void } | null>(null)
  const wasPinchingRef = useRef(false)
  const wasRightPinchingRef = useRef(false)
  const prevGestureRef = useRef<string>('neutral')
  const gestureResetRef = useRef<{ distortion?: number; reverbMix?: number; waveSpeed?: number } | null>(null)
  const handTrailRef = useRef(0) // cooldown for visual trail wave spawning
  const [currentFreq, setCurrentFreq] = useState(0)

  // Looper
  const looperRef = useRef(new Looper())
  const [looperRecording, setLooperRecording] = useState(false)
  const [looperPlaying, setLooperPlaying] = useState(false)

  // MIDI + Audio recorder
  const midiRef = useRef(new MidiOutput())
  const recorderRef = useRef(new AudioRecorder())
  const [midiEnabled, setMidiEnabled] = useState(false)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)
  const [performanceMode, setPerformanceMode] = useState(false)

  // Synth controls
  const [synthWaveform, setSynthWaveform] = useState<SynthWaveform>(tuning.synthWaveform ?? 'sine')
  const [synthFilterQ, setSynthFilterQ] = useState(tuning.synthFilterQ ?? 2.0)
  const [audioReactive, setAudioReactive] = useState(tuning.audioReactive ?? true)
  const [synthScale, setSynthScale] = useState<ScaleName>((tuning.synthScale as ScaleName) ?? 'continuous')
  const [unisonCount, setUnisonCount] = useState(tuning.unisonCount ?? 2)
  const [detuneSpread, setDetuneSpread] = useState(tuning.detuneSpread ?? 7)
  const [masterVolume, setMasterVolume] = useState(tuning.masterVolume ?? 0.8)
  const [droneVolume, setDroneVolume] = useState(tuning.droneVolume ?? 0.5)
  const [notesVolume, setNotesVolume] = useState(tuning.notesVolume ?? 0.8)
  // FX state
  const [delayTime, setDelayTime] = useState(tuning.delayTime ?? 0.3)
  const [delayFeedback, setDelayFeedback] = useState(tuning.delayFeedback ?? 0.4)
  const [delayMix, setDelayMix] = useState(tuning.delayMix ?? 0)
  const [reverbMix, setReverbMix] = useState(tuning.reverbMix ?? 0)
  const [reverbDecay, setReverbDecay] = useState(tuning.reverbDecay ?? 2)
  const [distortion, setDistortion] = useState(tuning.distortion ?? 0)
  const [autoDistortion, setAutoDistortion] = useState(tuning.autoDistortion ?? false)
  // Feedback loop state
  const [fftSpawnEnabled, setFftSpawnEnabled] = useState(tuning.fftSpawnEnabled ?? false)
  const [fftSpawnThreshold, setFftSpawnThreshold] = useState(tuning.fftSpawnThreshold ?? 0.5)
  const [fftSpawnRate, setFftSpawnRate] = useState(tuning.fftSpawnRate ?? 150)
  const fftSpawnCooldownRef = useRef(0)
  // Envelope state
  const [envAttack, setEnvAttack] = useState(tuning.envAttack ?? 0.015)
  const [envDecay, setEnvDecay] = useState(tuning.envDecay ?? 0.085)
  const [envSustain, setEnvSustain] = useState(tuning.envSustain ?? 0.6)
  const [envRelease, setEnvRelease] = useState(tuning.envRelease ?? 0.25)

  // Dev mode — unlocked after rip boot sequence OR always in dev
  const [devUnlocked, setDevUnlocked] = useState(IS_DEV)
  const [showDevPanel, setShowDevPanel] = useState(IS_DEV)

  // Start/stop audio based on toggle
  useEffect(() => {
    if (audioEnabled) {
      audio.start()
      // Autoplay policy resilience: ensure context resumes on user interaction
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

  // Keyboard → synth notes (chromatic scale across 3 rows)
  // Disabled during terminal intake so user can actually type
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

    // Track active held notes for polyphonic sustain
    const activeNotes = new Map<string, { release: () => void }>()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const key = e.key.toLowerCase()
      const freq = keyMap[key]
      if (freq) {
        // Release any existing note on this key (safety)
        activeNotes.get(key)?.release()
        const handle = audio.playNote(freq, 0.6, true) // sustained=true
        activeNotes.set(key, handle)
        // Spawn visual catalyst on screen
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
      activeNotes.forEach(h => h.release())
      activeNotes.clear()
    }
  }, [audioEnabled, isForging, audio, simClickQueueRef])

  const onRip = useCallback(() => {
    if (!wallRip) setIsForging(true)
  }, [wallRip])

  const handleSimClick = useCallback((x: number, y: number) => {
    simClickQueueRef.current.push({ x, y })
    const freq = yToFreq(y, synthScale)
    audio.playNote(freq, 0.6)
  }, [audio, synthScale])

  const handleSimMouseUpdate = useCallback((x: number, y: number) => {
    simMousePosRef.current = { x, y }
  }, [])

  // Throttle energy display updates to ~10fps to avoid re-render spam
  const lastUpdateRef = useRef(0)
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
          case 'waveSpeed': setTuning(p => ({ ...p, waveSpeed: 0.1 + value * 16 })); break
          case 'waveFreq': setTuning(p => ({ ...p, waveFreq: 1 + value * 50 })); break
          case 'waveWidth': setTuning(p => ({ ...p, waveWidth: value * 0.3 })); break
          case 'ripThreshold': setTuning(p => ({ ...p, ripThreshold: 0.5 + value * 4 })); break
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
        // Restore previous gesture's params
        if (gestureResetRef.current) {
          if (gestureResetRef.current.distortion !== undefined)
            audio.setDistortion(gestureResetRef.current.distortion)
          if (gestureResetRef.current.reverbMix !== undefined)
            audio.setReverbMix(gestureResetRef.current.reverbMix)
          if (gestureResetRef.current.waveSpeed !== undefined)
            setTuning(prev => ({ ...prev, waveSpeed: gestureResetRef.current!.waveSpeed! }))
          gestureResetRef.current = null
        }
        // Apply new gesture — audio + visual
        if (gesture === 'fist') {
          gestureResetRef.current = { distortion }
          audio.setDistortion(Math.min(1, distortion + 0.6))
          // Visual: burst of 5 waves from hand position
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
          // Visual: radial burst of 8 waves
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
          // Visual: freeze — set waveSpeed to near-0
          setTuning(prev => ({ ...prev, waveSpeed: 0.01 }))
        }
        prevGestureRef.current = gesture
      }
    }
    audio.update(energy, tuning.ripThreshold, interferenceRatio, synthX, synthY)

    // Two-hand split — each hand triggers independent notes
    if (useHand && audioEnabled) {
      // Left hand note
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

      // Right hand note (harmony)
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

      // Visual trail: spawn waves along hand path every ~80ms
      const trailHand = leftH.detected ? leftH : rightH
      if (trailHand.detected && now - handTrailRef.current > 80) {
        handTrailRef.current = now
        simClickQueueRef.current.push({ x: trailHand.x, y: trailHand.y })
      }
    }

    // FFT → Wave Spawning: bass hits auto-spawn waves
    if (fftSpawnEnabled && audioEnabled) {
      const bass = audio.fftRef.current.bass
      if (bass > fftSpawnThreshold && now - fftSpawnCooldownRef.current > fftSpawnRate) {
        fftSpawnCooldownRef.current = now
        const spawnX = 0.2 + Math.random() * 0.6
        const spawnY = 0.2 + Math.random() * 0.6
        simClickQueueRef.current.push({ x: spawnX, y: spawnY })
        // Play a quiet note at the spawn position
        const freq = yToFreq(spawnY, synthScale)
        audio.playNote(freq, 0.3)
      }
    }
  }, [audio, tuning.ripThreshold, fftSpawnEnabled, fftSpawnThreshold, fftSpawnRate, audioEnabled, synthScale])

  const handleZoomChange = useCallback((delta: number) => {
    setTuning(prev => {
      const current = prev.viewScale ?? 1.0
      const next = current + delta
      if (next <= 0.01) return prev // prevent zero/negative scale
      if (next === current) return prev
      return { ...prev, viewScale: next, zoomMode: 0 }
    })
  }, [setTuning])

  const handleBootDone = useCallback(() => {
    setDevUnlocked(true)
  }, [])

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
              const freq = yToFreq(y, synthScale)
              audio.playNote(freq, 0.6)
            }}
            onCanvasReady={(c) => { canvasRef.current = c }}
            audioBands={audioReactive ? audio.fftRef : undefined}
            handTrackingActive={hand.active}
            handTrackingPos={hand.stateRef}
          />
        </Suspense>
      </motion.div>

      {/* Hand tracking note overlay */}
      <NoteOverlay
        freq={currentFreq}
        active={hand.active}
        pinching={hand.handState.pinching}
        gesture={hand.handState.gesture ?? 'neutral'}
      />

      <AnimatePresence>
        {isForging && <TerminalIntake onBootDone={handleBootDone} />}
      </AnimatePresence>

      {/* Dev Mode button — appears after terminal boot finishes */}
      <AnimatePresence>
        {devUnlocked && !showDevPanel && !performanceMode && (
          <DevModeButton onClick={() => {
            setShowDevPanel(true)
            setIsForging(false) // Return to quantum canvas
          }} />
        )}
      </AnimatePresence>

      {/* Dev panel — unlocked after rip or always in dev */}
      {showDevPanel && !performanceMode && (
        <DevPanel
          tuning={tuning}
          energy={energyDisplay}
          onChange={setTuning}
          energyOverride={energyOverride}
          onEnergyOverride={setEnergyOverride}
          onSimClick={handleSimClick}
          wallRip={wallRip}
          onWallRipChange={setWallRip}
          simMouseActive={simMouseActive}
          onSimMouseActiveChange={setSimMouseActive}
          onSimMouseUpdate={handleSimMouseUpdate}
          audioEnabled={audioEnabled}
          onAudioToggle={setAudioEnabled}
          masterVolume={masterVolume}
          onMasterVolume={(v) => { setMasterVolume(v); audio.setVolume(v) }}
          droneVolume={droneVolume}
          onDroneVolume={(v) => { setDroneVolume(v); audio.setDroneVolume(v) }}
          notesVolume={notesVolume}
          onNotesVolume={(v) => { setNotesVolume(v); audio.setNotesVolume(v) }}
          hideCursor={hideCursor}
          onCursorHideChange={setHideCursor}
          gravBodyPositions={gravBodyPositionsRef}
          canvasRef={canvasRef}
          synthWaveform={synthWaveform}
          onSynthWaveform={(wf) => { setSynthWaveform(wf); audio.setWaveform(wf) }}
          synthFilterQ={synthFilterQ}
          onSynthFilterQ={(q) => { setSynthFilterQ(q); audio.setFilterQ(q) }}
          audioReactive={audioReactive}
          onAudioReactive={setAudioReactive}
          synthScale={synthScale}
          onSynthScale={(s) => { setSynthScale(s); audio.setScale(s) }}
          unisonCount={unisonCount}
          onUnisonCount={(n) => { setUnisonCount(n); audio.setUnisonCount(n) }}
          detuneSpread={detuneSpread}
          onDetuneSpread={(c) => { setDetuneSpread(c); audio.setDetuneSpread(c) }}
          delayTime={delayTime}
          onDelayTime={(v) => { setDelayTime(v); audio.setDelayTime(v) }}
          delayFeedback={delayFeedback}
          onDelayFeedback={(v) => { setDelayFeedback(v); audio.setDelayFeedback(v) }}
          delayMix={delayMix}
          onDelayMix={(v) => { setDelayMix(v); audio.setDelayMix(v) }}
          reverbMix={reverbMix}
          onReverbMix={(v) => { setReverbMix(v); audio.setReverbMix(v) }}
          reverbDecay={reverbDecay}
          onReverbDecay={(v) => { setReverbDecay(v); audio.setReverbDecay(v) }}
          distortion={distortion}
          onDistortion={(v) => { setDistortion(v); audio.setDistortion(v) }}
          autoDistortion={autoDistortion}
          onAutoDistortion={(v) => { setAutoDistortion(v); audio.setAutoDistortion(v) }}
          fftSpawnEnabled={fftSpawnEnabled}
          onFftSpawnEnabled={setFftSpawnEnabled}
          fftSpawnThreshold={fftSpawnThreshold}
          onFftSpawnThreshold={setFftSpawnThreshold}
          fftSpawnRate={fftSpawnRate}
          onFftSpawnRate={setFftSpawnRate}
          envAttack={envAttack}
          onEnvAttack={(v) => { setEnvAttack(v); audio.setEnvelope(v, envDecay, envSustain, envRelease) }}
          envDecay={envDecay}
          onEnvDecay={(v) => { setEnvDecay(v); audio.setEnvelope(envAttack, v, envSustain, envRelease) }}
          envSustain={envSustain}
          onEnvSustain={(v) => { setEnvSustain(v); audio.setEnvelope(envAttack, envDecay, v, envRelease) }}
          envRelease={envRelease}
          onEnvRelease={(v) => { setEnvRelease(v); audio.setEnvelope(envAttack, envDecay, envSustain, v) }}
          fftRef={audio.fftRef}
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
            onPerformanceToggle: () => setPerformanceMode(p => !p),
          }}
        />
      )}

      {/* Performance mode: minimal UI — Escape to exit */}
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

