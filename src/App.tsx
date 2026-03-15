import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QuantumCanvas, type SandboxCallbacks } from '@/features/quantum-canvas'
import { HeroOverlay } from '@/widgets/hero-section'
import { TerminalIntake } from '@/widgets/terminal-intake'

export default function App() {
  const [hasHovered, setHasHovered] = useState(false)
  const [isForging, setIsForging] = useState(false)

  const callbacks: SandboxCallbacks = useMemo(
    () => ({
      onFirstHover: () => setHasHovered(true),
      onRip: () => setIsForging(true),
    }),
    []
  )

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      {/* WebGL canvas — flashes white then fades out on rip */}
      <motion.div
        className="absolute inset-0 z-0"
        animate={{
          opacity: isForging ? 0 : 1,
        }}
        transition={{ duration: 1.5, delay: isForging ? 0.3 : 0 }}
        style={{ pointerEvents: isForging ? 'none' : 'auto' }}
      >
        <QuantumCanvas callbacks={callbacks} />
      </motion.div>

      {/* Hero overlay — fades out on rip */}
      <AnimatePresence>
        {!isForging && (
          <motion.div
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
          >
            <HeroOverlay
              showText={hasHovered}
              showCta={hasHovered}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terminal — fades in on rip */}
      <AnimatePresence>
        {isForging && <TerminalIntake />}
      </AnimatePresence>
    </div>
  )
}
