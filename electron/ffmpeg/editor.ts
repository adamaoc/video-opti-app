import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { app } from 'electron'
import crypto from 'node:crypto'
import path from 'node:path'
import { getFfmpegPath } from './paths'

export interface EditorMedia {
  previewData: ArrayBuffer
  thumbnails: string[]
}

export interface EditorMediaProgress {
  requestId: string
  inputPath: string
  stage: 'thumbnails' | 'preview'
  percent: number
  message: string
}

const THUMBNAIL_COUNT = 12
const activeEditorProcesses = new Map<string, Set<ChildProcess>>()
const cancelledEditorRequests = new Set<string>()

export function cancelEditorMedia(requestId: string): void {
  const processes = activeEditorProcesses.get(requestId)
  if (!processes) return

  cancelledEditorRequests.add(requestId)
  for (const proc of processes) {
    proc.kill('SIGTERM')
  }
  activeEditorProcesses.delete(requestId)
}

function trackProcess(requestId: string, proc: ChildProcess): () => void {
  const processes = activeEditorProcesses.get(requestId) ?? new Set<ChildProcess>()
  processes.add(proc)
  activeEditorProcesses.set(requestId, processes)

  return () => {
    processes.delete(proc)
    if (processes.size === 0) activeEditorProcesses.delete(requestId)
  }
}

function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

function runFfmpeg(
  requestId: string,
  args: string[],
  options: {
    duration?: number
    onProgress?: (percent: number) => void
  } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finalArgs = options.duration
      ? [...args.slice(0, -1), '-progress', 'pipe:1', '-nostats', args[args.length - 1]]
      : args
    const proc = spawn(getFfmpegPath(), finalArgs)
    const untrack = trackProcess(requestId, proc)
    let stderr = ''

    proc.stdout.on('data', chunk => {
      if (!options.duration || !options.onProgress) return
      for (const line of chunk.toString().split('\n')) {
        if (!line.startsWith('out_time=')) continue
        const timeSeconds = parseTimeToSeconds(line.replace('out_time=', '').trim())
        options.onProgress(Math.min(100, (timeSeconds / options.duration) * 100))
      }
    })

    proc.stderr.on('data', chunk => { stderr += chunk })
    proc.on('error', err => {
      untrack()
      reject(err)
    })
    proc.on('close', code => {
      untrack()
      if (code === 0) {
        resolve()
      } else if (code === null || cancelledEditorRequests.has(requestId)) {
        cancelledEditorRequests.delete(requestId)
        reject(new Error('Editor preview cancelled'))
      } else {
        reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`))
      }
    })
  })
}

async function getCacheDir(filePath: string): Promise<string> {
  const fileStat = await stat(filePath)
  const hash = crypto
    .createHash('sha1')
    .update(`editor-preview-v5:${filePath}:${fileStat.size}:${fileStat.mtimeMs}`)
    .digest('hex')
  const cacheDir = path.join(app.getPath('temp'), 'vidopti-editor', hash)
  await mkdir(cacheDir, { recursive: true })
  return cacheDir
}

async function generatePreview(
  requestId: string,
  filePath: string,
  cacheDir: string,
  duration: number,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const previewPath = path.join(cacheDir, 'preview.mp4')
  if (existsSync(previewPath)) return previewPath
  const tempPreviewPath = path.join(cacheDir, `preview-${requestId}.tmp.mp4`)

  const longClip = duration >= 600
  const maxSide = longClip ? 480 : 720
  const fps = longClip ? 10 : 15
  const crf = longClip ? 36 : 34

  try {
    await runFfmpeg(requestId, [
      '-y',
      '-i', filePath,
      '-map', '0:v:0',
      '-sn',
      '-dn',
      '-vf', `fps=${fps},scale=w=min(${maxSide}\\,iw):h=min(${maxSide}\\,ih):force_original_aspect_ratio=decrease`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', String(crf),
      '-pix_fmt', 'yuv420p',
      '-tag:v', 'avc1',
      '-an',
      '-movflags', '+faststart',
      tempPreviewPath,
    ], { duration, onProgress })
    await rename(tempPreviewPath, previewPath)
  } catch (err) {
    await rm(tempPreviewPath, { force: true })
    throw err
  }

  return previewPath
}

async function generateThumbnail(
  requestId: string,
  filePath: string,
  cacheDir: string,
  index: number,
  duration: number,
): Promise<string> {
  const thumbnailPath = path.join(cacheDir, `thumb-${String(index).padStart(2, '0')}.jpg`)
  if (!existsSync(thumbnailPath)) {
    const time = duration > 0
      ? Math.max(0, Math.min(duration - 0.05, (duration * (index + 0.5)) / THUMBNAIL_COUNT))
      : 0

    await runFfmpeg(requestId, [
      '-y',
      '-ss', String(time),
      '-i', filePath,
      '-frames:v', '1',
      '-vf', 'scale=160:90:force_original_aspect_ratio=decrease,pad=160:90:(ow-iw)/2:(oh-ih)/2',
      '-q:v', '4',
      thumbnailPath,
    ])
  }

  const data = await readFile(thumbnailPath)
  return `data:image/jpeg;base64,${data.toString('base64')}`
}

export async function prepareEditorMedia(
  requestId: string,
  filePath: string,
  duration: number,
  _codec: string,
  onProgress?: (progress: EditorMediaProgress) => void,
): Promise<EditorMedia> {
  const cacheDir = await getCacheDir(filePath)
  onProgress?.({
    requestId,
    inputPath: filePath,
    stage: 'thumbnails',
    percent: 0,
    message: 'Preparing thumbnails...',
  })
  const thumbnails: string[] = []
  for (let index = 0; index < THUMBNAIL_COUNT; index++) {
    thumbnails.push(await generateThumbnail(requestId, filePath, cacheDir, index, duration))
    onProgress?.({
      requestId,
      inputPath: filePath,
      stage: 'thumbnails',
      percent: ((index + 1) / THUMBNAIL_COUNT) * 100,
      message: `Preparing thumbnails ${index + 1}/${THUMBNAIL_COUNT}...`,
    })
  }
  onProgress?.({
    requestId,
    inputPath: filePath,
    stage: 'preview',
    percent: 0,
    message: 'Building playable preview 0%...',
  })
  const previewPath = await generatePreview(requestId, filePath, cacheDir, duration, percent => {
    onProgress?.({
      requestId,
      inputPath: filePath,
      stage: 'preview',
      percent,
      message: `Building playable preview ${Math.round(percent)}%...`,
    })
  })
  const previewBuffer = await readFile(previewPath)

  return {
    previewData: previewBuffer.buffer.slice(
      previewBuffer.byteOffset,
      previewBuffer.byteOffset + previewBuffer.byteLength,
    ),
    thumbnails,
  }
}
