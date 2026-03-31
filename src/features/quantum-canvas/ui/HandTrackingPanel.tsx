/**
 * HandTrackingPanel — Hand tracking controls, looper, MIDI, and performance
 * mode buttons. Extracted from DevPanel for LOC compliance.
 */
import { HAND_TARGET_LIST, HAND_TARGET_LABELS } from '@/features/hand-tracking'
import type { HandTarget } from '@/features/hand-tracking'

interface HandTrackingPanelProps {
  handTracking: {
    active: boolean
    loading: boolean
    toggle: () => void
    handState: { x: number; y: number; z: number; pinching: boolean; confidence: number; detected: boolean; gesture?: string }
    dualState: {
      left: { detected: boolean; gesture?: string; pinching: boolean; confidence: number }
      right: { detected: boolean; gesture?: string; pinching: boolean; confidence: number }
    }
    setMapping: (axis: 'x' | 'y' | 'z', target: HandTarget) => void
    setHandMapping: (hand: 'left' | 'right', axis: 'x' | 'y' | 'z', target: HandTarget) => void
    setSmoothing: (v: number) => void
    setPinchThreshold: (v: number) => void
    getConfig: () => { xTarget: HandTarget; yTarget: HandTarget; zTarget: HandTarget; pinchThreshold: number; smoothing: number }
    getDualConfig: () => { left: { xTarget: HandTarget; yTarget: HandTarget; zTarget: HandTarget }; right: { xTarget: HandTarget; yTarget: HandTarget; zTarget: HandTarget } }
    looper?: {
      recording: boolean
      playing: boolean
      onRecord: () => void
      onPlay: () => void
      onClear: () => void
      eventCount: number
    }
  }
  performance?: {
    midiEnabled: boolean
    onMidiToggle: () => void
    isRecording: boolean
    onRecordToggle: () => void
    performanceMode: boolean
    onPerformanceToggle: () => void
  }
}

