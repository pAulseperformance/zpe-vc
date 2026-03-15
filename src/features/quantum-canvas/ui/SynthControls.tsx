import type { MutableRefObject } from 'react'
import type { SynthWaveform, FFTBands } from '../lib/use-quantum-audio'

interface SynthControlsProps {
  waveform: SynthWaveform
  onWaveformChange: (wf: SynthWaveform) => void
  filterQ: number
  onFilterQChange: (q: number) => void
  audioReactive: boolean
  onAudioReactiveChange: (v: boolean) => void
  fftRef: MutableRefObject<FFTBands>
}

const WAVEFORMS: SynthWaveform[] = ['sine', 'sawtooth', 'square', 'triangle']
const WF_LABELS: Record<SynthWaveform, string> = {
  sine: '〜 Sine',
  sawtooth: '⩘ Saw',
  square: '⊓ Square',
  triangle: '△ Triangle',
}

export function SynthControls({
  waveform, onWaveformChange,
  filterQ, onFilterQChange,
  audioReactive, onAudioReactiveChange,
  fftRef,
}: SynthControlsProps) {
  const bands = fftRef.current

  return (
    <div className="mt-3 pt-3 border-t border-cold-white-dim/10">
      <span className="text-[0.6rem] text-electric-purple/60 tracking-wider uppercase">Synth</span>

      {/* Waveform selector */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Wave</span>
        <button
          onClick={() => {
            const idx = WAVEFORMS.indexOf(waveform)
            onWaveformChange(WAVEFORMS[(idx + 1) % WAVEFORMS.length])
          }}
          className="text-[0.55rem] text-cold-white-dim/50 hover:text-electric-purple border border-cold-white-dim/10 rounded px-2 py-0.5"
        >
          {WF_LABELS[waveform]}
        </button>
      </div>

      {/* Filter Q */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[0.55rem] text-cold-white-dim/40 w-14">Res Q</span>
        <input
          type="range" min={0.5} max={10} step={0.5} value={filterQ}
          onChange={e => onFilterQChange(Number(e.target.value))}
          className="flex-1 h-1 accent-electric-purple"
        />
        <span className="text-[0.55rem] w-8 text-right">{filterQ.toFixed(1)}</span>
      </div>

      {/* Audio Reactivity toggle */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[0.55rem] text-cold-white-dim/40 w-14">React</span>
        <button
          onClick={() => onAudioReactiveChange(!audioReactive)}
          className={`text-[0.55rem] px-2 py-0.5 rounded border transition-colors ${
            audioReactive
              ? 'text-electric-purple border-electric-purple/40 bg-electric-purple/10'
              : 'text-cold-white-dim/40 border-cold-white-dim/10'
          }`}
        >
          {audioReactive ? '🎵 ON' : '⏸ OFF'}
        </button>
      </div>

      {/* FFT Meter — 3 bars showing bass/mid/treble */}
      <div className="flex items-end gap-1 mt-2 h-6">
        <FFTBar label="B" value={bands.bass} color="from-red-500 to-orange-400" />
        <FFTBar label="M" value={bands.mid} color="from-electric-purple to-indigo-400" />
        <FFTBar label="T" value={bands.treble} color="from-cyan-400 to-blue-400" />
      </div>
    </div>
  )
}

function FFTBar({ label, value, color }: { label: string; value: number; color: string }) {
  const h = Math.max(2, value * 24)
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <div
        className={`w-full rounded-sm bg-gradient-to-t ${color} transition-all duration-75`}
        style={{ height: `${h}px`, opacity: 0.3 + value * 0.7 }}
      />
      <span className="text-[0.45rem] text-cold-white-dim/30">{label}</span>
    </div>
  )
}
