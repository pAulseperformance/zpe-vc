/**
 * useHandTracker — React hook for dual-hand camera tracking.
 *
 * Manages HandTracker lifecycle, dual GestureMapper output,
 * and provides camera preview element.
 */
import { useRef, useState, useCallback, useEffect } from 'react'
import { HandTracker } from '../lib/hand-tracker'
import { GestureMapper, EMPTY_STATE, EMPTY_DUAL } from '../lib/gesture-map'
import type { HandState, DualHandState, HandMappingConfig, HandTarget, Gesture } from '../lib/gesture-map'

export function useHandTracker() {
  const trackerRef = useRef<HandTracker | null>(null)
  const mapperRef = useRef(new GestureMapper())
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stateRef = useRef<HandState>(EMPTY_STATE)
  const dualRef = useRef<DualHandState>(EMPTY_DUAL)

  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [handState, setHandState] = useState<HandState>(EMPTY_STATE)
  const [dualState, setDualState] = useState<DualHandState>(EMPTY_DUAL)

  const getVideo = useCallback((): HTMLVideoElement => {
    if (!videoRef.current) {
      const v = document.createElement('video')
      v.playsInline = true
      v.muted = true
      v.style.cssText = 'position:fixed;bottom:12px;left:12px;width:160px;height:120px;border-radius:8px;border:1px solid rgba(168,85,247,0.3);z-index:100;object-fit:cover;opacity:0.7;pointer-events:none;transform:scaleX(-1);'
      document.body.appendChild(v)
      videoRef.current = v
    }
    return videoRef.current
  }, [])

  const toggle = useCallback(async () => {
    if (active) {
      trackerRef.current?.stop()
      if (videoRef.current) {
        videoRef.current.remove()
        videoRef.current = null
      }
      stateRef.current = EMPTY_STATE
      dualRef.current = EMPTY_DUAL
      setHandState(EMPTY_STATE)
      setDualState(EMPTY_DUAL)
      setActive(false)
      return
    }

    setLoading(true)
    try {
      if (!trackerRef.current) {
        trackerRef.current = new HandTracker()
      }
      const video = getVideo()

      let lastUpdate = 0
      await trackerRef.current.start(video, (result) => {
        const dual = mapperRef.current.processDual(result.left, result.right)
        dualRef.current = dual
        stateRef.current = dual.primary

        const now = performance.now()
        if (now - lastUpdate > 50) {
          setHandState({ ...dual.primary })
          setDualState({ ...dual })
          lastUpdate = now
        }
      })
      setActive(true)
    } catch (err) {
      console.error('Hand tracking failed:', err)
      if (videoRef.current) {
        videoRef.current.remove()
        videoRef.current = null
      }
    }
    setLoading(false)
  }, [active, getVideo])

  const setMapping = useCallback((axis: 'x' | 'y' | 'z', target: HandTarget) => {
    const key = `${axis}Target` as keyof HandMappingConfig
    mapperRef.current.setConfig({ [key]: target })
  }, [])

  const setSmoothing = useCallback((v: number) => {
    mapperRef.current.setConfig({ smoothing: v })
  }, [])

  const setPinchThreshold = useCallback((v: number) => {
    mapperRef.current.setConfig({ pinchThreshold: v })
  }, [])

  const getConfig = useCallback((): HandMappingConfig => {
    return mapperRef.current.getConfig()
  }, [])

  const getTargetValue = useCallback((target: HandTarget): number | null => {
    return mapperRef.current.getTargetValue(target, stateRef.current)
  }, [])

  const getTargetValueForHand = useCallback((target: HandTarget, which: 'left' | 'right'): number | null => {
    const state = which === 'left' ? dualRef.current.left : dualRef.current.right
    return mapperRef.current.getTargetValue(target, state)
  }, [])

  useEffect(() => {
    return () => {
      trackerRef.current?.destroy()
      if (videoRef.current) {
        videoRef.current.remove()
        videoRef.current = null
      }
    }
  }, [])

  return {
    active, loading, toggle,
    handState, stateRef,
    dualState, dualRef,
    setMapping, setSmoothing, setPinchThreshold,
    getConfig, getTargetValue, getTargetValueForHand,
  }
}

export type { HandState, DualHandState, HandMappingConfig, HandTarget, Gesture }
