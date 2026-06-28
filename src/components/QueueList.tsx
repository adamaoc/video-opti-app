import type { QueueItem } from '@/types/queue'
import { formatBytes, formatDuration, formatResolution } from '@/utils/format'
import './QueueList.css'

interface QueueListProps {
  items: QueueItem[]
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  disabled?: boolean
}

function statusLabel(item: QueueItem): string {
  switch (item.status) {
    case 'processing': return `${Math.round(item.progress)}%`
    case 'done': return 'Done'
    case 'error': return 'Error'
    default: return 'Pending'
  }
}

function trimLabel(item: QueueItem): string {
  if (item.trimStart == null && item.trimEnd == null) return 'Full video'
  return `${formatDuration(item.trimStart ?? 0)}–${formatDuration(item.trimEnd ?? item.duration)}`
}

export function QueueList({ items, onEdit, onRemove, disabled }: QueueListProps) {
  return (
    <div className="queue">
      <div className="queue__toolbar">
        <span className="queue__count">{items.length} file{items.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="queue__table">
        <div className="queue__head">
          <span>Name</span>
          <span>Resolution</span>
          <span>Size</span>
          <span>Duration</span>
          <span>Trim</span>
          <span>Status</span>
          <span />
        </div>
        {items.map(item => (
          <div key={item.id} className={`queue__row queue__row--${item.status}`}>
            <span className="queue__name" title={item.path}>{item.name}</span>
            <span className="mono">{formatResolution(item.width, item.height)}</span>
            <span className="mono">{formatBytes(item.size)}</span>
            <span className="mono">{formatDuration(item.duration)}</span>
            <span className="queue__trim mono" title={trimLabel(item)}>{trimLabel(item)}</span>
            <span
              className={`queue__status queue__status--${item.status}`}
              title={item.error ?? undefined}
            >
              {statusLabel(item)}
            </span>
            <div className="queue__actions">
              <button
                type="button"
                className="queue__edit"
                onClick={() => onEdit(item.id)}
                disabled={disabled || item.status === 'processing'}
                aria-label={`Trim ${item.name}`}
              >
                Trim
              </button>
              <button
                type="button"
                className="queue__remove"
                onClick={() => onRemove(item.id)}
                disabled={disabled || item.status === 'processing'}
                aria-label={`Remove ${item.name}`}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
