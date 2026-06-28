import type { PresetId } from '@/constants/presets'
import { PRESETS } from '@/constants/presets'
import './PresetPicker.css'

interface PresetPickerProps {
  value: PresetId
  onChange: (id: PresetId) => void
  customMaxHeight: number
  customCrf: number
  onCustomChange: (maxHeight: number, crf: number) => void
  disabled?: boolean
}

export function PresetPicker({
  value,
  onChange,
  customMaxHeight,
  customCrf,
  onCustomChange,
  disabled,
}: PresetPickerProps) {
  return (
    <div className="presets">
      <p className="presets__label">Preset</p>
      <div className="presets__list">
        {PRESETS.map(preset => (
          <label
            key={preset.id}
            className={`presets__item${value === preset.id ? ' presets__item--active' : ''}`}
          >
            <input
              type="radio"
              name="preset"
              value={preset.id}
              checked={value === preset.id}
              onChange={() => onChange(preset.id)}
              disabled={disabled}
            />
            <span className="presets__item-text">
              <span className="presets__item-label">{preset.label}</span>
              <span className="presets__item-desc">{preset.description}</span>
            </span>
          </label>
        ))}
      </div>

      {value === 'custom' && (
        <div className="presets__custom">
          <label className="presets__field">
            <span>Max height</span>
            <select
              value={customMaxHeight}
              onChange={e => onCustomChange(Number(e.target.value), customCrf)}
              disabled={disabled}
            >
              <option value={480}>480p</option>
              <option value={720}>720p</option>
              <option value={1080}>1080p</option>
              <option value={1440}>1440p</option>
              <option value={2160}>2160p</option>
            </select>
          </label>
          <label className="presets__field">
            <span>Quality (CRF)</span>
            <input
              type="range"
              min={18}
              max={36}
              value={customCrf}
              onChange={e => onCustomChange(customMaxHeight, Number(e.target.value))}
              disabled={disabled}
            />
            <span className="mono">{customCrf}</span>
          </label>
        </div>
      )}
    </div>
  )
}