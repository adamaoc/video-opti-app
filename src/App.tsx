import { useCallback, useEffect, useState } from 'react'
import type { PresetId } from '@/constants/presets'
import type { QueueItem } from '@/types/queue'
import type { EncodeCompleteEvent, EncodeFileResult, LogEntry } from '@/types/vidopti'
import { formatBytes } from '@/utils/format'
import { Header } from '@/components/Header'
import { DropZone } from '@/components/DropZone'
import { QueueList } from '@/components/QueueList'
import { Sidebar } from '@/components/Sidebar'
import { ProgressBar } from '@/components/ProgressBar'
import { LogPanel } from '@/components/LogPanel'
import './App.css'

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [presetId, setPresetId] = useState<PresetId>('quick-share')
  const [customMaxHeight, setCustomMaxHeight] = useState(1080)
  const [customCrf, setCustomCrf] = useState(23)
  const [outputDir, setOutputDir] = useState<string | null>(null)
  const [encoding, setEncoding] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [lastOutputPath, setLastOutputPath] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsOpen, setLogsOpen] = useState(false)

  useEffect(() => {
    window.vidopti.getLogs().then(setLogs)
    const unsub = window.vidopti.onLogEntry(entry => {
      setLogs(prev => [...prev.slice(-499), entry])
    })
    return unsub
  }, [])

  useEffect(() => {
    window.vidopti.getSettings().then(settings => {
      setPresetId(settings.defaultPreset)
      setOutputDir(settings.outputDir)
      setCustomMaxHeight(settings.customMaxHeight)
      setCustomCrf(settings.customCrf)
    })
  }, [])

  const addPaths = useCallback(async (paths: string[]) => {
    const existing = new Set(queue.map(q => q.path))
    const unique = paths.filter(p => !existing.has(p))
    if (!unique.length) return

    setStatusText('Reading file info…')
    const results = await window.vidopti.probeMany(unique)

    const newItems: QueueItem[] = results
      .filter(r => r.ok && r.data)
      .map(r => ({
        id: makeId(),
        path: r.data!.path,
        name: r.data!.name,
        size: r.data!.size,
        duration: r.data!.duration,
        width: r.data!.width,
        height: r.data!.height,
        codec: r.data!.codec,
        status: 'pending' as const,
        progress: 0,
      }))

    setQueue(prev => [...prev, ...newItems])
    setStatusText(newItems.length ? `${newItems.length} file(s) added` : 'Could not read selected files')
  }, [queue])

  const handleBrowse = useCallback(async () => {
    const paths = await window.vidopti.openFiles()
    if (paths.length) await addPaths(paths)
  }, [addPaths])

  const handleRemove = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id))
  }, [])

  const handlePresetChange = useCallback((id: PresetId) => {
    setPresetId(id)
    window.vidopti.setSettings({ defaultPreset: id })
  }, [])

  const handleCustomChange = useCallback((maxHeight: number, crf: number) => {
    setCustomMaxHeight(maxHeight)
    setCustomCrf(crf)
    window.vidopti.setSettings({ customMaxHeight: maxHeight, customCrf: crf })
  }, [])

  const handlePickOutputDir = useCallback(async () => {
    const dir = await window.vidopti.openOutputDir()
    if (dir) {
      setOutputDir(dir)
      window.vidopti.setSettings({ outputDir: dir })
    }
  }, [])

  const handleClearOutputDir = useCallback(() => {
    setOutputDir(null)
    window.vidopti.setSettings({ outputDir: null })
  }, [])

  const handleStart = useCallback(async () => {
    const pending = queue.filter(q => q.status === 'pending' || q.status === 'error')
    if (!pending.length) return

    setEncoding(true)
    setOverallProgress(0)
    setStatusText('Starting…')
    setLastOutputPath(null)

    const unsubProgress = window.vidopti.onEncodeProgress(({ inputPath, percent }) => {
      setQueue(prev => prev.map(item =>
        item.path === inputPath
          ? { ...item, status: 'processing', progress: percent }
          : item,
      ))
      const done = queue.filter(q => q.status === 'done').length
      const total = queue.length
      setOverallProgress(((done + percent / 100) / total) * 100)
    })

    const unsubStart = window.vidopti.onEncodeFileStart(({ inputPath }) => {
      setQueue(prev => prev.map(item =>
        item.path === inputPath ? { ...item, status: 'processing', progress: 0 } : item,
      ))
      const name = queue.find(q => q.path === inputPath)?.name ?? 'file'
      setStatusText(`Encoding ${name}…`)
    })

    const unsubDone = window.vidopti.onEncodeFileDone(({ inputPath, outputPath, outputSize }) => {
      setQueue(prev => prev.map(item =>
        item.path === inputPath
          ? { ...item, status: 'done', progress: 100, outputPath, outputSize }
          : item,
      ))
      setLastOutputPath(outputPath)
    })

    const unsubError = window.vidopti.onEncodeFileError(({ inputPath, error }) => {
      setQueue(prev => prev.map(item =>
        item.path === inputPath ? { ...item, status: 'error', error } : item,
      ))
      setLogsOpen(true)
      const name = queue.find(q => q.path === inputPath)?.name ?? 'file'
      setStatusText(`Failed — ${name}`)
    })

    const unsubComplete = window.vidopti.onEncodeComplete(({ results, savedBytes }: EncodeCompleteEvent) => {
      const ok = results.filter((r: EncodeFileResult) => r.ok).length
      const failed = results.length - ok
      const saved = results.reduce((sum: number, r: EncodeFileResult) => {
        const item = queue.find(q => q.path === r.inputPath)
        if (r.ok && r.outputSize && item) return sum + (item.size - r.outputSize)
        return sum
      }, savedBytes)

      if (failed > 0 && ok === 0) {
        setStatusText(`Failed — ${failed} file(s) errored. See logs for details.`)
        setLogsOpen(true)
      } else if (failed > 0) {
        setStatusText(`Done — ${ok} optimized, ${failed} failed, saved ${formatBytes(Math.max(0, saved))}`)
        setLogsOpen(true)
      } else {
        setStatusText(`Done — ${ok} file(s) optimized, saved ${formatBytes(Math.max(0, saved))}`)
      }

      setOverallProgress(100)
      setEncoding(false)
    })

    try {
      await window.vidopti.startEncode({
        files: pending.map(p => ({ path: p.path, duration: p.duration, size: p.size })),
        presetId,
        outputDir,
        custom: presetId === 'custom' ? { maxHeight: customMaxHeight, crf: customCrf } : undefined,
      })
    } catch (err) {
      setStatusText((err as Error).message)
      setEncoding(false)
    } finally {
      unsubProgress()
      unsubStart()
      unsubDone()
      unsubError()
      unsubComplete()
    }
  }, [queue, presetId, outputDir, customMaxHeight, customCrf])

  const handleCancel = useCallback(async () => {
    await window.vidopti.cancelEncode()
    setEncoding(false)
    setStatusText('Cancelled')
    setQueue(prev => prev.map(item =>
      item.status === 'processing' ? { ...item, status: 'pending', progress: 0 } : item,
    ))
  }, [])

  const handleReveal = useCallback(() => {
    if (lastOutputPath) window.vidopti.revealInFolder(lastOutputPath)
  }, [lastOutputPath])

  const showFooter = encoding || statusText.length > 0
  const hasOutput = queue.some(q => q.status === 'done')
  const logErrorCount = logs.filter(l => l.level === 'error').length

  const handleClearLogs = useCallback(async () => {
    await window.vidopti.clearLogs()
    setLogs([])
  }, [])

  return (
    <div className="app">
      <Header
        onToggleLogs={() => setLogsOpen(prev => !prev)}
        logsOpen={logsOpen}
        errorCount={logErrorCount}
      />
      <div className="app__body">
        <main className="app__main">
          {queue.length === 0 ? (
            <DropZone onFiles={addPaths} onBrowse={handleBrowse} disabled={encoding} />
          ) : (
            <QueueList items={queue} onRemove={handleRemove} disabled={encoding} />
          )}
        </main>
        <Sidebar
          presetId={presetId}
          onPresetChange={handlePresetChange}
          customMaxHeight={customMaxHeight}
          customCrf={customCrf}
          onCustomChange={handleCustomChange}
          outputDir={outputDir}
          onPickOutputDir={handlePickOutputDir}
          onClearOutputDir={handleClearOutputDir}
          onAddFiles={handleBrowse}
          onStart={handleStart}
          onCancel={handleCancel}
          onReveal={handleReveal}
          encoding={encoding}
          canStart={queue.some(q => q.status === 'pending' || q.status === 'error')}
          hasOutput={hasOutput}
        />
      </div>
      {showFooter && (
        <footer className="app__footer">
          <ProgressBar percent={overallProgress} label={`${Math.round(overallProgress)}%`} />
          <span className="app__status">{statusText}</span>
        </footer>
      )}
      {logsOpen && (
        <LogPanel
          entries={logs}
          onClear={handleClearLogs}
          onClose={() => setLogsOpen(false)}
        />
      )}
    </div>
  )
}