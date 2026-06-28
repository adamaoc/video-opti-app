import { spawn, type ChildProcess } from 'node:child_process'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { logger } from '../logger'
import { buildScaleFilter, extractFfmpegError } from './errors'
import { getFfmpegPath } from './paths'
import { resolvePreset, type CustomOptions, type PresetId } from './presets'

export interface EncodeJob {
  inputPath: string
  presetId: PresetId
  outputDir: string
  outputBasename: string
  custom?: CustomOptions
}

export interface EncodeResult {
  inputPath: string
  outputPath: string
  outputSize: number
}

export interface EncodeProgress {
  inputPath: string
  percent: number
  timeSeconds: number
}

let activeProcess: ChildProcess | null = null

export function cancelEncode(): void {
  if (activeProcess) {
    logger.warn('encode', 'Encoding cancelled by user')
    activeProcess.kill('SIGTERM')
    activeProcess = null
  }
}

function buildOutputPath(outputDir: string, outputBasename: string): string {
  return path.join(outputDir, `${outputBasename}.mp4`)
}

function parseTimeToSeconds(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

export function encodeVideo(
  job: EncodeJob,
  duration: number,
  onProgress: (progress: EncodeProgress) => void,
): Promise<EncodeResult> {
  const { maxHeight, crf } = resolvePreset(job.presetId, job.custom)
  const outputPath = buildOutputPath(job.outputDir, job.outputBasename)
  const scaleFilter = buildScaleFilter(maxHeight)
  const ffmpegPath = getFfmpegPath()

  const args = [
    '-y',
    '-i', job.inputPath,
    '-vf', scaleFilter,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', String(crf),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-progress', 'pipe:1',
    '-nostats',
    outputPath,
  ]

  const command = `${ffmpegPath} ${args.map(a => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`
  logger.info('encode', `Starting: ${path.basename(job.inputPath)}`)
  logger.debug('encode', command)

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args)
    activeProcess = proc
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n')
      for (const line of lines) {
        if (line.startsWith('out_time=')) {
          const timeStr = line.replace('out_time=', '').trim()
          const timeSeconds = parseTimeToSeconds(timeStr)
          const percent = duration > 0
            ? Math.min(100, (timeSeconds / duration) * 100)
            : 0
          onProgress({ inputPath: job.inputPath, percent, timeSeconds })
        }
      }
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderr += text

      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (/error|invalid|failed|no such|not found/i.test(trimmed)) {
          logger.error('ffmpeg', trimmed)
        }
      }
    })

    proc.on('error', err => {
      activeProcess = null
      logger.error('encode', `Process error: ${err.message}`)
      reject(err)
    })

    proc.on('close', async code => {
      activeProcess = null
      if (code === 0) {
        const outputStat = await stat(outputPath)
        logger.info('encode', `Finished: ${path.basename(outputPath)} (${outputStat.size} bytes)`)
        resolve({
          inputPath: job.inputPath,
          outputPath,
          outputSize: outputStat.size,
        })
      } else if (code === null) {
        reject(new Error('Encoding cancelled'))
      } else {
        const message = extractFfmpegError(stderr)
        logger.error('encode', `Failed (${path.basename(job.inputPath)}): ${message}`)
        reject(new Error(message))
      }
    })
  })
}