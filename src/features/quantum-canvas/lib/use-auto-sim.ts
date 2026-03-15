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

  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  // Refs to avoid tearing down the loop when slider changes
  const simStateRef = useRef({ simMode, simSeparation, simRate })
  simStateRef.current = { simMode, simSeparation, simRate }
  
  // Auto-sim click loop (RAF-based for smooth rate changes)
  useEffect(() => {
    if (!simActive || !simClicksOn) return
    
    let lastTime = 0
    let elapsed = 0
    let frameId: number

    const triggerClicks = () => {
      const { simMode, simSeparation } = simStateRef.current
      const { onSimClick } = callbacksRef.current
      if (simMode === 'single') {
        onSimClick(0.5, 0.5)
      } else {
        const half = simSeparation / 2
        onSimClick(0.5 - half, 0.5)
        onSimClick(0.5 + half, 0.5)
      }
    }

    const loop = (time: number) => {
      if (lastTime === 0) lastTime = time // Initialize on first frame to prevent timestamp drift
      
      const delta = time - lastTime
      lastTime = time
      elapsed += delta
      
      const rate = simStateRef.current.simRate
      const threshold = 1000 / rate
      
      if (elapsed >= threshold) {
        elapsed = elapsed % threshold
        triggerClicks()
      }
      frameId = requestAnimationFrame(loop)
    }
    
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [simActive, simClicksOn]) // Removed onSimClick to prevent teardowns

  // Auto-sim mouse movement (figure-8 lissajous pattern)
  useEffect(() => {
    const { onSimMouseActiveChange } = callbacksRef.current
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
      const { onSimMouseUpdate } = callbacksRef.current
      onSimMouseUpdate(x, y)
      simMouseFrameRef.current = requestAnimationFrame(loop)
    }
    simMouseFrameRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(simMouseFrameRef.current) }
  }, [simActive, simMouseOn, simMouseSpeed, simMouseRadius])

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
