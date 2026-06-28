import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
}

const MAX_ENTRIES = 500
const entries: LogEntry[] = []
let logFilePath: string | null = null
let entryCounter = 0

type LogListener = (entry: LogEntry) => void
const listeners = new Set<LogListener>()

function makeId(): string {
  entryCounter += 1
  return `${Date.now()}-${entryCounter}`
}

async function ensureLogFile(): Promise<string> {
  if (logFilePath) return logFilePath
  const dir = path.join(app.getPath('userData'), 'logs')
  await mkdir(dir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  logFilePath = path.join(dir, `vidopti-${date}.log`)
  return logFilePath
}

function pushEntry(level: LogLevel, source: string, message: string): LogEntry {
  const entry: LogEntry = {
    id: makeId(),
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
  }

  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.shift()

  for (const listener of listeners) listener(entry)

  void (async () => {
    try {
      const file = await ensureLogFile()
      const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}\n`
      await appendFile(file, line, 'utf8')
    } catch {
      // Non-fatal — UI still receives the entry
    }
  })()

  return entry
}

export const logger = {
  info: (source: string, message: string) => pushEntry('info', source, message),
  warn: (source: string, message: string) => pushEntry('warn', source, message),
  error: (source: string, message: string) => pushEntry('error', source, message),
  debug: (source: string, message: string) => pushEntry('debug', source, message),

  getEntries: () => [...entries],

  clear: () => {
    entries.length = 0
  },

  subscribe: (listener: LogListener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getLogFilePath: () => logFilePath,
}