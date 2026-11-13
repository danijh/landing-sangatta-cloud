import { useState } from 'react'
import {
  ArrowUpRight,
  ChevronDown,
  Cloud,
  Globe2,
  LogOut,
  Menu,
  UserRound,
  X,
} from 'lucide-react'
import { NotificationBell, useNotifications } from '../notifications.jsx'
import { alternateLocale, pathFor } from './routes.js'
import { usePublicSession } from './usePublicSession.js'

export default function SiteHeader({ locale, page = '', t }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const { sessionClient, csrfToken, isLoggingOut, logout } = usePublicSession()
  const notifications = useNotifications({ enabled: Boolean(sessionClient), csrfToken })
  const closeMenu = () => setMobileMenuOpen(false)

  const clientName = sessionClient
    ? sessionClient.name
      || [sessionClient.first_name, sessionClient.last_name].filter(Boolean).join(' ')
      || sessionClient.email?.split('@')[0]
      || 'Pelanggan'
    : ''
  const clientInitials = clientName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')

  const navItems = [
    { label: t.home, href: pathFor(locale) },
    { label: t.nav[0], href: pathFor(locale, 'pricing') },
    { label: t.nav[1], href: pathFor(locale, 'features') },
    { label: t.helpNav, href: pathFor(locale, 'help') },
    { label: t.nav[2], href: pathFor(locale, 'contact') },
  ]

  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="site-container flex h-[84px] items-center justify-between">
        <a className="brand-lockup" href={pathFor(locale)} aria-label="Sangatta Cloud home">
          <span className="brand-mark">
            <Cloud size={21} strokeWidth={2.2} />
          </span>
          <span className="text-teal text-[28px] font-bold tracking-[-0.04em]">
            Sangatta <span className="text-[#8a94a6]">Cloud</span><span className="text-ember animate-pulse">.</span>
          </span>
        </a>

        <nav className={`${mobileMenuOpen ? 'mobile-nav-open' : 'mobile-nav'}`}>
          {navItems.map((item) => (
            <a className="nav-link" href={item.href} key={item.label} onClick={closeMenu}>
              {item.label}
            </a>
          ))}
          <div className="flex items-center gap-3 border-t border-ink/10 pt-4 md:border-0 md:pt-0">
            <button
              className="language-toggle"
              type="button"
              onClick={() => window.location.assign(pathFor(alternateLocale(locale), page))}
              aria-label={`${t.languageLabel}: ${locale === 'id' ? 'English' : 'Bahasa Indonesia'}`}
            >
              <Globe2 size={15} />
              <span>{locale === 'id' ? 'ID' : 'EN'}</span>
              <ChevronDown size={13} />
            </button>
            {sessionClient ? (
              <>
                <NotificationBell
                  notifications={notifications}
                  open={bellOpen}
                  onOpenChange={setBellOpen}
                  onSelect={(item) => {
                    notifications.markTicketRead(item.ticketId)
                    window.location.assign(`/dashboard#ticket-${item.ticketId}`)
                  }}
                />
                <div className="nav-account-wrap" onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setAccountMenuOpen(false)
                }} onKeyDown={(event) => {
                  if (event.key === 'Escape') setAccountMenuOpen(false)
                }}>
                  <button className="nav-user" type="button" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}>
                    <span className="nav-user-avatar">{clientInitials}</span>
                    <span>{clientName}</span>
                    <ChevronDown size={13} />
                  </button>
                  {accountMenuOpen && (
                    <div className="dashboard-account-menu" role="menu">
                      <a className="nav-account-item" role="menuitem" href="/dashboard#profile" onClick={closeMenu}><UserRound size={15} /> Profil</a>
                      <button type="button" role="menuitem" className="dashboard-account-menu-logout" onClick={logout} disabled={isLoggingOut}><LogOut size={15} /> {isLoggingOut ? 'Keluar...' : 'Keluar'}</button>
                    </div>
                  )}
                </div>
                <a className="button button-dark nav-cta" href="/dashboard" onClick={closeMenu}>
                  Dashboard
                  <ArrowUpRight size={15} />
                </a>
              </>
            ) : (
              <>
                <a className="nav-sign-in" href="/login" onClick={closeMenu}>
                  {t.signIn}
                </a>
                <a className="button button-dark nav-cta" href="/signup" onClick={closeMenu}>
                  {t.getStarted}
                  <ArrowUpRight size={15} />
                </a>
              </>
            )}
          </div>
        </nav>

        <button
          aria-label={mobileMenuOpen ? t.closeMenu : t.menuLabel}
          className="menu-button"
          type="button"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </header>
  )
}
