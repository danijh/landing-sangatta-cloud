import { useEffect } from 'react'
import AdminPage from './AdminPage.jsx'
import AuthPage from './AuthPage.jsx'
import ClientDashboardPage from './ClientDashboardPage.jsx'
import InfoPage from './InfoPage.jsx'
import HomePage from './public/HomePage.jsx'
import PricingPage from './public/PricingPage.jsx'
import FeaturesPage from './public/FeaturesPage.jsx'
import HelpPage from './public/HelpPage.jsx'
import HelpArticlePage from './public/HelpArticlePage.jsx'
import ArticlesPage from './public/ArticlesPage.jsx'
import ArticlePage from './public/ArticlePage.jsx'
import { DEFAULT_LOCALE, INFO_PAGES, parsePublicPath, pathFor } from './public/routes.js'

function Redirect({ to }) {
  useEffect(() => {
    window.location.replace(to + window.location.search)
  }, [to])
  return null
}

const PUBLIC_PAGE_COMPONENTS = {
  pricing: PricingPage,
  features: FeaturesPage,
  help: HelpPage,
  articles: ArticlesPage,
}

const LEGACY_INFO_PATHS = {
  '/about': 'about',
  '/contact': 'contact',
  '/terms': 'terms',
  '/privacy': 'privacy',
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'

  if (path === '/admin') return <AdminPage />
  if (path === '/login') return <AuthPage mode="login" />
  if (path === '/signup') return <AuthPage mode="signup" />
  if (path === '/order') return <ClientDashboardPage initialPage="orders" />
  if (path === '/dashboard') return <ClientDashboardPage />

  const publicRoute = parsePublicPath(path)
  if (publicRoute) {
    const { locale, page, slug } = publicRoute
    if (!page) return <HomePage locale={locale} />
    if (page === 'help' && slug) return <HelpArticlePage locale={locale} articleKey={slug} />
    if (page === 'articles' && slug) return <ArticlePage locale={locale} articleKey={slug} />
    if (INFO_PAGES.includes(page)) return <InfoPage page={page} locale={locale} />
    const Page = PUBLIC_PAGE_COMPONENTS[page]
    if (Page) return <Page locale={locale} />
  }

  const legacyPage = LEGACY_INFO_PATHS[path]
  if (legacyPage) return <Redirect to={pathFor(DEFAULT_LOCALE, legacyPage)} />

  return <Redirect to={pathFor(DEFAULT_LOCALE)} />
}

export default App
