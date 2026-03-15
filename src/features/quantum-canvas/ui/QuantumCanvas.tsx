import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

import vertexShader from '../lib/shaders/quantum.vert'
import fragmentShader from '../lib/shaders/quantum.frag'
import type { ShaderTuning } from './DevPanel'

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
  onEnergyChange: (energy: number) => void
}

function ShaderPlane({ onRip, tuning, onEnergyChange }: ShaderPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { size } = useThree()

  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  const prevMouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  const energyRef = useRef(0)
  const hasRippedRef = useRef(false)
  const ripFlashRef = useRef(0)
  const catalystsRef = useRef<Catalyst[]>([])
  const tuningRef = useRef(tuning)
  tuningRef.current = tuning

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uEnergy: { value: 0 },
      uRipFlash: { value: 0 },
      uCatalysts: { value: Array.from({ length: MAX_CATALYSTS }, () => new THREE.Vector2(0, 0)) },
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
      uHeatIntensity: { value: tuning.heatIntensity },
      uInterferenceBlend: { value: tuning.interferenceBlend },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.uv) {
        prevMouseRef.current.copy(mouseRef.current)
        mouseRef.current.set(e.uv.x, e.uv.y)
      }
    },
    []
  )

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      energyRef.current += tuningRef.current.clickSpike

      const maxW = Math.floor(tuningRef.current.maxWaves)
      if (e.uv) {
        const cats = catalystsRef.current
        cats.push({ x: e.uv.x, y: e.uv.y, time: -1 })
        if (cats.length > maxW) cats.shift()
      }
    },
    []
  )

  const onPointerLeave = useCallback(() => {
    prevMouseRef.current.copy(mouseRef.current)
  }, [])

  useFrame((state, delta) => {
    const mat = meshRef.current?.material as THREE.ShaderMaterial | undefined
    if (!mat) return

    const now = state.clock.elapsedTime
    const t = tuningRef.current

    for (const cat of catalystsRef.current) {
      if (cat.time < 0) cat.time = now
    }
    catalystsRef.current = catalystsRef.current.filter(c => (now - c.time) < t.waveLifetime)

    const velocity = mouseRef.current.distanceTo(prevMouseRef.current)
    prevMouseRef.current.copy(mouseRef.current)

    energyRef.current += velocity * t.velocityMult
    energyRef.current -= t.energyDecay * delta
    energyRef.current = Math.max(0, energyRef.current)

    // Report energy to dev panel
    onEnergyChange(energyRef.current)

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
    const cats = catalystsRef.current
    const catPositions = mat.uniforms.uCatalysts.value as THREE.Vector2[]
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
    mat.uniforms.uEnergy.value = energyRef.current
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
    mat.uniforms.uHeatIntensity.value = t.heatIntensity
    mat.uniforms.uInterferenceBlend.value = t.interferenceBlend
  })

  return (
    <mesh
      ref={meshRef}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerLeave={onPointerLeave}
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
  onEnergyChange: (energy: number) => void
}

export function QuantumCanvas({ onRip, tuning, onEnergyChange }: QuantumCanvasProps) {
  return (
    <Canvas
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 1] }}
      dpr={[1, 1.5]}
      style={{ background: '#000000', cursor: 'none' }}
    >
      <ShaderPlane onRip={onRip} tuning={tuning} onEnergyChange={onEnergyChange} />
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}
