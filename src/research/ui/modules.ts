/** Navigation modules for the research platform shell. */
export type ModuleId =
  | 'dashboard'
  | 'discover'
  | 'company'
  | 'portfolio'
  | 'macro'
  | 'watchlists'
  | 'reports'
  | 'alerts'
  | 'settings'

export const MODULES: { id: ModuleId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'discover', label: 'Discover' },
  { id: 'company', label: 'Company Research' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'macro', label: 'Macro' },
  { id: 'watchlists', label: 'Watchlists' },
  { id: 'reports', label: 'Reports' },
  { id: 'alerts', label: 'Price Alerts' },
  { id: 'settings', label: 'Settings' },
]
