import { useState, useRef } from 'react'
import type { MutableRefObject } from 'react'

interface ExportControlsProps {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
}

export function ExportControls({ canvasRef }: ExportControlsProps) {
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleScreenshot = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `zpe-capture-${Date.now()}.png`)
    }, 'image/png')
  }

  const handleRecord = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (recording && recorderRef.current) {
      recorderRef.current.stop()
      return
    }

    const stream = canvas.captureStream(30)
    const chunks: Blob[] = []
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      setRecording(false)
      recorderRef.current = null
      const blob = new Blob(chunks, { type: 'video/webm' })
      downloadBlob(blob, `zpe-clip-${Date.now()}.webm`)
    }

    recorderRef.current = recorder
    recorder.start()
    setRecording(true)

    // Auto-stop after 10 seconds
    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
    }, 10000)
  }

  return (
    <div className="mt-3 pt-3 border-t border-cold-white-dim/10">
      <span className="text-[0.6rem] text-electric-purple/60 tracking-wider uppercase">Export</span>
      <div className="flex items-center gap-1 mt-2">
        <button
          onClick={handleScreenshot}
          className="flex-1 text-[0.55rem] text-cold-white-dim/40 hover:text-electric-purple uppercase px-2 py-1 border border-cold-white-dim/10 rounded hover:border-electric-purple/30 transition-colors"
        >
          📸 Screenshot
        </button>
        <button
          onClick={handleRecord}
          className={`flex-1 text-[0.55rem] uppercase px-2 py-1 border rounded transition-colors ${
            recording
              ? 'text-red-400 border-red-400/40 animate-pulse'
              : 'text-cold-white-dim/40 hover:text-electric-purple border-cold-white-dim/10 hover:border-electric-purple/30'
          }`}
        >
          {recording ? '⏹ Stop' : '🎬 Record 10s'}
        </button>
      </div>
    </div>
  )
}
