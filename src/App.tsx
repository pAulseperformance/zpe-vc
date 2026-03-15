import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QuantumCanvas } from '@/features/quantum-canvas'
import { TerminalIntake } from '@/widgets/terminal-intake'

export default function App() {
  const [isForging, setIsForging] = useState(false)

  const onRip = useCallback(() => setIsForging(true), [])

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      {/* WebGL canvas — flashes white then fades out on rip */}
      <motion.div
        className="absolute inset-0 z-0"
        animate={{ opacity: isForging ? 0 : 1 }}
        transition={{ duration: 1.5, delay: isForging ? 0.3 : 0 }}
        style={{ pointerEvents: isForging ? 'none' : 'auto' }}
      >
        <QuantumCanvas onRip={onRip} />
      </motion.div>

      {/* Terminal — fades in after the rip */}
      <AnimatePresence>
        {isForging && <TerminalIntake />}
      </AnimatePresence>
    </div>
  )
}
