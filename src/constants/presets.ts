export type PresetId = 'quick-share' | 'social' | 'smallest' | 'custom'

export interface Preset {
  id: PresetId
  label: string
  description: string
}

export const PRESETS: Preset[] = [
  { id: 'quick-share', label: 'Quick share', description: '720p — iMessage, email' },
  { id: 'social', label: 'Social', description: '1080p — Instagram, Discord' },
  { id: 'smallest', label: 'Smallest', description: '480p — aggressive compression' },
  { id: 'custom', label: 'Custom', description: 'Set resolution and quality' },
]