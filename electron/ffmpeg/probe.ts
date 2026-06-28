import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { getFfprobePath } from './paths'

export interface VideoMetadata {
  path: string
  name: string
  size: number
  duration: number
  width: number
  height: number
  codec: string
}

interface FfprobeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
}

interface FfprobeResult {
  format?: { duration?: string }
  streams?: FfprobeStream[]
}

function runFfprobe(filePath: string): Promise<FfprobeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]

    const proc = spawn(getFfprobePath(), args)
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', chunk => { stdout += chunk })
    proc.stderr.on('data', chunk => { stderr += chunk })
    proc.on('error', reject)
    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr || `ffprobe exited with code ${code}`))
        return
      }
      try {
        resolve(JSON.parse(stdout) as FfprobeResult)
      } catch {
        reject(new Error('Failed to parse ffprobe output'))
      }
    })
  })
}

export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  const [info, fileStat] = await Promise.all([
    runFfprobe(filePath),
    stat(filePath),
  ])

  const videoStream = info.streams?.find(s => s.codec_type === 'video')
  const duration = parseFloat(info.format?.duration ?? '0') || 0

  return {
    path: filePath,
    name: path.basename(filePath),
    size: fileStat.size,
    duration,
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    codec: videoStream?.codec_name ?? 'unknown',
  }
}