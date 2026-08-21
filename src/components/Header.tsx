import { ThemeToggle } from './ThemeToggle'
import type { Theme, User } from '../lib/types'

interface Props {
  user: User
  theme: Theme
  onToggleTheme: () => void
  onSignOut: () => void
}

export function Header({ user, theme, onToggleTheme, onSignOut }: Props) {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__logo" aria-hidden="true">
          ◔
        </span>
        <div>
          <p className="header__title">Portfolio Watcher</p>
          <p className="header__user" data-testid="current-user">
            {user.name}
            <span className="header__provider">{user.provider}</span>
          </p>
        </div>
      </div>
      <div className="header__actions">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button type="button" className="btn btn--ghost btn--sm" onClick={onSignOut}>
          Log out
        </button>
      </div>
    </header>
  )
}
