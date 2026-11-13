import { Cloud } from 'lucide-react'
import { INFO_PAGES, pathFor } from './routes.js'

export default function SiteFooter({ locale, t }) {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="flex flex-col justify-between gap-7 py-8 md:flex-row md:items-center">
          <div>
            <a className="brand-lockup" href={pathFor(locale)} aria-label="Sangatta Cloud home">
              <span className="brand-mark footer-brand-mark">
                <Cloud size={19} strokeWidth={2.2} />
              </span>
              <span className="text-teal text-[20px] font-bold tracking-[-0.04em]">
                Sangatta <span className="text-[#8a94a6]">Cloud</span> <span className="text-ember animate-pulse">.</span>
              </span>
            </a>
            <p className="mt-3 text-xs text-white/45">{t.footerText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs text-white/55">
            <a className="footer-link" href={pathFor(locale, 'help')}>{t.helpNav}</a>
            <a className="footer-link" href={pathFor(locale, 'articles')}>{t.articlesNav}</a>
            {t.footerLinks.map((link, index) => (
              <a
                className="footer-link"
                href={pathFor(locale, INFO_PAGES[index])}
                key={link}
              >
                {link}
              </a>
            ))}
            <span className="text-white/30">© 2026 Sangatta Cloud</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
