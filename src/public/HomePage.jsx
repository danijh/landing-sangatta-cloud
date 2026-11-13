import { useEffect } from 'react'
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  Check,
  Cloud,
  FileText,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { siteContent, siteMeta } from '../content/siteContent.js'
import SiteHeader from './SiteHeader.jsx'
import SiteFooter from './SiteFooter.jsx'
import { pathFor } from './routes.js'

export default function HomePage({ locale }) {
  const t = siteContent[locale]
  const pricingHref = pathFor(locale, 'pricing')

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = siteMeta[locale].home.title
  }, [locale])

  return (
    <div className="min-h-screen overflow-hidden bg-[#fbfaf8] text-ink">
      <SiteHeader locale={locale} page="" t={t} />

      <main id="top">
        <section className="hero-section">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="site-container relative grid min-h-[760px] items-center gap-12 pb-20 pt-32 lg:grid-cols-[1.02fr_0.98fr] lg:pb-24 lg:pt-28">
            <div className="relative z-10 max-w-[590px]">
              <div className="eyebrow-pill">
                <span className="eyebrow-dot" />
                {t.eyebrow}
              </div>
              <h1 className="mt-7 max-w-[610px] text-[clamp(3.25rem,6.25vw,5.65rem)] font-semibold leading-[0.98] tracking-[-0.075em] text-white">
                {t.heroTitle}
              </h1>
              <p className="mt-7 max-w-[490px] text-base leading-7 text-white/70 md:text-[18px] md:leading-8">
                {t.heroBody}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <a className="button button-light" href={pricingHref}>
                  {t.explorePlans}
                  <ArrowDownRight size={17} />
                </a>
                <div className="flex items-center gap-3 text-sm text-white/60">
                  <span className="avatar-stack" aria-hidden="true">
                    <span>R</span>
                    <span>A</span>
                    <span>M</span>
                  </span>
                  <span>{t.trustLine}</span>
                </div>
              </div>
              <div className="mt-14 grid max-w-[465px] grid-cols-3 border-t border-white/15 pt-6">
                {t.stats.map(([number, label]) => (
                  <div key={label}>
                    <div className="text-[24px] font-semibold tracking-[-0.05em] text-white">
                      {number}
                    </div>
                    <div className="mt-1 max-w-[100px] text-[11px] leading-4 text-white/50">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-art relative mx-auto flex h-[440px] w-full max-w-[590px] items-center justify-center">
              <div className="orbit orbit-outer" />
              <div className="orbit orbit-inner" />
              <div className="art-blob" />
              <div className="floating-note note-top">
                <div className="note-icon note-icon-teal">
                  <ShieldCheck size={19} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-ink">
                    {locale === 'id' ? 'Privasi terlindungi' : 'Privacy protected'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink/45">
                    {locale === 'id' ? 'Setiap saat' : 'All the time'}
                  </p>
                </div>
                <span className="status-indicator" />
              </div>
              <div className="cloud-window">
                <div className="window-topbar">
                  <div className="window-dots"><i /><i /><i /></div>
                  <div className="window-lock"><LockKeyhole size={11} /> Sangatta Cloud</div>
                  <div className="window-menu"><span /><span /><span /></div>
                </div>
                <div className="window-content">
                  <div className="window-sidebar">
                    <div className="sidebar-logo"><Cloud size={15} /></div>
                    <span className="sidebar-item active"><Cloud size={13} /></span>
                    <span className="sidebar-item"><FileText size={13} /></span>
                    <span className="sidebar-item"><UsersRound size={13} /></span>
                  </div>
                  <div className="window-main">
                    <div className="window-heading">
                      <div>
                        <span className="window-label">
                          {locale === 'id' ? 'RUANG PRIBADIMU' : 'YOUR PRIVATE SPACE'}
                        </span>
                        <h3>{locale === 'id' ? 'Selamat pagi, Asha' : 'Good morning, Asha'}</h3>
                      </div>
                      <div className="window-avatar">A</div>
                    </div>
                    <div className="storage-card">
                      <div className="storage-copy">
                        <span>{locale === 'id' ? 'Penyimpanan' : 'Storage'}</span>
                        <strong>68.4 <small>GB / 100 GB</small></strong>
                      </div>
                      <div className="storage-progress"><span /></div>
                      <div className="storage-footer">
                        <span>{locale === 'id' ? 'Ruangmu aman' : 'Your space is secure'}</span>
                        <ShieldCheck size={13} />
                      </div>
                    </div>
                    <div className="files-label">
                      {locale === 'id' ? 'BARU DIBUKA' : 'RECENTLY OPENED'}
                      <span>{locale === 'id' ? 'Lihat semua' : 'View all'} <ArrowRight size={11} /></span>
                    </div>
                    <div className="file-row">
                      <span className="file-type file-type-orange"><FileText size={16} /></span>
                      <span className="file-name"><b>{locale === 'id' ? 'Rencana perjalanan' : 'Travel plans'}</b><small>{locale === 'id' ? 'Diubah 2 jam lalu' : 'Edited 2 hours ago'}</small></span>
                      <span className="file-size">2.4 MB</span>
                    </div>
                    <div className="file-row">
                      <span className="file-type file-type-green"><Globe2 size={16} /></span>
                      <span className="file-name"><b>{locale === 'id' ? 'Ide akhir pekan' : 'Weekend ideas'}</b><small>{locale === 'id' ? 'Diubah kemarin' : 'Edited yesterday'}</small></span>
                      <span className="file-size">860 KB</span>
                    </div>
                    <div className="file-row">
                      <span className="file-type file-type-blue"><FileText size={16} /></span>
                      <span className="file-name"><b>{locale === 'id' ? 'Foto keluarga' : 'Family photos'}</b><small>{locale === 'id' ? 'Diubah 3 hari lalu' : 'Edited 3 days ago'}</small></span>
                      <span className="file-size">18.2 MB</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="floating-note note-bottom">
                <div className="sync-icon"><Check size={14} /></div>
                <div>
                  <p className="text-[11px] font-semibold text-ink">
                    {locale === 'id' ? 'Semua tersinkron' : 'Everything in sync'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink/45">
                    {locale === 'id' ? 'Di semua perangkatmu' : 'Across all your devices'}
                  </p>
                </div>
              </div>
              <div className="art-sparkle sparkle-one">✳</div>
              <div className="art-sparkle sparkle-two">✳</div>
              <div className="art-sparkle sparkle-three">·</div>
            </div>
          </div>
          <div className="hero-bottom-fade" />
        </section>

        <section className="cta-section">
          <div className="cta-decoration cta-decoration-one" />
          <div className="cta-decoration cta-decoration-two" />
          <div className="site-container relative z-10 flex flex-col items-start justify-between gap-8 py-16 md:flex-row md:items-center md:py-20">
            <div className="max-w-[570px]">
              <h2>{t.ctaTitle}</h2>
              <p>{t.ctaBody}</p>
            </div>
            <a className="button button-light shrink-0" href={pricingHref}>
              {t.ctaButton}
              <ArrowRight size={16} />
            </a>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} t={t} />

      <a className="back-to-top" href="#top" aria-label={locale === 'id' ? 'Kembali ke atas' : 'Back to top'}>
        <ArrowDown size={16} />
      </a>
    </div>
  )
}
