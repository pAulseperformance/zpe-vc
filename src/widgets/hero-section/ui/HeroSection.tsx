import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/shared/ui'

interface HeroOverlayProps {
  showText: boolean
  showCta: boolean
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
}

export function HeroOverlay({ showText, showCta }: HeroOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
      {/* H1 + Subtext — in DOM always (SEO), visible on first hover */}
      <motion.h1
        className="font-primary text-[clamp(2rem,8vw,5rem)] font-light leading-tight tracking-[0.08em] text-cold-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: showText ? 1 : 0, y: showText ? 0 : 20 }}
        transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
      >
        Pure potential.
      </motion.h1>

      <motion.p
        className="mt-6 max-w-lg font-primary text-sm font-light leading-relaxed tracking-[0.08em] text-cold-white-dim"
        initial={{ opacity: 0 }}
        animate={{ opacity: showText ? 1 : 0, y: showText ? 0 : 20 }}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        Ideas are just noise. We subject them to extreme market friction,
        validating and forging only what survives.
      </motion.p>

      {/* CTA — visible ONLY after first release */}
      <AnimatePresence>
        {showCta && (
          <motion.div
            className="pointer-events-auto mt-12"
            {...fadeIn}
          >
            <a href="mailto:hello@zpe.vc">
              <Button variant="default" size="lg" className="lowercase">
                [ this is the cosmic assembly line ]
              </Button>
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
