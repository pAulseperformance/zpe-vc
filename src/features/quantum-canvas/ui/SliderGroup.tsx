import type { ShaderTuning, SliderDef } from '../lib/shader-tuning'

const GOD_MODE_WAVE_WARN = 200
const GOD_MODE_WAVE_DANGER = 500
const GOD_MODE_WAVE_HARD_CAP = 2000

interface SliderGroupProps {
  sliders: SliderDef[]
  tuning: ShaderTuning
  onChange: (key: keyof ShaderTuning, value: number) => void
}

export function SliderGroup({ sliders, tuning, onChange }: SliderGroupProps) {
  return (
    <>
      {sliders.map(({ key, label, min, max, step }) => {
        const val = tuning[key] as number
        const isWaveGod = key === 'maxWaves' && tuning.godMode
        const isWaveDanger = isWaveGod && val > GOD_MODE_WAVE_WARN
        const isWaveCritical = isWaveGod && val > GOD_MODE_WAVE_DANGER

        const handleSliderChange = (newVal: number) => {
          if (key === 'maxWaves' && newVal > GOD_MODE_WAVE_HARD_CAP) newVal = GOD_MODE_WAVE_HARD_CAP
          onChange(key, newVal)
        }

        return (
          <div key={key}>
            <div className="flex items-center gap-2">
              <label className={`text-[0.55rem] w-20 shrink-0 truncate ${isWaveCritical ? 'text-red-400' : isWaveDanger ? 'text-yellow-400' : isWaveGod ? 'text-orange-400' : 'text-cold-white-dim/40'}`}>{label}</label>
              <input
                type="range" min={min} max={tuning.godMode ? (key === 'maxWaves' ? GOD_MODE_WAVE_HARD_CAP : max * 50) : max} step={step}
                value={val}
                onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-electric-purple"
              />
              {tuning.godMode ? (
                <input 
                  type="number" 
                  value={val} 
                  onChange={(e) => handleSliderChange(parseFloat(e.target.value) || 0)}
                  className={`text-[0.55rem] w-12 text-right tabular-nums bg-transparent border-b outline-none appearance-none ${isWaveCritical ? 'border-red-400/50 text-red-400' : isWaveDanger ? 'border-yellow-400/50 text-yellow-400' : 'border-electric-purple/50 text-electric-purple'}`}
                />
              ) : (
                <span className="text-[0.55rem] w-10 text-right tabular-nums">
                  {val.toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 0)}
                </span>
              )}
            </div>
            {isWaveCritical && (
              <div className="text-[0.5rem] text-red-400 bg-red-400/10 border border-red-400/30 rounded px-1.5 py-0.5 mt-0.5 animate-pulse">
                ☠️ YOU WILL GET REKT — GPU meltdown imminent ({val} waves/pixel/frame)
              </div>
            )}
            {isWaveDanger && !isWaveCritical && (
              <div className="text-[0.5rem] text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded px-1.5 py-0.5 mt-0.5">
                ⚠️ GPU Warning — {val} waves is heavy, frames may drop
              </div>
            )}
            {isWaveGod && !isWaveDanger && (
              <div className="text-[0.5rem] text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded px-1.5 py-0.5 mt-0.5">
                🔥 Max Waves unlocked — increase carefully (hard cap: {GOD_MODE_WAVE_HARD_CAP})
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
