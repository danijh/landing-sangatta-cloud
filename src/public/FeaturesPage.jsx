import { useEffect } from 'react'
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Cloud,
  FileText,
  HeartHandshake,
  LockKeyhole,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { siteContent, siteMeta } from '../content/siteContent.js'
import SiteHeader from './SiteHeader.jsx'
import SiteFooter from './SiteFooter.jsx'
import { pathFor } from './routes.js'

const featureIcons = {
  cloud: Cloud,
  fileText: FileText,
  users: UsersRound,
  devices: MonitorSmartphone,
  support: HeartHandshake,
  sparkles: Sparkles,
}

export default function FeaturesPage({ locale }) {
  const t = siteContent[locale]

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = siteMeta[locale].features.title
  }, [locale])

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-ink">
      <div className="relative">
        <SiteHeader locale={locale} page="features" t={t} />
        <section className="info-hero" style={{ paddingTop: '128px' }}>
          <div className="site-container">
            <a className="info-back" href={pathFor(locale)}>
              <ArrowLeft size={15} />
              {locale === 'id' ? 'Kembali ke beranda' : 'Back to home'}
            </a>
            <p className="info-eyebrow">SANGATTA CLOUD</p>
            <h1>{t.featuresTitle}</h1>
            <p className="info-subtitle">{t.featuresBody}</p>
          </div>
        </section>
      </div>

      <main>
        <section className="section-space features-section">
          <div className="site-container">
            <div className="section-heading max-w-[590px]">
              <span className="section-eyebrow">{t.featuresEyebrow}</span>
              <h2>{t.featuresTitle}</h2>
              <p>{t.featuresBody}</p>
            </div>
            <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {t.features.map(({ icon, title, description }, index) => {
                const Icon = featureIcons[icon] ?? Sparkles
                return (
                  <article className="feature-item" key={title}>
                    <div className={`feature-icon feature-icon-${index + 1}`}>
                      <Icon size={21} strokeWidth={1.8} />
                    </div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="promise-section section-space">
          <div className="site-container grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="promise-visual">
              <div className="promise-glow" />
              <div className="promise-orbit">
                <div className="promise-shield"><ShieldCheck size={47} strokeWidth={1.4} /></div>
                <span className="promise-star promise-star-one">✳</span>
                <span className="promise-star promise-star-two">✦</span>
                <span className="promise-dot promise-dot-one" />
                <span className="promise-dot promise-dot-two" />
              </div>
              <div className="promise-caption">
                <LockKeyhole size={14} />
                {locale === 'id' ? 'Privasi, sejak awal' : 'Privacy, from day one'}
              </div>
            </div>
            <div className="promise-copy">
              <span className="section-eyebrow">{t.promiseEyebrow}</span>
              <h2>{t.promiseTitle}</h2>
              <div className="mt-8 divide-y divide-ink/10">
                {t.promises.map(([title, description], index) => (
                  <article className="promise-row" key={title}>
                    <span className="promise-index">0{index + 1}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                    <ArrowDownRight className="promise-arrow" size={17} />
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-decoration cta-decoration-one" />
          <div className="cta-decoration cta-decoration-two" />
          <div className="site-container relative z-10 flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-center md:py-20">
            <div className="max-w-[570px]">
              <h2>{t.ctaTitle}</h2>
              <p>{t.ctaBody}</p>
            </div>
            <a className="button button-light shrink-0" href={pathFor(locale, 'pricing')}>
              {t.ctaButton}
              <ArrowRight size={16} />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} t={t} />
    </div>
  )
}
