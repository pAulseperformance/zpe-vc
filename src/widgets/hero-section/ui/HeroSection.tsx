import { motion, useScroll, useTransform } from 'framer-motion'
import type { RefObject } from 'react'
import { Button } from '@/shared/ui'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 1.2,
      delay,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  }),
}

interface HeroSectionProps {
  scrollRef: RefObject<HTMLElement | null>
}

export function HeroSection({ scrollRef }: HeroSectionProps) {
  // Stealth load: text is invisible until user scrolls slightly
  const { scrollYProgress } = useScroll({ container: scrollRef })
  const textOpacity = useTransform(scrollYProgress, [0, 0.03, 0.08], [0, 0, 1])
  const textY = useTransform(scrollYProgress, [0.03, 0.10], [20, 0])

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <motion.div style={{ opacity: textOpacity, y: textY }}>
        <motion.h1
          className="font-primary text-[clamp(2rem,8vw,5rem)] font-light leading-tight tracking-[0.08em] text-cold-white"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.2}
        >
          Pure potential.
        </motion.h1>

        <motion.p
          className="mt-6 max-w-lg mx-auto font-primary text-sm font-light leading-relaxed tracking-[0.08em] text-cold-white-dim"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.6}
        >
          Ideas are just noise. We subject them to extreme market friction,
          validating and forging only what survives.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1.0}
          className="mt-12"
        >
          <Button variant="default" size="lg" className="lowercase">
            [ this is the cosmic assembly line ]
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
