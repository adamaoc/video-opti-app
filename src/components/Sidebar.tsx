import type { PresetId } from '@/constants/presets'
import { PresetPicker } from './PresetPicker'
import './Sidebar.css'

interface SidebarProps {
  presetId: PresetId
  onPresetChange: (id: PresetId) => void
  customMaxHeight: number
  customCrf: number
  onCustomChange: (maxHeight: number, crf: number) => void
  outputDir: string | null
  onPickOutputDir: () => void
  onClearOutputDir: () => void
  onAddFiles: () => void
  onStart: () => void
  onCancel: () => void
  onReveal: () => void
  encoding: boolean
  canStart: boolean
  hasOutput: boolean
}

export function Sidebar({
  presetId,
  onPresetChange,
  customMaxHeight,
  customCrf,
  onCustomChange,
  outputDir,
  onPickOutputDir,
  onClearOutputDir,
  onAddFiles,
  onStart,
  onCancel,
  onReveal,
  encoding,
  canStart,
  hasOutput,
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
        <p className="sidebar__path mono" title={outputDir ?? 'Same as source'}>
          {outputDir ?? 'Same as source'}
        </p>
        <div className="sidebar__path-actions">
          <button type="button" className="btn btn--secondary" onClick={onPickOutputDir} disabled={encoding}>
            Choose
          </button>
          {outputDir && (
            <button type="button" className="btn btn--ghost" onClick={onClearOutputDir} disabled={encoding}>
              Reset
            </button>
          )}
        </div>
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