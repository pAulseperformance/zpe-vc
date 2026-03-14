import { motion } from 'framer-motion'
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

export function HeroSection() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
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
        className="mt-6 max-w-lg font-primary text-sm font-light leading-relaxed tracking-[0.08em] text-cold-white-dim"
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
    </div>
  )
}
