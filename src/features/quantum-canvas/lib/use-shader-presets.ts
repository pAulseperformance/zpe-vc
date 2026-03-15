import { useState, useEffect } from 'react'
import type { ShaderTuning } from './shader-tuning'
import { BUILT_IN_PRESETS, DEFAULT_TUNING } from './shader-tuning'

const STORAGE_KEY = 'zpe-shader-presets-v2'
const ACTIVE_KEY = 'zpe-shader-active-v2'
const THUMBNAIL_KEY = 'zpe-shader-thumbnails-v1'

export type PresetMap = Record<string, ShaderTuning>
export type ThumbnailMap = Record<string, string>

function loadPresets(): PresetMap {
  const presets: PresetMap = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      for (const [k, v] of Object.entries(parsed)) {
        if (!BUILT_IN_PRESETS[k]) {
          presets[k] = v as ShaderTuning
        }
      }
    }
  } catch {}
  
  // Always enforce built-in presets over user overrides
  for (const [k, v] of Object.entries(BUILT_IN_PRESETS)) {
    presets[k] = { ...v }
  }
  return presets
}

function savePresets(presets: PresetMap) {
  // Only save user presets to localStorage, strip built-ins
  const userPresets = { ...presets }
  for (const k of Object.keys(BUILT_IN_PRESETS)) {
    delete userPresets[k]
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets))
}

function loadActive(): ShaderTuning | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    return raw ? (JSON.parse(raw) as ShaderTuning) : null
  } catch {
    return null
  }
}

function saveActive(tuning: ShaderTuning) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(tuning))
}

/** Persist active tuning across page refresh */
export function usePersistedTuning() {
  const [tuning, setTuning] = useState<ShaderTuning>(
    () => ({ ...DEFAULT_TUNING, ...(loadActive() ?? {}) })
  )

  useEffect(() => {
    saveActive(tuning)
  }, [tuning])

  return [tuning, setTuning] as const
}

/** Manage named presets (save/load/delete from localStorage) */
export function useShaderPresets() {
  const [presets, setPresets] = useState<PresetMap>(loadPresets)

  const save = (name: string, tuning: ShaderTuning) => {
    const updated = { ...presets, [name]: { ...tuning } }
    setPresets(updated)
    savePresets(updated)
  }

  const load = (name: string): ShaderTuning | undefined => presets[name]

  const remove = (name: string) => {
    const updated = { ...presets }
    delete updated[name]
    setPresets(updated)
    savePresets(updated)
  }

  const names = Object.keys(presets)

  // ── Thumbnails ──
  const [thumbnails, setThumbnails] = useState<ThumbnailMap>(() => {
    try {
      const raw = localStorage.getItem(THUMBNAIL_KEY)
      return raw ? JSON.parse(raw) as ThumbnailMap : {}
    } catch { return {} }
  })

  const saveThumbnail = (name: string, dataUrl: string) => {
    const updated = { ...thumbnails, [name]: dataUrl }
    setThumbnails(updated)
    localStorage.setItem(THUMBNAIL_KEY, JSON.stringify(updated))
  }

  const getThumbnail = (name: string): string | undefined => thumbnails[name]

  return { presets, names, save, load, remove, thumbnails, saveThumbnail, getThumbnail }
}
