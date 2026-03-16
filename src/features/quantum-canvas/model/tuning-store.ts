import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { ShaderTuning } from '../lib/shader-tuning'
import { DEFAULT_TUNING, BUILT_IN_PRESETS } from '../lib/shader-tuning'

const ACTIVE_KEY = 'zpe-shader-active-v4'
const PRESETS_KEY = 'zpe-shader-presets-v2'
const THUMBNAIL_KEY = 'zpe-shader-thumbnails-v1'

export type PresetMap = Record<string, ShaderTuning>
export type ThumbnailMap = Record<string, string>

function loadUserPresets(): PresetMap {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PresetMap
      // Strip built-ins — they're always injected fresh
      for (const k of Object.keys(BUILT_IN_PRESETS)) delete parsed[k]
      return parsed
    }
  } catch { /* empty */ }
  return {}
}

function loadThumbnails(): ThumbnailMap {
  try {
    const raw = localStorage.getItem(THUMBNAIL_KEY)
    return raw ? JSON.parse(raw) as ThumbnailMap : {}
  } catch { return {} }
}

interface TuningState {
  // Active tuning
  tuning: ShaderTuning
  setTuning: (tuning: ShaderTuning) => void
  patchTuning: (patch: Partial<ShaderTuning>) => void

  // Named presets
  presets: PresetMap
  presetNames: string[]
  savePreset: (name: string, tuning: ShaderTuning) => void
  loadPreset: (name: string) => ShaderTuning | undefined
  deletePreset: (name: string) => void

  // Thumbnails
  thumbnails: ThumbnailMap
  saveThumbnail: (name: string, dataUrl: string) => void
  getThumbnail: (name: string) => string | undefined
}

function buildPresetMap(userPresets: PresetMap): PresetMap {
  return { ...userPresets, ...BUILT_IN_PRESETS }
}

export const useTuningStore = create<TuningState>()(
  subscribeWithSelector(
  immer((set, get) => {
    const userPresets = loadUserPresets()
    const allPresets = buildPresetMap(userPresets)

    return {
      tuning: { ...DEFAULT_TUNING },
      presets: allPresets,
      presetNames: Object.keys(allPresets),
      thumbnails: loadThumbnails(),

      setTuning: (tuning) => set({ tuning }),

      patchTuning: (patch) =>
        set((state) => {
          Object.assign(state.tuning, patch)
        }),

      savePreset: (name, tuning) =>
        set((state) => {
          state.presets[name] = { ...tuning }
          state.presetNames = Object.keys(state.presets)
          // Persist user presets only
          const userOnly = { ...state.presets }
          for (const k of Object.keys(BUILT_IN_PRESETS)) delete userOnly[k]
          localStorage.setItem(PRESETS_KEY, JSON.stringify(userOnly))
        }),

      loadPreset: (name) => get().presets[name],

      deletePreset: (name) =>
        set((state) => {
          delete state.presets[name]
          state.presetNames = Object.keys(state.presets)
          const userOnly = { ...state.presets }
          for (const k of Object.keys(BUILT_IN_PRESETS)) delete userOnly[k]
          localStorage.setItem(PRESETS_KEY, JSON.stringify(userOnly))
        }),

      saveThumbnail: (name, dataUrl) =>
        set((state) => {
          state.thumbnails[name] = dataUrl
          localStorage.setItem(THUMBNAIL_KEY, JSON.stringify(state.thumbnails))
        }),

      getThumbnail: (name) => get().thumbnails[name],
    }
  })
))

// Persist active tuning to localStorage on every change
useTuningStore.subscribe(
  (state) => state.tuning,
  (tuning) => {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(tuning))
  }
)

// Hydrate from localStorage on startup
function hydrateActiveTuning() {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as ShaderTuning
      useTuningStore.setState({ tuning: { ...DEFAULT_TUNING, ...saved } })
    }
  } catch { /* empty */ }
}
hydrateActiveTuning()
