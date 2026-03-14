import { useRef } from 'react'
import { useScroll } from 'framer-motion'
import { QuantumCanvas } from '@/features/quantum-canvas'
import { HeroSection } from '@/widgets/hero-section'
import { WavesSection } from '@/widgets/waves-section'
import { ForgeSection } from '@/widgets/forge-section'
import { AwakeningSection } from '@/widgets/awakening-section'
import { SCROLL_PAGES } from '@/shared/lib/constants'

export default function App() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ container: scrollRef })

  return (
    <div
      ref={scrollRef}
      className="h-screen overflow-y-auto overflow-x-hidden bg-void"
    >
      {/* Fixed full-screen R3F canvas — behind everything */}
      <div className="fixed inset-0 z-0">
        <QuantumCanvas progress={scrollYProgress} />
      </div>

      {/* Scrollable content — floats above the canvas */}
      <div
        className="relative z-10"
        style={{ height: `${SCROLL_PAGES * 100}vh` }}
      >
        {/* STATE 1: Quantum Jitter (0%) */}
        <HeroSection />

        {/* STATE 2: Transverse Waves (33%) */}
        <WavesSection scrollRef={scrollRef} />

        {/* STATE 3: The Forge (66%) */}
        <ForgeSection scrollRef={scrollRef} />

        {/* STATE 4: The Awakening (100%) */}
        <AwakeningSection scrollRef={scrollRef} />
      </div>
    </div>
  )
}
