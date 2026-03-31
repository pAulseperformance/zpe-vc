import { motion } from 'framer-motion'

/* Quantum sparkle particles around the button */
function SparkleParticles() {
  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2
    const radius = 28
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      delay: i * 0.06,
      size: 2 + ((i * 7) % 3),
    }
  })

  return (
    <>
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: 'radial-gradient(circle, rgba(168,85,247,0.9), rgba(168,85,247,0))',
            left: '50%',
            top: '50%',
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
          animate={{
            x: [0, p.x, p.x * 1.3],
            y: [0, p.y, p.y * 1.3],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 0.8,
            delay: 0.2 + p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </>
  )
}

interface DevModeButtonProps {
  onClick: () => void
}

export function DevModeButton({ onClick }: DevModeButtonProps) {
  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
        delay: 1.5,
      }}
    >
      {/* Sparkle burst on entrance */}
      <SparkleParticles />

      {/* Pulsing glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,0.15), transparent 70%)',
        }}
        animate={{
          scale: [1, 1.6, 1],
          opacity: [0.4, 0, 0.4],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Button */}
      <motion.button
        onClick={onClick}
        className="relative w-10 h-10 rounded-full border border-electric-purple/30 bg-black/80 backdrop-blur-sm flex items-center justify-center cursor-pointer group"
        whileHover={{ scale: 1.15, borderColor: 'rgba(168,85,247,0.6)' }}
        whileTap={{ scale: 0.95 }}
        title="Enter Dev Mode"
      >
        {/* Icon */}
        <span className="text-sm group-hover:text-electric-purple transition-colors text-cold-white-dim/50">
          ⚙️
        </span>
      </motion.button>

      {/* Label */}
      <motion.span
        className="absolute -top-6 left-1/2 -translate-x-1/2 text-[0.5rem] font-mono tracking-[0.2em] text-cold-white-dim/20 uppercase whitespace-nowrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
      >
        dev mode
      </motion.span>
    </motion.div>
  )
}
