import { useState, useEffect, useRef } from 'react'

interface AutoSimCallbacks {
  onSimClick: (x: number, y: number) => void
  onSimMouseActiveChange: (active: boolean) => void
  onSimMouseUpdate: (x: number, y: number) => void
}

/**
 * Headless hook: auto-simulation state + side-effect loops
 *
 * Encapsulates:
 * - Click interval (single/dual origin, configurable rate + separation)
 * - Mouse figure-8 movement (lissajous pattern, configurable speed + radius)
 */
export function useAutoSim(callbacks: AutoSimCallbacks) {
  const [simActive, setSimActive] = useState(false)
  const [simClicksOn, setSimClicksOn] = useState(true)
  const [simMouseOn, setSimMouseOn] = useState(false)
  const [simRate, setSimRate] = useState(2)
  const [simMode, setSimMode] = useState<'single' | 'dual'>('single')
  const [simSeparation, setSimSeparation] = useState(0.2)
  const [simMouseSpeed, setSimMouseSpeed] = useState(0.5)
  const [simMouseRadius, setSimMouseRadius] = useState(0.15)
  const simMouseFrameRef = useRef(0)

  const { onSimClick, onSimMouseActiveChange, onSimMouseUpdate } = callbacks

  // Auto-sim click interval
  useEffect(() => {
    if (!simActive || !simClicksOn) return
    const interval = setInterval(() => {
      if (simMode === 'single') {
        onSimClick(0.5, 0.5)
      } else {
        // Fire BOTH origins simultaneously for coherent interference
        const half = simSeparation / 2
        onSimClick(0.5 - half, 0.5)
        onSimClick(0.5 + half, 0.5)
      }
    }, 1000 / simRate)
    return () => clearInterval(interval)
  }, [simActive, simClicksOn, simRate, simMode, simSeparation, onSimClick])

  // Auto-sim mouse movement (figure-8 lissajous pattern)
  useEffect(() => {
    if (!simActive || !simMouseOn) {
      onSimMouseActiveChange(false)
      return
    }
    onSimMouseActiveChange(true)
    let running = true
    const loop = () => {
      if (!running) return
      const t = Date.now() * 0.001 * simMouseSpeed
      const x = 0.5 + Math.sin(t) * simMouseRadius
      const y = 0.5 + Math.sin(t * 2) * simMouseRadius * 0.7
      onSimMouseUpdate(x, y)
      simMouseFrameRef.current = requestAnimationFrame(loop)
    }
    simMouseFrameRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(simMouseFrameRef.current) }
  }, [simActive, simMouseOn, simMouseSpeed, simMouseRadius, onSimMouseActiveChange, onSimMouseUpdate])

  return {
    simActive, setSimActive,
    simClicksOn, setSimClicksOn,
    simMouseOn, setSimMouseOn,
    simRate, setSimRate,
    simMode, setSimMode,
    simSeparation, setSimSeparation,
    simMouseSpeed, setSimMouseSpeed,
    simMouseRadius, setSimMouseRadius,
  }
}
