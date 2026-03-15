import type { ShaderTuning } from '../lib/shader-tuning'

interface BarrierControlsProps {
  tuning: ShaderTuning
  onChange: (tuning: ShaderTuning) => void
}

export function BarrierControls({ tuning, onChange }: BarrierControlsProps) {
  const enabled = tuning.barrierEnabled > 0.5

  return (
    <div className="mt-3 border-t border-cold-white-dim/10 pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[0.6rem] text-electric-purple/60 uppercase tracking-wider">Barrier</span>
        <button
          onClick={() => onChange({ ...tuning, barrierEnabled: enabled ? 0 : 1 })}
          className={`text-[0.6rem] px-2 py-0.5 rounded border ${
            enabled
              ? 'text-electric-purple border-electric-purple/40 bg-electric-purple/10'
              : 'text-cold-white-dim/40 border-cold-white-dim/10 hover:border-electric-purple/30'
          }`}
        >
          {enabled ? '🧱 ON' : '○ OFF'}
        </button>
      </div>

      {enabled && (
        <div className="space-y-1.5">
          {/* Slit count selector */}
          <div className="flex items-center gap-1">
            <span className="text-[0.55rem] text-cold-white-dim/40 w-14 shrink-0">Slits</span>
            {([
              { n: 0, label: '▬ Wall' },
              { n: 1, label: '╎ 1' },
              { n: 2, label: '╎╎ 2' },
              { n: 3, label: '╎╎╎ 3' },
            ] as const).map(({ n, label }) => (
              <button
                key={n}
                onClick={() => onChange({ ...tuning, slitCount: n })}
                className={`text-[0.5rem] px-1.5 py-0.5 rounded border ${
                  Math.round(tuning.slitCount) === n
                    ? 'text-electric-purple border-electric-purple/40 bg-electric-purple/10'
                    : 'text-cold-white-dim/30 border-cold-white-dim/10 hover:border-electric-purple/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sliders */}
          <BarrierSlider label="Position" value={tuning.barrierY} min={0.2} max={0.8} step={0.01}
            onChange={v => onChange({ ...tuning, barrierY: v })} />

          {tuning.slitCount > 0.5 && (
            <>
              <BarrierSlider label="Slit Width" value={tuning.slitWidth} min={0.01} max={0.15} step={0.005}
                onChange={v => onChange({ ...tuning, slitWidth: v })} />
              {tuning.slitCount > 1.5 && (
                <BarrierSlider label="Separation" value={tuning.slitSeparation} min={0.05} max={0.4} step={0.01}
                  onChange={v => onChange({ ...tuning, slitSeparation: v })} />
              )}
              <BarrierSlider label="Samples" value={tuning.diffSamples} min={4} max={16} step={1}
                onChange={v => onChange({ ...tuning, diffSamples: v })} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function BarrierSlider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.55rem] text-cold-white-dim/40 w-14 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-electric-purple" />
      <span className="text-[0.55rem] w-10 text-right tabular-nums">
        {value.toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 0)}
      </span>
    </div>
  )
}
