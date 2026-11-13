import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { siteMeta } from '../src/content/siteContent.js'
import { infoCopy } from '../src/content/infoCopy.js'
import { LOCALES, INFO_PAGES, localizedPageSegment } from '../src/public/routes.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const port = Number(process.env.PRERENDER_PORT || 4173)
const base = `http://127.0.0.1:${port}`
const siteUrl = (process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, '')

const PAGES = ['', 'pricing', 'features', 'help', 'articles', ...INFO_PAGES]

const routePath = (locale, route) => {
  if (route.slug) {
    return `/${locale}/${localizedPageSegment(locale, route.page)}/${encodeURIComponent(route.slug)}`
  }
  return route.page ? `/${locale}/${localizedPageSegment(locale, route.page)}` : `/${locale}`
}

function staticRoutes() {
  return LOCALES.flatMap((locale) =>
    PAGES.map((page) => ({
      locale,
      page,
      slug: null,
      path: routePath(locale, { page, slug: null }),
      outDir: page ? [locale, localizedPageSegment(locale, page)] : [locale],
    })),
  )
}

async function helpArticleRoutes() {
  try {
    const response = await fetch(`${base}/api/content.php?action=kb-categories&per_page=100`)
    const result = await response.json()
    if (!response.ok || !Array.isArray(result?.categories)) return []

    const articles = []
    const seen = new Set()
    for (const category of result.categories) {
      for (const article of category.articles || []) {
        const key = article.slug || String(article.id)
        if (!key || seen.has(key)) continue
        seen.add(key)
        articles.push({ key, article })
      }
    }

    const routes = []
    for (const { key } of articles) {
      let meta = null
      try {
        const param = /^[0-9]+$/.test(key) ? `id=${encodeURIComponent(key)}` : `slug=${encodeURIComponent(key)}`
        const detail = await fetch(`${base}/api/content.php?action=kb-article&${param}`)
        const detailResult = await detail.json()
        const fetched = detailResult?.article
        if (fetched && typeof fetched.title === 'string') {
          const plain = String(fetched.content || '')
            .replace(/[#>*_`[\]()!~-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          meta = {
            title: `${fetched.title} — Sangatta Cloud`,
            description: plain.slice(0, 160) || undefined,
          }
        }
      } catch {
        // meta opsional — title di DOM sudah benar dari React
      }
      for (const locale of LOCALES) {
        routes.push({
          locale,
          page: 'help',
          slug: key,
          path: routePath(locale, { page: 'help', slug: key }),
          outDir: [locale, 'help', key],
          meta,
        })
      }
    }
    return routes
  } catch (error) {
    console.warn(`[prerender] gagal memuat daftar artikel bantuan: ${error.message}`)
    return []
  }
}

async function newsArticleRoutes() {
  try {
    const response = await fetch(`${base}/api/content.php?action=news&per_page=100`)
    const result = await response.json()
    if (!response.ok || !Array.isArray(result?.news)) return []

    const seen = new Set()
    const routes = []
    for (const article of result.news) {
      const key = article.slug || String(article.id)
      if (!key || seen.has(key)) continue
      seen.add(key)
      const meta = {
        title: `${article.title} — Sangatta Cloud`,
        description: (article.excerpt || article.description || '').slice(0, 160) || undefined,
      }
      for (const locale of LOCALES) {
        routes.push({
          locale,
          page: 'articles',
          slug: key,
          path: routePath(locale, { page: 'articles', slug: key }),
          outDir: [locale, localizedPageSegment(locale, 'articles'), key],
          meta,
        })
      }
    }
    return routes
  } catch (error) {
    console.warn(`[prerender] gagal memuat daftar berita: ${error.message}`)
    return []
  }
}

function pageMeta({ locale, page, meta }) {
  if (meta) return meta
  if (!page || page === '') return siteMeta[locale].home
  if (page === 'pricing' || page === 'features' || page === 'help' || page === 'articles') return siteMeta[locale][page]
  const info = infoCopy[locale].pages[page]
  return {
    title: `${info.title} — Sangatta Cloud`,
    description: info.subtitle || siteMeta[locale].home.description,
  }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  for (const name of ['google-chrome', 'chromium', 'chromium-browser']) {
    const result = spawnSync('which', [name], { encoding: 'utf8' })
    const found = result.stdout.trim()
    if (result.status === 0 && found) return found
  }
  return null
}

function hasPhp() {
  const result = spawnSync('php', ['-v'], { encoding: 'utf8' })
  return result.status === 0
}

async function waitForServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // server belum siap
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Server ${url} tidak merespons dalam ${timeoutMs}ms`)
}

function injectHeadTags(html, route) {
  const meta = pageMeta(route)
  const description = (meta.description || '').replace(/"/g, '&quot;')

  let result = html
  if (description) {
    result = result.replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${description}" />`,
    )
    if (!result.includes('name="description"')) {
      result = result.replace('</head>', `<meta name="description" content="${description}" />\n  </head>`)
    }
  }

  if (siteUrl) {
    const canonicalPath = routePath(route.locale, route)
    const alternatePath = (other) => routePath(other, route)
    const alternates = LOCALES.map(
      (other) => `<link rel="alternate" hreflang="${other}" href="${siteUrl}${alternatePath(other)}" />`,
    ).join('\n    ')
    const tags = [
      `<link rel="canonical" href="${siteUrl}${canonicalPath}" />`,
      alternates,
      `<link rel="alternate" hreflang="x-default" href="${siteUrl}${alternatePath('id')}" />`,
    ].join('\n    ')
    result = result.replace('</head>', `    ${tags}\n  </head>`)
  }

  return result
}

