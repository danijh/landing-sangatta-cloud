import { useEffect } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { siteContent, siteMeta } from '../content/siteContent.js'
import SiteHeader from './SiteHeader.jsx'
import SiteFooter from './SiteFooter.jsx'
import PricingSection from './PricingSection.jsx'
import { pathFor } from './routes.js'

export default function PricingPage({ locale }) {
  const t = siteContent[locale]

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = siteMeta[locale].pricing.title
  }, [locale])

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-ink">
      <div className="relative">
        <SiteHeader locale={locale} page="pricing" t={t} />
        <section className="info-hero" style={{ paddingTop: '128px' }}>
          <div className="site-container">
            <a className="info-back" href={pathFor(locale)}>
              <ArrowLeft size={15} />
              {locale === 'id' ? 'Kembali ke beranda' : 'Back to home'}
            </a>
            <p className="info-eyebrow">SANGATTA CLOUD</p>
            <h1>{t.pricingTitle}</h1>
            <p className="info-subtitle">{t.pricingBody}</p>
          </div>
        </section>
      </div>

      <main>
        <PricingSection t={t} locale={locale} />

        <section className="cta-section">
          <div className="cta-decoration cta-decoration-one" />
          <div className="cta-decoration cta-decoration-two" />
          <div className="site-container relative z-10 flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-center md:py-20">
            <div className="max-w-[570px]">
              <h2>{t.ctaTitle}</h2>
              <p>{t.ctaBody}</p>
            </div>
            <a className="button button-light shrink-0" href={pathFor(locale, 'features')}>
              {t.nav[1]}
              <ArrowRight size={16} />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} t={t} />
    </div>
  )
}
