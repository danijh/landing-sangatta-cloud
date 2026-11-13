import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import DOMPurify from 'dompurify'
import { siteContent, siteMeta } from '../content/siteContent.js'
import SiteHeader from './SiteHeader.jsx'
import SiteFooter from './SiteFooter.jsx'
import { pathFor } from './routes.js'

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

export default function ArticlePage({ locale, articleKey }) {
  const t = siteContent[locale]
  const [article, setArticle] = useState(null)
  const [state, setState] = useState('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)

  const isIdLookup = /^\d+$/.test(articleKey)
  const query = isIdLookup ? `id=${encodeURIComponent(articleKey)}` : `slug=${encodeURIComponent(articleKey)}`

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = siteMeta[locale].articles.title
  }, [locale])

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setArticle(null)

    fetch(`/api/content.php?action=news-article&${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.article || typeof result.article !== 'object') {
          throw new Error(result?.error || 'Artikel tidak ditemukan.')
        }
        setArticle(result.article)
        document.title = `${result.article.title} — Sangatta Cloud`
        setState('loaded')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setState('error')
      })
    return () => controller.abort()
  }, [query, loadAttempt])

  const articleHtml = useMemo(() => {
    const content = article?.content
    if (!content) return ''
    try {
      return DOMPurify.sanitize(String(content))
    } catch {
      return ''
    }
  }, [article?.content])

  const date = formatNewsDate(article?.published_at || article?.created_at, locale)

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-ink">
      <div className="relative">
        <SiteHeader locale={locale} page="articles" t={t} />
        <section className="info-hero" style={{ paddingTop: '128px' }}>
          <div className="site-container">
            <a className="info-back" href={pathFor(locale, 'articles')}>
              <ArrowLeft size={15} />
              {t.articlesBack}
            </a>
            {state === 'loaded' && article && (
              <>
                <h1>{article.title}</h1>
                <p className="help-article-meta">
                  {[
                    date && `${date}`,
                    article.author ? `${t.articlesBy} ${article.author}` : '',
                  ].filter(Boolean).join(' · ')}
                </p>
              </>
            )}
            {state === 'loading' && <p className="info-subtitle">{t.articlesLoading}</p>}
          </div>
        </section>
      </div>

      <main className="help-article-main site-container">
        {state === 'loading' && <p className="help-state" role="status">{t.articlesLoading}</p>}
        {state === 'error' && (
          <div className="help-state help-state-error" role="alert">
            <div>
              <strong>{t.articlesNotFound}</strong>
              <p>{t.articlesNotFoundBody}</p>
            </div>
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{t.retry}</button>
          </div>
        )}
        {state === 'loaded' && article && (
          <article className="help-article-card">
            {article.image && (
              <img className="article-detail-image" src={article.image} alt="" />
            )}
            {article.description && (
              <p className="article-detail-desc">{article.description}</p>
            )}
            {articleHtml ? (
              <div className="help-article-content" dangerouslySetInnerHTML={{ __html: articleHtml }} />
            ) : (
              <p className="help-state">{t.articlesEmpty}</p>
            )}
          </article>
        )}
      </main>

      <SiteFooter locale={locale} t={t} />
    </div>
  )
}
