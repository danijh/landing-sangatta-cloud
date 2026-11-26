import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Quote } from 'lucide-react'
import { siteContent } from '../content/siteContent.js'
import SiteHeader from './SiteHeader.jsx'
import SiteFooter from './SiteFooter.jsx'
import { pathFor } from './routes.js'

const TICKET_HASH_PATTERN = /^[a-f0-9]{30,64}$/

const STATUS_KEYS = { open: 'ticketStatusOpen', on_hold: 'ticketStatusHold', closed: 'ticketStatusClosed' }

export default function GuestTicketPage({ locale, hash }) {
  const t = siteContent[locale]
  const validHash = typeof hash === 'string' && TICKET_HASH_PATTERN.test(hash) ? hash : null
  const [ticket, setTicket] = useState(null)
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [actionError, setActionError] = useState('')
  const replyRef = useRef(null)

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = `${t.ticketTitle} — Sangatta Cloud`
  }, [locale, t.ticketTitle])

  useEffect(() => {
    if (!validHash) {
      setState('error')
      setError(t.ticketNotFoundBody)
      return undefined
    }

    const controller = new AbortController()
    setState('loading')
    setError('')
    fetch('/api/guest-support.php?action=ticket-get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash: validHash }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.ticket || typeof result.ticket !== 'object') {
          throw new Error(result?.error || t.ticketLoadError)
        }
        setTicket(result.ticket)
        setState('loaded')
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message || t.ticketLoadError)
          setState('error')
        }
      })
    return () => controller.abort()
  }, [validHash, loadAttempt, t.ticketLoadError])

  useEffect(() => {
    if (replyOpen) replyRef.current?.focus()
  }, [replyOpen])

  const reloadTicket = useCallback(async () => {
    if (!validHash) return
    const response = await fetch('/api/guest-support.php?action=ticket-get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash: validHash }),
    })
    const result = await response.json().catch(() => null)
    if (response.ok && result?.ticket) setTicket(result.ticket)
  }, [validHash])

  const handleReply = async (event) => {
    event.preventDefault()
    if (!validHash || replyText.trim() === '') return
    setIsReplying(true)
    setActionError('')
    try {
      const response = await fetch('/api/guest-support.php?action=ticket-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: validHash, content: replyText.trim() }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(result?.error || t.ticketReplyFailed)
      }
      setReplyText('')
      setReplyOpen(false)
      await reloadTicket()
    } catch (err) {
      setActionError(err.message || t.ticketReplyFailed)
    } finally {
      setIsReplying(false)
    }
  }

  const handleClose = async () => {
    if (!validHash) return
    setIsClosing(true)
    setActionError('')
    try {
      const response = await fetch('/api/guest-support.php?action=ticket-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: validHash }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(result?.error || t.ticketCloseFailed)
      }
      await reloadTicket()
    } catch (err) {
      setActionError(err.message || t.ticketCloseFailed)
    } finally {
      setIsClosing(false)
    }
  }

  const quoteMessage = (content) => {
    const quote = String(content || '')
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    setReplyText((current) => (current.trim() === '' ? `${quote}\n\n` : `${current.replace(/\s+$/, '')}\n\n${quote}\n\n`))
    setReplyOpen(true)
  }

  const formatTicketDate = (value) => {
    const date = value ? new Date(`${String(value).replace(' ', 'T')}Z`) : null
    const localeTag = locale === 'id' ? 'id-ID' : 'en-GB'
    return date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(localeTag, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
      : value || '-'
  }

  const ticketStatus = ticket ? String(ticket.status || '').toLowerCase() : ''
  const statusKey = STATUS_KEYS[ticketStatus]
  const statusLabel = statusKey ? t[statusKey] : ticketStatus.replace(/[_-]/g, ' ')
  const helpdeskName = ticket?.helpdesk && typeof ticket.helpdesk === 'object'
    ? ticket.helpdesk.name
    : (typeof ticket?.helpdesk === 'string' ? ticket.helpdesk : '')
  const isClosed = ticketStatus === 'closed'

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-ink">
      <div className="relative">
        <SiteHeader locale={locale} page={validHash ? `support/${validHash}` : 'support'} t={t} />
        <section className="info-hero" style={{ paddingTop: '128px' }}>
          <div className="site-container">
            <a className="info-back" href={pathFor(locale, 'contact')}>
              <ArrowLeft size={15} />
              {t.ticketBack}
            </a>
            <p className="info-eyebrow">SANGATTA CLOUD</p>
            <h1>{ticket?.subject || t.ticketTitle}</h1>
            <p className="info-subtitle">{t.ticketSubtitle}</p>
          </div>
        </section>
      </div>

      <main>
        <section className="info-content site-container">
          <div className="guest-ticket-panel">
            {state === 'loading' ? (
              <div className="dashboard-profile-loading" role="status">{t.ticketLoading}</div>
            ) : state === 'error' ? (
              <div className="dashboard-profile-load-error" role="alert">
                <p>{error || t.ticketLoadError}</p>
                <button
                  type="button"
                  className="dashboard-profile-retry"
                  onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                >
                  {t.ticketRetry}
                </button>
              </div>
            ) : ticket ? (
              <>
                <div className="dashboard-page-heading dashboard-page-heading-action">
                  <div>
                    <span className="dashboard-section-kicker">{t.ticketKicker}</span>
                    <h2>{ticket.subject}</h2>
                  </div>
                  <div className="dashboard-ticket-actions">
                    {!isClosed ? (
                      <>
                        <button className="dashboard-primary-action" type="button" onClick={() => setReplyOpen(true)}>
                          {t.ticketReply}
                        </button>
                        <button
                          className="dashboard-profile-retry"
                          type="button"
                          onClick={handleClose}
                          disabled={isClosing}
                        >
                          {isClosing ? t.ticketClosing : t.ticketClose}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <dl className="dashboard-ticket-meta">
                  <div><dt>{t.ticketHelpdesk}</dt><dd>{helpdeskName || '-'}</dd></div>
                  <div>
                    <dt>{t.ticketStatusLabel}</dt>
                    <dd>
                      <span className={`dashboard-status ${ticketStatus === 'open' ? 'status-active' : ticketStatus === 'on_hold' ? 'status-pending' : 'status-closed'}`}>
                        <i />{statusLabel}
                      </span>
                    </dd>
                  </div>
                  <div><dt>{t.ticketOpened}</dt><dd>{formatTicketDate(ticket.created_at)}</dd></div>
                </dl>

                <div className="dashboard-ticket-messages">
                  {(Array.isArray(ticket.messages) ? ticket.messages : []).map((message) => {
                    const role = message?.author?.role || ''
                    const isStaff = role === 'admin'
                    const authorName = message?.author?.name || (isStaff ? t.ticketOperator : t.ticketGuest)
                    return (
                      <article className={`dashboard-ticket-message${isStaff ? ' is-staff' : ''}`} key={message.id}>
                        <header>
                          <strong>{authorName}</strong>
                          <span className="dashboard-ticket-role">{isStaff ? t.ticketOperator : t.ticketGuest}</span>
                          <small>{t.ticketOn} {formatTicketDate(message.created_at)}</small>
                          <span className="dashboard-ticket-number">#{message.id}</span>
                          {!isClosed ? (
                            <button
                              className="dashboard-ticket-quote"
                              type="button"
                              onClick={() => quoteMessage(message.content)}
                              aria-label={`${t.ticketQuote} #${message.id}`}
                              title={t.ticketQuote}
                            >
                              <Quote size={14} />
                            </button>
                          ) : null}
                        </header>
                        <p>{message.content}</p>
                      </article>
                    )
                  })}
                </div>

                {replyOpen && !isClosed ? (
                  <form className="dashboard-ticket-reply" onSubmit={handleReply}>
                    <textarea
                      ref={replyRef}
                      rows={6}
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      placeholder={t.ticketReplyPlaceholder}
                      required
                    />
                    <div>
                      <button className="dashboard-primary-action" type="submit" disabled={isReplying || replyText.trim() === ''}>
                        {isReplying ? t.ticketSending : t.ticketSend}
                      </button>
                      <button className="dashboard-profile-retry" type="button" onClick={() => { setReplyOpen(false); setReplyText('') }}>
                        {t.ticketCancel}
                      </button>
                    </div>
                  </form>
                ) : null}

                {actionError ? <p className="ticket-form-error" role="alert">{actionError}</p> : null}
                {isClosed ? <p className="dashboard-ticket-closed" role="status">{t.ticketClosedNotice}</p> : null}
              </>
            ) : null}
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} t={t} />
    </div>
  )
}
