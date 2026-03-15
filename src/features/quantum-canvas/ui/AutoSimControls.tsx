import type { useAutoSim } from '../lib/use-auto-sim'

type AutoSimState = ReturnType<typeof useAutoSim>

interface AutoSimControlsProps {
  sim: AutoSimState
}

export function AutoSimControls({ sim }: AutoSimControlsProps) {
  const {
    simActive, setSimActive,
    simClicksOn, setSimClicksOn,
    simMouseOn, setSimMouseOn,
    simRate, setSimRate,
    simMode, setSimMode,
    simSeparation, setSimSeparation,
    simMouseSpeed, setSimMouseSpeed,
    simMouseRadius, setSimMouseRadius,
  } = sim

  return (
    <div className="mt-3 border-t border-cold-white-dim/10 pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[0.6rem] text-electric-purple/60 uppercase tracking-wider">Auto-Sim</span>
        <button
          onClick={() => setSimActive(!simActive)}
          className={`text-[0.6rem] px-2 py-0.5 rounded border ${
            simActive
              ? 'text-electric-purple border-electric-purple/40 bg-electric-purple/10'
              : 'text-cold-white-dim/40 border-cold-white-dim/10 hover:border-electric-purple/30'
          }`}
        >
          {simActive ? '■ STOP' : '▶ START'}
        </button>
      </div>

      {/* Independent toggles */}
      <div className="flex items-center gap-3 mb-1.5">
        <button
          onClick={() => setSimClicksOn(!simClicksOn)}
          className={`text-[0.55rem] ${simClicksOn ? 'text-electric-purple' : 'text-cold-white-dim/30'}`}
        >
          {simClicksOn ? '☑' : '☐'} Clicks
        </button>
        <button
          onClick={() => setSimMouseOn(!simMouseOn)}
          className={`text-[0.55rem] ${simMouseOn ? 'text-electric-purple' : 'text-cold-white-dim/30'}`}
        >
          {simMouseOn ? '☑' : '☐'} Mouse
        </button>
      </div>

      <div className="space-y-1">
        {/* Click controls */}
        {simClicksOn && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Mode</span>
              <button
                onClick={() => {
                  const modes = ['single', 'dual', 'cluster', 'gravity', 'random', 'spiral'] as const
                  const idx = modes.indexOf(simMode)
                  setSimMode(modes[(idx + 1) % modes.length])
                }}
                className="text-[0.55rem] text-cold-white-dim/50 hover:text-electric-purple border border-cold-white-dim/10 rounded px-2 py-0.5"
              >
                {simMode === 'single' ? '● Single Origin' : simMode === 'dual' ? '●● Dual Origins' : simMode === 'cluster' ? '✨ Cluster' : simMode === 'gravity' ? '🌀 Gravity Orbit' : simMode === 'random' ? '🎲 Random Walk' : '🌀 Spiral'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Rate</span>
              <input type="range" min={0.5} max={10} step={0.5} value={simRate}
                onChange={e => setSimRate(Number(e.target.value))} className="flex-1 h-1 accent-electric-purple" />
              <span className="text-[0.55rem] w-10 text-right">{simRate}/s</span>
            </div>
            {(simMode === 'dual' || simMode === 'cluster') && (
              <div className="flex items-center gap-2">
                <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Spread</span>
                <input type="range" min={0.05} max={0.5} step={0.05} value={simSeparation}
                  onChange={e => setSimSeparation(Number(e.target.value))} className="flex-1 h-1 accent-electric-purple" />
                <span className="text-[0.55rem] w-10 text-right">{simSeparation.toFixed(2)}</span>
              </div>
            )}
          </>
        )}

        {/* Mouse controls */}
        {simMouseOn && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Speed</span>
              <input type="range" min={0.1} max={3} step={0.1} value={simMouseSpeed}
                onChange={e => setSimMouseSpeed(Number(e.target.value))} className="flex-1 h-1 accent-electric-purple" />
              <span className="text-[0.55rem] w-10 text-right">{simMouseSpeed.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Radius</span>
              <input type="range" min={0.05} max={0.4} step={0.05} value={simMouseRadius}
                onChange={e => setSimMouseRadius(Number(e.target.value))} className="flex-1 h-1 accent-electric-purple" />
              <span className="text-[0.55rem] w-10 text-right">{simMouseRadius.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
