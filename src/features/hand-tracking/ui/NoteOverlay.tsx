/**
 * NoteOverlay — Displays current note name + octave near the camera preview.
 * Updates at ~10fps from the synth's current frequency.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function freqToNote(freq: number): { name: string; octave: number; cents: number } {
  if (freq <= 0) return { name: '—', octave: 0, cents: 0 }
  // A4 = 440Hz = MIDI 69
  const midi = 12 * Math.log2(freq / 440) + 69
  const rounded = Math.round(midi)
  const cents = Math.round((midi - rounded) * 100)
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12]
  const octave = Math.floor(rounded / 12) - 1
  return { name, octave, cents }
}

interface NoteOverlayProps {
  freq: number
  active: boolean
  pinching: boolean
  gesture: string
}

export function NoteOverlay({ freq, active, pinching, gesture }: NoteOverlayProps) {
  if (!active) return null

  const note = freqToNote(freq)
  const GESTURE_EMOJI: Record<string, string> = {
    pinch: '🤏', fist: '👊', spread: '🖐', open: '✋', neutral: '',
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 140,
      left: 12,
      zIndex: 101,
      pointerEvents: 'none',
      fontFamily: 'JetBrains Mono, monospace',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
    }}>
      {/* Note display */}
      <div style={{
        fontSize: pinching ? 32 : 20,
        fontWeight: 700,
        color: pinching ? '#a855f7' : 'rgba(168, 85, 247, 0.4)',
        textShadow: pinching ? '0 0 20px rgba(168,85,247,0.6)' : 'none',
        transition: 'all 0.15s ease',
        lineHeight: 1,
      }}>
        {note.name}<span style={{ fontSize: '0.6em', opacity: 0.6 }}>{note.octave}</span>
      </div>
      {/* Cents deviation */}
      {pinching && note.cents !== 0 && (
        <div style={{
          fontSize: 10,
          color: Math.abs(note.cents) < 10 ? '#4ade80' : '#fbbf24',
          opacity: 0.6,
        }}>
          {note.cents > 0 ? '+' : ''}{note.cents}¢
        </div>
      )}
      {/* Gesture indicator */}
      {gesture !== 'neutral' && gesture !== 'pinch' && (
        <div style={{ fontSize: 18, marginTop: 2 }}>
          {GESTURE_EMOJI[gesture] ?? ''}
        </div>
      )}
    </div>
  )
}
