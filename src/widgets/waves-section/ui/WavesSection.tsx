import { motion, useScroll, useTransform } from 'framer-motion'
import type { RefObject } from 'react'

interface WavesSectionProps {
  scrollRef: RefObject<HTMLElement | null>
}

export function WavesSection({ scrollRef }: WavesSectionProps) {
  const { scrollYProgress } = useScroll({ container: scrollRef })
  const opacity = useTransform(scrollYProgress, [0.25, 0.35, 0.45, 0.55], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [0.25, 0.35], [40, 0])

  return (
    <section className="flex min-h-screen items-center justify-center px-6">
      <motion.div
        style={{ opacity, y }}
        className="flex flex-col items-center gap-6 text-center"
      >
        <p className="font-primary text-xs tracking-[0.3em] text-electric-purple uppercase">
          Phase II
        </p>
        <h2 className="font-primary text-[clamp(1.5rem,4vw,3rem)] font-light leading-tight tracking-[0.05em] text-cold-white">
          Direction out of chaos.
        </h2>
        <p className="max-w-md font-primary text-sm font-light leading-relaxed tracking-[0.08em] text-cold-white-dim">
          Raw ideas are just noise. We take scattered potential, apply strict
          lateral thinking, and align it into high-velocity trajectories.
        </p>
      </motion.div>
    </section>
  )
}
