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
  const [simMode, setSimMode] = useState<'single' | 'dual' | 'gravity'>('single')
  const [simSeparation, setSimSeparation] = useState(0.2)
  const [simMouseSpeed, setSimMouseSpeed] = useState(0.5)
  const [simMouseRadius, setSimMouseRadius] = useState(0.15)

  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  // Refs to avoid tearing down the loop when slider changes
  const simStateRef = useRef({ simMode, simSeparation, simRate, simMouseSpeed, simMouseRadius, simClicksOn, simMouseOn, simActive })
  simStateRef.current = { simMode, simSeparation, simRate, simMouseSpeed, simMouseRadius, simClicksOn, simMouseOn, simActive }
  
  // Physics state for gravity mode
  const gravStateRef = useRef({
    clickPos: { x: 0.8, y: 0.5 },
    clickVel: { x: 0.0, y: 0.8 },
    mousePos: { x: 0.2, y: 0.5 },
    mouseVel: { x: 0.0, y: -0.8 },
  })
  
  // Unified Simulation Loop
  useEffect(() => {
    callbacksRef.current.onSimMouseActiveChange(simActive && simMouseOn)
    
    if (!simActive) return
    if (!simClicksOn && !simMouseOn) return

    // Randomize gravity initial conditions each time mode enters gravity
    if (simMode === 'gravity') {
      const angle = Math.random() * Math.PI * 2
      const r = 0.15 + Math.random() * 0.15
      gravStateRef.current = {
        clickPos: { x: 0.5 + Math.cos(angle) * r, y: 0.5 + Math.sin(angle) * r },
        clickVel: { x: -Math.sin(angle) * 0.8, y: Math.cos(angle) * 0.8 },
        mousePos: { x: 0.5 - Math.cos(angle) * r, y: 0.5 - Math.sin(angle) * r },
        mouseVel: { x: Math.sin(angle) * 0.8, y: -Math.cos(angle) * 0.8 },
      }
    }
    
    let lastTime = 0
    let elapsedClick = 0
    let frameId: number

    const loop = (time: number) => {
      if (lastTime === 0) lastTime = time
      const deltaMs = time - lastTime
      const dt = Math.min(deltaMs * 0.001, 0.05) // dt in seconds, capped at 50ms
      lastTime = time
      elapsedClick += deltaMs
      
      const st = simStateRef.current
      const grav = gravStateRef.current
      const { onSimClick, onSimMouseUpdate } = callbacksRef.current

      // ── MOUSE UPDATE ──
      if (st.simMouseOn) {
        if (st.simMode === 'gravity') {
          // Gravity physics: mouse is pulled towards click pos and center
          const dx = grav.clickPos.x - grav.mousePos.x
          const dy = grav.clickPos.y - grav.mousePos.y
          const distSq = Math.max(0.01, dx*dx + dy*dy)
          const dist = Math.sqrt(distSq)
          const dirX = dx / dist
          const dirY = dy / dist
          
          // Mutual attraction + central spring
          const force = 0.5 / distSq // Gravity
          const centerForceX = (0.5 - grav.mousePos.x) * 2.0
          const centerForceY = (0.5 - grav.mousePos.y) * 2.0
          
          grav.mouseVel.x += (dirX * force + centerForceX) * dt
          grav.mouseVel.y += (dirY * force + centerForceY) * dt
          
          // Speed limit and friction
          grav.mouseVel.x *= 0.99
          grav.mouseVel.y *= 0.99
          
          grav.mousePos.x += grav.mouseVel.x * dt * st.simMouseSpeed
          grav.mousePos.y += grav.mouseVel.y * dt * st.simMouseSpeed
          
          onSimMouseUpdate(grav.mousePos.x, grav.mousePos.y)
        } else {
          // Lissajous
          const t = Date.now() * 0.001 * st.simMouseSpeed
          const x = 0.5 + Math.sin(t) * st.simMouseRadius
          const y = 0.5 + Math.sin(t * 2) * st.simMouseRadius * 0.7
          onSimMouseUpdate(x, y)
        }
      }

      // ── CLICK UPDATE ──
      if (st.simClicksOn && st.simMode === 'gravity') {
        // Gravity physics: click pos is pulled towards mouse pos and center
        const dx = grav.mousePos.x - grav.clickPos.x
        const dy = grav.mousePos.y - grav.clickPos.y
        const distSq = Math.max(0.01, dx*dx + dy*dy)
        const dist = Math.sqrt(distSq)
        const dirX = dx / dist
        const dirY = dy / dist
        
        const force = 0.5 / distSq
        const centerForceX = (0.5 - grav.clickPos.x) * 2.0
        const centerForceY = (0.5 - grav.clickPos.y) * 2.0
        
        grav.clickVel.x += (dirX * force + centerForceX) * dt
        grav.clickVel.y += (dirY * force + centerForceY) * dt
        
        grav.clickVel.x *= 0.99
        grav.clickVel.y *= 0.99
        
        grav.clickPos.x += grav.clickVel.x * dt * Math.min(3.0, st.simRate * 0.3)
        grav.clickPos.y += grav.clickVel.y * dt * Math.min(3.0, st.simRate * 0.3)
      }

      // ── TRIGGER CLICKS ──
      if (st.simClicksOn) {
        const threshold = 1000 / st.simRate
        if (elapsedClick >= threshold) {
          elapsedClick = elapsedClick % threshold
          if (st.simMode === 'single') {
            onSimClick(0.5, 0.5)
          } else if (st.simMode === 'dual') {
            const half = st.simSeparation / 2
            onSimClick(0.5 - half, 0.5)
            onSimClick(0.5 + half, 0.5)
          } else if (st.simMode === 'gravity') {
            onSimClick(grav.clickPos.x, grav.clickPos.y)
          }
        }
      }

      frameId = requestAnimationFrame(loop)
    }
    
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [simActive, simClicksOn, simMouseOn])

  return {
    simActive, setSimActive,
    simClicksOn, setSimClicksOn,
    simMouseOn, setSimMouseOn,
    simRate, setSimRate,
    simMode, setSimMode,
    simSeparation, setSimSeparation,
    simMouseSpeed, setSimMouseSpeed,
    simMouseRadius, setSimMouseRadius,
    gravState: gravStateRef,
  }
}
