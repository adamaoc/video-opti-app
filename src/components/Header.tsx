import './Header.css'

interface HeaderProps {
  onOpenSettings?: () => void
}

export function Header({ onOpenSettings }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__name">VidOpti</span>
        <span className="header__tagline">Compress & resize videos locally</span>
      </div>
      {onOpenSettings && (
        <button type="button" className="header__settings" onClick={onOpenSettings} aria-label="Settings">
          ⚙
        </button>
      )}
    </header>
  )
}