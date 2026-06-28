import type { PresetId } from '@/constants/presets'

export interface AppSettings {
  defaultPreset: PresetId
  outputDir: string | null
  customMaxHeight: number
  customCrf: number
}

export interface VideoMetadata {
  path: string
  name: string
  size: number
  duration: number
  width: number
  height: number
  codec: string
}

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

export interface CustomOptions {
  maxHeight: number
  crf: number
}

export interface VidOptiApi {
  getPathForFile: (file: File) => string
  openFiles: () => Promise<string[]>
  openOutputDir: () => Promise<string | null>
  probeMany: (paths: string[]) => Promise<ProbeResult[]>
  getSettings: () => Promise<AppSettings>
  setSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  revealInFolder: (filePath: string) => Promise<void>
  startEncode: (payload: {
    files: EncodeFileInput[]
    presetId: PresetId
    outputDir?: string | null
    custom?: CustomOptions
  }) => Promise<EncodeFileResult[]>
  cancelEncode: () => Promise<void>
  onEncodeProgress: (callback: (event: EncodeProgressEvent) => void) => () => void
  onEncodeFileStart: (callback: (data: { inputPath: string }) => void) => () => void
  onEncodeFileDone: (callback: (data: { inputPath: string; outputPath: string; outputSize: number }) => void) => () => void
  onEncodeFileError: (callback: (data: { inputPath: string; error: string }) => void) => () => void
  onEncodeComplete: (callback: (event: EncodeCompleteEvent) => void) => () => void
}