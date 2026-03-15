import { useState, useEffect } from 'react'
import type { ShaderTuning } from './shader-tuning'
import { DEFAULT_TUNING } from './shader-tuning'

const STORAGE_KEY = 'zpe-shader-presets-v2'
const ACTIVE_KEY = 'zpe-shader-active-v2'

export type PresetMap = Record<string, ShaderTuning>

function loadPresets(): PresetMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PresetMap) : {}
  } catch {
    return {}
  }
}

function savePresets(presets: PresetMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
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

  return { presets, names, save, load, remove }
}
