import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

/* ─── Boot Sequence Lines ─── */
const BOOT_LINES = [
  '> system boot...',
  '> pure potential detected.',
  '> ideas are just noise. we forge what survives.',
]

const LINE_DELAY_MS = 1200      // Delay between each line
const TYPE_SPEED_MS = 35        // Speed per character
const INPUT_REVEAL_DELAY_MS = 800 // After last line, before input appears

/* ─── Typewriter Hook ─── */
function useTypewriter(text: string, speed: number, start: boolean) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!start) return
    setDisplayed('')
    setDone(false)

    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed, start])

  return { displayed, done }
}

/* ─── Single Boot Line ─── */
interface BootLineProps {
  text: string
  speed: number
  start: boolean
  onDone: () => void
}

function BootLine({ text, speed, start, onDone }: BootLineProps) {
  const { displayed, done } = useTypewriter(text, speed, start)

  useEffect(() => {
    if (done) onDone()
  }, [done, onDone])

  if (!start) return null

  return (
    <div className="font-mono text-xs tracking-[0.15em] text-cold-white-dim/40 mb-2">
      {displayed}
      {!done && <span className="animate-blink">█</span>}
    </div>
  )
}

/* ─── Terminal Intake ─── */
export function TerminalIntake() {
  const [activeLine, setActiveLine] = useState(0)
  const [bootDone, setBootDone] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Advance to next boot line after delay
  const handleLineDone = () => {
    const next = activeLine + 1
    if (next < BOOT_LINES.length) {
      setTimeout(() => setActiveLine(next), LINE_DELAY_MS)
    } else {
      setTimeout(() => {
        setBootDone(true)
        setShowInput(true)
      }, INPUT_REVEAL_DELAY_MS)
    }
  }

  // Auto-focus input when it appears
  useEffect(() => {
    if (showInput) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300)
      return () => clearTimeout(timer)
    }
  }, [showInput])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      window.location.href = `mailto:hello@zpe.vc?subject=Forge%20Intake&body=${encodeURIComponent(input)}`
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, delay: 0.8 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black"
    >
      <div className="w-full max-w-2xl px-8">
        {/* Boot sequence */}
        {BOOT_LINES.map((line, i) => (
          <BootLine
            key={i}
            text={line}
            speed={TYPE_SPEED_MS}
            start={i <= activeLine}
            onDone={i === activeLine ? handleLineDone : () => {}}
          />
        ))}

        {/* Active input — appears after boot */}
        {showInput && (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="mt-4"
          >
            <div className="flex items-center gap-0 font-mono text-sm">
              <span className="text-electric-purple/60 shrink-0 select-none">
                {'> '}
              </span>
              <span className="text-cold-white-dim/50 shrink-0 select-none">
                initiate_forge:{' '}
              </span>

              <div
                className="relative flex-1 cursor-text"
                onClick={() => inputRef.current?.focus()}
              >
                <span className="text-cold-white">{input}</span>
                <span className="inline-block animate-blink text-cold-white">█</span>

                {input.length === 0 && (
                  <span className="absolute left-0 top-0 text-cold-white-dim/20 select-none pointer-events-none">
                    [Enter your raw idea...]
                  </span>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="absolute inset-0 w-full bg-transparent text-transparent caret-transparent outline-none border-none font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </motion.form>
        )}

        {/* Subtle hint after input appears */}
        {bootDone && showInput && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="mt-12 font-mono text-[0.6rem] tracking-[0.15em] text-cold-white-dim/15 uppercase"
          >
            Press Enter to submit to the forge
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}
