import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  Cloud,
  Globe2,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react'
import { contactDetails, infoCopy } from './content/infoCopy.js'

const pageKeys = ['about', 'contact', 'terms', 'privacy']

function InfoPage({ page, locale = 'id' }) {
  const language = locale
  const [ticketNotice, setTicketNotice] = useState(false)
  const [savedContent, setSavedContent] = useState(null)
  const [contentLoadError, setContentLoadError] = useState(false)
  const t = infoCopy[language]
  const pageContent = savedContent?.pages?.[language]?.[page] ?? t.pages[page]
  const isLegalPage = page === 'terms' || page === 'privacy'
  const contacts = { ...contactDetails, ...savedContent?.contacts }
  const whatsappNumber = contacts.whatsapp.replace(/\D/g, '')
  const contactItems = [
    { icon: Mail, value: contacts.email, href: contacts.email ? `mailto:${contacts.email}` : '' },
    {
      icon: Phone,
      value: contacts.whatsapp,
      href: whatsappNumber ? `https://wa.me/${whatsappNumber}` : '',
    },
    { icon: MapPin, value: contacts.address },
    { icon: null, value: contacts.officeHours },
  ]
  const homeHref = `/${language}`
  const pricingHref = `/${language}/pricing`
  const featuresHref = `/${language}/features`
  const otherLocale = language === 'id' ? 'en' : 'id'

  useEffect(() => {
    let active = true
    fetch('/api/admin-content.php?action=public')
      .then((response) => {
        if (!response.ok) throw new Error(`Content API returned ${response.status}`)
        return response.json()
      })
      .then((result) => {
        if (active && result.content) setSavedContent(result.content)
      })
      .catch((error) => {
        console.error('Unable to load page content:', error)
        if (active) setContentLoadError(true)
      })

    return () => {
      active = false
    }
  }, [])

  const handleTicketSubmit = (event) => {
    event.preventDefault()
    setTicketNotice(true)
  }

  useEffect(() => {
    document.documentElement.lang = language
    document.title = `${pageContent.title} — Sangatta Cloud`
  }, [language, pageContent.title])

  return (
    <div className="info-page min-h-screen">
      <header className="info-header">
        <div className="site-container info-header-inner">
          <a className="brand-lockup info-brand" href={homeHref} aria-label={`${t.brand} ${t.home}`}>
            <span className="brand-mark">
              <Cloud size={21} strokeWidth={2.2} />
            </span>
            <span className="text-[17px] font-bold tracking-[-0.04em]">
              Sangatta Cloud<span className="text-teal">.</span>
            </span>
          </a>
          <nav className="info-nav" aria-label={language === 'id' ? 'Navigasi utama' : 'Main navigation'}>
            <a href={homeHref}>{t.home}</a>
            <a href={pricingHref}>{t.plans}</a>
            <a href={featuresHref}>{t.features}</a>
            <button
              className="info-language"
              type="button"
              onClick={() => window.location.assign(`/${otherLocale}/${page}`)}
              aria-label={`${t.language}: ${language === 'id' ? 'English' : 'Bahasa Indonesia'}`}
            >
              <Globe2 size={15} />
              {language === 'id' ? 'ID' : 'EN'}
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section className="info-hero">
          <div className="site-container">
            <a className="info-back" href={homeHref}>
              <ArrowLeft size={15} />
              {t.back}
            </a>
            <p className="info-eyebrow">SANGATTA CLOUD</p>
            <h1>{pageContent.title}</h1>
            <p className="info-subtitle">{pageContent.subtitle}</p>
          </div>
        </section>

        <section className="info-content site-container">
          {contentLoadError && (
            <p className="info-content-warning" role="alert">
              {language === 'id'
                ? 'Konten terbaru belum dapat dimuat. Informasi yang tampil mungkin belum diperbarui.'
                : 'The latest content could not be loaded. The information shown may be outdated.'}
            </p>
          )}
          {page === 'contact' ? (
            <div className="contact-layout">
              <aside className="contact-details">
                <h2>{language === 'id' ? 'Informasi kontak' : 'Contact information'}</h2>
                <p className="contact-intro">
                  {language === 'id'
                    ? 'Pilih cara yang paling nyaman untuk menghubungi tim Sangatta Cloud.'
                    : 'Choose the most convenient way to reach the Sangatta Cloud team.'}
                </p>
                <div className="contact-methods">
                  {contactItems.map(({ icon: Icon, value, href }, index) => (
                    <div className="contact-method" key={t.contactLabels[index]}>
                      <span className="contact-method-icon">
                        {Icon ? <Icon size={17} /> : <Clock size={17} />}
                      </span>
                      <div>
                        <span>{t.contactLabels[index]}</span>
                        {href ? (
                          <a
                            href={href}
                            target={index === 1 ? '_blank' : undefined}
                            rel={index === 1 ? 'noreferrer' : undefined}
                          >
                            {value}
                            {index === 1 && <ArrowUpRight size={13} />}
                          </a>
                        ) : (
                          <p>{value || t.contactUnavailable}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="contact-detail-note">
                  {language === 'id'
                    ? 'Email, WhatsApp, alamat perusahaan, dan jam operasional dikelola oleh tim Sangatta Cloud.'
                    : 'Email, WhatsApp, company address, and office hours are managed by the Sangatta Cloud team.'}
                </p>
              </aside>

              <section className="ticket-card">
                <div className="ticket-heading">
                  <span className="contact-label">
                    {language === 'id' ? 'DUKUNGAN PELANGGAN' : 'CUSTOMER SUPPORT'}
                  </span>
                  <h2>{t.contactFormTitle}</h2>
                  <p>{t.contactFormBody}</p>
                </div>
                <p className="ticket-placeholder-notice" role="note">
                  {t.ticketPreviewNotice}
                </p>
                <form className="ticket-form" onSubmit={handleTicketSubmit}>
                  <div className="ticket-field-grid">
                    <label className="ticket-field">
                      <span>{t.nameLabel}</span>
                      <input autoComplete="name" name="name" placeholder={t.namePlaceholder} required />
                    </label>
                    <label className="ticket-field">
                      <span>{t.emailLabel}</span>
                      <input
                        autoComplete="email"
                        name="email"
                        placeholder={t.emailPlaceholder}
                        required
                        type="email"
                      />
                    </label>
                  </div>
                  <label className="ticket-field">
                    <span>{t.categoryLabel}</span>
                    <select defaultValue="" name="category" required>
                      {t.categories.map((category, index) => (
                        <option disabled={index === 0} key={category} value={index === 0 ? '' : category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ticket-field">
                    <span>{t.subjectLabel}</span>
                    <input name="subject" placeholder={t.subjectPlaceholder} required />
                  </label>
                  <label className="ticket-field">
                    <span>{t.messageLabel}</span>
                    <textarea
                      name="message"
                      placeholder={t.messagePlaceholder}
                      required
                      rows="5"
                    />
                  </label>
                  <p className="ticket-privacy-hint">{t.privacyHint}</p>
                  <button className="button button-teal ticket-submit" type="submit">
                    {t.submitTicket}
                    <ArrowUpRight size={16} />
                  </button>
                  {ticketNotice && (
                    <p className="ticket-placeholder-notice" role="status">
                      {t.ticketNotConnected}
                    </p>
                  )}
                </form>
              </section>
            </div>
          ) : (
            <div className="info-sections">
              {pageContent.sections.map((section) => (
                <article className="info-section" key={section.title}>
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </article>
              ))}
            </div>
          )}
          {isLegalPage && <p className="legal-notice">{t.legalNotice}</p>}
        </section>
      </main>

      <footer className="info-footer">
        <div className="site-container info-footer-inner">
          <div>
            <a className="brand-lockup info-brand" href={homeHref}>
              <span className="brand-mark">
                <Cloud size={19} strokeWidth={2.2} />
              </span>
              <span className="text-[16px] font-bold tracking-[-0.04em]">
                Sangatta Cloud<span className="text-teal">.</span>
              </span>
            </a>
            <p>{t.footer}</p>
          </div>
          <nav className="info-footer-links" aria-label={language === 'id' ? 'Tautan informasi' : 'Information links'}>
            {t.links.map((label, index) => (
              <a href={`/${language}/${pageKeys[index]}`} key={label}>{label}</a>
            ))}
          </nav>
          <span className="info-copyright">© 2026 Sangatta Cloud</span>
        </div>
      </footer>
    </div>
  )
}

export default InfoPage
