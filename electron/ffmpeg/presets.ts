export type PresetId = 'quick-share' | 'social' | 'smallest' | 'custom'

export interface Preset {
  id: PresetId
  label: string
  description: string
  maxHeight: number
  crf: number
  suffix: string
}

export interface CustomOptions {
  maxHeight: number
  crf: number
}

export const PRESETS: Preset[] = [
  {
    id: 'quick-share',
    label: 'Quick share',
    description: '720p — iMessage, email',
    maxHeight: 720,
    crf: 28,
    suffix: '_720p',
  },
  {
    id: 'social',
    label: 'Social',
    description: '1080p — Instagram, Discord',
    maxHeight: 1080,
    crf: 23,
    suffix: '_1080p',
  },
  {
    id: 'smallest',
    label: 'Smallest',
    description: '480p — aggressive compression',
    maxHeight: 480,
    crf: 32,
    suffix: '_480p',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Set resolution and quality',
    maxHeight: 1080,
    crf: 23,
    suffix: '_optimized',
  },
]

export function resolvePreset(
  presetId: PresetId,
  custom?: CustomOptions,
): { maxHeight: number; crf: number } {
  const preset = PRESETS.find(p => p.id === presetId) ?? PRESETS[0]

  if (presetId === 'custom' && custom) {
    return {
      maxHeight: custom.maxHeight,
      crf: custom.crf,
    }
  }

  return {
    maxHeight: preset.maxHeight,
    crf: preset.crf,
  }
}