import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import { probeVideo } from '../ffmpeg/probe'
import { cancelEncode, encodeVideo } from '../ffmpeg/encode'
import {
  buildOutputBasename,
  ensureOutputDir,
  hasMultipleSourceDirs,
  resolveOutputDir,
} from '../ffmpeg/output'
import type { CustomOptions, PresetId } from '../ffmpeg/presets'
import { logger, type LogEntry } from '../logger'
import { settingsStore, type AppSettings } from '../store'

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi']

let encoding = false

function getWindow(): BrowserWindow {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win) throw new Error('No browser window available')
  return win
}

function broadcastLog(entry: LogEntry) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('log:entry', entry)
  }
}

export function registerIpcHandlers(): void {
  logger.subscribe(broadcastLog)

  ipcMain.handle('log:get', () => logger.getEntries())
  ipcMain.handle('log:clear', () => { logger.clear() })
  ipcMain.handle('log:get-file-path', () => logger.getLogFilePath())

  ipcMain.handle('dialog:open-files', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: VIDEO_EXTENSIONS }],
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('dialog:open-output-dir', async () => {
    const result = await dialog.showOpenDialog(getWindow(), {
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : result.filePaths[0] ?? null
  })

  ipcMain.handle('video:probe', async (_, filePath: string) => {
    return probeVideo(filePath)
  })

  ipcMain.handle('video:probe-many', async (_, filePaths: string[]) => {
    logger.info('probe', `Probing ${filePaths.length} file(s)`)
    const results = await Promise.allSettled(filePaths.map(probeVideo))
    return results.map((result, i) => ({
      path: filePaths[i],
      ok: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected'
        ? (result.reason as Error).message
        : null,
    }))
  })

  ipcMain.handle('settings:get', () => {
    return settingsStore.store
  })

  ipcMain.handle('settings:set', (_, partial: Partial<AppSettings>) => {
    for (const [key, value] of Object.entries(partial)) {
      settingsStore.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings])
    }
    return settingsStore.store
  })

  ipcMain.handle('shell:reveal', async (_, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('encode:start', async (event, payload: {
    files: Array<{ path: string; duration: number; size: number }>
    presetId: PresetId
    outputDir?: string | null
    useSequenceSuffix?: boolean
    custom?: CustomOptions
  }) => {
    if (encoding) throw new Error('An encoding job is already running')

    const manualOutputDir = payload.outputDir ?? settingsStore.get('outputDir')
    const useSequenceSuffix = payload.useSequenceSuffix ?? settingsStore.get('useSequenceSuffix')

    if (hasMultipleSourceDirs(payload.files.map(f => f.path)) && !manualOutputDir) {
      throw new Error('Videos are from different folders. Choose one output folder before encoding.')
    }

    logger.info('encode', `Batch started — ${payload.files.length} file(s), preset: ${payload.presetId}`)
    encoding = true
    const results: Array<{
      inputPath: string
      ok: boolean
      outputPath?: string
      outputSize?: number
      inputSize?: number
      error?: string
    }> = []

    try {
      for (let index = 0; index < payload.files.length; index++) {
        const file = payload.files[index]
        const outputDir = resolveOutputDir(file.path, manualOutputDir)
        const outputBasename = buildOutputBasename(file.path, index, useSequenceSuffix)

        await ensureOutputDir(outputDir)
        event.sender.send('encode:file-start', { inputPath: file.path })

        try {
          const result = await encodeVideo(
            {
              inputPath: file.path,
              presetId: payload.presetId,
              outputDir,
              outputBasename,
              custom: payload.custom,
            },
            file.duration,
            progress => {
              event.sender.send('encode:progress', progress)
            },
          )

          results.push({
            inputPath: file.path,
            ok: true,
            outputPath: result.outputPath,
            outputSize: result.outputSize,
          })
          event.sender.send('encode:file-done', result)
        } catch (err) {
          const message = (err as Error).message
          results.push({ inputPath: file.path, ok: false, error: message })
          event.sender.send('encode:file-error', { inputPath: file.path, error: message })

          if (message === 'Encoding cancelled') break
        }
      }
    } finally {
      encoding = false
    }

    const savedBytes = results
      .filter(r => r.ok && r.outputSize)
      .reduce((sum, r) => {
        const file = payload.files.find(f => f.path === r.inputPath)
        if (file && r.outputSize) return sum + Math.max(0, file.size - r.outputSize)
        return sum
      }, 0)

    const okCount = results.filter(r => r.ok).length
    const failCount = results.length - okCount
    logger.info('encode', `Batch complete — ${okCount} succeeded, ${failCount} failed, saved ${savedBytes} bytes`)

    const firstFile = payload.files[0]
    const resolvedOutputDir = firstFile
      ? resolveOutputDir(firstFile.path, manualOutputDir)
      : ''

    event.sender.send('encode:complete', {
      results,
      savedBytes,
      outputDir: resolvedOutputDir,
    })

    return results
  })

  ipcMain.handle('encode:cancel', () => {
    cancelEncode()
    encoding = false
  })
}