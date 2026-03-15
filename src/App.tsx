import { useState, useMemo } from 'react'
import { QuantumCanvas, type SandboxCallbacks } from '@/features/quantum-canvas'
import { HeroOverlay } from '@/widgets/hero-section'

export default function App() {
  const [hasHovered, setHasHovered] = useState(false)
  const [hasReleased, setHasReleased] = useState(false)

  const callbacks: SandboxCallbacks = useMemo(
    () => ({
      onFirstHover: () => setHasHovered(true),
      onFirstRelease: () => setHasReleased(true),
    }),
    []
  )

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      {/* Full-screen interactive R3F canvas */}
      <div className="absolute inset-0 z-0">
        <QuantumCanvas callbacks={callbacks} />
      </div>

      {/* Floating UI overlay */}
      <HeroOverlay showText={hasHovered} showCta={hasReleased} />
    </div>
  )
}
