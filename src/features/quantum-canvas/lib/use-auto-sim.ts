import { useState, useEffect, useRef } from 'react'

interface AutoSimCallbacks {
  onSimClick: (x: number, y: number) => void
  onSimMouseActiveChange: (active: boolean) => void
  onSimMouseUpdate: (x: number, y: number) => void
  zoomMode?: number
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
  const [simMode, setSimMode] = useState<'single' | 'dual' | 'cluster' | 'gravity' | 'random' | 'spiral'>('single')
  const [simSeparation, setSimSeparation] = useState(0.2)
  const [simMouseSpeed, setSimMouseSpeed] = useState(0.5)
  const [simMouseRadius, setSimMouseRadius] = useState(0.15)

  const callbacksRef = useRef(callbacks)
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  // Refs to avoid tearing down the loop when slider changes
  const simStateRef = useRef({ simMode, simSeparation, simRate, simMouseSpeed, simMouseRadius, simClicksOn, simMouseOn, simActive })
  useEffect(() => {
    simStateRef.current = { simMode, simSeparation, simRate, simMouseSpeed, simMouseRadius, simClicksOn, simMouseOn, simActive }
  }, [simMode, simSeparation, simRate, simMouseSpeed, simMouseRadius, simClicksOn, simMouseOn, simActive])
  
  // Physics state for gravity mode
  const gravStateRef = useRef({
    clickPos: { x: 0.8, y: 0.5 },
    clickVel: { x: 0.0, y: 0.8 },
    mousePos: { x: 0.2, y: 0.5 },
    mouseVel: { x: 0.0, y: -0.8 },
  })
  
  // Unified Simulation Loop
  useEffect(() => {
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

    const computeRandomPoint = (seconds: number, speed: number) => {
      const t = seconds * speed
      const x = 0.5 + Math.sin(t * 0.7) * 0.15 + Math.sin(t * 1.3) * 0.08 + Math.sin(t * 2.9) * 0.04
      const y = 0.5 + Math.cos(t * 0.5) * 0.15 + Math.cos(t * 1.7) * 0.08 + Math.cos(t * 3.1) * 0.04
      return { x: clamp(x, 0.05, 0.95), y: clamp(y, 0.05, 0.95) }
    }

    const computeSpiralPoint = (seconds: number, speed: number, radius: number) => {
      const t = seconds * speed
      const cycle = t % 8
      const r = (cycle / 8) * radius * 2
      const theta = cycle * 3
      const x = 0.5 + Math.cos(theta) * r
      const y = 0.5 + Math.sin(theta) * r
      return { x: clamp(x, 0.02, 0.98), y: clamp(y, 0.02, 0.98) }
    }

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
      const seconds = time * 0.001
      
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
          grav.mouseVel.y *= 0.99
          
          // ── CONFINEMENT WALLS ──
          if (callbacksRef.current.zoomMode === 2) {
            const mDistY = grav.mousePos.y - 0.5
            const mDistX = grav.mousePos.x - 0.5
            const rad = Math.sqrt(mDistX*mDistX + mDistY*mDistY)
            if (rad > 0.45) { // 90% from center
              const force = (rad - 0.45) * 50.0
              grav.mouseVel.x -= (mDistX / rad) * force * dt
              grav.mouseVel.y -= (mDistY / rad) * force * dt
            }
          }

          grav.mousePos.x += grav.mouseVel.x * dt * st.simMouseSpeed
          grav.mousePos.y += grav.mouseVel.y * dt * st.simMouseSpeed
          
          onSimMouseUpdate(grav.mousePos.x, grav.mousePos.y)
        } else if (st.simMode === 'random') {
          // Organic random walk using layered sine waves (poor man's Perlin)
          const p = computeRandomPoint(seconds, st.simMouseSpeed)
          onSimMouseUpdate(p.x, p.y)
        } else if (st.simMode === 'spiral') {
          // Archimedean spiral expanding outward then snapping back
          const p = computeSpiralPoint(seconds, st.simMouseSpeed, st.simMouseRadius)
          onSimMouseUpdate(p.x, p.y)
        } else {
          // Lissajous
          const t = seconds * st.simMouseSpeed
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
        
        // ── CONFINEMENT WALLS ──
        if (callbacksRef.current.zoomMode === 2) {
          const cDistY = grav.clickPos.y - 0.5
          const cDistX = grav.clickPos.x - 0.5
          const rad = Math.sqrt(cDistX*cDistX + cDistY*cDistY)
          if (rad > 0.45) {
            const force = (rad - 0.45) * 50.0
            grav.clickVel.x -= (cDistX / rad) * force * dt
            grav.clickVel.y -= (cDistY / rad) * force * dt
          }
        }
        
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
          } else if (st.simMode === 'cluster') {
            // Hexagon cluster
            for (let i = 0; i < 6; i++) {
              const angle = (i / 6) * Math.PI * 2 + seconds // Rotate over time
              onSimClick(0.5 + Math.cos(angle) * st.simSeparation, 0.5 + Math.sin(angle) * st.simSeparation)
            }
          } else if (st.simMode === 'gravity') {
            onSimClick(grav.clickPos.x, grav.clickPos.y)
          } else if (st.simMode === 'random') {
            // Click at the wandering mouse position
            const p = computeRandomPoint(seconds, st.simMouseSpeed)
            onSimClick(p.x, p.y)
          } else if (st.simMode === 'spiral') {
            const p = computeSpiralPoint(seconds, st.simMouseSpeed, st.simMouseRadius)
            onSimClick(p.x, p.y)
          }
        }
      }

      frameId = requestAnimationFrame(loop)
    }
    
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [simActive, simClicksOn, simMouseOn, simMode])

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
