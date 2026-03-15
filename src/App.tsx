import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QuantumCanvas } from '@/features/quantum-canvas'
import { DevPanel, usePersistedTuning } from '@/features/quantum-canvas/ui/DevPanel'
import { TerminalIntake } from '@/widgets/terminal-intake'
import { useQuantumAudio } from '@/features/quantum-canvas/lib/use-quantum-audio'

const IS_DEV = import.meta.env.DEV

export default function App() {
  const [isForging, setIsForging] = useState(false)
  const [tuning, setTuning] = usePersistedTuning()
  const energyRef = useRef(0)
  const [energyDisplay, setEnergyDisplay] = useState(0)
  const [energyOverride, setEnergyOverride] = useState<number | null>(null)
  const simClickQueueRef = useRef<Array<{x: number, y: number}>>([])
  const [wallRip, setWallRip] = useState(true)
  const [simMouseActive, setSimMouseActive] = useState(false)
  const simMousePosRef = useRef({ x: 0.5, y: 0.5 })
  const [audioEnabled, setAudioEnabled] = useState(false)
  const audio = useQuantumAudio()

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
  const handleEnergyChange = useCallback((energy: number) => {
    energyRef.current = energy
    const now = Date.now()
    if (now - lastUpdateRef.current > 100) {
      lastUpdateRef.current = now
      setEnergyDisplay(energy)
    }
    // Update audio per frame
    audio.update(energy, tuning.ripThreshold, 1.0)
  }, [audio, tuning.ripThreshold])

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      <motion.div
        className="absolute inset-0 z-0"
        animate={{ opacity: isForging ? 0 : 1 }}
        transition={{ duration: 1.5, delay: isForging ? 0.3 : 0 }}
        style={{ pointerEvents: isForging ? 'none' : 'auto' }}
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
        {isForging && <TerminalIntake />}
      </AnimatePresence>

      {/* Dev panel — only in development */}
      {IS_DEV && !isForging && (
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
        />
      )}
    </div>
  )
}
