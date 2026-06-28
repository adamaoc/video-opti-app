import './Header.css'

interface HeaderProps {
  onToggleLogs?: () => void
  logsOpen?: boolean
  errorCount?: number
}

export function Header({ onToggleLogs, logsOpen, errorCount = 0 }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__name">VidOpti</span>
        <span className="header__tagline">Compress & resize videos locally</span>
      </div>
      {onToggleLogs && (
        <button
          type="button"
          className={`header__logs${logsOpen ? ' header__logs--active' : ''}`}
          onClick={onToggleLogs}
        >
          Logs{errorCount > 0 && <span className="header__badge">{errorCount}</span>}
        </button>
      )}
    </header>
  )
}