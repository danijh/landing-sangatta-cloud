import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Search } from 'lucide-react'
import { siteContent, siteMeta } from '../content/siteContent.js'
import SiteHeader from './SiteHeader.jsx'
import SiteFooter from './SiteFooter.jsx'
import { newsArticlePath, pathFor } from './routes.js'

function formatNewsDate(value, locale) {
  if (!value) return ''
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default function ArticlesPage({ locale }) {
  const t = siteContent[locale]
  const [articles, setArticles] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = siteMeta[locale].articles.title
  }, [locale])

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setError('')
    fetch('/api/content.php?action=news&per_page=100', { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(result?.news)) {
          throw new Error(result?.error || 'Artikel tidak dapat dimuat.')
        }
        setArticles(result.news)
        setState('loaded')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message || t.articlesLoadError)
          setState('error')
        }
      })
    return () => controller.abort()
  }, [loadAttempt])

  const visibleArticles = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((article) =>
      `${article.title} ${article.description || ''} ${article.excerpt || ''}`.toLowerCase().includes(q))
  }, [articles, query])

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-ink">
      <div className="relative">
        <SiteHeader locale={locale} page="articles" t={t} />
        <section className="info-hero" style={{ paddingTop: '128px' }}>
          <div className="site-container">
            <a className="info-back" href={pathFor(locale)}>
              <ArrowLeft size={15} />
              {locale === 'id' ? 'Kembali ke beranda' : 'Back to home'}
            </a>
            <p className="info-eyebrow">SANGATTA CLOUD</p>
            <h1>{t.articlesTitle}</h1>
            <p className="info-subtitle">{t.articlesSubtitle}</p>
            <label className="help-search">
              <Search size={17} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.helpSearchPlaceholder}
                aria-label={t.articlesTitle}
              />
            </label>
          </div>
        </section>
      </div>

      <main className="help-main site-container">
        {state === 'loading' && (
          <p className="help-state" role="status">{t.articlesLoading}</p>
        )}
        {state === 'error' && (
          <div className="help-state help-state-error" role="alert">
            <span>{error || t.articlesLoadError}</span>
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{t.retry}</button>
          </div>
        )}
        {state === 'loaded' && visibleArticles.length === 0 && (
          <p className="help-state">{query ? t.helpEmpty : t.articlesEmpty}</p>
        )}
        {state === 'loaded' && visibleArticles.length > 0 && (
          <div className="articles-grid">
            {visibleArticles.map((article) => {
              const date = formatNewsDate(article.published_at || article.created_at, locale)
              const excerpt = article.excerpt || article.description || ''
              return (
                <a className="article-card" href={newsArticlePath(locale, article)} key={article.id}>
                  {article.image && (
                    <span className="article-card-image">
                      <img src={article.image} alt="" loading="lazy" />
                    </span>
                  )}
                  <span className="article-card-body">
                    <span className="article-card-meta">
                      {date && (
                        <span><CalendarDays size={13} /> {date}</span>
                      )}
                      {article.author && <span>{t.articlesBy} {article.author}</span>}
                    </span>
                    <strong className="article-card-title">{article.title}</strong>
                    {excerpt && <span className="article-card-excerpt">{excerpt}</span>}
                    <span className="article-card-more">
                      {locale === 'id' ? 'Baca artikel' : 'Read article'}
                      <ArrowRight size={14} />
                    </span>
                  </span>
                </a>
              )
            })}
          </div>
        )}
      </main>

      <SiteFooter locale={locale} t={t} />
    </div>
  )
}
