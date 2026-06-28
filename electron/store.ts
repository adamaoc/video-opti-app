import Store from 'electron-store'
import type { PresetId } from './ffmpeg/presets'

export interface AppSettings {
  defaultPreset: PresetId
  outputDir: string | null
  customMaxHeight: number
  customCrf: number
}

const defaults: AppSettings = {
  defaultPreset: 'quick-share',
  outputDir: null,
  customMaxHeight: 1080,
  customCrf: 23,
}

export const settingsStore = new Store<AppSettings>({
  name: 'vidopti-settings',
  defaults,
})