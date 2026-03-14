import { useScroll, useTransform, type MotionValue } from 'framer-motion'
import type { RefObject } from 'react'

/**
 * Returns a normalized [0, 1] scroll progress for a scroll container.
 * Drives the GLSL uniform transitions.
 */
export function useScrollProgress(
  containerRef: RefObject<HTMLElement | null>
): MotionValue<number> {
  const { scrollYProgress } = useScroll({ container: containerRef })
  return useTransform(scrollYProgress, [0, 1], [0, 1])
}
