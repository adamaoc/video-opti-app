import { useCallback, useState } from 'react'
import './DropZone.css'

interface DropZoneProps {
  onFiles: (paths: string[]) => void
  onBrowse: () => void
  disabled?: boolean
}

export function DropZone({ onFiles, onBrowse, disabled }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return

    const paths = Array.from(e.dataTransfer.files)
      .map(f => window.vidopti.getPathForFile(f))
      .filter(Boolean)

    if (paths.length) onFiles(paths)
  }, [disabled, onFiles])

  return (
    <div
      className={`drop-zone${dragOver ? ' drop-zone--active' : ''}${disabled ? ' drop-zone--disabled' : ''}`}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && onBrowse()}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onBrowse() }}
    >
      <div className="drop-zone__icon">▣</div>
      <p className="drop-zone__title">Drop videos here</p>
      <p className="drop-zone__hint">or click to browse</p>
      <p className="drop-zone__formats mono">MP4 · MOV · M4V · WEBM</p>
    </div>
  )
}