export function HandTrackingPanel({ handTracking, performance }: HandTrackingPanelProps) {
  return (
    <div className="mt-3 pt-3 border-t border-cold-white-dim/10">
      <div className="flex items-center justify-between">
        <span className="text-[0.6rem] text-electric-purple/60 tracking-wider uppercase">🖐 Hand Tracking</span>
        <button
          onClick={handTracking.toggle}
          disabled={handTracking.loading}
          className={`text-[0.55rem] px-2 py-0.5 rounded border transition-colors ${
            handTracking.loading
              ? 'border-yellow-400/30 text-yellow-400 animate-pulse'
              : handTracking.active
                ? 'border-green-400/40 bg-green-400/10 text-green-400'
                : 'border-cold-white-dim/20 text-cold-white-dim/50 hover:border-electric-purple/30'
          }`}
        >
          {handTracking.loading ? '⏳ Loading...' : handTracking.active ? '🟢 Active' : '📷 Enable'}
        </button>
      </div>

      {handTracking.active && (() => {
        const dualCfg = handTracking.getDualConfig()
        const cfg = handTracking.getConfig()
        const hs = handTracking.handState
        return (
          <div className="mt-2 space-y-1.5">
            {/* Live status */}
            <div className="flex items-center gap-2 text-[0.5rem] text-cold-white-dim/40 flex-wrap">
              <span>L: <span className={handTracking.dualState.left.detected ? 'text-green-400' : 'text-red-400/40'}>{handTracking.dualState.left.detected ? handTracking.dualState.left.gesture ?? '✋' : '—'}</span></span>
              <span>R: <span className={handTracking.dualState.right.detected ? 'text-cyan-400' : 'text-red-400/40'}>{handTracking.dualState.right.detected ? handTracking.dualState.right.gesture ?? '✋' : '—'}</span></span>
              <span>{hs.pinching ? '🤏' : ''}</span>
              <span className="text-cold-white-dim/20">{(hs.confidence * 100).toFixed(0)}%</span>
            </div>

            {/* Per-hand axis mapping */}
            {(['left', 'right'] as const).map((hand) => (
              <div key={hand} className="space-y-0.5">
                <span className={`text-[0.5rem] font-bold ${hand === 'left' ? 'text-green-400/60' : 'text-cyan-400/60'}`}>
                  {hand === 'left' ? '🫲 Left' : '🫱 Right'}
                </span>
                {(['x', 'y', 'z'] as const).map((axis) => (
                  <div key={axis} className="flex items-center gap-2">
                    <span className="text-[0.5rem] text-cold-white-dim/40 w-5 uppercase">{axis}</span>
                    <select
                      value={dualCfg[hand][`${axis}Target`]}
                      onChange={e => handTracking.setHandMapping(hand, axis, e.target.value as HandTarget)}
                      className="flex-1 bg-black/60 border border-cold-white-dim/15 rounded text-[0.5rem] text-cold-white-dim px-1 py-0.5"
                    >
                      {HAND_TARGET_LIST.map(t => <option key={t} value={t}>{HAND_TARGET_LABELS[t]}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}

            {/* Smoothing */}
            <div className="flex items-center gap-2">
              <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Smooth</span>
              <input type="range" min={0} max={0.95} step={0.05} value={cfg.smoothing}
                onChange={e => handTracking.setSmoothing(Number(e.target.value))}
                className="flex-1 h-1 accent-electric-purple" />
              <span className="text-[0.55rem] w-8 text-right">{(cfg.smoothing * 100).toFixed(0)}%</span>
            </div>

            {/* Pinch threshold */}
            <div className="flex items-center gap-2">
              <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Pinch</span>
              <input type="range" min={0.02} max={0.15} step={0.005} value={cfg.pinchThreshold}
                onChange={e => handTracking.setPinchThreshold(Number(e.target.value))}
                className="flex-1 h-1 accent-electric-purple" />
              <span className="text-[0.55rem] w-8 text-right">{(cfg.pinchThreshold * 100).toFixed(0)}</span>
            </div>

            {/* Looper controls */}
            {handTracking.looper && (
              <div className="flex items-center gap-1.5 mt-1">
                <button
                  onClick={handTracking.looper.onRecord}
                  className={`px-2 py-0.5 rounded text-[0.55rem] font-bold transition-colors ${
                    handTracking.looper.recording
                      ? 'bg-red-500/30 text-red-400 border border-red-500/50 animate-pulse'
                      : 'bg-white/5 text-cold-white-dim/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {handTracking.looper.recording ? '⏹ Stop' : '⏺ Rec'}
                </button>
                <button
                  onClick={handTracking.looper.onPlay}
                  disabled={handTracking.looper.eventCount === 0}
                  className={`px-2 py-0.5 rounded text-[0.55rem] font-bold transition-colors ${
                    handTracking.looper.playing
                      ? 'bg-green-500/30 text-green-400 border border-green-500/50'
                      : 'bg-white/5 text-cold-white-dim/50 border border-white/10 hover:bg-white/10'
                  } disabled:opacity-30`}
                >
                  {handTracking.looper.playing ? '⏹ Stop' : '▶ Play'}
                </button>
                <button
                  onClick={handTracking.looper.onClear}
                  className="px-2 py-0.5 rounded text-[0.55rem] bg-white/5 text-cold-white-dim/50 border border-white/10 hover:bg-white/10"
                >
                  ✕
                </button>
                {handTracking.looper.eventCount > 0 && (
                  <span className="text-[0.5rem] text-cold-white-dim/30">{handTracking.looper.eventCount} events</span>
                )}
              </div>
            )}
            {/* Performance controls */}
            {performance && (
              <div className="flex items-center gap-1.5 mt-1">
                <button
                  onClick={performance.onMidiToggle}
                  className={`px-2 py-0.5 rounded text-[0.55rem] font-bold transition-colors ${
                    performance.midiEnabled
                      ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                      : 'bg-white/5 text-cold-white-dim/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  🎹 MIDI
                </button>
                <button
                  onClick={performance.onRecordToggle}
                  className={`px-2 py-0.5 rounded text-[0.55rem] font-bold transition-colors ${
                    performance.isRecording
                      ? 'bg-red-500/30 text-red-400 border border-red-500/50 animate-pulse'
                      : 'bg-white/5 text-cold-white-dim/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {performance.isRecording ? '⏹ REC' : '🎙 REC'}
                </button>
                <button
                  onClick={performance.onPerformanceToggle}
                  className={`px-2 py-0.5 rounded text-[0.55rem] font-bold transition-colors ${
                    performance.performanceMode
                      ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50'
                      : 'bg-white/5 text-cold-white-dim/50 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  🎭 Perform
                </button>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
