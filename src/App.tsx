import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QuantumCanvas } from '@/features/quantum-canvas'
import { DevPanel, usePersistedTuning } from '@/features/quantum-canvas/ui/DevPanel'
import { TerminalIntake } from '@/widgets/terminal-intake'
import { DevModeButton } from '@/widgets/dev-mode-button/DevModeButton'
import { useQuantumAudio } from '@/features/quantum-canvas/lib/use-quantum-audio'

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
  const audio = useQuantumAudio()

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

  const onRip = useCallback(() => {
    if (!wallRip) setIsForging(true)
  }, [wallRip])

  const handleSimClick = useCallback((x: number, y: number) => {
    simClickQueueRef.current.push({ x, y })
    audio.triggerClick()
  }, [audio])

  const handleSimMouseUpdate = useCallback((x: number, y: number) => {
    simMousePosRef.current = { x, y }
  }, [])

  // Throttle energy display updates to ~10fps to avoid re-render spam
  const lastUpdateRef = useRef(0)
  const handleEnergyChange = useCallback((energy: number, interferenceRatio: number) => {
    energyRef.current = energy
    const now = Date.now()
    if (now - lastUpdateRef.current > 100) {
      lastUpdateRef.current = now
      setEnergyDisplay(energy)
    }
    // Update audio per frame — interferenceRatio modulates shimmer volume
    audio.update(energy, tuning.ripThreshold, interferenceRatio)
  }, [audio, tuning.ripThreshold])

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
        <QuantumCanvas
          onRip={onRip}
          tuning={tuning}
          onEnergyChange={handleEnergyChange}
          energyOverride={energyOverride}
          simClickQueue={simClickQueueRef}
          simMouseActive={simMouseActive}
          simMousePos={simMousePosRef}
        />
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
        />
      )}
    </div>
  )
}

