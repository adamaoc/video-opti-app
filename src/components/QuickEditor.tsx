import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import type { QueueItem } from '@/types/queue'
import { formatDuration } from '@/utils/format'
import './QuickEditor.css'

interface QuickEditorProps {
  item: QueueItem
  onCancel: () => void
  onSave: (id: string, trimStart: number, trimEnd: number) => void
}

const MIN_TRIM_SECONDS = 0.25

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function makeRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function QuickEditor({ item, onCancel, onSave }: QuickEditorProps) {
  const duration = Math.max(item.duration, MIN_TRIM_SECONDS)
  const [trimStart, setTrimStart] = useState(() => clamp(item.trimStart ?? 0, 0, duration - MIN_TRIM_SECONDS))
  const [trimEnd, setTrimEnd] = useState(() => clamp(item.trimEnd ?? duration, MIN_TRIM_SECONDS, duration))
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null)
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [mediaStatus, setMediaStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [mediaMessage, setMediaMessage] = useState('Preparing preview...')
  const [previewSrc, setPreviewSrc] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [canPlayPreview, setCanPlayPreview] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(duration)
  const [loopTrim, setLoopTrim] = useState(false)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const selectedDuration = Math.max(0, trimEnd - trimStart)
  const startPercent = (trimStart / duration) * 100
  const endPercent = (trimEnd / duration) * 100
  const videoAspectRatio = item.width > 0 && item.height > 0
    ? `${item.width} / ${item.height}`
    : '16 / 9'

  useEffect(() => {
    let cancelled = false
    let nextPreviewUrl = ''
    const requestId = makeRequestId()
    setThumbnails([])
    setMediaStatus('loading')
    setMediaMessage('Preparing thumbnails...')
    setPreviewSrc('')
    setIsPlaying(false)
    setCanPlayPreview(false)
    setPlaybackTime(0)
    setPlaybackDuration(duration)

    const unsubscribeProgress = window.vidopti.onEditorMediaProgress(progress => {
      if (progress.requestId !== requestId) return
      setMediaMessage(progress.message)
    })

    async function prepareMedia() {
      try {
        const media = await window.vidopti.prepareEditorMedia({
          requestId,
          path: item.path,
          duration: item.duration,
          codec: item.codec,
        })
        if (cancelled) return
        const blob = new Blob([media.previewData], { type: 'video/mp4' })
        nextPreviewUrl = URL.createObjectURL(blob)
        setPreviewSrc(nextPreviewUrl)
        setThumbnails(media.thumbnails)
        setMediaStatus('ready')
        setMediaMessage('Preview ready')
      } catch (err) {
        if (!cancelled) {
          const message = (err as Error).message
          setMediaStatus('failed')
          setMediaMessage(message || 'Preview unavailable')
        }
      }
    }

    prepareMedia()

    return () => {
      cancelled = true
      window.vidopti.cancelEditorMedia(requestId)
      if (nextPreviewUrl) URL.revokeObjectURL(nextPreviewUrl)
      unsubscribeProgress()
    }
  }, [item.codec, item.duration, item.path])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      const target = event.target as HTMLElement | null
      if (target?.closest('button, input, textarea, select')) return
      event.preventDefault()
      handleTogglePlayback()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeHandle) return
    video.currentTime = activeHandle === 'end' ? trimEnd : trimStart
  }, [activeHandle, trimStart, trimEnd])

  const handleTogglePlayback = useCallback(async () => {
    const video = videoRef.current
    if (!video || mediaStatus !== 'ready' || !canPlayPreview) return

    if (video.paused) {
      try {
        if (loopTrim && (video.currentTime < trimStart || video.currentTime >= trimEnd)) {
          video.currentTime = trimStart
        }
        await video.play()
      } catch (err) {
        setMediaMessage((err as Error).message || 'Playback could not start')
      }
    } else {
      video.pause()
    }
  }, [canPlayPreview, loopTrim, mediaStatus, trimEnd, trimStart])

  const handleScrub = useCallback((value: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = value
    setPlaybackTime(value)
  }, [])

  const seekToTimelinePosition = useCallback((clientX: number) => {
    const timeline = timelineRef.current
    const video = videoRef.current
    if (!timeline || !video || mediaStatus !== 'ready') return

    const rect = timeline.getBoundingClientRect()
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    const seconds = ratio * duration
    video.currentTime = Math.min(seconds, playbackDuration)
    setPlaybackTime(video.currentTime)
  }, [duration, mediaStatus, playbackDuration])

  const updateFromPointer = useCallback((clientX: number, handle: 'start' | 'end') => {
    const timeline = timelineRef.current
    if (!timeline) return

    const rect = timeline.getBoundingClientRect()
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
    const seconds = ratio * duration

    if (handle === 'start') {
      setTrimStart(clamp(seconds, 0, trimEnd - MIN_TRIM_SECONDS))
    } else {
      setTrimEnd(clamp(seconds, trimStart + MIN_TRIM_SECONDS, duration))
    }
  }, [duration, trimEnd, trimStart])

  const handlePointerDown = (handle: 'start' | 'end') => (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setActiveHandle(handle)
    updateFromPointer(event.clientX, handle)
  }

  const handlePointerMove = (handle: 'start' | 'end') => (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    updateFromPointer(event.clientX, handle)
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    setActiveHandle(null)
  }

  return (
    <section className="quick-editor" aria-labelledby="quick-editor-title">
      <div className="quick-editor__header">
        <button type="button" className="quick-editor__back" onClick={onCancel}>
          Back
        </button>
        <div className="quick-editor__title">
          <h2 id="quick-editor-title">Quick editor</h2>
          <p title={item.path}>{item.name}</p>
        </div>
        <button
          type="button"
          className="quick-editor__save"
          onClick={() => onSave(item.id, trimStart, trimEnd)}
        >
          Save trim
        </button>
      </div>

      <div className="quick-editor__workspace">
        <div className="quick-editor__viewer">
          <div className="quick-editor__video-frame" style={{ aspectRatio: videoAspectRatio }}>
            {previewSrc && (
              <video
                ref={videoRef}
                className="quick-editor__video"
                key={previewSrc}
                src={previewSrc}
                poster={thumbnails[0]}
                preload="metadata"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onLoadedMetadata={event => {
                  const loadedDuration = event.currentTarget.duration
                  setPlaybackDuration(Number.isFinite(loadedDuration) ? loadedDuration : duration)
                }}
                onCanPlay={() => {
                  setCanPlayPreview(true)
                  setMediaMessage('Preview ready')
                }}
                onError={event => {
                  const error = event.currentTarget.error
                  setCanPlayPreview(false)
                  setMediaStatus('failed')
                  setMediaMessage(error ? `Video error ${error.code}` : 'Video could not load')
                }}
                onTimeUpdate={event => {
                  const video = event.currentTarget
                  if (video.currentTime >= trimEnd) {
                    if (loopTrim) {
                      video.currentTime = trimStart
                      setPlaybackTime(trimStart)
                      return
                    }
                    video.pause()
                    setPlaybackTime(trimEnd)
                    return
                  }
                  setPlaybackTime(video.currentTime)
                }}
                onClick={handleTogglePlayback}
              />
            )}
            {mediaStatus !== 'ready' && (
              <div className="quick-editor__media-status">{mediaMessage}</div>
            )}
          </div>
          <div className="quick-editor__player-controls">
            <button
              type="button"
              className="quick-editor__play"
              onClick={handleTogglePlayback}
              disabled={mediaStatus !== 'ready' || !canPlayPreview}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <span className="quick-editor__play-time mono">{formatDuration(playbackTime)}</span>
            <input
              className="quick-editor__scrub"
              type="range"
              min="0"
              max={playbackDuration}
              step="0.01"
              value={Math.min(playbackTime, playbackDuration)}
              onChange={event => handleScrub(Number(event.target.value))}
              disabled={mediaStatus !== 'ready' || !canPlayPreview}
              aria-label="Playback position"
            />
            <span className="quick-editor__play-time mono">{formatDuration(playbackDuration)}</span>
            <label className="quick-editor__loop">
              <input
                type="checkbox"
                checked={loopTrim}
                onChange={event => setLoopTrim(event.target.checked)}
              />
              <span>Loop trim</span>
            </label>
          </div>
          {mediaStatus === 'ready' && mediaMessage !== 'Preview ready' && (
            <p className="quick-editor__playback-message">{mediaMessage}</p>
          )}
        </div>

        <div className="quick-editor__timeline-panel">
          <div className="quick-editor__times">
            <span>Start {formatDuration(trimStart)}</span>
            <strong>{formatDuration(selectedDuration)}</strong>
            <span>End {formatDuration(trimEnd)}</span>
          </div>

          <div className="quick-editor__timeline-wrap">
            <div
              className="quick-editor__timeline"
              ref={timelineRef}
              onPointerDown={event => seekToTimelinePosition(event.clientX)}
            >
              <div className="quick-editor__track">
                {mediaStatus === 'ready' ? (
                  thumbnails.map((thumbnail, index) => (
                    <img
                      key={index}
                      src={thumbnail}
                      alt=""
                      draggable={false}
                    />
                  ))
                ) : (
                  <div className="quick-editor__thumbnail-fallback">
                    {mediaStatus === 'loading' ? mediaMessage : 'Timeline preview unavailable'}
                  </div>
                )}
              </div>
              <div
                className="quick-editor__shade quick-editor__shade--left"
                style={{ width: `${startPercent}%` }}
              />
              <div
                className="quick-editor__shade quick-editor__shade--right"
                style={{ left: `${endPercent}%` }}
              />
              <div
                className="quick-editor__selection"
                style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
              />
              <button
                type="button"
                className="quick-editor__handle quick-editor__handle--start"
                style={{ left: `${startPercent}%` }}
                onPointerDown={handlePointerDown('start')}
                onPointerMove={handlePointerMove('start')}
                onPointerUp={handlePointerUp}
                aria-label="Trim start"
              />
              <button
                type="button"
                className="quick-editor__handle quick-editor__handle--end"
                style={{ left: `${endPercent}%` }}
                onPointerDown={handlePointerDown('end')}
                onPointerMove={handlePointerMove('end')}
                onPointerUp={handlePointerUp}
                aria-label="Trim end"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
