import { useRef, useMemo, useCallback, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Vector2 } from 'three'
import type { Mesh, ShaderMaterial } from 'three'

import vertexShader from '../lib/shaders/quantum.vert'
import fragmentShader from '../lib/shaders/quantum.frag'
import type { ShaderTuning } from '../lib/shader-tuning'
import { computeInterferenceRatio } from '../lib/compute-interference'

/* ─── Constants ─── */
const MAX_CATALYSTS = 100

/* ─── Catalyst Type ─── */
interface Catalyst {
  x: number
  y: number
  time: number
}

/* ─── Shader Plane ─── */

interface ShaderPlaneProps {
  onRip: () => void
  tuning: ShaderTuning
  performanceMode: boolean
  onEnergyChange: (energy: number, interferenceRatio: number, mouseX: number, mouseY: number) => void
  onPerfSample?: (frameMs: number) => void
  energyOverride: number | null
  simClickQueue: MutableRefObject<Array<{x: number, y: number}>>
  simMouseActive: boolean
  simMousePos: MutableRefObject<{x: number, y: number}>
  gravBodyPositions: MutableRefObject<{click: {x: number, y: number}, mouse: {x: number, y: number}} | null>
  onZoomChange: (delta: number) => void
  onManualClick?: (x: number, y: number) => void
  onManualRelease?: () => void
  onManualDrag?: (x: number, y: number) => void
  audioBands?: MutableRefObject<{bass: number, mid: number, treble: number}>
  handTrackingActive?: boolean
  handTrackingPos?: MutableRefObject<{x: number, y: number, detected: boolean}>
}

