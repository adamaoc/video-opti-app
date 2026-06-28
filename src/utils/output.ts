export const OUTPUT_SUBFOLDER = 'vid-opti'

function getPathSeparator(filePath: string): string {
  return filePath.includes('\\') ? '\\' : '/'
}

export function getSourceDir(filePath: string): string {
  const sep = getPathSeparator(filePath)
  const parts = filePath.split(sep)
  parts.pop()
  return parts.join(sep)
}

export function getUniqueSourceDirs(filePaths: string[]): string[] {
  return [...new Set(filePaths.map(getSourceDir))]
}

export function hasMultipleSourceDirs(filePaths: string[]): boolean {
  return getUniqueSourceDirs(filePaths).length > 1
}

export function resolveDefaultOutputDir(sourcePath: string): string {
  const sep = getPathSeparator(sourcePath)
  return `${getSourceDir(sourcePath)}${sep}${OUTPUT_SUBFOLDER}`
}

export function describeOutputFolder(
  filePaths: string[],
  manualDir: string | null,
): { label: string; warning?: string } {
  if (filePaths.length === 0) {
    return { label: `${OUTPUT_SUBFOLDER}/ next to source videos` }
  }

  if (hasMultipleSourceDirs(filePaths)) {
    if (manualDir) return { label: manualDir }
    return {
      label: 'Choose a folder (multiple sources)',
      warning: 'Videos are from different folders. Pick one output folder before encoding.',
    }
  }

  if (manualDir) return { label: manualDir }
  return { label: resolveDefaultOutputDir(filePaths[0]) }
}

export function buildOutputPreviewName(fileName: string, index: number, useSequence: boolean): string {
  const base = fileName.replace(/\.[^.]+$/, '')
  if (!useSequence) return `${base}.mp4`
  return `${base}-${String(index + 1).padStart(3, '0')}.mp4`
}