function writeSitemap(routes) {
  if (!siteUrl) return
  const urls = routes.map((route) => `  <url><loc>${siteUrl}${route.path}</loc></url>`).join('\n')
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  )
}

function writeRobots() {
  const sitemapLine = siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''
  writeFileSync(
    join(dist, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /dashboard\nDisallow: /order\n${sitemapLine}`,
  )
}

async function main() {
  if (!existsSync(join(dist, 'index.html'))) {
    throw new Error('dist/index.html tidak ditemukan — jalankan `vite build` dulu.')
  }

  const chrome = findChrome()
  if (!chrome) {
    console.warn('[prerender] Chrome tidak ditemukan — lewati prerender statis.')
    return
  }

  let server
  let serverArgs
  let serverCommand
  if (hasPhp()) {
    serverCommand = 'php'
    serverArgs = ['-S', `127.0.0.1:${port}`, '-t', dist, join(root, 'scripts', 'prerender-router.php')]
  } else {
    console.warn('[prerender] PHP tidak ditemukan — fallback ke `vite preview` (API tidak jalan, harga mungkin kosong).')
    serverCommand = join(root, 'node_modules', '.bin', 'vite')
    serverArgs = ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort']
  }

  server = spawn(serverCommand, serverArgs, { cwd: root, stdio: 'ignore' })
  const shutdown = () => server?.kill()
  process.on('exit', shutdown)
  process.on('SIGINT', () => { shutdown(); process.exit(130) })

  let routes = []
  try {
    await waitForServer(`${base}/id`)
    routes = [...staticRoutes(), ...(await helpArticleRoutes()), ...(await newsArticleRoutes())]

    const browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })

    try {
      const page = await browser.newPage()
      for (const route of routes) {
        const target = `${base}${route.path}`
        await page.goto(target, { waitUntil: 'networkidle0', timeout: 60000 })
        await page.waitForSelector('#root > *', { timeout: 15000 }).catch(() => {})
        if (route.page === 'pricing') {
          const pricingState = await page
            .waitForSelector('.plan-card, .pricing-error', { timeout: 20000 })
            .then(async () => (await page.$('.pricing-error')) ? 'error' : 'ready')
            .catch(() => 'timeout')
          if (pricingState !== 'ready') {
            console.warn(`[prerender] ${route.path}: pricing API tidak mengembalikan paket (${pricingState}).`)
          }
        }
        if (route.page === 'help' || route.page === 'articles') {
          await page
            .waitForSelector('.help-category-card, .help-article-content, .articles-grid, .article-card, .help-state-error', { timeout: 20000 })
            .catch(() => console.warn(`[prerender] ${route.path}: konten tidak termuat.`))
        }
        await new Promise((resolve) => setTimeout(resolve, 600))

        const html = injectHeadTags(await page.content(), route)
        const outDir = join(dist, ...route.outDir)
        mkdirSync(outDir, { recursive: true })
        writeFileSync(join(outDir, 'index.html'), html)
        console.log(`[prerender] ${route.path}`)
      }
    } finally {
      await browser.close()
    }
  } finally {
    shutdown()
  }

  writeSitemap(routes)
  writeRobots()
  console.log('[prerender] selesai.')
}

main().catch((error) => {
  console.error('[prerender] gagal:', error.message)
  process.exitCode = 1
})
