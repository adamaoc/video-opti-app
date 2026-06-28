export type QueueStatus = 'pending' | 'processing' | 'done' | 'error'

export interface QueueItem {
  id: string
  path: string
  name: string
  size: number
  duration: number
  width: number
  height: number
  codec: string
  status: QueueStatus
  progress: number
  error?: string
  outputPath?: string
  outputSize?: number
}