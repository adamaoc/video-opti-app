import { useEffect, useRef } from 'react'
import type { LogEntry } from '@/types/vidopti'
import './LogPanel.css'

interface LogPanelProps {
  entries: LogEntry[]
  onClear: () => void
  onClose: () => void
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString()
  } catch {
    return iso
  }
}

export function LogPanel({ entries, onClear, onClose }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries])

  return (
    <section className="log-panel">
      <div className="log-panel__header">
        <span className="log-panel__title">Logs</span>
        <span className="log-panel__count mono">{entries.length} entries</span>
        <div className="log-panel__actions">
          <button type="button" className="log-panel__btn" onClick={onClear}>Clear</button>
          <button type="button" className="log-panel__btn" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="log-panel__body" ref={scrollRef}>
        {entries.length === 0 ? (
          <p className="log-panel__empty">No log entries yet.</p>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className={`log-panel__row log-panel__row--${entry.level}`}>
              <span className="log-panel__time mono">{formatTime(entry.timestamp)}</span>
              <span className="log-panel__level mono">{entry.level}</span>
              <span className="log-panel__source mono">{entry.source}</span>
              <span className="log-panel__message">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}