function ShaderPlane({ onRip, tuning, performanceMode, onEnergyChange, onPerfSample, energyOverride, simClickQueue, simMouseActive, simMousePos, gravBodyPositions, onZoomChange, onManualClick, onManualRelease, onManualDrag, audioBands, handTrackingActive, handTrackingPos }: ShaderPlaneProps) {
  const meshRef = useRef<Mesh>(null)
  const { size } = useThree()

  const mouseRef = useRef(new Vector2(0.5, 0.5))
  const prevMouseRef = useRef(new Vector2(0.5, 0.5))
  const velocityVecRef = useRef(new Vector2(0, 0))
  const energyRef = useRef(0)
  const hasRippedRef = useRef(false)
  const heatFieldRef = useRef(0)
  const ripFlashRef = useRef(0)
  const isDownRef = useRef(false)
  const catalystsRef = useRef<Catalyst[]>([])
  const tuningRef = useRef(tuning)
  tuningRef.current = tuning
  const adaptiveZoomRef = useRef(1.0) // Smoothed adaptive zoom value
  const perfEmaMsRef = useRef(16)
  const perfSampleElapsedRef = useRef(0)
  const interferenceRef = useRef({ value: 1, elapsed: 0 })
  const perfModeRef = useRef(performanceMode)
  const zoomSampleElapsedRef = useRef(0)
  const zoomTargetRef = useRef(1.0)
  perfModeRef.current = performanceMode

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new Vector2(size.width, size.height) },
      uMouse: { value: new Vector2(0.5, 0.5) },
      uEnergy: { value: 0 },
      uRipFlash: { value: 0 },
      uCatalysts: { value: Array.from({ length: MAX_CATALYSTS }, () => new Vector2(0, 0)) },
      uCatalystTimes: { value: new Float32Array(MAX_CATALYSTS) },
      uCatalystCount: { value: 0 },
      // Tunable uniforms
      uWaveSpeed: { value: tuning.waveSpeed },
      uWaveFreq: { value: tuning.waveFreq },
      uWaveWidth: { value: tuning.waveWidth },
      uEmDamping: { value: tuning.emDamping },
      uGravDamping: { value: tuning.gravDamping },
      uLenzStrength: { value: tuning.lenzStrength },
      uLenzWake: { value: tuning.lenzWake },
      uHoverRadius: { value: tuning.hoverRadius },
      uWaveLifetime: { value: tuning.waveLifetime },
      uParallaxDepth: { value: tuning.parallaxDepth },
      uHeatDecay: { value: tuning.heatDecay },
      uHeatAttack: { value: tuning.heatAttack },
      uHeatIntensity: { value: tuning.heatIntensity },
      uInterferenceBlend: { value: tuning.interferenceBlend },
      uHeatField: { value: 0 },
      uIridescence: { value: tuning.iridescence ?? 0.5 },
      uPaletteMode: { value: tuning.paletteMode ?? 1 },
      uStarField: { value: tuning.starField ?? 0 },
      uWavelength: { value: tuning.wavelength ?? 2 },
      uMouseVelocity: { value: new Vector2(0, 0) },
      // Barrier / Diffraction
      uBarrierEnabled: { value: tuning.barrierEnabled ?? 0 },
      uBarrierY: { value: tuning.barrierY ?? 0.5 },
      uSlitCount: { value: tuning.slitCount ?? 2 },
      uSlitWidth: { value: tuning.slitWidth ?? 0.04 },
      uSlitSeparation: { value: tuning.slitSeparation ?? 0.15 },
      uDiffSamples: { value: tuning.diffSamples ?? 12 },
      uPointerHover: { value: (tuning.pointerHover ?? false) ? 1.0 : 0.0 },
      uHoverWarp: { value: tuning.hoverWarp ?? 0.1 },
      uSpinSpeed: { value: tuning.spinSpeed ?? 1.0 },
      uViewScale: { value: tuning.viewScale ?? 1.0 },
      // Audio-reactive FFT bands
      uAudioBass: { value: 0 },
      uAudioMid: { value: 0 },
      uAudioTreble: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.uv) {
        prevMouseRef.current.copy(mouseRef.current)
        mouseRef.current.set(e.uv.x, e.uv.y)
        if (isDownRef.current) onManualDrag?.(e.uv.x, e.uv.y)
      }
    },
    [onManualDrag]
  )

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      isDownRef.current = true
      energyRef.current += tuningRef.current.clickSpike

      const maxW = Math.floor(tuningRef.current.maxWaves)
      if (e.uv) {
        const cats = catalystsRef.current
        cats.push({ x: e.uv.x, y: e.uv.y, time: -1 })
        if (cats.length > maxW) cats.shift()
        onManualClick?.(e.uv.x, e.uv.y)
      }
    },
    [onManualClick]
  )

  const onPointerUp = useCallback(
    () => {
      isDownRef.current = false
      onManualRelease?.()
    },
    [onManualRelease]
  )

  const onPointerLeave = useCallback(() => {
    prevMouseRef.current.copy(mouseRef.current)
    isDownRef.current = false
    onManualRelease?.()
  }, [onManualRelease])

  const onWheel = useCallback(
    (e: ThreeEvent<WheelEvent>) => {
      const delta = e.deltaY * 0.002
      onZoomChange(delta)
    },
    [onZoomChange]
  )

  useFrame((state, delta) => {
    const mat = meshRef.current?.material as ShaderMaterial | undefined
    if (!mat) return

    const now = state.clock.elapsedTime
    const t = tuningRef.current

    const catsMutable = catalystsRef.current
    let writeIdx = 0
    for (let i = 0; i < catsMutable.length; i++) {
      const cat = catsMutable[i]
      if (cat.time < 0) cat.time = now
      if ((now - cat.time) < t.waveLifetime) {
        catsMutable[writeIdx] = cat
        writeIdx += 1
      }
    }
    if (catsMutable.length !== writeIdx) {
      catsMutable.length = writeIdx
    }

    // Override mouse position with sim mouse when active
    if (simMouseActive) {
      mouseRef.current.set(simMousePos.current.x, simMousePos.current.y)
    }

    // Override mouse position with hand tracking when active
    if (handTrackingActive && handTrackingPos?.current.detected) {
      mouseRef.current.set(handTrackingPos.current.x, handTrackingPos.current.y)
    }

    // Drain sim click queue (injected from DevPanel auto-sim)
    const maxW = Math.floor(t.maxWaves)
    const simClicks = simClickQueue.current
    for (let i = 0; i < simClicks.length; i++) {
      const click = simClicks[i]
      catalystsRef.current.push({ x: click.x, y: click.y, time: -1 })
      energyRef.current += t.clickSpike
      if (catalystsRef.current.length > maxW) catalystsRef.current.shift()
    }
    if (simClicks.length > 0) {
      simClicks.length = 0
    }

    const velocity = mouseRef.current.distanceTo(prevMouseRef.current)
    const velocityVec = velocityVecRef.current
    velocityVec.copy(mouseRef.current).sub(prevMouseRef.current)
    prevMouseRef.current.copy(mouseRef.current)

    // Energy input from movement
    energyRef.current += velocity * t.velocityMult

    // Momentum decay (linear — so rapid clicking CAN reach rip threshold)
    energyRef.current -= t.energyDecay * delta
    energyRef.current = Math.max(0, energyRef.current)

    // Energy override: pin at fixed value when locked
    const effectiveEnergy = energyOverride !== null ? energyOverride : energyRef.current

    // Phase 2: Persistent heat field — accumulates from active catalysts, decays independently
    const cats = catalystsRef.current
    for (let i = 0; i < cats.length; i++) {
      const cat = cats[i]
      const age = state.clock.elapsedTime - cat.time
      if (age > 0 && age < t.waveLifetime) {
        heatFieldRef.current += Math.max(0, 1 - age / t.waveLifetime) * delta * 2
      }
    }
    heatFieldRef.current *= Math.pow(0.97, delta * 60) // Slow independent decay
    heatFieldRef.current = Math.min(heatFieldRef.current, 3.0) // Cap to prevent runaway

    perfEmaMsRef.current = perfEmaMsRef.current * 0.92 + delta * 1000 * 0.08
    perfSampleElapsedRef.current += delta
    if (perfSampleElapsedRef.current >= 0.5) {
      onPerfSample?.(perfEmaMsRef.current)
      perfSampleElapsedRef.current = 0
    }

    // Sample interference at a reduced rate in performance mode.
    interferenceRef.current.elapsed += delta
    const interferenceHz = perfModeRef.current ? 12 : 30
    if (interferenceRef.current.elapsed >= 1 / interferenceHz) {
      interferenceRef.current.value = computeInterferenceRatio(
        cats,
        mouseRef.current.x,
        mouseRef.current.y,
        now,
        t.waveFreq,
        t.waveLifetime,
      )
      interferenceRef.current.elapsed = 0
    }

    // Report energy + interference to parent
    onEnergyChange(effectiveEnergy, interferenceRef.current.value, mouseRef.current.x, mouseRef.current.y)

    if (energyRef.current >= t.ripThreshold && !hasRippedRef.current) {
      hasRippedRef.current = true
      ripFlashRef.current = 1.0
      onRip()
    }

    if (ripFlashRef.current > 0) {
      ripFlashRef.current -= delta * 2.0
      if (ripFlashRef.current < 0) ripFlashRef.current = 0
    }

    // Catalyst uniforms
    const catPositions = mat.uniforms.uCatalysts.value as Vector2[]
    const catTimes = mat.uniforms.uCatalystTimes.value as Float32Array

    for (let i = 0; i < MAX_CATALYSTS; i++) {
      if (i < cats.length) {
        catPositions[i].set(cats[i].x, cats[i].y)
        catTimes[i] = cats[i].time
      } else {
        catPositions[i].set(0, 0)
        catTimes[i] = 0
      }
    }
    mat.uniforms.uCatalystCount.value = cats.length

    // Core uniforms
    mat.uniforms.uTime.value = now
    mat.uniforms.uMouse.value.copy(mouseRef.current)
    mat.uniforms.uEnergy.value = effectiveEnergy
    mat.uniforms.uRipFlash.value = ripFlashRef.current
    mat.uniforms.uResolution.value.set(
      state.size.width * state.viewport.dpr,
      state.size.height * state.viewport.dpr
    )

    // Tunable uniforms — live update from sliders
    mat.uniforms.uWaveSpeed.value = t.waveSpeed
    mat.uniforms.uWaveFreq.value = t.waveFreq
    mat.uniforms.uWaveWidth.value = t.waveWidth
    mat.uniforms.uEmDamping.value = t.emDamping
    mat.uniforms.uGravDamping.value = t.gravDamping
    mat.uniforms.uLenzStrength.value = t.lenzStrength
    mat.uniforms.uLenzWake.value = t.lenzWake
    mat.uniforms.uHoverRadius.value = t.hoverRadius
    mat.uniforms.uWaveLifetime.value = t.waveLifetime
    mat.uniforms.uParallaxDepth.value = t.parallaxDepth
    mat.uniforms.uHeatDecay.value = t.heatDecay
    mat.uniforms.uHeatAttack.value = t.heatAttack
    mat.uniforms.uHeatIntensity.value = t.heatIntensity
    mat.uniforms.uInterferenceBlend.value = t.interferenceBlend
    mat.uniforms.uHeatField.value = heatFieldRef.current
    mat.uniforms.uIridescence.value = t.iridescence ?? 0.5
    mat.uniforms.uPaletteMode.value = t.paletteMode ?? 1
    mat.uniforms.uStarField.value = t.starField ?? 0
    mat.uniforms.uWavelength.value = t.wavelength ?? 2
    mat.uniforms.uMouseVelocity.value.copy(velocityVec)
    // Barrier / Diffraction
    mat.uniforms.uBarrierEnabled.value = t.barrierEnabled ?? 0
    mat.uniforms.uBarrierY.value = t.barrierY ?? 0.5
    mat.uniforms.uSlitCount.value = t.slitCount ?? 2
    mat.uniforms.uSlitWidth.value = t.slitWidth ?? 0.04
    mat.uniforms.uSlitSeparation.value = t.slitSeparation ?? 0.15
    mat.uniforms.uDiffSamples.value = perfModeRef.current ? Math.min(4, t.diffSamples ?? 12) : (t.diffSamples ?? 12)
    mat.uniforms.uPointerHover.value = (t.pointerHover ?? false) ? 1.0 : 0.0
    mat.uniforms.uHoverWarp.value = t.hoverWarp ?? 0.1
    mat.uniforms.uSpinSpeed.value = t.spinSpeed ?? 1.0
    mat.uniforms.uViewScale.value = t.viewScale ?? 1.0

    // ── Audio-Reactive FFT Modulation ──
    // Bass → heat pulse + wider waves | Mid → interference shimmer + iridescence | Treble → starfield + spin
    if (audioBands?.current) {
      const b = audioBands.current
      mat.uniforms.uHeatIntensity.value *= (1.0 + b.bass * 2.0)
      mat.uniforms.uWaveWidth.value *= (1.0 + b.bass * 0.5)
      mat.uniforms.uInterferenceBlend.value *= (1.0 + b.mid * 1.5)
      mat.uniforms.uIridescence.value *= (1.0 + b.mid * 0.8)
      mat.uniforms.uStarField.value = Math.max(mat.uniforms.uStarField.value, b.treble * 0.5)
      mat.uniforms.uSpinSpeed.value *= (1.0 + b.treble * 0.5)
    }

    // ── Adaptive Zoom ──
    let targetScale = t.viewScale ?? 1.0
    if (!perfModeRef.current && (t.zoomMode ?? 0) >= 1) {
      zoomSampleElapsedRef.current += delta
      if (zoomSampleElapsedRef.current >= 1 / 15) {
        // Compute bounding box of all active catalysts + gravity bodies
        let minX = 0.5, maxX = 0.5, minY = 0.5, maxY = 0.5
        for (const cat of cats) {
          minX = Math.min(minX, cat.x)
          maxX = Math.max(maxX, cat.x)
          minY = Math.min(minY, cat.y)
          maxY = Math.max(maxY, cat.y)
        }
        // Include gravity body positions if available
        const grav = gravBodyPositions.current
        if (grav) {
          minX = Math.min(minX, grav.click.x, grav.mouse.x)
          maxX = Math.max(maxX, grav.click.x, grav.mouse.x)
          minY = Math.min(minY, grav.click.y, grav.mouse.y)
          maxY = Math.max(maxY, grav.click.y, grav.mouse.y)
        }
        // Scale so the bounding box fits within 60% of the viewport
        const spanX = maxX - minX
        const spanY = maxY - minY
        const maxSpan = Math.max(spanX, spanY)
        const requiredScale = Math.max(1.0, maxSpan / 0.6)
        zoomTargetRef.current = Math.max(targetScale, requiredScale)
        zoomSampleElapsedRef.current = 0
      }
      targetScale = zoomTargetRef.current
    }
    // Smooth lerp toward target zoom (prevents jarring jumps)
    adaptiveZoomRef.current += (targetScale - adaptiveZoomRef.current) * Math.min(1.0, delta * 3.0)
    mat.uniforms.uViewScale.value = adaptiveZoomRef.current
  })

  return (
    <mesh
      ref={meshRef}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/* ─── Public Canvas ─── */

interface QuantumCanvasProps {
  onRip: () => void
  tuning: ShaderTuning
  performanceMode?: boolean
  onEnergyChange: (energy: number, interferenceRatio: number, mouseX: number, mouseY: number) => void
  energyOverride: number | null
  simClickQueue: MutableRefObject<Array<{x: number, y: number}>>
  simMouseActive: boolean
  simMousePos: MutableRefObject<{x: number, y: number}>
  gravBodyPositions: MutableRefObject<{click: {x: number, y: number}, mouse: {x: number, y: number}} | null>
  onZoomChange: (delta: number) => void
  onManualClick?: (x: number, y: number) => void
  onManualRelease?: () => void
  onManualDrag?: (x: number, y: number) => void
  onCanvasReady?: (canvas: HTMLCanvasElement) => void
  audioBands?: MutableRefObject<{bass: number, mid: number, treble: number}>
  handTrackingActive?: boolean
  handTrackingPos?: MutableRefObject<{x: number, y: number, detected: boolean}>
}

export function QuantumCanvas({ onRip, tuning, performanceMode = false, onEnergyChange, energyOverride, simClickQueue, simMouseActive, simMousePos, gravBodyPositions, onZoomChange, onManualClick, onManualRelease, onManualDrag, onCanvasReady, audioBands, handTrackingActive, handTrackingPos }: QuantumCanvasProps) {
  const [dprMax, setDprMax] = useState(1.25)
  const [bloomIntensity, setBloomIntensity] = useState(1.5)
  const [bloomEnabled, setBloomEnabled] = useState(true)

  const handlePerfSample = useCallback((frameMs: number) => {
    if (performanceMode) return
    // Coarse quality tiers with hysteresis to avoid frequent toggling.
    if (frameMs > 22) {
      setDprMax((prev) => (prev === 1 ? prev : 1))
      setBloomEnabled((prev) => (prev ? false : prev))
      return
    }
    if (frameMs > 18) {
      setDprMax((prev) => (prev === 1.1 ? prev : 1.1))
      setBloomEnabled((prev) => (prev ? prev : true))
      setBloomIntensity((prev) => (prev === 0.75 ? prev : 0.75))
      return
    }
    if (frameMs < 14) {
      setDprMax((prev) => (prev === 1.25 ? prev : 1.25))
      setBloomEnabled((prev) => (prev ? prev : true))
      setBloomIntensity((prev) => (prev === 1.5 ? prev : 1.5))
    }
  }, [performanceMode])

  const effectiveDprMax = performanceMode ? 1 : dprMax
  const effectiveBloomEnabled = !performanceMode && bloomEnabled
  const effectiveBloomIntensity = performanceMode ? 0 : bloomIntensity

  return (
    <Canvas
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 1] }}
      dpr={[1, effectiveDprMax]}
      style={{ background: '#000000', cursor: 'none' }}
      onCreated={({ gl }) => onCanvasReady?.(gl.domElement)}
    >
      <ShaderPlane onRip={onRip} tuning={tuning} performanceMode={performanceMode} onEnergyChange={onEnergyChange} onPerfSample={handlePerfSample} energyOverride={energyOverride} simClickQueue={simClickQueue} simMouseActive={simMouseActive} simMousePos={simMousePos} gravBodyPositions={gravBodyPositions} onZoomChange={onZoomChange} onManualClick={onManualClick} onManualRelease={onManualRelease} onManualDrag={onManualDrag} audioBands={audioBands} handTrackingActive={handTrackingActive} handTrackingPos={handTrackingPos} />
      {effectiveBloomEnabled && (
        <EffectComposer>
          <Bloom
            intensity={effectiveBloomIntensity}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      )}
    </Canvas>
  )
}

export default QuantumCanvas
