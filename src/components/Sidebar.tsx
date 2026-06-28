import type { PresetId } from '@/constants/presets'
import { buildOutputPreviewName } from '@/utils/output'
import { PresetPicker } from './PresetPicker'
import './Sidebar.css'

interface SidebarProps {
  presetId: PresetId
  onPresetChange: (id: PresetId) => void
  customMaxHeight: number
  customCrf: number
  onCustomChange: (maxHeight: number, crf: number) => void
  outputLabel: string
  outputWarning?: string
  useSequenceSuffix: boolean
  onSequenceSuffixChange: (value: boolean) => void
  previewNames: string[]
  onPickOutputDir: () => void
  onClearOutputDir: () => void
  onAddFiles: () => void
  onStart: () => void
  onCancel: () => void
  onReveal: () => void
  encoding: boolean
  canStart: boolean
  hasOutput: boolean
  hasManualOutputDir: boolean
}

export function Sidebar({
  presetId,
  onPresetChange,
  customMaxHeight,
  customCrf,
  onCustomChange,
  outputLabel,
  outputWarning,
  useSequenceSuffix,
  onSequenceSuffixChange,
  previewNames,
  onPickOutputDir,
  onClearOutputDir,
  onAddFiles,
  onStart,
  onCancel,
  onReveal,
  encoding,
  canStart,
  hasOutput,
  hasManualOutputDir,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <PresetPicker
        value={presetId}
        onChange={onPresetChange}
        customMaxHeight={customMaxHeight}
        customCrf={customCrf}
        onCustomChange={onCustomChange}
        disabled={encoding}
      />

      <div className="sidebar__section">
        <p className="sidebar__label">Output folder</p>
        <p className={`sidebar__path mono${outputWarning ? ' sidebar__path--warn' : ''}`} title={outputLabel}>
          {outputLabel}
        </p>
        {outputWarning && <p className="sidebar__warning">{outputWarning}</p>}
        <div className="sidebar__path-actions">
          <button type="button" className="btn btn--secondary" onClick={onPickOutputDir} disabled={encoding}>
            Choose
          </button>
          {hasManualOutputDir && (
            <button type="button" className="btn btn--ghost" onClick={onClearOutputDir} disabled={encoding}>
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="sidebar__section">
        <label className="sidebar__checkbox">
          <input
            type="checkbox"
            checked={useSequenceSuffix}
            onChange={e => onSequenceSuffixChange(e.target.checked)}
            disabled={encoding}
          />
          <span>Add sequence suffix (-001, -002, …)</span>
        </label>
        {previewNames.length > 0 && (
          <div className="sidebar__preview">
            <p className="sidebar__label">Output names</p>
            {previewNames.slice(0, 3).map(name => (
              <p key={name} className="sidebar__preview-name mono">{name}</p>
            ))}
            {previewNames.length > 3 && (
              <p className="sidebar__preview-more mono">+{previewNames.length - 3} more</p>
            )}
          </div>
        )}
      </div>

      <div className="sidebar__actions">
        <button type="button" className="btn btn--secondary" onClick={onAddFiles} disabled={encoding}>
          Add files
        </button>
        {encoding ? (
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={onStart} disabled={!canStart}>
            Start encoding
          </button>
        )}
        {hasOutput && !encoding && (
          <button type="button" className="btn btn--ghost" onClick={onReveal}>
            Reveal in Finder
          </button>
        )}
      </div>
    </aside>
  )
}