/**
 * midi-output.ts — Web MIDI output for hand tracking performances.
 *
 * Sends MIDI note on/off/pitch bend to connected MIDI devices.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69)
}

function freqToNoteName(freq: number): string {
  const midi = freqToMidi(freq)
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1)
}

export class MidiOutput {
  private access: MIDIAccess | null = null
  private output: MIDIOutput | null = null
  private _available = false
  private _connected = false
  private _lastNote = -1
  private _channel = 0 // 0-15

  get available(): boolean { return this._available }
  get connected(): boolean { return this._connected }
  get outputName(): string { return this.output?.name ?? 'None' }

  async init(): Promise<boolean> {
    try {
      if (!navigator.requestMIDIAccess) {
        this._available = false
        return false
      }
      this.access = await navigator.requestMIDIAccess()
      this._available = true
      this.selectFirstOutput()
      return true
    } catch {
      this._available = false
      return false
    }
  }

  getOutputs(): Array<{ id: string; name: string }> {
    if (!this.access) return []
    const outputs: Array<{ id: string; name: string }> = []
    this.access.outputs.forEach((output, id) => {
      outputs.push({ id, name: output.name ?? id })
    })
    return outputs
  }

  selectOutput(id: string): void {
    if (!this.access) return
    this.output = this.access.outputs.get(id) ?? null
    this._connected = this.output !== null
  }

  private selectFirstOutput(): void {
    if (!this.access) return
    const first = this.access.outputs.values().next()
    if (!first.done) {
      this.output = first.value
      this._connected = true
    }
  }

  noteOn(freq: number, velocity = 100): void {
    if (!this.output) return
    const midi = freqToMidi(freq)
    if (midi < 0 || midi > 127) return
    // Note off previous if different
    if (this._lastNote >= 0 && this._lastNote !== midi) {
      this.output.send([0x80 | this._channel, this._lastNote, 0])
    }
    this.output.send([0x90 | this._channel, midi, Math.min(127, Math.max(0, velocity))])
    this._lastNote = midi
  }

  noteOff(): void {
    if (!this.output || this._lastNote < 0) return
    this.output.send([0x80 | this._channel, this._lastNote, 0])
    this._lastNote = -1
  }

  pitchBend(freq: number): void {
    if (!this.output || this._lastNote < 0) return
    const targetMidi = 12 * Math.log2(freq / 440) + 69
    const semitones = targetMidi - this._lastNote
    // Standard pitch bend range is ±2 semitones (can be configured on synth)
    const bendRange = 2
    const normalized = Math.max(-1, Math.min(1, semitones / bendRange))
    const bendValue = Math.round((normalized + 1) * 8191.5)
    const lsb = bendValue & 0x7F
    const msb = (bendValue >> 7) & 0x7F
    this.output.send([0xE0 | this._channel, lsb, msb])
  }

  allNotesOff(): void {
    if (!this.output) return
    // CC 123 = All Notes Off
    this.output.send([0xB0 | this._channel, 123, 0])
    this._lastNote = -1
  }

  destroy(): void {
    this.allNotesOff()
    this.output = null
    this.access = null
    this._connected = false
  }
}

export { freqToMidi, freqToNoteName }
