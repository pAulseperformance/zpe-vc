import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

export function TerminalIntake() {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the hidden input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      // Future: send to API
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
        {/* System breach header */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="font-mono text-xs tracking-[0.3em] text-cold-white-dim/40 uppercase mb-8"
        >
          SYSTEM BREACHED. VACUUM STATE OVERRIDDEN.
        </motion.p>

        {/* Terminal input area */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.8 }}
          className="relative"
        >
          {/* Prefix */}
          <div className="flex items-center gap-0 font-mono text-sm">
            <span className="text-electric-purple/60 shrink-0 select-none">
              {'> '}
            </span>
            <span className="text-cold-white-dim/50 shrink-0 select-none">
              initiate_forge:{' '}
            </span>

            {/* Visible text + cursor */}
            <div
              className="relative flex-1 cursor-text"
              onClick={() => inputRef.current?.focus()}
            >
              {/* Display layer */}
              <span className="text-cold-white">
                {input}
              </span>

              {/* Blinking block cursor */}
              <span className="inline-block animate-blink text-cold-white">
                █
              </span>

              {/* Placeholder */}
              {input.length === 0 && (
                <span className="absolute left-0 top-0 text-cold-white-dim/20 select-none pointer-events-none">
                  [Enter your raw idea...]
                </span>
              )}

              {/* Hidden real input */}
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

        {/* Subtle hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 2.5 }}
          className="mt-12 font-mono text-[0.6rem] tracking-[0.15em] text-cold-white-dim/15 uppercase"
        >
          Press Enter to submit to the forge
        </motion.p>
      </div>
    </motion.div>
  )
}
