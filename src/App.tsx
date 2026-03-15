import { useState, useCallback, useRef, useEffect, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
const QuantumCanvas = lazy(() => import('@/features/quantum-canvas/ui/QuantumCanvas'))
import { DevPanel, usePersistedTuning } from '@/features/quantum-canvas/ui/DevPanel'
import { TerminalIntake } from '@/widgets/terminal-intake'
import { DevModeButton } from '@/widgets/dev-mode-button/DevModeButton'
import { useSynth } from '@/features/quantum-audio'
import type { SynthWaveform } from '@/features/quantum-audio'

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
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [hideCursor, setHideCursor] = useState(true)
  const audio = useSynth()
  const gravBodyPositionsRef = useRef<{click: {x: number, y: number}, mouse: {x: number, y: number}} | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Synth controls
  const [synthWaveform, setSynthWaveform] = useState<SynthWaveform>('sine')
  const [synthFilterQ, setSynthFilterQ] = useState(2.0)
  const [audioReactive, setAudioReactive] = useState(true)

  // Dev mode — unlocked after rip boot sequence OR always in dev
  const [devUnlocked, setDevUnlocked] = useState(IS_DEV)
  const [showDevPanel, setShowDevPanel] = useState(IS_DEV)

  // Start/stop audio based on toggle
  useEffect(() => {
    if (audioEnabled) {
      audio.start()
    } else {
      audio.stop()
    }
  }, [audioEnabled, audio])

  // Keyboard → synth notes (chromatic scale across 3 rows)
  useEffect(() => {
    if (!audioEnabled) return

    // C3=130.81, C4=261.63, C5=523.25
    const keyMap: Record<string, number> = {
      // Bottom row: C3 → B3
      z: 130.81, x: 138.59, c: 146.83, v: 155.56, b: 164.81, n: 174.61, m: 185.00,
      // Home row: C4 → B4
      a: 261.63, s: 277.18, d: 293.66, f: 311.13, g: 329.63, h: 349.23, j: 369.99, k: 392.00, l: 415.30,
      // Top row: C5 → E5
      q: 523.25, w: 554.37, e: 587.33, r: 622.25, t: 659.26, y: 698.46, u: 739.99, i: 783.99, o: 830.61, p: 880.00,
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const freq = keyMap[e.key.toLowerCase()]
      if (freq) {
        audio.playNote(freq)
        // Spawn a catalyst at a position mapped to the key's pitch
        const pitchNorm = (Math.log2(freq) - Math.log2(130.81)) / (Math.log2(880) - Math.log2(130.81))
        simClickQueueRef.current.push({ x: 0.1 + pitchNorm * 0.8, y: 0.3 + Math.random() * 0.4 })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [audioEnabled, audio, simClickQueueRef])

  const onRip = useCallback(() => {
    if (!wallRip) setIsForging(true)
  }, [wallRip])

  const handleSimClick = useCallback((x: number, y: number) => {
    simClickQueueRef.current.push({ x, y })
    audio.triggerClick(x)
  }, [audio])

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
    // Update synth per frame — mouseX=filter cutoff + panning, mouseY=pitch
    audio.update(energy, tuning.ripThreshold, interferenceRatio, mouseX, mouseY)
  }, [audio, tuning.ripThreshold])

  const handleZoomChange = useCallback((delta: number) => {
    setTuning(prev => {
      const current = prev.viewScale ?? 1.0
      let next = current + delta
      next = Math.max(0.5, Math.min(3.0, next))
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
            onManualClick={(x, _y) => audio.triggerClick(x)}
            onCanvasReady={(c) => { canvasRef.current = c }}
            audioBands={audioReactive ? audio.fftRef : undefined}
          />
        </Suspense>
      </motion.div>

      <AnimatePresence>
        {isForging && <TerminalIntake onBootDone={handleBootDone} />}
      </AnimatePresence>

      {/* Dev Mode button — appears after terminal boot finishes */}
      <AnimatePresence>
        {devUnlocked && !showDevPanel && (
          <DevModeButton onClick={() => {
            setShowDevPanel(true)
            setIsForging(false) // Return to quantum canvas
          }} />
        )}
      </AnimatePresence>

      {/* Dev panel — unlocked after rip or always in dev */}
      {showDevPanel && (
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
          fftRef={audio.fftRef}
        />
      )}
    </div>
  )
}

