import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Search } from 'lucide-react'
import { siteContent, siteMeta } from '../content/siteContent.js'
import SiteHeader from './SiteHeader.jsx'
import SiteFooter from './SiteFooter.jsx'
import { articlePath, pathFor } from './routes.js'

export default function HelpPage({ locale }) {
  const t = siteContent[locale]
  const [categories, setCategories] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = siteMeta[locale].help.title
  }, [locale])

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setError('')
    fetch('/api/content.php?action=kb-categories&per_page=100', { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(result?.categories)) {
          throw new Error(result?.error || 'Artikel tidak dapat dimuat.')
        }
        setCategories(result.categories)
        setState('loaded')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message || t.helpLoadError)
          setState('error')
        }
      })
    return () => controller.abort()
  }, [loadAttempt])

  const visibleCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories
      .map((category) => ({
        ...category,
        articles: (category.articles || []).filter((article) =>
          article.title.toLowerCase().includes(q)),
      }))
      .filter((category) =>
        category.articles.length > 0
        || `${category.title} ${category.description ?? ''}`.toLowerCase().includes(q))
  }, [categories, query])

  const totalArticles = categories.reduce((sum, category) => sum + (category.articles?.length || 0), 0)

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-ink">
      <div className="relative">
        <SiteHeader locale={locale} page="help" t={t} />
        <section className="info-hero" style={{ paddingTop: '128px' }}>
          <div className="site-container">
            <a className="info-back" href={pathFor(locale)}>
              <ArrowLeft size={15} />
              {locale === 'id' ? 'Kembali ke beranda' : 'Back to home'}
            </a>
            <p className="info-eyebrow">SANGATTA CLOUD</p>
            <h1>{t.helpTitle}</h1>
            <p className="info-subtitle">{t.helpSubtitle}</p>
            <label className="help-search">
              <Search size={17} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.helpSearchPlaceholder}
                aria-label={t.helpSearchLabel}
              />
            </label>
          </div>
        </section>
      </div>

      <main className="help-main site-container">
        {state === 'loading' && (
          <p className="help-state" role="status">{t.helpLoading}</p>
        )}
        {state === 'error' && (
          <div className="help-state help-state-error" role="alert">
            <span>{error || t.helpLoadError}</span>
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{t.retry}</button>
          </div>
        )}
        {state === 'loaded' && visibleCategories.length === 0 && (
          <p className="help-state">{t.helpEmpty}</p>
        )}
        {state === 'loaded' && visibleCategories.length > 0 && (
          <div className="help-grid">
            {visibleCategories.map((category) => (
              <article className="help-category-card" key={category.id}>
                <div className="help-category-head">
                  <span className="help-category-icon"><BookOpen size={18} /></span>
                  <div>
                    <h2>{category.title}</h2>
                    {category.description && <p>{category.description}</p>}
                  </div>
                </div>
                <div className="help-category-articles">
                  {category.articles.length ? category.articles.map((article) => (
                    <a className="help-article-link" href={articlePath(locale, article)} key={article.id}>
                      <span>{article.title}</span>
                      <ChevronRight size={15} />
                    </a>
                  )) : (
                    <span className="help-category-empty">{t.helpNoArticles}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {state === 'loaded' && totalArticles === 0 && query === '' && (
          <p className="help-state">{t.helpNoArticles}</p>
        )}
      </main>

      <SiteFooter locale={locale} t={t} />
    </div>
  )
}
