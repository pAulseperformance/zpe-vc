/**
 * useHandTracker — React hook for camera hand tracking.
 *
 * Manages HandTracker lifecycle and GestureMapper output.
 * Returns hand state + toggle + video ref.
 */
import { useRef, useState, useCallback, useEffect } from 'react'
import { HandTracker } from '../lib/hand-tracker'
import { GestureMapper, DEFAULT_HAND_MAPPING } from '../lib/gesture-map'
import type { HandState, HandMappingConfig, HandTarget } from '../lib/gesture-map'

const EMPTY: HandState = {
  x: 0.5, y: 0.5, z: 0.5,
  pinching: false, confidence: 0, detected: false,
}

export function useHandTracker() {
  const trackerRef = useRef<HandTracker | null>(null)
  const mapperRef = useRef(new GestureMapper())
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stateRef = useRef<HandState>(EMPTY)

  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [handState, setHandState] = useState<HandState>(EMPTY)

  // Create video element on first use
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
      // Stop
      trackerRef.current?.stop()
      if (videoRef.current) {
        videoRef.current.remove()
        videoRef.current = null
      }
      stateRef.current = EMPTY
      setHandState(EMPTY)
      setActive(false)
      return
    }

    // Start
    setLoading(true)
    try {
      if (!trackerRef.current) {
        trackerRef.current = new HandTracker()
      }
      const video = getVideo()

      // Throttle React state updates to ~20fps to avoid excessive renders
      let lastUpdate = 0
      await trackerRef.current.start(video, (landmarks) => {
        const state = mapperRef.current.process(landmarks)
        stateRef.current = state
        const now = performance.now()
        if (now - lastUpdate > 50) { // ~20fps UI updates
          setHandState({ ...state })
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

  // Cleanup on unmount
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
    setMapping, setSmoothing, setPinchThreshold,
    getConfig, getTargetValue,
  }
}

export { DEFAULT_HAND_MAPPING }
export type { HandState, HandMappingConfig, HandTarget }
