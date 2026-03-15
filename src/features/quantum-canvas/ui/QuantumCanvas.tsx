import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

import vertexShader from '../lib/shaders/quantum.vert'
import fragmentShader from '../lib/shaders/quantum.frag'

/* ─── Constants ─── */
const ENERGY_DECAY_RATE = 8.0
const VELOCITY_ENERGY_MULT = 40.0
const CLICK_ENERGY_SPIKE = 25.0
const RIP_THRESHOLD = 100.0

/* ─── Shader Plane ─── */

interface ShaderPlaneProps {
  onRip: () => void
}

function ShaderPlane({ onRip }: ShaderPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { size } = useThree()

  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  const prevMouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  const energyRef = useRef(0)
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

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.uv) {
        prevMouseRef.current.copy(mouseRef.current)
        mouseRef.current.set(e.uv.x, e.uv.y)
      }
    },
    []
  )

  const onPointerDown = useCallback(() => {
    energyRef.current += CLICK_ENERGY_SPIKE
  }, [])

  const onPointerLeave = useCallback(() => {
    prevMouseRef.current.copy(mouseRef.current)
  }, [])

  useFrame((state, delta) => {
    const mat = meshRef.current?.material as THREE.ShaderMaterial | undefined
    if (!mat) return

    const velocity = mouseRef.current.distanceTo(prevMouseRef.current)
    prevMouseRef.current.copy(mouseRef.current)

    energyRef.current += velocity * VELOCITY_ENERGY_MULT
    energyRef.current -= ENERGY_DECAY_RATE * delta
    energyRef.current = Math.max(0, energyRef.current)

    if (energyRef.current >= RIP_THRESHOLD && !hasRippedRef.current) {
      hasRippedRef.current = true
      ripFlashRef.current = 1.0
      onRip()
    }

    if (ripFlashRef.current > 0) {
      ripFlashRef.current -= delta * 2.0
      if (ripFlashRef.current < 0) ripFlashRef.current = 0
    }

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
  onRip: () => void
}

export function QuantumCanvas({ onRip }: QuantumCanvasProps) {
  return (
    <Canvas
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 1] }}
      dpr={[1, 1.5]}
      style={{ background: '#000000', cursor: 'crosshair' }}
    >
      <ShaderPlane onRip={onRip} />
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
