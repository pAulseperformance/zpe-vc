import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QuantumCanvas } from '@/features/quantum-canvas'
import { DevPanel, usePersistedTuning } from '@/features/quantum-canvas/ui/DevPanel'
import { TerminalIntake } from '@/widgets/terminal-intake'

const IS_DEV = import.meta.env.DEV

export default function App() {
  const [isForging, setIsForging] = useState(false)
  const [tuning, setTuning] = usePersistedTuning()
  const energyRef = useRef(0)
  const [energyDisplay, setEnergyDisplay] = useState(0)

  const onRip = useCallback(() => setIsForging(true), [])

  // Throttle energy display updates to ~10fps to avoid re-render spam
  const lastUpdateRef = useRef(0)
  const handleEnergyChange = useCallback((energy: number) => {
    energyRef.current = energy
    const now = Date.now()
    if (now - lastUpdateRef.current > 100) {
      lastUpdateRef.current = now
      setEnergyDisplay(energy)
    }
  }, [])

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
        />
      )}
    </div>
  )
}
