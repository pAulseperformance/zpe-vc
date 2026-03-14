import { motion, useScroll, useTransform } from 'framer-motion'
import type { RefObject } from 'react'

interface ForgeSectionProps {
  scrollRef: RefObject<HTMLElement | null>
}

export function ForgeSection({ scrollRef }: ForgeSectionProps) {
  const { scrollYProgress } = useScroll({ container: scrollRef })
  const opacity = useTransform(scrollYProgress, [0.55, 0.65, 0.75, 0.85], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [0.55, 0.65], [40, 0])
  const scale = useTransform(scrollYProgress, [0.55, 0.70], [0.95, 1])

  return (
    <section className="flex min-h-screen items-center justify-center px-6">
      <motion.div
        style={{ opacity, y, scale }}
        className="flex flex-col items-center gap-6 text-center"
      >
        <p className="font-primary text-xs tracking-[0.3em] text-electric-purple uppercase">
          Phase III
        </p>
        <h2 className="font-primary text-[clamp(1.5rem,4vw,3rem)] font-light leading-tight tracking-[0.05em] text-cold-white">
          The friction of reality.
        </h2>
        <p className="max-w-md font-primary text-sm font-light leading-relaxed tracking-[0.08em] text-cold-white-dim">
          Not every concept survives the gravity of the market. We subject
          assumptions to extreme pressure, validating and forging only the
          most resilient B2B SaaS systems.
        </p>
      </motion.div>
    </section>
  )
}
