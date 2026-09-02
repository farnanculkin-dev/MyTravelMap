import React from 'react'

type AppHeaderProps = {
  email?: string
  active: 'home' | 'map' | 'trips' | 'timeline' | 'settings'
  onHome: () => void
  onMap: () => void
  onTrips: () => void
  onTimeline: () => void
  onSettings: () => void
  onSignOut: () => void
}

export default function AppHeader({ email, active, onHome, onMap, onTrips, onTimeline, onSettings, onSignOut }: AppHeaderProps) {
  const navButton = (key: AppHeaderProps['active'], label: string, onClick: () => void) => (
    <button
      type="button"
      className={`app-nav-link${active === key ? ' active' : ''}`}
      aria-current={active === key ? 'page' : undefined}
      onClick={onClick}
    >
      {label}
    </button>
  )

  return <header className="app-header">
    <div className="app-header-inner">
      <button type="button" className="app-brand" onClick={onHome} aria-label="Family Atlas home">
        <span>FAMILY ATLAS</span>
      </button>
      <nav className="app-primary-nav" aria-label="Family Atlas navigation">
        {navButton('home', 'Home', onHome)}
        {navButton('map', 'My Map', onMap)}
        {navButton('trips', 'Trips', onTrips)}
        {navButton('timeline', 'Timeline', onTimeline)}
        {navButton('settings', 'Settings', onSettings)}
      </nav>
      <div className="app-account">
        <span className="app-account-email">{email || 'Family Atlas member'}</span>
        <button className="sign-out-btn" type="button" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  </header>
}
