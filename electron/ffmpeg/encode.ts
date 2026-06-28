import { spawn, type ChildProcess } from 'node:child_process'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { getFfmpegPath } from './paths'
import { resolvePreset, type CustomOptions, type PresetId } from './presets'

export interface EncodeJob {
  inputPath: string
  presetId: PresetId
  outputDir?: string
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
    activeProcess.kill('SIGTERM')
    activeProcess = null
  }
}

function buildOutputPath(
  inputPath: string,
  suffix: string,
  outputDir?: string,
): string {
  const parsed = path.parse(inputPath)
  const dir = outputDir ?? parsed.dir
  return path.join(dir, `${parsed.name}${suffix}.mp4`)
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
  const { maxHeight, crf, suffix } = resolvePreset(job.presetId, job.custom)
  const outputPath = buildOutputPath(job.inputPath, suffix, job.outputDir)

  const args = [
    '-y',
    '-i', job.inputPath,
    '-vf', `autorotate,scale=-2:'min(${maxHeight},ih)'`,
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

  return new Promise((resolve, reject) => {
    const proc = spawn(getFfmpegPath(), args)
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
      stderr += chunk.toString()
    })

    proc.on('error', err => {
      activeProcess = null
      reject(err)
    })

    proc.on('close', async code => {
      activeProcess = null
      if (code === 0) {
        const outputStat = await stat(outputPath)
        resolve({
          inputPath: job.inputPath,
          outputPath,
          outputSize: outputStat.size,
        })
      } else if (code === null) {
        reject(new Error('Encoding cancelled'))
      } else {
        reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`))
      }
    })
  })
}