import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

/* ─── Boot Sequence Lines ─── */
const BOOT_LINES = [
  '> system boot...',
  '> pure potential detected.',
  '> ideas are just noise. we forge what survives.',
]

const LINE_DELAY_MS = 1200
const TYPE_SPEED_MS = 35
const INPUT_REVEAL_DELAY_MS = 800

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
function BootLine({ text, speed, start, onDone }: {
  text: string; speed: number; start: boolean; onDone: () => void
}) {
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
export function TerminalIntake({ onBootDone, forgeToken }: { onBootDone?: () => void; forgeToken?: string | null }) {
  const [activeLine, setActiveLine] = useState(0)
  const [bootDone, setBootDone] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [input, setInput] = useState('')
  const [forgeState, setForgeState] = useState<'idle' | 'forging' | 'done'>('idle')
  const [forgeResponse, setForgeResponse] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleLineDone = () => {
    const next = activeLine + 1
    if (next < BOOT_LINES.length) {
      setTimeout(() => setActiveLine(next), LINE_DELAY_MS)
    } else {
      setTimeout(() => {
        setBootDone(true)
        setShowInput(true)
        onBootDone?.()
      }, INPUT_REVEAL_DELAY_MS)
    }
  }

  useEffect(() => {
    if (showInput && forgeState === 'idle') {
      const timer = setTimeout(() => inputRef.current?.focus(), 300)
      return () => clearTimeout(timer)
    }
  }, [showInput, forgeState])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const idea = input.trim()
    if (!idea || forgeState !== 'idle') return

    setForgeState('forging')
    setForgeResponse('')

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (forgeToken) headers['Authorization'] = `Bearer ${forgeToken}`

      const res = await fetch('/api/forge', {
        method: 'POST',
        headers,
        body: JSON.stringify({ idea }),
      })

      if (res.status === 401) {
        setForgeResponse('> forge access denied. the rip was not earned.')
        setForgeState('done')
        return
      }

      if (!res.ok || !res.body) {
        setForgeResponse('> the forge is silent. try again.')
        setForgeState('done')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data) as { response?: string }
              if (parsed.response) {
                setForgeResponse(prev => prev + parsed.response)
              }
            } catch { /* skip */ }
          }
        }
      }

      setForgeState('done')
    } catch {
      setForgeResponse('> connection to the forge was severed.')
      setForgeState('done')
    }
  }, [input, forgeState])

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

        {/* Input line */}
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
                {forgeState === 'idle' && (
                  <span className="inline-block animate-blink text-cold-white">█</span>
                )}

                {input.length === 0 && forgeState === 'idle' && (
                  <span className="absolute left-0 top-0 text-cold-white-dim/20 select-none pointer-events-none">
                    [Enter your raw idea...]
                  </span>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={forgeState !== 'idle'}
                  className="absolute inset-0 w-full bg-transparent text-transparent caret-transparent outline-none border-none font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </motion.form>
        )}

        {/* Forging indicator */}
        {forgeState === 'forging' && forgeResponse.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 font-mono text-xs tracking-[0.15em] text-electric-purple/40"
          >
            <span className="animate-pulse">⟡ forging...</span>
          </motion.div>
        )}

        {/* AI response */}
        {forgeResponse.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="mt-6 font-mono text-sm leading-relaxed text-cold-white-dim/70 border-l-2 border-electric-purple/30 pl-4"
          >
            {forgeResponse}
            {forgeState === 'forging' && (
              <span className="inline-block animate-blink text-electric-purple/60">█</span>
            )}
          </motion.div>
        )}

        {/* Hint */}
        {bootDone && showInput && forgeState === 'idle' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="mt-12 font-mono text-[0.6rem] tracking-[0.15em] text-cold-white-dim/15 uppercase"
          >
            Press Enter to submit to the forge
          </motion.p>
        )}

        {forgeState === 'done' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mt-8 font-mono text-[0.6rem] tracking-[0.15em] text-cold-white-dim/15 uppercase"
          >
            Press Escape to return to the void
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}
