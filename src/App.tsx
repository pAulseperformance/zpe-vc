import { useEffect, useRef, useCallback } from 'react'
import './index.css'

/* ─── Particle config ─── */
const PARTICLE_COUNT = 40

interface ParticleStyle {
  left: string
  animationDuration: string
  animationDelay: string
  width: string
  height: string
  boxShadow: string
}

function generateParticleStyles(): ParticleStyle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const size = Math.random() * 2 + 1
    const glow = size > 2 ? `0 0 ${size * 3}px rgba(224, 231, 255, 0.3)` : 'none'
    return {
      left: `${Math.random() * 100}%`,
      animationDuration: `${Math.random() * 15 + 10}s`,
      animationDelay: `${Math.random() * 20}s`,
      width: `${size}px`,
      height: `${size}px`,
      boxShadow: glow,
    }
  })
}

const particles = generateParticleStyles()

/* ─── App ─── */
export default function App() {
  const glowRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const glow = glowRef.current
    if (!glow) return
    glow.style.left = `${e.clientX}px`
    glow.style.top = `${e.clientY}px`
    glow.classList.add('cursor-glow--visible')
  }, [])

  const handleMouseLeave = useCallback(() => {
    glowRef.current?.classList.remove('cursor-glow--visible')
  }, [])

  useEffect(() => {
    // External system sync — mouse tracking for ambient glow
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [handleMouseMove, handleMouseLeave])

  return (
    <>
      {/* Cursor-follow ambient glow */}
      <div ref={glowRef} className="cursor-glow" />

      <section className="hero">
        {/* Background layers */}
        <div className="hero__bg" />
        <div className="hero__glow" />
        <div className="hero__field" />

        {/* Floating particles */}
        <div className="particles">
          {particles.map((style, i) => (
            <div key={i} className="particle" style={style} />
          ))}
        </div>

        {/* Content */}
        <div className="hero__content">
          <h1 className="hero__title">ZPE</h1>

          <p className="hero__subtitle">
            Zero-Point Energy
          </p>

          <hr className="hero__divider" />

          <p className="hero__tagline">
            The energy that persists when everything else is gone.
            The irreducible hum of the quantum vacuum.
          </p>

          <a
            href="mailto:hello@zpe.vc"
            className="hero__cta"
          >
            <span>Get in Touch</span>
          </a>
        </div>

        {/* Footer */}
        <footer className="footer">
          <p className="footer__text">© 2026 ZPE Ventures</p>
        </footer>
      </section>
    </>
  )
}
