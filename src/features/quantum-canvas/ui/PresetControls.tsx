import { useState, useRef } from 'react'
import type { ShaderTuning } from '../lib/shader-tuning'
import { BUILT_IN_PRESETS, DEFAULT_TUNING } from '../lib/shader-tuning'
import { useShaderPresets } from '../lib/use-shader-presets'
import { useAudioStore } from '@/features/quantum-audio/model/audio-store'

interface PresetControlsProps {
  tuning: ShaderTuning
  onChange: (tuning: ShaderTuning) => void
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>
}

export function PresetControls({ tuning, onChange, canvasRef }: PresetControlsProps) {
  const { names, save, load, remove, saveThumbnail, getThumbnail } = useShaderPresets()
  const [presetName, setPresetName] = useState('')
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const captureThumb = (): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    try {
      const w = 120
      const h = 68
      const offscreen = document.createElement('canvas')
      offscreen.width = w
      offscreen.height = h
      const ctx = offscreen.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(canvas, 0, 0, w, h)
      return offscreen.toDataURL('image/webp', 0.6)
    } catch { return null }
  }

  const handleSave = () => {
    const name = presetName.trim() || `preset-${Date.now()}`
    save(name, tuning)
    const thumb = captureThumb()
    if (thumb) saveThumbnail(name, thumb)
    setPresetName('')
  }

  const handleLoad = (name: string) => {
    const preset = load(name)
    if (preset) {
      onChange({ ...preset })
      // Sync FX/synth params to audio engine via subscriptions
      useAudioStore.getState().hydrateFromTuning(preset)
    }
  }

  const handleExport = (btn: HTMLButtonElement) => {
    const json = JSON.stringify(tuning, null, 2)
    navigator.clipboard.writeText(json)
    const og = btn.innerText
    btn.innerText = '✓ COPIED'
    btn.classList.add('text-electric-purple')
    setTimeout(() => {
      btn.innerText = og
      btn.classList.remove('text-electric-purple')
    }, 1200)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (typeof parsed.waveSpeed !== 'number') throw new Error('Invalid preset')
        const merged: ShaderTuning = { ...DEFAULT_TUNING, ...parsed }
        onChange(merged)
        useAudioStore.getState().hydrateFromTuning(merged)
        setImportStatus('✓ Loaded')
        setTimeout(() => setImportStatus(null), 2000)
      } catch {
        setImportStatus('✗ Invalid JSON')
        setTimeout(() => setImportStatus(null), 2000)
      }
    }
    reader.readAsText(file)
    // Reset input so re-importing same file works
    e.target.value = ''
  }

  return (
    <div className="mt-3 pt-3 border-t border-cold-white-dim/10">
      <span className="text-[0.6rem] text-electric-purple/60 tracking-wider uppercase">Presets</span>

      {/* Save */}
      <div className="flex items-center gap-1 mt-2">
        <input
          type="text"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="preset name..."
          className="flex-1 bg-cold-white-dim/5 border border-cold-white-dim/10 rounded px-2 py-0.5 text-[0.6rem] text-cold-white outline-none focus:border-electric-purple/40"
        />
        <button
          onClick={handleSave}
          className="text-[0.6rem] text-electric-purple/60 hover:text-electric-purple uppercase px-2 py-0.5 border border-electric-purple/20 rounded hover:border-electric-purple/40"
        >
          Save
        </button>
      </div>

      {/* Import / Export */}
      <div className="flex items-center gap-1 mt-1.5">
        <button
          onClick={(e) => handleExport(e.currentTarget)}
          className="flex-1 text-[0.55rem] text-cold-white-dim/40 hover:text-electric-purple uppercase px-2 py-0.5 border border-cold-white-dim/10 rounded hover:border-electric-purple/30 transition-colors"
        >
          📋 Export JSON
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 text-[0.55rem] text-cold-white-dim/40 hover:text-electric-purple uppercase px-2 py-0.5 border border-cold-white-dim/10 rounded hover:border-electric-purple/30 transition-colors"
        >
          📂 Import JSON
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        {importStatus && (
          <span className={`text-[0.55rem] ${importStatus.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{importStatus}</span>
        )}
      </div>

      {/* Preset list */}
      {names.length > 0 && (
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
          {names.map(name => {
            const thumb = getThumbnail(name)
            return (
              <div key={name} className="flex items-center gap-2 group py-1 border-b border-cold-white-dim/5 last:border-0 pl-1">
                {thumb ? (
                  <img src={thumb} alt={name} className="w-[30px] h-[17px] rounded-sm object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <div className="w-[30px] h-[17px] rounded-sm bg-gradient-to-br from-electric-purple/20 to-cold-white-dim/10" />
                )}
                <button
                  onClick={() => handleLoad(name)}
                  className="text-[0.55rem] text-cold-white-dim/50 hover:text-cold-white truncate flex-1 text-left"
                >
                  {name}
                </button>
                {BUILT_IN_PRESETS[name] === undefined && (
                  <button
                    onClick={() => remove(name)}
                    className="text-[0.6rem] text-cold-white-dim/30 hover:text-red-400 px-2 py-0.5 rounded hover:bg-red-400/10 transition-colors ml-2"
                    title="Delete preset"
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
