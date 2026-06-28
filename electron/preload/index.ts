import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AppSettings } from '../store'
import type { VideoMetadata } from '../ffmpeg/probe'
import type { CustomOptions, PresetId } from '../ffmpeg/presets'

export interface ProbeResult {
  path: string
  ok: boolean
  data: VideoMetadata | null
  error: string | null
}

export interface EncodeFileInput {
  path: string
  duration: number
  size: number
}

export interface EncodeProgressEvent {
  inputPath: string
  percent: number
  timeSeconds: number
}

export interface EncodeFileResult {
  inputPath: string
  ok: boolean
  outputPath?: string
  outputSize?: number
  error?: string
}

export interface EncodeCompleteEvent {
  results: EncodeFileResult[]
  savedBytes: number
  outputDir: string
}

const api = {
  getPathForFile: (file: File): string =>
    webUtils.getPathForFile(file),

  openFiles: (): Promise<string[]> =>
    ipcRenderer.invoke('dialog:open-files'),

  openOutputDir: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:open-output-dir'),

  probeMany: (paths: string[]): Promise<ProbeResult[]> =>
    ipcRenderer.invoke('video:probe-many', paths),

  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:get'),

  setSettings: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', partial),

  revealInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:reveal', filePath),

  startEncode: (payload: {
    files: EncodeFileInput[]
    presetId: PresetId
    outputDir?: string | null
    custom?: CustomOptions
  }): Promise<EncodeFileResult[]> =>
    ipcRenderer.invoke('encode:start', payload),

  cancelEncode: (): Promise<void> =>
    ipcRenderer.invoke('encode:cancel'),

  onEncodeProgress: (callback: (event: EncodeProgressEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: EncodeProgressEvent) => callback(data)
    ipcRenderer.on('encode:progress', listener)
    return () => ipcRenderer.off('encode:progress', listener)
  },

  onEncodeFileStart: (callback: (data: { inputPath: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { inputPath: string }) => callback(data)
    ipcRenderer.on('encode:file-start', listener)
    return () => ipcRenderer.off('encode:file-start', listener)
  },

  onEncodeFileDone: (callback: (data: { inputPath: string; outputPath: string; outputSize: number }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { inputPath: string; outputPath: string; outputSize: number }) => callback(data)
    ipcRenderer.on('encode:file-done', listener)
    return () => ipcRenderer.off('encode:file-done', listener)
  },

  onEncodeFileError: (callback: (data: { inputPath: string; error: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: { inputPath: string; error: string }) => callback(data)
    ipcRenderer.on('encode:file-error', listener)
    return () => ipcRenderer.off('encode:file-error', listener)
  },

  onEncodeComplete: (callback: (event: EncodeCompleteEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: EncodeCompleteEvent) => callback(data)
    ipcRenderer.on('encode:complete', listener)
    return () => ipcRenderer.off('encode:complete', listener)
  },
}

contextBridge.exposeInMainWorld('vidopti', api)

export type VidOptiApi = typeof api