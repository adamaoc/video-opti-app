import './ProgressBar.css'

interface ProgressBarProps {
  percent: number
  label?: string
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div className="progress">
      <div className="progress__track">
        <div className="progress__fill" style={{ width: `${clamped}%` }} />
      </div>
      {label && <span className="progress__label mono">{label}</span>}
    </div>
  )
}