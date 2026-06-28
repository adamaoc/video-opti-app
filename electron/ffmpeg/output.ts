import { mkdir } from 'node:fs/promises'
import path from 'node:path'

export const OUTPUT_SUBFOLDER = 'vid-opti'

export function getSourceDir(filePath: string): string {
  return path.dirname(filePath)
}

export function getUniqueSourceDirs(filePaths: string[]): string[] {
  return [...new Set(filePaths.map(getSourceDir))]
}

export function hasMultipleSourceDirs(filePaths: string[]): boolean {
  return getUniqueSourceDirs(filePaths).length > 1
}

export function resolveOutputDir(sourcePath: string, manualDir?: string | null): string {
  if (manualDir) return manualDir
  return path.join(getSourceDir(sourcePath), OUTPUT_SUBFOLDER)
}

export function buildOutputBasename(
  inputPath: string,
  index: number,
  useSequenceSuffix: boolean,
): string {
  const { name } = path.parse(inputPath)
  if (!useSequenceSuffix) return name
  return `${name}-${String(index + 1).padStart(3, '0')}`
}

export function buildOutputFilePath(
  inputPath: string,
  index: number,
  manualDir: string | null | undefined,
  useSequenceSuffix: boolean,
): string {
  const outputDir = resolveOutputDir(inputPath, manualDir)
  const basename = buildOutputBasename(inputPath, index, useSequenceSuffix)
  return path.join(outputDir, `${basename}.mp4`)
}

export async function ensureOutputDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}