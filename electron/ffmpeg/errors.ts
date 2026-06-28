export function extractFfmpegError(stderr: string): string {
  const lines = stderr
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const errorLines = lines.filter(line =>
    /error|invalid|failed|no such|not found|cannot|unable|permission denied/i.test(line),
  )

  if (errorLines.length) {
    return errorLines.slice(-4).join('\n')
  }

  return lines.slice(-6).join('\n') || 'Unknown FFmpeg error'
}

export function buildScaleFilter(maxHeight: number): string {
  // Comma must be escaped — otherwise FFmpeg treats it as a filter separator
  return `scale=-2:min(${maxHeight}\\,ih)`
}