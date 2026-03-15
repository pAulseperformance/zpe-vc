/**
 * FX Controls — Delay, Reverb, Distortion sliders
 */

interface FXControlsProps {
  delayTime: number
  onDelayTimeChange: (v: number) => void
  delayFeedback: number
  onDelayFeedbackChange: (v: number) => void
  delayMix: number
  onDelayMixChange: (v: number) => void
  reverbMix: number
  onReverbMixChange: (v: number) => void
  reverbDecay: number
  onReverbDecayChange: (v: number) => void
  distortion: number
  onDistortionChange: (v: number) => void
  autoDistortion: boolean
  onAutoDistortionChange: (v: boolean) => void
}

export function FXControls({
  delayTime, onDelayTimeChange,
  delayFeedback, onDelayFeedbackChange,
  delayMix, onDelayMixChange,
  reverbMix, onReverbMixChange,
  reverbDecay, onReverbDecayChange,
  distortion, onDistortionChange,
  autoDistortion, onAutoDistortionChange,
}: FXControlsProps) {
  return (
    <div className="mt-3 pt-3 border-t border-cold-white-dim/10">
      <span className="text-[0.6rem] text-electric-purple/60 tracking-wider uppercase">FX</span>

      {/* Delay */}
      <FXSlider label="D.Time" value={delayTime} min={0.05} max={1} step={0.05}
        display={`${(delayTime * 1000).toFixed(0)}ms`} onChange={onDelayTimeChange} />
      <FXSlider label="D.Feed" value={delayFeedback} min={0} max={0.95} step={0.05}
        display={`${(delayFeedback * 100).toFixed(0)}%`} onChange={onDelayFeedbackChange} />
      <FXSlider label="D.Mix" value={delayMix} min={0} max={1} step={0.05}
        display={`${(delayMix * 100).toFixed(0)}%`} onChange={onDelayMixChange} />

      {/* Reverb */}
      <FXSlider label="Rev" value={reverbMix} min={0} max={1} step={0.05}
        display={`${(reverbMix * 100).toFixed(0)}%`} onChange={onReverbMixChange} />
      <FXSlider label="Decay" value={reverbDecay} min={0.5} max={5} step={0.25}
        display={`${reverbDecay.toFixed(1)}s`} onChange={onReverbDecayChange} />

      {/* Distortion */}
      <FXSlider label="Drive" value={distortion} min={0} max={100} step={1}
        display={distortion.toFixed(0)} onChange={onDistortionChange} />

      {/* Auto-distortion toggle */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Auto</span>
        <button
          onClick={() => onAutoDistortionChange(!autoDistortion)}
          className={`text-[0.55rem] px-2 py-0.5 rounded border transition-colors ${
            autoDistortion
              ? 'text-electric-purple border-electric-purple/40 bg-electric-purple/10'
              : 'text-cold-white-dim/40 border-cold-white-dim/10'
          }`}
        >
          {autoDistortion ? '⚡ ON' : '⏸ OFF'}
        </button>
      </div>
    </div>
  )
}

function FXSlider({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number
  step: number; display: string; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <span className="text-[0.55rem] text-cold-white-dim/40 w-14">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-electric-purple"
      />
      <span className="text-[0.55rem] w-10 text-right">{display}</span>
    </div>
  )
}
