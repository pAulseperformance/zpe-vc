import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { type MotionValue, useMotionValueEvent } from 'framer-motion'
import * as THREE from 'three'

import vertexShader from '../lib/shaders/quantum.vert'
import fragmentShader from '../lib/shaders/quantum.frag'

/* ─── Shader Plane (internal) ─── */

interface ShaderPlaneProps {
  progress: MotionValue<number>
}

function ShaderPlane({ progress }: ShaderPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const progressRef = useRef(0)
  const { size } = useThree()

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Sync Framer Motion value → ref (no re-renders)
  useMotionValueEvent(progress, 'change', (v) => {
    progressRef.current = v
  })

  useFrame((state) => {
    const material = meshRef.current?.material as THREE.ShaderMaterial | undefined
    if (!material) return

    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uProgress.value = progressRef.current
    material.uniforms.uResolution.value.set(
      state.size.width * state.viewport.dpr,
      state.size.height * state.viewport.dpr
    )
  })

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}

/* ─── Public Canvas Wrapper ─── */

interface QuantumCanvasProps {
  progress: MotionValue<number>
}

export function QuantumCanvas({ progress }: QuantumCanvasProps) {
  return (
    <Canvas
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 1] }}
      dpr={[1, 1.5]}
      style={{ background: '#050507' }}
    >
      <ShaderPlane progress={progress} />
    </Canvas>
  )
}
