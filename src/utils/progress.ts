import type { QueueItem } from '@/types/queue'

export function computeBatchProgress(items: QueueItem[], batchPaths: string[]): number {
  const batch = items.filter(item => batchPaths.includes(item.path))
  if (!batch.length) return 0

  const total = batch.reduce((sum, item) => {
    if (item.status === 'done' || item.status === 'error') return sum + 100
    if (item.status === 'processing') return sum + item.progress
    return sum
  }, 0)

  return total / batch.length
}