import { create } from 'zustand'

interface UIState {
  isForging: boolean
  devUnlocked: boolean
  showDevPanel: boolean
  performanceMode: boolean
  hideCursor: boolean

  // Actions
  setIsForging: (v: boolean) => void
  setDevUnlocked: (v: boolean) => void
  setShowDevPanel: (v: boolean) => void
  setPerformanceMode: (v: boolean) => void
  togglePerformanceMode: () => void
  setHideCursor: (v: boolean) => void
}

const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV

export const useUIStore = create<UIState>()((set) => ({
  isForging: false,
  devUnlocked: IS_DEV ?? false,
  showDevPanel: IS_DEV ?? false,
  performanceMode: false,
  hideCursor: true,

  setIsForging: (v) => set({ isForging: v }),
  setDevUnlocked: (v) => set({ devUnlocked: v }),
  setShowDevPanel: (v) => set({ showDevPanel: v }),
  setPerformanceMode: (v) => set({ performanceMode: v }),
  togglePerformanceMode: () => set((s) => ({ performanceMode: !s.performanceMode })),
  setHideCursor: (v) => set({ hideCursor: v }),
}))
