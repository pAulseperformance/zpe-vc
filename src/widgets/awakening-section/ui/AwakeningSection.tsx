import { motion, useScroll, useTransform } from 'framer-motion'
import type { RefObject } from 'react'
import { Button } from '@/shared/ui'

interface AwakeningSectionProps {
  scrollRef: RefObject<HTMLElement | null>
}

export function AwakeningSection({ scrollRef }: AwakeningSectionProps) {
  const { scrollYProgress } = useScroll({ container: scrollRef })
  const opacity = useTransform(scrollYProgress, [0.82, 0.92], [0, 1])
  const y = useTransform(scrollYProgress, [0.82, 0.92], [50, 0])

  return (
    <section className="flex min-h-screen items-center justify-center px-6">
      <motion.div
        style={{ opacity, y }}
        className="flex flex-col items-center gap-8 text-center"
      >
        <p className="font-primary text-xs tracking-[0.3em] text-electric-purple uppercase">
          Phase IV
        </p>
        <h2 className="font-primary text-[clamp(1.5rem,4vw,3rem)] font-light leading-tight tracking-[0.05em] text-cold-white">
          Dead chemistry wakes up.
        </h2>
        <p className="max-w-md font-primary text-sm font-light leading-relaxed tracking-[0.08em] text-cold-white-dim">
          From the void to a living, breathing machine. We engineer autonomous,
          scalable platforms built to endure the sandbox.
        </p>

        <div className="mt-4">
          <a href="mailto:hello@zpe.vc">
            <Button variant="default" size="lg" className="lowercase">
              [ Initiate the Forge ]
            </Button>
          </a>
        </div>

        <p className="mt-12 font-primary text-[0.6rem] tracking-[0.15em] text-cold-white-dim/25 uppercase">
          © 2026 ZPE Ventures
        </p>
      </motion.div>
    </section>
  )
}
