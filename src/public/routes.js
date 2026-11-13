export const LOCALES = ['id', 'en']
export const PUBLIC_PAGES = ['', 'pricing', 'features', 'help', 'articles', 'artikel', 'about', 'contact', 'terms', 'privacy']
export const INFO_PAGES = ['about', 'contact', 'terms', 'privacy']
export const DEFAULT_LOCALE = 'id'

const SEGMENT_PAGES = { artikel: 'articles', articles: 'articles' }

export const localizedPageSegment = (locale, page) =>
  page === 'articles' ? (locale === 'id' ? 'artikel' : 'articles') : page

export const pathFor = (locale, page = '') =>
  page ? `/${locale}/${localizedPageSegment(locale, page)}` : `/${locale}`

export const articlePath = (locale, article) =>
  `/${locale}/help/${encodeURIComponent(article.slug || String(article.id))}`

export const newsArticlePath = (locale, article) =>
  `/${locale}/${localizedPageSegment(locale, 'articles')}/${encodeURIComponent(article.slug || String(article.id))}`

export const alternateLocale = (locale) => (locale === 'id' ? 'en' : 'id')

export function parsePublicPath(pathname) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 3) return null
  const [first, second, third] = segments
  if (!LOCALES.includes(first)) return null
  if (second === undefined) return { locale: first, page: '' }

  const secondPage = SEGMENT_PAGES[second] || second

  if (third !== undefined) {
    if ((secondPage === 'help' || secondPage === 'articles') && third !== '') {
      return { locale: first, page: secondPage, slug: decodeURIComponent(third) }
    }
    return null
  }
  if (PUBLIC_PAGES.includes(second)) return { locale: first, page: secondPage }
  return null
}
