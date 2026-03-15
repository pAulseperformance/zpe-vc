import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

import vertexShader from '../lib/shaders/quantum.vert'
import fragmentShader from '../lib/shaders/quantum.frag'

/* ─── Callback types ─── */

export interface SandboxCallbacks {
  onFirstHover: () => void
  onRip: () => void
}

/* ─── Constants ─── */
const ENERGY_DECAY_RATE = 8.0       // Energy lost per second (idle decay)
const VELOCITY_ENERGY_MULT = 40.0   // Energy gained per unit of mouse velocity
const CLICK_ENERGY_SPIKE = 25.0     // Energy added per click
const RIP_THRESHOLD = 100.0         // Energy level that triggers the Rip

/* ─── Shader Plane ─── */

interface ShaderPlaneProps {
  callbacks: SandboxCallbacks
}

function ShaderPlane({ callbacks }: ShaderPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { size } = useThree()

  // Interaction state — all refs, zero re-renders
  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  const prevMouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  const energyRef = useRef(0)
  const hasHoveredRef = useRef(false)
  const hasRippedRef = useRef(false)
  const ripFlashRef = useRef(0)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uEnergy: { value: 0 },
      uRipFlash: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ── Pointer handlers ──
  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.uv) {
        prevMouseRef.current.copy(mouseRef.current)
        mouseRef.current.set(e.uv.x, e.uv.y)
      }
      if (!hasHoveredRef.current) {
        hasHoveredRef.current = true
        callbacks.onFirstHover()
      }
    },
    [callbacks]
  )

  const onPointerDown = useCallback(() => {
    // Massive energy spike on click
    energyRef.current += CLICK_ENERGY_SPIKE
  }, [])

  const onPointerLeave = useCallback(() => {
    prevMouseRef.current.copy(mouseRef.current)
  }, [])

  // ── Frame loop ──
  useFrame((state, delta) => {
    const mat = meshRef.current?.material as THREE.ShaderMaterial | undefined
    if (!mat) return

    // Calculate mouse velocity (distance moved this frame)
    const velocity = mouseRef.current.distanceTo(prevMouseRef.current)
    prevMouseRef.current.copy(mouseRef.current)

    // Add velocity-based energy
    energyRef.current += velocity * VELOCITY_ENERGY_MULT

    // Constant decay toward 0
    energyRef.current -= ENERGY_DECAY_RATE * delta
    energyRef.current = Math.max(0, energyRef.current)

    // Check Rip threshold
    if (energyRef.current >= RIP_THRESHOLD && !hasRippedRef.current) {
      hasRippedRef.current = true
      ripFlashRef.current = 1.0
      callbacks.onRip()
    }

    // Decay rip flash
    if (ripFlashRef.current > 0) {
      ripFlashRef.current -= delta * 2.0 // Fast decay ~0.5s
      if (ripFlashRef.current < 0) ripFlashRef.current = 0
    }

    // Push uniforms
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uMouse.value.copy(mouseRef.current)
    mat.uniforms.uEnergy.value = energyRef.current
    mat.uniforms.uRipFlash.value = ripFlashRef.current
    mat.uniforms.uResolution.value.set(
      state.size.width * state.viewport.dpr,
      state.size.height * state.viewport.dpr
    )
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
  callbacks: SandboxCallbacks
}

export function QuantumCanvas({ callbacks }: QuantumCanvasProps) {
  return (
    <Canvas
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 1] }}
      dpr={[1, 1.5]}
      style={{ background: '#000000', cursor: 'crosshair' }}
    >
      <ShaderPlane callbacks={callbacks} />
      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.12}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}
