/**
 * EnvelopeControls — ADSR sliders for note shaping
 */

interface EnvelopeControlsProps {
  attack: number   // seconds
  decay: number    // seconds
  sustain: number  // 0-1
  release: number  // seconds
  onAttackChange: (v: number) => void
  onDecayChange: (v: number) => void
  onSustainChange: (v: number) => void
  onReleaseChange: (v: number) => void
}

export function EnvelopeControls({
  attack, onAttackChange,
  decay, onDecayChange,
  sustain, onSustainChange,
  release, onReleaseChange,
}: EnvelopeControlsProps) {
  return (
    <div className="mt-3 pt-3 border-t border-cold-white-dim/10">
      <span className="text-[0.6rem] text-electric-purple/60 tracking-wider uppercase">Envelope</span>
      <EnvSlider label="Atk" value={attack} min={0.001} max={0.5} step={0.005}
        display={`${(attack * 1000).toFixed(0)}ms`} onChange={onAttackChange} />
      <EnvSlider label="Dec" value={decay} min={0.01} max={1} step={0.01}
        display={`${(decay * 1000).toFixed(0)}ms`} onChange={onDecayChange} />
      <EnvSlider label="Sus" value={sustain} min={0} max={1} step={0.05}
        display={`${(sustain * 100).toFixed(0)}%`} onChange={onSustainChange} />
      <EnvSlider label="Rel" value={release} min={0.01} max={2} step={0.01}
        display={`${(release * 1000).toFixed(0)}ms`} onChange={onReleaseChange} />
    </div>
  )
}

function EnvSlider({ label, value, min, max, step, display, onChange }: {
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
