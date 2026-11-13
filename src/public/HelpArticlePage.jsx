import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { siteContent, siteMeta } from '../content/siteContent.js'
import SiteHeader from './SiteHeader.jsx'
import SiteFooter from './SiteFooter.jsx'
import { articlePath, pathFor } from './routes.js'

function formatArticleDate(value, locale) {
  if (!value) return ''
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default function HelpArticlePage({ locale, articleKey }) {
  const t = siteContent[locale]
  const [article, setArticle] = useState(null)
  const [related, setRelated] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  const isIdLookup = /^\d+$/.test(articleKey)
  const query = isIdLookup ? `id=${encodeURIComponent(articleKey)}` : `slug=${encodeURIComponent(articleKey)}`

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = siteMeta[locale].help.title
  }, [locale])

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setError('')
    setArticle(null)
    setRelated([])

    fetch(`/api/content.php?action=kb-article&${query}`, { signal: controller.signal })
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
        if (err.name !== 'AbortError') {
          setError(err.message || 'Artikel tidak ditemukan.')
          setState('error')
        }
      })
    return () => controller.abort()
  }, [query, loadAttempt])

  useEffect(() => {
    if (!article?.category?.id) return undefined
    const controller = new AbortController()
    fetch('/api/content.php?action=kb-categories&per_page=100', { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(result?.categories)) return
        const category = result.categories.find((item) => item.id === article.category.id)
        if (!category) return
        setRelated((category.articles || []).filter((item) => item.id !== article.id).slice(0, 6))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [article])

  const articleHtml = useMemo(() => {
    const content = article?.content
    if (!content) return ''
    try {
      return DOMPurify.sanitize(marked.parse(content, { async: false, breaks: true }))
    } catch {
      return ''
    }
  }, [article?.content])

  const updatedLabel = formatArticleDate(article?.updated_at || article?.created_at, locale)

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-ink">
      <div className="relative">
        <SiteHeader locale={locale} page="help" t={t} />
        <section className="info-hero help-article-hero" style={{ paddingTop: '128px' }}>
          <div className="site-container">
            <a className="info-back" href={pathFor(locale, 'help')}>
              <ArrowLeft size={15} />
              {t.helpBack}
            </a>
            {state === 'loaded' && article && (
              <>
                {article.category?.title && (
                  <span className="help-article-category">{article.category.title}</span>
                )}
                <h1>{article.title}</h1>
                {updatedLabel && (
                  <p className="help-article-meta">
                    {t.helpUpdated} {updatedLabel}
                  </p>
                )}
              </>
            )}
            {state === 'loading' && <p className="info-subtitle">{t.helpLoading}</p>}
          </div>
        </section>
      </div>

      <main className="help-article-main site-container">
        {state === 'loading' && <p className="help-state" role="status">{t.helpLoading}</p>}
        {state === 'error' && (
          <div className="help-state help-state-error" role="alert">
            <div>
              <strong>{t.helpNotFound}</strong>
              <p>{t.helpNotFoundBody}</p>
            </div>
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{t.retry}</button>
          </div>
        )}
        {state === 'loaded' && article && (
          <>
            <article className="help-article-card">
              {articleHtml ? (
                <div className="help-article-content" dangerouslySetInnerHTML={{ __html: articleHtml }} />
              ) : (
                <p className="help-state">{t.helpNoArticles}</p>
              )}
            </article>

            {related.length > 0 && (
              <aside className="help-related">
                <h2>{t.helpRelated}</h2>
                <div className="help-related-list">
                  {related.map((item) => (
                    <a className="help-related-link" href={articlePath(locale, item)} key={item.id}>
                      <BookOpen size={15} />
                      <span>{item.title}</span>
                      <ChevronRight size={15} />
                    </a>
                  ))}
                </div>
              </aside>
            )}
          </>
        )}
      </main>

      <SiteFooter locale={locale} t={t} />
    </div>
  )
}
