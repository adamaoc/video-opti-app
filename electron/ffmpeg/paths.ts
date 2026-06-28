import { createRequire } from 'node:module'
import { app } from 'electron'
import path from 'node:path'
import { existsSync } from 'node:fs'

const require = createRequire(import.meta.url)

function resolveBinary(packageName: string, binaryName: string): string {
  const bundled = require(`${packageName}/package.json`) as { main?: string }
  const packageDir = path.dirname(require.resolve(`${packageName}/package.json`))
  const candidates = [
    path.join(packageDir, binaryName),
    path.join(packageDir, `${binaryName}.exe`),
    bundled.main ? path.join(packageDir, bundled.main) : '',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  throw new Error(`Could not find ${binaryName} binary for ${packageName}`)
}

export function getFfmpegPath(): string {
  if (app.isPackaged) {
    const unpacked = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'ffmpeg-static',
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
    )
    if (existsSync(unpacked)) return unpacked
  }

  return resolveBinary('ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
}

export function getFfprobePath(): string {
  if (app.isPackaged) {
    const unpacked = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      'ffprobe-static',
      'bin',
      process.platform,
      process.arch,
      process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe',
    )
    if (existsSync(unpacked)) return unpacked
  }

  return require('ffprobe-static').path as string
}