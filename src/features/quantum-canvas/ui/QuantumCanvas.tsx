import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

import vertexShader from '../lib/shaders/quantum.vert'
import fragmentShader from '../lib/shaders/quantum.frag'

/* ─── Interaction State Refs (shared) ─── */

export interface SandboxCallbacks {
  onFirstHover: () => void
  onFirstRelease: () => void
}

interface ShaderPlaneProps {
  callbacks: SandboxCallbacks
}

function ShaderPlane({ callbacks }: ShaderPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { size } = useThree()

  // Interaction refs — no React re-renders, just refs for useFrame
  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5))
  const hoverRef = useRef(0)     // 0→1 smooth
  const releaseAnimRef = useRef(0)
  const releaseOriginRef = useRef(new THREE.Vector2(0.5, 0.5))
  const isPressedRef = useRef(false)
  const releaseActiveRef = useRef(false)
  const hasHoveredRef = useRef(false)
  const hasReleasedRef = useRef(false)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uHoverStrength: { value: 0 },
      uPressStrength: { value: 0 },
      uReleaseAnim: { value: 0 },
      uReleaseOrigin: { value: new THREE.Vector2(0.5, 0.5) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Pointer handlers
  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // Convert R3F coordinates to 0..1 UV space
      const { uv } = e
      if (uv) {
        mouseRef.current.set(uv.x, uv.y)
      }
      hoverRef.current = 1.0

      // Fire first-hover callback once
      if (!hasHoveredRef.current) {
        hasHoveredRef.current = true
        callbacks.onFirstHover()
      }
    },
    [callbacks]
  )

  const onPointerDown = useCallback(() => {
    isPressedRef.current = true
    releaseActiveRef.current = false
    releaseAnimRef.current = 0
  }, [])

  const onPointerUp = useCallback(() => {
    if (isPressedRef.current) {
      isPressedRef.current = false
      releaseActiveRef.current = true
      releaseAnimRef.current = 0
      releaseOriginRef.current.copy(mouseRef.current)

      // Fire first-release callback once
      if (!hasReleasedRef.current) {
        hasReleasedRef.current = true
        callbacks.onFirstRelease()
      }
    }
  }, [callbacks])

  const onPointerLeave = useCallback(() => {
    hoverRef.current = 0
    if (isPressedRef.current) {
      isPressedRef.current = false
    }
  }, [])

  useFrame((state, delta) => {
    const mat = meshRef.current?.material as THREE.ShaderMaterial | undefined
    if (!mat) return

    // Smooth interpolation of interaction states
    const lerpSpeed = 4.0 * delta

    // Hover strength — smoothly ramp up/down
    const targetHover = hoverRef.current
    mat.uniforms.uHoverStrength.value += (targetHover - mat.uniforms.uHoverStrength.value) * lerpSpeed * 2

    // Press strength — smoothly ramp up/down
    const targetPress = isPressedRef.current ? 1.0 : 0.0
    mat.uniforms.uPressStrength.value += (targetPress - mat.uniforms.uPressStrength.value) * lerpSpeed * 3

    // Release animation — drives from 0→1 over ~1.5 seconds
    if (releaseActiveRef.current) {
      releaseAnimRef.current += delta * 0.7
      if (releaseAnimRef.current >= 1.0) {
        releaseAnimRef.current = 1.0
        releaseActiveRef.current = false
      }
    } else if (releaseAnimRef.current > 0 && !releaseActiveRef.current) {
      // Fade out after animation completes
      releaseAnimRef.current -= delta * 0.5
      if (releaseAnimRef.current < 0) releaseAnimRef.current = 0
    }

    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uMouse.value.copy(mouseRef.current)
    mat.uniforms.uReleaseAnim.value = releaseAnimRef.current
    mat.uniforms.uReleaseOrigin.value.copy(releaseOriginRef.current)
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
      onPointerUp={onPointerUp}
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

/* ─── Public Canvas Wrapper ─── */

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
      eventSource={undefined}
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
