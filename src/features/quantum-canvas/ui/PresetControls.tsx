import { useState } from 'react'
import type { ShaderTuning } from '../lib/shader-tuning'
import { BUILT_IN_PRESETS } from '../lib/shader-tuning'
import { useShaderPresets } from '../lib/use-shader-presets'

interface PresetControlsProps {
  tuning: ShaderTuning
  onChange: (tuning: ShaderTuning) => void
}

export function PresetControls({ tuning, onChange }: PresetControlsProps) {
  const { names, save, load, remove } = useShaderPresets()
  const [presetName, setPresetName] = useState('')

  const handleSave = () => {
    const name = presetName.trim() || `preset-${Date.now()}`
    save(name, tuning)
    setPresetName('')
  }

  const handleLoad = (name: string) => {
    const preset = load(name)
    if (preset) onChange({ ...preset })
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

      {/* Preset list */}
      {names.length > 0 && (
        <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
          {names.map(name => (
            <div key={name} className="flex items-center justify-between group py-1 border-b border-cold-white-dim/5 last:border-0 pl-1">
              <button
                onClick={() => handleLoad(name)}
                className="text-[0.55rem] text-cold-white-dim/50 hover:text-cold-white truncate flex-1 text-left"
              >
                ▸ {name}
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
          ))}
        </div>
      )}
    </div>
  )
}
