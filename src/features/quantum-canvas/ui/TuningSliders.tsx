/**
 * TuningSliders — Shader tuning slider groups, palette/wavelength toggles,
 * zoom mode, god mode, and cursor controls. Extracted from DevPanel.
 */
import { MOUSE_SLIDERS, OBJECT_SLIDERS, UNIVERSE_SLIDERS } from '../lib/shader-tuning'
import type { ShaderTuning } from '../lib/shader-tuning'
import { SliderGroup } from './SliderGroup'
import { useUIStore } from '@/shared/model/ui-store'

interface TuningSlidersProps {
  tuning: ShaderTuning
  onTuningChange: (t: ShaderTuning) => void
  onFieldChange: (key: keyof ShaderTuning, value: number | boolean) => void
}

export function TuningSliders({ tuning, onTuningChange, onFieldChange }: TuningSlidersProps) {
  const hideCursor = useUIStore((s) => s.hideCursor)
  const setHideCursor = useUIStore((s) => s.setHideCursor)

  return (
    <>
      <PaletteModeToggle tuning={tuning} onChange={onTuningChange} />
      <WavelengthBandSelector tuning={tuning} onChange={onTuningChange} />

      {/* God Mode & Pointer Hover Toggles */}
      <div className="flex gap-2 mb-2 w-full">
        <button 
          onClick={() => onFieldChange('godMode', !tuning.godMode)}
          className={`flex-1 text-[0.6rem] uppercase tracking-wider border px-2 py-1 rounded transition-colors ${tuning.godMode ? 'border-electric-purple bg-electric-purple/20 text-electric-purple shadow-[0_0_10px_rgba(155,81,224,0.3)]' : 'border-cold-white-dim/20 text-cold-white-dim/50 hover:border-cold-white-dim/40'}`}
        >
          ⚡ God Mode
        </button>
        <button 
          onClick={() => setHideCursor(!hideCursor)}
          className={`flex-1 text-[0.6rem] uppercase tracking-wider border px-2 py-1 rounded transition-colors ${hideCursor ? 'border-red-400/50 bg-red-400/10 text-red-400' : 'border-cold-white-dim/20 text-cold-white-dim/50 hover:border-cold-white-dim/40'}`}
        >
          {hideCursor ? '🚫 Cursor Off' : '🖱 Cursor On'}
        </button>
      </div>

      {/* Mouse / God Object */}
      <div className="text-[0.55rem] text-electric-purple/50 uppercase tracking-widest mt-1 mb-0.5 border-b border-electric-purple/10 pb-0.5">🖱 Mouse (God Object)</div>
      <button 
        onClick={() => onFieldChange('pointerHover', !tuning.pointerHover)}
        className={`text-[0.55rem] w-full text-left px-1 py-0.5 rounded border mb-1 transition-colors ${tuning.pointerHover ? 'border-electric-purple/30 text-electric-purple bg-electric-purple/10' : 'border-cold-white-dim/10 text-cold-white-dim/30'}`}
      >
        {tuning.pointerHover ? '☑ Hover Warp Active' : '☐ Hover Warp Disabled'}
      </button>
      <SliderGroup sliders={MOUSE_SLIDERS} tuning={tuning} onChange={onFieldChange} />

      {/* Click Object */}
      <div className="text-[0.55rem] text-electric-purple/50 uppercase tracking-widest mt-2 mb-0.5 border-b border-electric-purple/10 pb-0.5">💥 Click Object (EM Waves)</div>
      <SliderGroup sliders={OBJECT_SLIDERS} tuning={tuning} onChange={onFieldChange} />

      {/* Universe */}
      <div className="text-[0.55rem] text-electric-purple/50 uppercase tracking-widest mt-2 mb-0.5 border-b border-electric-purple/10 pb-0.5">🌌 Universe</div>
      <SliderGroup sliders={UNIVERSE_SLIDERS} tuning={tuning} onChange={onFieldChange} />

      {/* Zoom Mode Toggle */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[0.55rem] text-cold-white-dim/40 w-14 shrink-0">Zoom</span>
        <button
          onClick={() => {
            const next = ((tuning.zoomMode ?? 0) + 1) % 3
            onTuningChange({ ...tuning, zoomMode: next })
          }}
          className="text-[0.55rem] text-cold-white-dim/50 hover:text-electric-purple border border-cold-white-dim/10 rounded px-2 py-0.5"
        >
          {(tuning.zoomMode ?? 0) === 0 ? '🔧 Manual' : (tuning.zoomMode ?? 0) === 1 ? '🔭 Adaptive' : '🔭 Adaptive + Walls'}
        </button>
      </div>
    </>
  )
}

/* ─── Inline sub-components ─── */

function PaletteModeToggle({ tuning, onChange }: { tuning: ShaderTuning; onChange: (t: ShaderTuning) => void }) {
  const modes = [
    { mode: 0, label: '🔬 Physical', title: 'Planck blackbody + intensity-only interference' },
    { mode: 1, label: '🎨 Artistic', title: 'Vibrant cosine palette + chromatic dispersion' },
    { mode: 2, label: '⚗️ Hybrid', title: 'Blackbody thermal + artistic wavefronts' },
  ] as const

  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className="text-[0.55rem] text-cold-white-dim/40 w-14 shrink-0">Palette</span>
      {modes.map(({ mode, label, title }) => (
        <button
          key={mode}
          onClick={() => onChange({ ...tuning, paletteMode: mode })}
          title={title}
          className={`text-[0.5rem] px-1.5 py-0.5 rounded border ${
            tuning.paletteMode === mode
              ? 'text-electric-purple border-electric-purple/40 bg-electric-purple/10'
              : 'text-cold-white-dim/30 border-cold-white-dim/10 hover:border-electric-purple/20'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function WavelengthBandSelector({ tuning, onChange }: { tuning: ShaderTuning; onChange: (t: ShaderTuning) => void }) {
  const bands = [
    { mode: 0, label: '📻', title: 'Radio — long wavelength, low energy' },
    { mode: 1, label: '🔴', title: 'Infrared — thermal emission' },
    { mode: 2, label: '👁', title: 'Visible — default human perception' },
    { mode: 3, label: '💎', title: 'X-Ray — high energy penetration' },
    { mode: 4, label: '☢️', title: 'Gamma — extreme energy, pair production' },
  ] as const

  return (
    <div className="flex items-center gap-1 mb-2 flex-wrap">
      <span className="text-[0.55rem] text-cold-white-dim/40 w-14 shrink-0">Band</span>
      {bands.map(({ mode, label, title }) => (
        <button
          key={mode}
          onClick={() => onChange({ ...tuning, wavelength: mode })}
          title={title}
          className={`text-[0.6rem] px-1 py-0.5 rounded border ${
            tuning.wavelength === mode
              ? 'text-electric-purple border-electric-purple/40 bg-electric-purple/10'
              : 'text-cold-white-dim/30 border-cold-white-dim/10 hover:border-electric-purple/20'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
