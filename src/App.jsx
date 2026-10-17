import { useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Cloud,
  FileText,
  Globe2,
  HeartHandshake,
  LockKeyhole,
  Menu,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'

const content = {
  id: {
    title: 'RuangAwan — Cloud yang terasa lebih personal',
    nav: ['Paket', 'Fitur', 'Privasi'],
    signIn: 'Masuk',
    getStarted: 'Mulai sekarang',
    eyebrow: 'Cloud privat, hidup lebih ringan',
    heroTitle: 'Ruang digitalmu, tetap milikmu.',
    heroBody:
      'Simpan, bagikan, dan kerjakan semuanya di satu cloud yang menghargai privasimu. Tanpa iklan, tanpa pelacakan, tanpa drama.',
    explorePlans: 'Lihat paket',
    trustLine: 'Dibuat untuk hidup digital yang lebih tenang',
    stats: [
      ['100%', 'Privat sejak awal'],
      ['0', 'Iklan & pelacakan'],
      ['1', 'Ruang untuk semuanya'],
    ],
    pricingEyebrow: 'Ruang untuk hal-hal penting',
    pricingTitle: 'Pilih ruang yang pas.',
    pricingBody:
      'Mulai sederhana, tambah ruang kapan pun kamu butuh. Semua paket menyertakan fitur lengkap.',
    monthly: 'Bulanan',
    yearly: 'Tahunan',
    save: 'Hemat 2 bulan',
    perMonth: '/ bln',
    billedYearly: 'ditagih tahunan',
    perYear: '/ tahun',
    users: 'pengguna',
    choose: 'Pilih paket',
    popular: 'Favorit banyak orang',
    placeholderNotice:
      'Harga di bawah adalah contoh sementara. Tarif final akan dimuat dari server FossBilling.',
    loading: 'Memuat paket…',
    loadError: 'Paket belum bisa dimuat.',
    retry: 'Coba lagi',
    featuresEyebrow: 'Semua yang kamu butuhkan',
    featuresTitle: 'Bekerja dan berbagi, tanpa berpindah-pindah.',
    featuresBody:
      'File, dokumen, dan keseharianmu tersusun rapi dalam satu ruang yang aman.',
    features: [
      {
        icon: Cloud,
        title: 'Penyimpanan yang aman',
        description: 'File, foto, dan kenanganmu tersimpan dengan perlindungan berlapis.',
      },
      {
        icon: FileText,
        title: 'Dokumen siap kolaborasi',
        description: 'Buat dan sunting dokumen bersama, langsung dari browser.',
      },
      {
        icon: UsersRound,
        title: 'Berbagi dengan mudah',
        description: 'Kirim tautan yang aman dan tetap kendalikan aksesnya.',
      },
      {
        icon: MonitorSmartphone,
        title: 'Selalu tersinkron',
        description: 'Akses file penting dari laptop, ponsel, maupun tablet.',
      },
      {
        icon: HeartHandshake,
        title: 'Bantuan dari manusia',
        description: 'Tim kami siap membantu ketika kamu membutuhkannya.',
      },
      {
        icon: Sparkles,
        title: 'Lebih teratur',
        description: 'Catatan dan tugas untuk menjaga hari tetap berjalan.',
      },
    ],
    promiseEyebrow: 'Privasi bukan fitur tambahan',
    promiseTitle: 'Awan yang bekerja untukmu.',
    promises: [
      ['Data tetap milikmu', 'Kami tidak membaca, menjual, atau menggunakan filemu untuk iklan.'],
      ['Bebas memilih', 'Bawa filemu kapan saja. Tidak ada jebakan atau format tertutup.'],
      ['Keamanan sejak awal', 'Perlindungan privasi menjadi bagian dari cara layanan ini dibuat.'],
    ],
    ctaTitle: 'Siap memberi ruang untuk hal yang penting?',
    ctaBody: 'Mulai dengan cloud yang terasa lebih personal.',
    ctaButton: 'Temukan paketmu',
    footerText: 'Ruang digital yang lebih tenang, untuk semua orang.',
    footerLinks: ['Ketentuan', 'Privasi', 'Bantuan'],
    menuLabel: 'Buka menu',
    closeMenu: 'Tutup menu',
    languageLabel: 'Bahasa',
  },
  en: {
    title: 'RuangAwan — A more personal cloud',
    nav: ['Plans', 'Features', 'Privacy'],
    signIn: 'Sign in',
    getStarted: 'Get started',
    eyebrow: 'Private cloud, lighter living',
    heroTitle: 'Your digital space, yours to keep.',
    heroBody:
      'Store, share, and get things done in one cloud that respects your privacy. No ads, no tracking, no fuss.',
    explorePlans: 'Explore plans',
    trustLine: 'Made for a calmer digital life',
    stats: [
      ['100%', 'Private by design'],
      ['0', 'Ads or tracking'],
      ['1', 'Space for everything'],
    ],
    pricingEyebrow: 'Room for what matters',
    pricingTitle: 'Find your right fit.',
    pricingBody:
      'Start simple and add more space whenever you need. Every plan comes with the full toolkit.',
    monthly: 'Monthly',
    yearly: 'Yearly',
    save: 'Save 2 months',
    perMonth: '/ mo',
    billedYearly: 'billed yearly',
    perYear: '/ year',
    users: 'users',
    choose: 'Choose plan',
    popular: 'Most popular',
    placeholderNotice:
      'Prices below are temporary examples. Final rates will be loaded from your FossBilling server.',
    loading: 'Loading plans…',
    loadError: 'Plans could not be loaded.',
    retry: 'Try again',
    featuresEyebrow: 'Everything you need',
    featuresTitle: 'Work and share without switching around.',
    featuresBody:
      'Your files, documents, and everyday life, neatly together in one secure space.',
    features: [
      {
        icon: Cloud,
        title: 'Secure storage',
        description: 'Your files, photos, and memories are protected with care.',
      },
      {
        icon: FileText,
        title: 'Collaborative documents',
        description: 'Create and edit documents together, right in your browser.',
      },
      {
        icon: UsersRound,
        title: 'Easy sharing',
        description: 'Send secure links and stay in control of who has access.',
      },
      {
        icon: MonitorSmartphone,
        title: 'Always in sync',
        description: 'Reach important files from your laptop, phone, or tablet.',
      },
      {
        icon: HeartHandshake,
        title: 'Human support',
        description: 'Our team is here when you need a hand.',
      },
      {
        icon: Sparkles,
        title: 'Stay organised',
        description: 'Notes and tasks to help keep your day on track.',
      },
    ],
    promiseEyebrow: 'Privacy is not an add-on',
    promiseTitle: 'A cloud that works for you.',
    promises: [
      ['Your data stays yours', 'We never read, sell, or use your files for advertising.'],
      ['Freedom to choose', 'Take your files with you. No lock-in or closed formats.'],
      ['Security from day one', 'Privacy is built into the way this service is designed.'],
    ],
    ctaTitle: 'Ready to make room for what matters?',
    ctaBody: 'Start with a cloud that feels more personal.',
    ctaButton: 'Find your plan',
    footerText: 'A calmer digital space, made for everyone.',
    footerLinks: ['Terms', 'Privacy', 'Support'],
    menuLabel: 'Open menu',
    closeMenu: 'Close menu',
    languageLabel: 'Language',
  },
}

const formatPrice = (amount, currency, language) =>
  new Intl.NumberFormat(language === 'id' ? 'id-ID' : 'en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)

function App() {
  const [language, setLanguage] = useState('id')
  const [billing, setBilling] = useState('monthly')
  const [plans, setPlans] = useState([])
  const [currency, setCurrency] = useState('IDR')
  const [priceState, setPriceState] = useState('loading')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const t = content[language]

  const loadPlans = async () => {
    setPriceState('loading')
    try {
      const response = await fetch('/api/pricing.php')
      if (!response.ok) {
        throw new Error(`Pricing API returned ${response.status}`)
      }

      const result = await response.json()
      if (!Array.isArray(result.plans) || !result.currency) {
        throw new Error('Pricing API returned an invalid response')
      }

      setPlans(result.plans)
      setCurrency(result.currency)
      setPriceState(result.source === 'placeholder' ? 'placeholder' : 'ready')
    } catch (error) {
      console.error('Unable to load pricing plans:', error)
      setPriceState('error')
    }
  }

  useEffect(() => {
    loadPlans()
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.title = t.title
  }, [language, t.title])

  const closeMenu = () => setMobileMenuOpen(false)

  return (
    <div className="min-h-screen overflow-hidden bg-[#fbfaf8] text-ink">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="site-container flex h-[84px] items-center justify-between">
          <a className="brand-lockup" href="#top" aria-label="RuangAwan home">
            <span className="brand-mark">
              <Cloud size={21} strokeWidth={2.2} />
            </span>
            <span className="text-[17px] font-bold tracking-[-0.04em]">
              ruangawan<span className="text-teal">.</span>
            </span>
          </a>

          <nav className={`${mobileMenuOpen ? 'mobile-nav-open' : 'mobile-nav'}`}>
            {t.nav.map((item, index) => (
              <a
                className="nav-link"
                href={['#paket', '#fitur', '#privasi'][index]}
                key={item}
                onClick={closeMenu}
              >
                {item}
              </a>
            ))}
            <div className="flex items-center gap-3 border-t border-ink/10 pt-4 md:border-0 md:pt-0">
              <button
                className="language-toggle"
                type="button"
                onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
                aria-label={`${t.languageLabel}: ${language === 'id' ? 'English' : 'Bahasa Indonesia'}`}
              >
                <Globe2 size={15} />
                <span>{language === 'id' ? 'ID' : 'EN'}</span>
                <ChevronDown size={13} />
              </button>
              <a className="nav-sign-in" href="#paket" onClick={closeMenu}>
                {t.signIn}
              </a>
              <a className="button button-dark nav-cta" href="#paket" onClick={closeMenu}>
                {t.getStarted}
                <ArrowUpRight size={15} />
              </a>
            </div>
          </nav>

          <button
            aria-label={mobileMenuOpen ? t.closeMenu : t.menuLabel}
            className="menu-button"
            type="button"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

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
              <p className="mt-7 max-w-[490px] text-base leading-7 text-white/70 md:text-[20px] md:leading-8">
                {t.heroBody}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <a className="button button-light" href="#paket">
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
                    {language === 'id' ? 'Privasi terlindungi' : 'Privacy protected'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink/45">
                    {language === 'id' ? 'Setiap saat' : 'All the time'}
                  </p>
                </div>
                <span className="status-indicator" />
              </div>
              <div className="cloud-window">
                <div className="window-topbar">
                  <div className="window-dots"><i /><i /><i /></div>
                  <div className="window-lock"><LockKeyhole size={11} /> ruangawan</div>
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
                          {language === 'id' ? 'RUANG PRIBADIMU' : 'YOUR PRIVATE SPACE'}
                        </span>
                        <h3>{language === 'id' ? 'Selamat pagi, Asha' : 'Good morning, Asha'}</h3>
                      </div>
                      <div className="window-avatar">A</div>
                    </div>
                    <div className="storage-card">
                      <div className="storage-copy">
                        <span>{language === 'id' ? 'Penyimpanan' : 'Storage'}</span>
                        <strong>68.4 <small>GB / 100 GB</small></strong>
                      </div>
                      <div className="storage-progress"><span /></div>
                      <div className="storage-footer">
                        <span>{language === 'id' ? 'Ruangmu aman' : 'Your space is secure'}</span>
                        <ShieldCheck size={13} />
                      </div>
                    </div>
                    <div className="files-label">
                      {language === 'id' ? 'BARU DIBUKA' : 'RECENTLY OPENED'}
                      <span>{language === 'id' ? 'Lihat semua' : 'View all'} <ArrowRight size={11} /></span>
                    </div>
                    <div className="file-row">
                      <span className="file-type file-type-orange"><FileText size={16} /></span>
                      <span className="file-name"><b>Rencana perjalanan</b><small>Diubah 2 jam lalu</small></span>
                      <span className="file-size">2.4 MB</span>
                    </div>
                    <div className="file-row">
                      <span className="file-type file-type-green"><Globe2 size={16} /></span>
                      <span className="file-name"><b>Ide akhir pekan</b><small>Diubah kemarin</small></span>
                      <span className="file-size">860 KB</span>
                    </div>
                    <div className="file-row">
                      <span className="file-type file-type-blue"><FileText size={16} /></span>
                      <span className="file-name"><b>Foto keluarga</b><small>Diubah 3 hari lalu</small></span>
                      <span className="file-size">18.2 MB</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="floating-note note-bottom">
                <div className="sync-icon"><Check size={14} /></div>
                <div>
                  <p className="text-[11px] font-semibold text-ink">
                    {language === 'id' ? 'Semua tersinkron' : 'Everything in sync'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink/45">
                    {language === 'id' ? 'Di semua perangkatmu' : 'Across all your devices'}
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

        <section className="section-space pricing-section" id="paket">
          <div className="site-container">
            <div className="section-heading mx-auto max-w-[650px] text-center">
              <span className="section-eyebrow">{t.pricingEyebrow}</span>
              <h2>{t.pricingTitle}</h2>
              <p>{t.pricingBody}</p>
            </div>
            <div className="billing-toggle mt-8">
              <button
                className={billing === 'monthly' ? 'billing-option active' : 'billing-option'}
                type="button"
                onClick={() => setBilling('monthly')}
              >
                {t.monthly}
              </button>
              <button
                className={billing === 'yearly' ? 'billing-option active' : 'billing-option'}
                type="button"
                onClick={() => setBilling('yearly')}
              >
                {t.yearly}<span className="save-pill">{t.save}</span>
              </button>
            </div>

            {priceState === 'loading' && (
              <p className="pricing-feedback" role="status">{t.loading}</p>
            )}
            {priceState === 'error' && (
              <div className="pricing-feedback pricing-error" role="alert">
                <span>{t.loadError}</span>
                <button type="button" onClick={loadPlans}>{t.retry}</button>
              </div>
            )}
            {(priceState === 'ready' || priceState === 'placeholder') && (
              <>
                {priceState === 'placeholder' && (
                  <div className="placeholder-notice" role="note">
                    <span className="notice-dot" />
                    {t.placeholderNotice}
                  </div>
                )}
                <div className="mt-8 grid gap-5 md:grid-cols-3">
                  {plans.map((plan) => {
                    const isYearly = billing === 'yearly'
                    const localizedPlan = plan.translations?.[language] ?? plan
                    const price = formatPrice(
                      isYearly ? plan.annual_price : plan.monthly_price,
                      currency,
                      language,
                    )
                    const monthlyEquivalent = isYearly
                      ? formatPrice(Math.round(plan.annual_price / 12), currency, language)
                      : null

                    return (
                      <article
                        className={`plan-card ${plan.featured ? 'plan-card-featured' : ''}`}
                        key={plan.id}
                      >
                        {plan.featured && <span className="plan-ribbon">{t.popular}</span>}
                        <div className="flex items-start justify-between">
                          <span className="plan-name">{localizedPlan.name}</span>
                          <span className="plan-storage">{plan.storage}</span>
                        </div>
                        <p className="mt-3 min-h-10 text-[13px] leading-5 text-ink/55">
                          {localizedPlan.description}
                        </p>
                        <div className="mt-5 flex items-end gap-1">
                          <span className="plan-price">{monthlyEquivalent || price}</span>
                          <span className="mb-1 text-xs text-ink/50">{t.perMonth}</span>
                        </div>
                        {isYearly ? (
                          <p className="mt-1 text-[11px] text-ink/45">
                            {price} {t.perYear} · {t.billedYearly}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-ink/45">
                            {language === 'id' ? 'Tagihan bulanan' : 'Billed monthly'}
                          </p>
                        )}
                        <a
                          className={`button mt-6 w-full justify-center ${plan.featured ? 'button-teal' : 'button-outline'}`}
                          href={`/order?plan=${encodeURIComponent(plan.id)}&billing=${billing}`}
                        >
                          {t.choose}
                          <ArrowUpRight size={15} />
                        </a>
                        <div className="plan-divider" />
                        <div className="plan-user">
                          <UsersRound size={15} />
                          {plan.users} {t.users}
                        </div>
                        <ul className="mt-4 space-y-3">
                          {localizedPlan.features.map((feature) => (
                            <li className="plan-feature" key={feature}>
                              <span><Check size={12} /></span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="section-space features-section" id="fitur">
          <div className="site-container">
            <div className="section-heading max-w-[590px]">
              <span className="section-eyebrow">{t.featuresEyebrow}</span>
              <h2>{t.featuresTitle}</h2>
              <p>{t.featuresBody}</p>
            </div>
            <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {t.features.map(({ icon: Icon, title, description }, index) => (
                <article className="feature-item" key={title}>
                  <div className={`feature-icon feature-icon-${index + 1}`}>
                    <Icon size={21} strokeWidth={1.8} />
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="promise-section section-space" id="privasi">
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
                {language === 'id' ? 'Privasi, sejak awal' : 'Privacy, from day one'}
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
            <a className="button button-light shrink-0" href="#paket">
              {t.ctaButton}
              <ArrowRight size={16} />
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-container">
          <div className="flex flex-col justify-between gap-7 py-8 md:flex-row md:items-center">
            <div>
              <a className="brand-lockup" href="#top" aria-label="RuangAwan home">
                <span className="brand-mark footer-brand-mark">
                  <Cloud size={19} strokeWidth={2.2} />
                </span>
                <span className="text-[16px] font-bold tracking-[-0.04em]">
                  ruangawan<span className="text-teal">.</span>
                </span>
              </a>
              <p className="mt-3 text-xs text-white/45">{t.footerText}</p>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-xs text-white/55">
              {t.footerLinks.map((link) => (
                <a className="footer-link" href="#privasi" key={link}>{link}</a>
              ))}
              <span className="text-white/30">© 2026 RuangAwan</span>
            </div>
          </div>
        </div>
      </footer>

      <a className="back-to-top" href="#top" aria-label={language === 'id' ? 'Kembali ke atas' : 'Back to top'}>
        <ArrowDown size={16} />
      </a>
    </div>
  )
}

export default App
