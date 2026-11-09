import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Check,
  Cloud,
  Copy,
  CreditCard,
  FileText,
  Gauge,
  HardDrive,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  PackagePlus,
  Search,
  ShoppingCart,
  Settings2,
  ShieldCheck,
  UserRound,
  Wallet,
  Quote,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NotificationBell, useNotifications } from './notifications.jsx'
import QRCode from 'qrcode'
import { getPaymentGuide, guideMethodLabels } from './paymentGuides'

const countryCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const countryNames = new Intl.DisplayNames(['id'], { type: 'region' })
const countryOptions = countryCodes
  .map((code) => ({ code, name: countryNames.of(code) || code }))
  .sort((a, b) => a.code === 'ID' ? -1 : b.code === 'ID' ? 1 : a.name.localeCompare(b.name, 'id'))

const services = [
  { name: 'Cloud Personal', detail: 'Penyimpanan privat', used: '24 GB', total: '100 GB', progress: 24, next: '26 Nov 2026' },
  { name: 'Cloud Team', detail: 'Ruang kerja bersama', used: '68 GB', total: '250 GB', progress: 27, next: '12 Des 2026' },
]

const invoices = [
  { id: 'INV-2026-018', date: '18 Okt 2026', due: '28 Okt 2026', amount: 'Rp149.000', status: 'Menunggu' },
  { id: 'INV-2026-012', date: '18 Sep 2026', due: '28 Sep 2026', amount: 'Rp149.000', status: 'Lunas' },
  { id: 'INV-2026-006', date: '18 Agu 2026', due: '28 Agu 2026', amount: 'Rp149.000', status: 'Lunas' },
]

const dashboardMenuItems = [
  { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'orders', label: 'Order', icon: ShoppingCart },
  { id: 'support', label: 'Dukungan', icon: LifeBuoy },
  { id: 'services', label: 'Layanan', icon: PackagePlus },
  { id: 'invoices', label: 'Tagihan', icon: FileText },
  { id: 'emails', label: 'Email', icon: Mail },
  { id: 'wallet', label: 'Dompet', icon: Wallet },
  { id: 'news', label: 'Berita', icon: Newspaper },
  { id: 'knowledge-base', label: 'Pusat Bantuan', icon: BookOpen },
]

const supportArticles = [
  { category: 'Akun & keamanan', title: 'Cara mengamankan akun Sangatta Cloud', readTime: '3 menit baca' },
  { category: 'Layanan', title: 'Mengelola dan memperpanjang layanan', readTime: '4 menit baca' },
  { category: 'Pembayaran', title: 'Metode pembayaran dan status tagihan', readTime: '2 menit baca' },
]

function formatCompactPrice(price) {
  const amount = typeof price === 'number' ? price : Number(price)
  if (!Number.isFinite(amount)) return '-'

  if (amount >= 1_000_000) {
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(amount / 1_000_000)} jt`
  }
  if (amount >= 1_000) {
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(amount / 1_000)} rb`
  }
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(amount)
}

// Tombol sementara untuk uji: buka halaman simulasi pembayaran Komerce.
function komercePaymentUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.endsWith('.komerce.my.id') ? url.href : ''
  } catch {
    return ''
  }
}

const VA_ACCOUNT_NAME = 'PT Sangatta Cloud Media'

function CopyVaButton({ value }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button className="dashboard-copy-button" type="button" onClick={copy} aria-label="Salin nomor VA" title={copied ? 'Tersalin' : 'Salin nomor VA'}>
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  )
}

function QrisPanel({ payment }) {
  const [image, setImage] = useState('')
  useEffect(() => {
    let active = true
    QRCode.toDataURL(payment.qris_string, { width: 320, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (active) setImage(url) })
      .catch(() => { if (active) setImage('') })
    return () => { active = false }
  }, [payment.qris_string])
  return (
    <div className="dashboard-payment-va dashboard-payment-qris">
      <div>
        <small>Pembayaran QRIS {payment.payment_type === 'gopay' ? 'GoPay' : 'Komerce'}</small>
        <small>Nominal yang harus dibayar</small>
        <b>{formatFullPrice(payment.amount, 'IDR')}</b>
        <small>Pindai dengan aplikasi bank atau e-wallet apa pun. Bayar sesuai nominal persis{payment.payment_type === 'gopay' ? ', termasuk kode unik di belakang' : ', termasuk angka unik di belakang'}.</small>
        {payment.expired_at && <small>Berlaku hingga {payment.expired_at}</small>}
      </div>
      {image ? <img className="dashboard-qris-code" src={image} alt="Kode QRIS" /> : <span>Membuat kode QR...</span>}
    </div>
  )
}

function PaymentGuide({ bankCode }) {
  const guide = getPaymentGuide(bankCode)
  const [tab, setTab] = useState(0)
  if (!guide) return null
  const active = guide.methods[tab] || guide.methods[0]
  return (
    <div className="dashboard-payment-guide">
      <div className="dashboard-payment-guide-notice">
        <strong>Waspada Penipuan</strong>
        <p>Pastikan nama merchant, nominal pembayaran, dan detail lainnya sudah benar. Selalu periksa sebelum melanjutkan pembayaran.</p>
      </div>
      <div className="dashboard-payment-guide-tabs" role="tablist">
        {guide.methods.map((item, index) => (
          <button key={item.method} type="button" role="tab" aria-selected={index === tab} className={index === tab ? 'is-active' : ''} onClick={() => setTab(index)}>{guideMethodLabels[item.method] || item.method}</button>
        ))}
      </div>
      {active.steps.map((step) => (
        <div className="dashboard-payment-guide-step" key={step.title}>
          <strong>{step.title}</strong>
          <ol>{step.content.map((line) => <li key={line}>{line}</li>)}</ol>
        </div>
      ))}
    </div>
  )
}

function formatFullPrice(amount, currency) {
  const value = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(value)) return '-'
  const formatted = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value)
  return currency === 'IDR' ? `Rp ${formatted},-` : `${currency} ${formatted}`
}

function formatInvoiceDate(value) {
  if (!value) return '-'
  const date = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function invoiceStatusDisplay(status) {
  switch (String(status || '').toLowerCase()) {
    case 'paid':
    case 'lunas':
      return { label: 'Lunas', tone: 'status-paid' }
    case 'refunded':
      return { label: 'Dikembalikan', tone: 'status-closed' }
    case 'canceled':
    case 'cancelled':
    case 'dibatalkan':
      return { label: 'Dibatalkan', tone: 'status-closed' }
    default:
      return { label: 'Menunggu', tone: 'status-pending' }
  }
}

const QRIS_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg'
const VA_FEE = 4440

function transactionFee(paymentMethod, subtotal) {
  const amount = Number(subtotal)
  if (!paymentMethod || !Number.isFinite(amount) || amount <= 0) return 0
  if (paymentMethod.startsWith('va:')) return VA_FEE
  if (paymentMethod === 'gopay:') return 0
  if (paymentMethod.startsWith('qris:')) {
    const mdr = amount > 100000 ? amount * 0.007 : 0
    return Math.round(mdr + amount * 0.0029)
  }
  return 0
}

function groupCartItems(items) {
  const groups = new Map()
  for (const item of items) {
    const key = `${item.product_id}|${item.period}`
    const group = groups.get(key)
    const lineTotal = Number(item.total ?? item.price) || 0
    if (group) {
      group.count += 1
      group.total += lineTotal
      group.lastId = item.id
    } else {
      groups.set(key, { ...item, key, count: 1, total: lineTotal, lastId: item.id })
    }
  }
  return [...groups.values()]
}

const periodLabels = { '1M': 'Bulanan', '1Y': 'Tahunan' }

function formatServicePeriod(period) {
  const unit = typeof period === 'string' ? period.match(/[YMW]$/i)?.[0].toUpperCase() : null
  const units = { Y: 'tahun', M: 'bulan', W: 'pekan' }
  return unit && units[unit] ? `/${units[unit]}` : ''
}

function servicePeriodLabel(period) {
  const unit = typeof period === 'string' ? period.match(/[YMW]$/i)?.[0].toUpperCase() : null
  const units = { Y: 'tahun', M: 'bulan', W: 'pekan' }
  return unit && units[unit] ? units[unit] : ''
}

function formatRelativeTime(value) {
  const date = value ? new Date(`${String(value).replace(' ', 'T')}Z`) : null
  if (!date || Number.isNaN(date.getTime())) return value || '-'
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  const units = [['hari', 86400], ['jam', 3600], ['menit', 60]]
  for (const [label, size] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)} ${label} lalu`
  }
  return 'Baru saja'
}

function ClientDashboardPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [activePage, setActivePage] = useState(() => (window.location.hash === '#profile' || window.location.hash.startsWith('#ticket-') ? (window.location.hash === '#profile' ? 'profile' : 'support') : 'dashboard'))
  const [invoiceFilter, setInvoiceFilter] = useState('Menunggu')
  const [articleQuery, setArticleQuery] = useState('')
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [profileTab, setProfileTab] = useState('details')
  const [authState, setAuthState] = useState('loading')
  const [authError, setAuthError] = useState('')
  const [csrfToken, setCsrfToken] = useState('')
  const [client, setClient] = useState({})
  const [profile, setProfile] = useState(null)
  const [profileState, setProfileState] = useState('idle')
  const [profileError, setProfileError] = useState('')
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [serviceOrders, setServiceOrders] = useState([])
  const [serviceState, setServiceState] = useState('idle')
  const [serviceError, setServiceError] = useState('')
  const [serviceLoadAttempt, setServiceLoadAttempt] = useState(0)
  const [servicePage, setServicePage] = useState(1)
  const [invoiceRecords, setInvoiceRecords] = useState([])
  const [invoiceState, setInvoiceState] = useState('idle')
  const [invoiceError, setInvoiceError] = useState('')
  const [invoiceLoadAttempt, setInvoiceLoadAttempt] = useState(0)
  const [invoicePage, setInvoicePage] = useState(1)
  const [wallet, setWallet] = useState({ status: 'idle', balance: null, currency: 'IDR', transactions: [], error: '' })
  const [walletLoadAttempt, setWalletLoadAttempt] = useState(0)
  const [topupOpen, setTopupOpen] = useState(false)
  const [topupAmount, setTopupAmount] = useState('')
  const [topupMethod, setTopupMethod] = useState('')
  const [topupError, setTopupError] = useState('')
  const [isTopupBusy, setIsTopupBusy] = useState(false)
  const [balancePayPassword, setBalancePayPassword] = useState('')
  const [balancePayError, setBalancePayError] = useState('')
  const [balancePayOpen, setBalancePayOpen] = useState(false)
  const [isBalancePayBusy, setIsBalancePayBusy] = useState(false)
  const [checkoutBalanceOpen, setCheckoutBalanceOpen] = useState(false)
  const [checkoutBalancePassword, setCheckoutBalancePassword] = useState('')
  const [checkoutBalanceError, setCheckoutBalanceError] = useState('')
  const [isCheckoutBalanceBusy, setIsCheckoutBalanceBusy] = useState(false)
  const [orderProducts, setOrderProducts] = useState([])
  const [orderCategories, setOrderCategories] = useState([])
  const [selectedOrderCategory, setSelectedOrderCategory] = useState(null)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [cart, setCart] = useState({ items: [], total: 0, currency: 'IDR' })
  const [cartOpen, setCartOpen] = useState(false)
  const [cartError, setCartError] = useState('')
  const [paymentMethods, setPaymentMethods] = useState({ status: 'idle', items: [], error: '' })
  const [paymentMethod, setPaymentMethod] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [isPaying, setIsPaying] = useState(false)
  const [paymentResult, setPaymentResult] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState({ state: 'idle', data: null, error: '' })
  const [statusCooldown, setStatusCooldown] = useState(false)
  const [invoicePayModal, setInvoicePayModal] = useState(null)
  const [invoicePayMethod, setInvoicePayMethod] = useState('')
  const [invoicePayError, setInvoicePayError] = useState('')
  const [isPayingInvoice, setIsPayingInvoice] = useState(false)
  const [periodConflict, setPeriodConflict] = useState(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelOther, setCancelOther] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [isCartBusy, setIsCartBusy] = useState(false)
  const [orderSlide, setOrderSlide] = useState('next')
  const [orderCurrency, setOrderCurrency] = useState('IDR')
  const [orderState, setOrderState] = useState('idle')
  const [orderError, setOrderError] = useState('')
  const [orderLoadAttempt, setOrderLoadAttempt] = useState(0)
  const [invoiceDetail, setInvoiceDetail] = useState(null)
  const [invoiceDetailState, setInvoiceDetailState] = useState('idle')
  const [invoiceDetailError, setInvoiceDetailError] = useState('')
  const [isPdfDownloading, setIsPdfDownloading] = useState(false)
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [helpdesks, setHelpdesks] = useState([])
  const [helpdeskState, setHelpdeskState] = useState('idle')
  const [isCreatingTicket, setIsCreatingTicket] = useState(false)
  const [activeTicketId, setActiveTicketId] = useState(() => (/^#ticket-[0-9]{1,18}$/.test(window.location.hash) ? window.location.hash.slice(8) : null))
  const [ticket, setTicket] = useState(null)
  const [ticketState, setTicketState] = useState('idle')
  const [ticketError, setTicketError] = useState('')
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [isClosingTicket, setIsClosingTicket] = useState(false)
  const [ticketList, setTicketList] = useState([])
  const [ticketListState, setTicketListState] = useState('idle')
  const [ticketListError, setTicketListError] = useState('')
  const [ticketListAttempt, setTicketListAttempt] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)
  const activeTicketIdRef = useRef(activeTicketId)
  activeTicketIdRef.current = activeTicketId
  const notifications = useNotifications({
    enabled: authState === 'authenticated',
    csrfToken,
    onNew: (items) => {
      setTicketListAttempt((attempt) => attempt + 1)
      const openTicketId = activeTicketIdRef.current
      if (!openTicketId) return
      const related = items.filter((item) => String(item.ticketId) === String(openTicketId))
      if (related.length === 0) return
      if (related.some((item) => item.type === 'closed')) {
        setTicket((current) => (current ? { ...current, status: 'closed' } : current))
        setReplyOpen(false)
        setReplyText('')
      }
      fetch(`/api/fossbilling-auth.php?action=ticket&id=${encodeURIComponent(openTicketId)}`, { credentials: 'same-origin' })
        .then(async (response) => {
          const result = await response.json().catch(() => null)
          if (response.ok && result?.ticket && Array.isArray(result.ticket.messages) && String(activeTicketIdRef.current) === String(openTicketId)) {
            setTicket(result.ticket)
          }
        })
        .catch(() => {})
    },
  })

  const servicesPerPage = 7

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/fossbilling-auth.php?action=status', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok || typeof result.authenticated !== 'boolean' || typeof result.csrfToken !== 'string') {
          throw new Error(result.error || 'Sesi akun tidak dapat diverifikasi.')
        }
        if (!result.authenticated) {
          window.location.replace('/login')
          return
        }
        setClient(result.client || {})
        setCsrfToken(result.csrfToken)
        setAuthState('authenticated')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setAuthError(error.message || 'Sesi akun tidak dapat diverifikasi.')
          setAuthState('error')
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (authState !== 'authenticated' || activePage !== 'profile') return undefined

    const controller = new AbortController()
    setProfileState('loading')
    setProfileError('')

    fetch('/api/fossbilling-auth.php?action=profile', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok || !result.profile || typeof result.profile !== 'object') {
          throw new Error(result.error || 'Profil tidak dapat dimuat.')
        }
        setProfile(result.profile)
        setProfileState('loaded')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setProfileError(error.message || 'Profil tidak dapat dimuat.')
          setProfileState('error')
        }
      })

    return () => controller.abort()
  }, [activePage, authState, profileLoadAttempt])

  useEffect(() => {
    if (authState !== 'authenticated' || activePage !== 'support' || activeTicketId) return undefined

    const controller = new AbortController()
    setTicketListState('loading')
    setTicketListError('')

    fetch('/api/fossbilling-auth.php?action=tickets', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result || !Array.isArray(result.tickets)) {
          throw new Error(result?.error || 'Daftar tiket tidak dapat dimuat.')
        }
        setTicketList(result.total === 0 ? [] : result.tickets)
        setTicketListState('loaded')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setTicketListError(error.message || 'Daftar tiket tidak dapat dimuat.')
          setTicketListState('error')
        }
      })

    return () => controller.abort()
  }, [activePage, authState, activeTicketId, ticketListAttempt])

  useEffect(() => {
    if (authState !== 'authenticated' || activePage !== 'support' || !activeTicketId) return undefined

    const controller = new AbortController()
    setTicketState('loading')
    setTicketError('')

    fetch(`/api/fossbilling-auth.php?action=ticket&id=${encodeURIComponent(activeTicketId)}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.ticket) {
          throw new Error(result?.error || 'Tiket tidak dapat dimuat.')
        }
        setTicket(result.ticket)
        setTicketState('loaded')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setTicketError(error.message || 'Tiket tidak dapat dimuat.')
          setTicketState('error')
        }
      })

    return () => controller.abort()
  }, [activePage, authState, activeTicketId])

  useEffect(() => {
    if (!ticketModalOpen) return undefined

    const controller = new AbortController()
    setHelpdeskState('loading')

    fetch('/api/fossbilling-auth.php?action=helpdesks', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result || !Array.isArray(result.helpdesks)) {
          throw new Error(result?.error || 'Helpdesk tidak dapat dimuat.')
        }
        setHelpdesks(result.helpdesks)
        setHelpdeskState('loaded')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setHelpdeskState('error')
      })

    return () => controller.abort()
  }, [ticketModalOpen])

  useEffect(() => {
    if (authState !== 'authenticated' || !['services', 'orders', 'checkout'].includes(activePage)) return undefined

    const controller = new AbortController()
    setServiceState('loading')
    setServiceError('')

    fetch('/api/fossbilling-auth.php?action=services', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result || !Array.isArray(result.orders)) {
          throw new Error(result?.error || 'Daftar layanan tidak dapat dimuat.')
        }
        setServiceOrders(result.orders)
        setServicePage(1)
        setServiceState('loaded')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setServiceError(error.message || 'Daftar layanan tidak dapat dimuat.')
          setServiceState('error')
        }
      })

    return () => controller.abort()
  }, [activePage, authState, serviceLoadAttempt])

  useEffect(() => {
    if (authState !== 'authenticated' || (activePage !== 'invoices' && activePage !== 'dashboard')) return undefined

    const controller = new AbortController()
    setInvoiceState('loading')
    setInvoiceError('')

    fetch('/api/fossbilling-auth.php?action=invoices', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result || !Array.isArray(result.invoices)) {
          throw new Error(result?.error || 'Daftar tagihan tidak dapat dimuat.')
        }
        setInvoiceRecords(result.invoices)
        setInvoiceState('loaded')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setInvoiceError(error.message || 'Daftar tagihan tidak dapat dimuat.')
          setInvoiceState('error')
        }
      })

    return () => controller.abort()
  }, [activePage, authState, invoiceLoadAttempt])

  useEffect(() => {
    if (authState !== 'authenticated') return undefined

    const controller = new AbortController()
    setWallet((current) => ({ ...current, status: 'loading', error: '' }))

    fetch('/api/fossbilling-auth.php?action=wallet', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result || typeof result.balance !== 'number' || !Array.isArray(result.transactions)) {
          throw new Error(result?.error || 'Dompet tidak dapat dimuat.')
        }
        setWallet({
          status: 'loaded',
          balance: result.balance,
          currency: typeof result.currency === 'string' ? result.currency : 'IDR',
          transactions: result.transactions,
          error: '',
        })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setWallet((current) => ({ ...current, status: 'error', error: error.message || 'Dompet tidak dapat dimuat.' }))
        }
      })

    return () => controller.abort()
  }, [authState, walletLoadAttempt])

  useEffect(() => {
    if (authState !== 'authenticated' || activePage !== 'orders' && activePage !== 'checkout') return undefined

    const controller = new AbortController()
    setOrderState('loading')
    setOrderError('')

    fetch('/api/pricing.php?scope=dashboard', { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !result || !Array.isArray(result.plans) || typeof result.currency !== 'string') {
          throw new Error(result?.error || 'Daftar produk tidak dapat dimuat.')
        }
        setOrderProducts(result.plans)
        setOrderCategories(Array.isArray(result.categories) ? result.categories : [])
        setOrderCurrency(result.currency)
        setOrderState('loaded')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setOrderError(error.message || 'Daftar produk tidak dapat dimuat.')
          setOrderState('error')
        }
      })

    return () => controller.abort()
  }, [activePage, authState, orderLoadAttempt])

  useEffect(() => {
    if (authState !== 'authenticated') return undefined

    const controller = new AbortController()
    fetch('/api/fossbilling-auth.php?action=cart', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(result?.cart?.items)) {
          throw new Error(result?.error || 'Keranjang tidak dapat dimuat.')
        }
        setCart(result.cart)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setCartError(error.message || 'Keranjang tidak dapat dimuat.')
      })

    return () => controller.abort()
  }, [authState])

  useEffect(() => {
    if (authState !== 'authenticated' || activePage !== 'checkout') return undefined

    const controller = new AbortController()
    fetch('/api/fossbilling-auth.php?action=cart', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(result?.cart?.items)) {
          throw new Error(result?.error || 'Keranjang tidak dapat dimuat.')
        }
        setCart(result.cart)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setCartError(error.message || 'Keranjang tidak dapat dimuat.')
      })

    return () => controller.abort()
  }, [authState, activePage])

  useEffect(() => {
    if ((activePage !== 'checkout' && !invoicePayModal && !topupOpen) || authState !== 'authenticated') return undefined
    const controller = new AbortController()
    setPaymentMethods({ status: 'loading', items: [], error: '' })
    fetch('/api/fossbilling-auth.php?action=payment-methods', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(result?.methods)) {
          throw new Error(result?.error || 'Metode pembayaran tidak dapat dimuat.')
        }
        setPaymentMethods({ status: 'ready', items: result.methods, error: '' })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setPaymentMethods({ status: 'error', items: [], error: error.message || 'Metode pembayaran tidak dapat dimuat.' })
      })

    return () => controller.abort()
  }, [activePage, authState, invoicePayModal, topupOpen])

  const updateCart = async (action, body) => {
    setIsCartBusy(true)
    setCartError('')
    try {
      const response = await fetch(`/api/fossbilling-auth.php?action=${action}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => null)
      if (response.status === 409 && result?.conflict) {
        return { ok: false, conflict: result.conflict }
      }
      if (!response.ok || !Array.isArray(result?.cart?.items)) {
        throw new Error(result?.error || 'Keranjang tidak dapat diperbarui.')
      }
      setCart(result.cart)
      return { ok: true }
    } catch (error) {
      setCartError(error.message || 'Keranjang tidak dapat diperbarui.')
      return { ok: false }
    } finally {
      setIsCartBusy(false)
    }
  }

  const finishAddToCart = () => {
    setSelectedProductId(null)
    setSelectedPeriod(null)
    setNotice('')
    openPage('checkout')
  }

  const handleAddToCart = async (product) => {
    const result = await updateCart('cart-add', { product_id: String(product.id), period: selectedPeriod })
    if (result.ok) {
      finishAddToCart()
      return
    }
    if (result.conflict) {
      setPeriodConflict({ ...result.conflict, product })
    }
  }

  const handleReplacePeriod = async () => {
    if (!periodConflict) return
    const { product, new_period: newPeriod } = periodConflict
    setIsCartBusy(true)
    const result = await updateCart('cart-add', { product_id: String(product.id), period: newPeriod, replace: true })
    setIsCartBusy(false)
    if (result.ok) {
      setPeriodConflict(null)
      finishAddToCart()
    }
  }

  const openPage = (page) => {
    setCartOpen(false)
    if (page === 'support') {
      setActiveTicketId(null)
      setTicket(null)
      setReplyOpen(false)
      setReplyText('')
      setTicketListAttempt((attempt) => attempt + 1)
    }
    setBellOpen(false)
    setActivePage(page)
    setMenuOpen(false)
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const { unreadTicketIds, markTicketRead } = notifications
  const activeTicketUnread = activePage === 'support' && Boolean(activeTicketId) && unreadTicketIds.has(String(activeTicketId))

  useEffect(() => {
    if (activeTicketUnread) markTicketRead(activeTicketId)
    // markTicketRead is recreated every render; only the unread state should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTicketUnread, activeTicketId])
  const supportUnread = unreadTicketIds.size
  const unpaidInvoiceCount = invoiceRecords.filter((invoice) => invoice.status === 'unpaid').length

  const customerName = profile?.name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    || client.name
    || [client.first_name, client.last_name].filter(Boolean).join(' ')
    || (profile?.email || client.email)?.split('@')[0]
    || 'Pelanggan'
  const customerInitials = customerName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  // Peta produk yang masih aktif per product_id — dipakai untuk memberi tahu
  // bahwa pembelian ulang akan memperpanjang masa aktif, bukan produk baru.
  const activeProductExpiry = (() => {
    const map = {}
    const now = Date.now()
    for (const order of serviceOrders) {
      if (order.status !== 'active' || !order.product_id || !order.expires_at) continue
      const expiry = new Date(String(order.expires_at).replace(' ', 'T')).getTime()
      if (!Number.isFinite(expiry) || expiry <= now) continue
      const key = String(order.product_id)
      if (map[key] === undefined || expiry > map[key]) map[key] = expiry
    }
    return map
  })()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    setNotice('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      })
      const result = await response.json()
      if (!response.ok || result.result !== true || result.error !== null) {
        throw new Error(result.error || 'Tidak dapat mengakhiri sesi. Coba lagi.')
      }
      window.location.replace('/login')
    } catch (error) {
      setNotice(error.message || 'Tidak dapat mengakhiri sesi. Coba lagi.')
      setIsLoggingOut(false)
      setAccountMenuOpen(false)
    }
  }

  const handleTicketCreate = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setIsCreatingTicket(true)
    setNotice('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=ticket-create', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          support_helpdesk_id: String(formData.get('support_helpdesk_id') || ''),
          subject: String(formData.get('subject') || ''),
          content: String(formData.get('message') || ''),
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result || !Number.isInteger(result.result)) {
        throw new Error(result?.error || 'Tiket tidak dapat dibuat.')
      }
      setTicket(null)
      setReplyOpen(false)
      setReplyText('')
      setActiveTicketId(result.result)
      setTicketModalOpen(false)
      setNotice('Tiket berhasil dibuat.')
    } catch (error) {
      setNotice(error.message || 'Tiket tidak dapat dibuat.')
    } finally {
      setIsCreatingTicket(false)
    }
  }

  const openReply = (quote = '') => {
    setReplyOpen(true)
    setReplyText((current) => {
      const quoted = quote ? `${quote.split('\n').map((line) => `> ${line}`).join('\n')}\n\n` : ''
      return current && quoted ? `${current.replace(/\s*$/, '')}\n\n${quoted}` : current || quoted
    })
    setTimeout(() => document.getElementById('ticket-reply-text')?.focus(), 0)
  }

  const handleTicketReply = async (event) => {
    event.preventDefault()
    setIsReplying(true)
    setNotice('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=ticket-reply', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ id: String(activeTicketId), content: replyText }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.result !== true) {
        throw new Error(result?.error || 'Balasan tidak dapat dikirim.')
      }
      const ticketResponse = await fetch(`/api/fossbilling-auth.php?action=ticket&id=${encodeURIComponent(activeTicketId)}`, {
        credentials: 'same-origin',
      })
      const ticketResult = await ticketResponse.json().catch(() => null)
      if (ticketResponse.ok && ticketResult?.ticket) setTicket(ticketResult.ticket)
      setReplyText('')
      setReplyOpen(false)
      setNotice('Balasan terkirim.')
    } catch (error) {
      setNotice(error.message || 'Balasan tidak dapat dikirim.')
    } finally {
      setIsReplying(false)
    }
  }

  const handleOpenStorage = async () => {
    const tab = window.open('', '_blank')
    setNotice('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=storage-url', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: '{}',
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || typeof result?.url !== 'string') {
        throw new Error(result?.error || 'Storage Area tidak dapat dibuka.')
      }
      if (tab) tab.location.href = result.url
      else window.location.href = result.url
    } catch (error) {
      if (tab) tab.close()
      setNotice(error.message)
    }
  }

  const handleTicketClose = async () => {
    if (!window.confirm('Tutup tiket ini? Tiket yang sudah ditutup tidak dapat dibuka kembali.')) return
    setIsClosingTicket(true)
    setNotice('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=ticket-close', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ id: String(activeTicketId) }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.result !== true) {
        throw new Error(result?.error || 'Tiket tidak dapat ditutup.')
      }
      const ticketResponse = await fetch(`/api/fossbilling-auth.php?action=ticket&id=${encodeURIComponent(activeTicketId)}`, {
        credentials: 'same-origin',
      })
      const ticketResult = await ticketResponse.json().catch(() => null)
      if (ticketResponse.ok && ticketResult?.ticket) setTicket(ticketResult.ticket)
      setReplyOpen(false)
      setReplyText('')
      setNotice('Tiket berhasil ditutup.')
    } catch (error) {
      setNotice(error.message || 'Tiket tidak dapat ditutup.')
    } finally {
      setIsClosingTicket(false)
    }
  }

  const handleProfileUpdate = async (event) => {
    event.preventDefault()
    setIsSavingProfile(true)
    setNotice('')
    try {
      const formData = new FormData(event.currentTarget)
      const payload = Object.fromEntries(formData.entries())
      payload.phone_cc = typeof profile?.phone_cc === 'string' ? profile.phone_cc : ''
      const response = await fetch('/api/fossbilling-auth.php?action=profile-update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok || !result.profile || typeof result.profile !== 'object') {
        throw new Error(result.error || 'Profil tidak dapat diperbarui.')
      }
      setProfile(result.profile)
      setClient((current) => ({ ...current, ...result.profile }))
      setNotice('Profil berhasil diperbarui.')
    } catch (error) {
      setNotice(error.message || 'Profil tidak dapat diperbarui.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordUpdate = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const currentPassword = formData.get('current_password')
    const newPassword = formData.get('new_password')
    const confirmPassword = formData.get('confirm_password')

    if (
      typeof currentPassword !== 'string'
      || typeof newPassword !== 'string'
      || typeof confirmPassword !== 'string'
    ) {
      setNotice('Data password tidak valid.')
      return
    }
    if (newPassword.length < 8) {
      setNotice('Password baru harus terdiri dari minimal 8 karakter.')
      return
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setNotice('Password baru harus memiliki minimal 1 huruf uppercase, 1 huruf lowercase, dan 1 simbol.')
      return
    }
    if (newPassword !== confirmPassword) {
      setNotice('Konfirmasi password baru belum sama.')
      return
    }

    setIsChangingPassword(true)
    setNotice('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=password-change', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!result || typeof result !== 'object') {
        throw new Error('Respons server tidak valid. Periksa konfigurasi endpoint API.')
      }
      if (!response.ok || result.result !== true || result.error !== null) {
        throw new Error(
          typeof result.error === 'string' && result.error
            ? result.error
            : 'Password tidak dapat diperbarui. Silakan coba lagi.',
        )
      }
      form.reset()
      setNotice('Password berhasil diperbarui.')
    } catch (error) {
      setNotice(error.message || 'Password tidak dapat diperbarui. Silakan coba lagi.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const orderCategory = orderCategories.some((item) => item.id === selectedOrderCategory) ? selectedOrderCategory : orderCategories[0]?.id ?? null
  const selectOrderCategory = (id) => {
    const from = orderCategories.findIndex((item) => item.id === orderCategory)
    const to = orderCategories.findIndex((item) => item.id === id)
    setOrderSlide(to < from ? 'prev' : 'next')
    setSelectedProductId(null)
    setSelectedPeriod(null)
    setSelectedOrderCategory(id)
  }

  const loadPaymentStatus = async (paymentId) => {
    setPaymentStatus((current) => ({ ...current, state: 'loading', error: '' }))
    setStatusCooldown(true)
    window.setTimeout(() => setStatusCooldown(false), 3000)
    try {
      const response = await fetch(`/api/fossbilling-auth.php?action=payment-status&payment_id=${encodeURIComponent(paymentId)}`, { credentials: 'same-origin' })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.payment) throw new Error(result?.error || 'Status pembayaran tidak dapat dimuat.')
      setPaymentStatus({ state: 'ready', data: result.payment, error: '' })
    } catch (error) {
      setPaymentStatus({ state: 'error', data: null, error: error.message || 'Status pembayaran tidak dapat dimuat.' })
    }
  }

  const handleCancelPayment = async () => {
    const reason = cancelReason === 'Alasan lainnya' ? cancelOther.trim() : cancelReason
    if (!reason) {
      setCancelError(cancelReason === 'Alasan lainnya' ? 'Tuliskan alasan pembatalan.' : 'Pilih alasan pembatalan.')
      return
    }
    setIsCancelling(true)
    setCancelError('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=payment-cancel', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ payment_id: paymentResult.payment.payment_id, reason }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Pesanan tidak dapat dibatalkan.')
      setCancelOpen(false)
      setCancelReason('')
      setCancelOther('')
      setNotice(result?.invoice_cancelled === false ? 'Pembayaran dibatalkan, tetapi invoice belum dapat dibatalkan otomatis. Hubungi admin.' : 'Pesanan dan invoice berhasil dibatalkan.')
      loadPaymentStatus(paymentResult.payment.payment_id)
    } catch (error) {
      setCancelError(error.message || 'Pesanan tidak dapat dibatalkan.')
    } finally {
      setIsCancelling(false)
    }
  }

  const paymentId = paymentResult?.payment?.payment_id || null
  const paymentType = paymentResult?.payment?.payment_type || ''
  const PAYMENT_TERMINAL = new Set(['PAID', 'EXPIRED', 'CANCELED', 'CANCELLED', 'FAILED'])
  const paymentPending = Boolean(paymentId) && activePage === 'payment'
    && (!paymentStatus.data || !PAYMENT_TERMINAL.has(String(paymentStatus.data.status || '').toUpperCase()))
  const paymentPollMs = ['qris', 'gopay'].includes(paymentType) ? 5000 : 15000
  useEffect(() => {
    if (!paymentPending || !paymentId) return undefined
    const timer = window.setInterval(() => loadPaymentStatus(paymentId), paymentPollMs)
    return () => window.clearInterval(timer)
  }, [paymentPending, paymentId, paymentPollMs])

  const paidNoticeRef = useRef('')
  useEffect(() => {
    const pid = paymentResult?.payment?.payment_id
    if (!pid) { paidNoticeRef.current = ''; return }
    if (paymentStatus.data?.status !== 'PAID' || paidNoticeRef.current === pid) return
    paidNoticeRef.current = pid
    const amount = paymentStatus.data?.merchant_receives ?? paymentResult?.invoice?.total ?? paymentStatus.data?.amount
    setNotice(paymentResult?.wallet_topup === true
      ? `Pembayaran berhasil. Saldo ditambahkan sebesar ${formatFullPrice(amount, 'IDR')}.`
      : `Pembayaran berhasil. Tagihan ${paymentStatus.data?.order_id || paymentResult?.invoice?.id || ''} telah lunas — layanan dan tagihan diperbarui.`)
    setWalletLoadAttempt((attempt) => attempt + 1)
    setInvoiceLoadAttempt((attempt) => attempt + 1)
    setServiceLoadAttempt((attempt) => attempt + 1)
  }, [paymentStatus.data, paymentResult])

  const handleCheckout = async () => {
    setCheckoutError('')
    if (cart.items.length === 0) {
      setCheckoutError('Keranjang masih kosong.')
      return
    }
    if (!paymentMethod) {
      setCheckoutError('Pilih metode pembayaran terlebih dahulu.')
      return
    }
    if (paymentMethod === 'va:' || (!paymentMethod.startsWith('va:') && !paymentMethod.startsWith('qris:') && paymentMethod !== 'gopay:')) {
      setCheckoutError('Metode ini belum tersedia. Pilih bank Virtual Account atau QRIS.')
      return
    }

    setIsPaying(true)
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ method: paymentMethod }),
      })
      const result = await response.json().catch(() => null)
      if (result?.paid_with_credits === true) {
        setCart((current) => ({ ...current, items: [], total: 0 }))
        setPaymentMethod('')
        setNotice(`Pesanan berhasil dibayar dengan saldo${result?.invoice?.total ? ` sebesar ${formatFullPrice(result.invoice.total, cart.currency)}` : ''}.`)
        setWalletLoadAttempt((attempt) => attempt + 1)
        setInvoiceLoadAttempt((attempt) => attempt + 1)
        setServiceLoadAttempt((attempt) => attempt + 1)
        openPage('services')
        return
      }
      if (!response.ok || typeof result?.payment?.payment_id !== 'string') {
        throw new Error(result?.error || 'Checkout gagal diproses.')
      }
      setPaymentResult(result)
      setPaymentStatus({ state: 'idle', data: null, error: '' })
      setCart((current) => ({ ...current, items: [], total: 0 }))
      setPaymentMethod('')
      openPage('payment')
      loadPaymentStatus(result.payment.payment_id)
    } catch (error) {
      setCheckoutError(error.message || 'Checkout gagal diproses.')
    } finally {
      setIsPaying(false)
    }
  }

  const handleCheckoutBalance = async () => {
    if (!checkoutBalancePassword) {
      setCheckoutBalanceError('Masukkan password akun untuk konfirmasi.')
      return
    }
    setIsCheckoutBalanceBusy(true)
    setCheckoutBalanceError('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=checkout-balance', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ password: checkoutBalancePassword }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.result !== true) {
        throw new Error(result?.error || 'Checkout dengan saldo gagal diproses.')
      }
      setCheckoutBalanceOpen(false)
      setCheckoutBalancePassword('')
      setCart((current) => ({ ...current, items: [], total: 0 }))
      setNotice(`Pesanan berhasil dibayar dengan saldo${result?.invoice?.total ? ` sebesar ${formatFullPrice(result.invoice.total, cart.currency)}` : ''}.`)
      setWalletLoadAttempt((attempt) => attempt + 1)
      setInvoiceLoadAttempt((attempt) => attempt + 1)
      setServiceLoadAttempt((attempt) => attempt + 1)
      openPage('services')
    } catch (error) {
      setCheckoutBalanceError(error.message || 'Checkout dengan saldo gagal diproses.')
    } finally {
      setIsCheckoutBalanceBusy(false)
    }
  }

  const handleTopup = async () => {
    const amount = Number(String(topupAmount).replace(/[^0-9]/g, ''))
    if (!Number.isInteger(amount) || amount < 10000 || amount > 100000000) {
      setTopupError('Nominal penambahan saldo harus antara Rp 10.000 dan Rp 100.000.000.')
      return
    }
    if (!topupMethod) {
      setTopupError('Pilih metode pembayaran terlebih dahulu.')
      return
    }
    setIsTopupBusy(true)
    setTopupError('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=wallet-topup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ amount, method: topupMethod }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || typeof result?.payment?.payment_id !== 'string') {
        throw new Error(result?.error || 'Pembayaran gagal diproses.')
      }
      setPaymentResult(result)
      setPaymentStatus({ state: 'idle', data: null, error: '' })
      setTopupOpen(false)
      setTopupAmount('')
      setTopupMethod('')
      openPage('payment')
      loadPaymentStatus(result.payment.payment_id)
    } catch (error) {
      setTopupError(error.message || 'Pembayaran gagal diproses.')
    } finally {
      setIsTopupBusy(false)
    }
  }

  const handlePayWithBalance = async () => {
    if (!invoicePayModal || !balancePayOpen) return
    if (!balancePayPassword) {
      setBalancePayError('Masukkan password akun untuk konfirmasi.')
      return
    }
    setIsBalancePayBusy(true)
    setBalancePayError('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=pay-invoice-balance', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ invoice_id: String(invoicePayModal.id), password: balancePayPassword }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.result !== true) {
        throw new Error(result?.error || 'Pembayaran dengan saldo gagal diproses.')
      }
      setInvoicePayModal(null)
      setBalancePayOpen(false)
      setInvoicePayMethod('')
      setInvoicePayError('')
      setBalancePayPassword('')
      setBalancePayError('')
      setNotice(`Tagihan ${invoicePayModal.number || `#${invoicePayModal.id}`} berhasil dibayar dengan saldo.`)
      setWalletLoadAttempt((attempt) => attempt + 1)
      setInvoiceLoadAttempt((attempt) => attempt + 1)
      setServiceLoadAttempt((attempt) => attempt + 1)
    } catch (error) {
      setBalancePayError(error.message || 'Pembayaran dengan saldo gagal diproses.')
    } finally {
      setIsBalancePayBusy(false)
    }
  }

  const handlePayInvoice = async () => {
    if (!invoicePayModal) return
    if (!invoicePayMethod) {
      setInvoicePayError('Pilih metode pembayaran terlebih dahulu.')
      return
    }
    setIsPayingInvoice(true)
    setInvoicePayError('')
    try {
      const response = await fetch('/api/fossbilling-auth.php?action=pay-invoice', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ invoice_id: String(invoicePayModal.id), method: invoicePayMethod }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || typeof result?.payment?.payment_id !== 'string') {
        throw new Error(result?.error || 'Pembayaran gagal diproses.')
      }
      setPaymentResult(result)
      setPaymentStatus({ state: 'idle', data: null, error: '' })
      setInvoicePayModal(null)
      setInvoicePayMethod('')
      openPage('payment')
      loadPaymentStatus(result.payment.payment_id)
    } catch (error) {
      setInvoicePayError(error.message || 'Pembayaran gagal diproses.')
    } finally {
      setIsPayingInvoice(false)
    }
  }

  const renderMenuPage = () => {
    if (activePage === 'payment') {
      const created = paymentResult?.payment
      const status = paymentStatus.data
      const rows = status ? [
        ['Payment ID', status.payment_id], ['Order ID', status.order_id], ['Bank', status.bank_code],
        ['Nomor VA', status.va_number], ['Nominal', formatFullPrice(status.amount, status.currency || 'IDR')],
        ['Diterima merchant', status.merchant_receives != null ? formatFullPrice(status.merchant_receives, status.currency || 'IDR') : null],
        ['Tipe', status.payment_type], ['Status', status.status], ['Kedaluwarsa', status.expired_at],
        ['Dibuat', status.created_at], ['Dibayar', status.paid_at], ['Pengirim', status.sender_name],
      ].filter(([, value]) => value !== null && value !== undefined && value !== '') : []
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading">
            <div><span className="dashboard-section-kicker">PEMBAYARAN</span><h2>Status pembayaran</h2><p>Data respons dari {created?.payment_type === 'gopay' ? 'gateway QRIS GoPay' : 'Komerce'} untuk pembayaran {created?.payment_type === 'qris' ? 'QRIS' : created?.payment_type === 'gopay' ? 'QRIS GoPay' : 'Virtual Account'}.</p></div>
          </div>
          {!created ? (
            <div className="dashboard-empty-state"><span><CreditCard size={22} /></span><strong>Belum ada pembayaran</strong><p>Mulai dari keranjang untuk membuat pembayaran.</p><button className="dashboard-outline-action" type="button" onClick={() => openPage('orders')}>Lihat produk</button></div>
          ) : (
            <div className="dashboard-payment-result">
              {['qris', 'gopay'].includes(created.payment_type) ? <QrisPanel payment={created} /> : (
              <div className="dashboard-payment-va">
                <div>
                  <small>Nomor Virtual Account {created.bank_name || created.bank_code}</small>
                  <strong>{created.va_number} <CopyVaButton value={created.va_number} /></strong>
                  <small>Nama Virtual Account</small>
                  <b>{VA_ACCOUNT_NAME}</b>
                  <small>Nominal yang harus dibayar</small>
                  <b>{formatFullPrice(created.amount, 'IDR')}</b>
                </div>
                {getPaymentGuide(created.bank_code)?.logo && <img src={getPaymentGuide(created.bank_code).logo} alt={created.bank_name || created.bank_code} referrerPolicy="no-referrer" />}
              </div>
              )}
              {paymentStatus.state === 'loading' && <p className="dashboard-powered-by">Memuat status pembayaran...</p>}
              {paymentStatus.state === 'error' && <p className="dashboard-checkout-error" role="alert">{paymentStatus.error}</p>}
              {rows.length > 0 && <dl className="dashboard-payment-data">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>}
              <div className="dashboard-payment-actions">
              <button className="dashboard-outline-action" type="button" disabled={statusCooldown || paymentStatus.state === 'loading'} onClick={() => loadPaymentStatus(created.payment_id)}>Perbarui status</button>
              <button className="dashboard-danger-action" type="button" disabled={paymentStatus.data?.status !== 'PENDING'} onClick={() => { setCancelError(''); setCancelOpen(true) }}>Batalkan pesanan</button>
              {komercePaymentUrl(created.payment_url) && <a className="dashboard-outline-action" href={komercePaymentUrl(created.payment_url)} target="_blank" rel="noopener noreferrer">Buka halaman pembayaran (uji)</a>}
              </div>
              {!['qris', 'gopay'].includes(created.payment_type) && <PaymentGuide bankCode={created.bank_code} />}
            </div>
          )}
          {cancelOpen && (
            <div className="dashboard-modal-backdrop" role="presentation">
              <div className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
                <h3 id="cancel-title">Batalkan pesanan?</h3>
                <p>{created?.payment_type === 'qris' ? 'Kode QRIS tidak boleh dibayar lagi setelah pesanan dibatalkan.' : 'Virtual Account akan dinonaktifkan dan tidak dapat dipakai lagi.'}</p>
                <label>Alasan pembatalan
                  <select value={cancelReason} onChange={(event) => { setCancelReason(event.target.value); setCancelError('') }}>
                    <option value="">Pilih alasan</option>
                    <option>Salah memilih produk</option>
                    <option>Ingin mengganti metode pembayaran</option>
                    <option>Harga tidak sesuai</option>
                    <option>Tidak jadi membeli</option>
                    <option>Alasan lainnya</option>
                  </select>
                </label>
                {cancelReason === 'Alasan lainnya' && (
                  <label>Tulis alasan
                    <textarea rows={3} maxLength={200} value={cancelOther} onChange={(event) => { setCancelOther(event.target.value); setCancelError('') }} />
                  </label>
                )}
                {cancelError && <p className="dashboard-checkout-error" role="alert">{cancelError}</p>}
                <div className="dashboard-modal-actions">
                  <button className="dashboard-outline-action" type="button" disabled={isCancelling} onClick={() => setCancelOpen(false)}>Kembali</button>
                  <button className="dashboard-danger-action" type="button" disabled={isCancelling} onClick={handleCancelPayment}>{isCancelling ? 'Membatalkan...' : 'Ya, batalkan'}</button>
                </div>
              </div>
            </div>
          )}
        </section>
      )
    }

    if (activePage === 'checkout') {
      const customerLabel = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.name || customerName
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading">
            <div><span className="dashboard-section-kicker">PEMBAYARAN</span><h2>Checkout</h2><p>Tinjau pesananmu, lalu pilih metode pembayaran.</p></div>
            <button className="dashboard-product-back" type="button" onClick={() => openPage('orders')}><ArrowLeft size={14} /> Tambah produk</button>
          </div>
          {cart.items.length === 0 ? (
            <div className="dashboard-empty-state"><span><ShoppingCart size={22} /></span><strong>Keranjang masih kosong</strong><p>Pilih produk di menu Order untuk memulai.</p><button className="dashboard-outline-action" type="button" onClick={() => openPage('orders')}>Lihat produk</button></div>
          ) : (
            <div className="dashboard-checkout-layout">
              <div className="dashboard-checkout-main">
                <h3 className="dashboard-checkout-title">Ringkasan pesanan</h3>
                <ul className="dashboard-checkout-items">
                  {groupCartItems(cart.items).map((item) => {
                    const categoryId = orderProducts.find((product) => String(product.id) === item.product_id)?.category_id
                    const categoryName = orderCategories.find((category) => category.id === categoryId)?.name
                    const itemName = categoryName ? `${item.title} - ${categoryName}` : item.title
                    return (
                      <li key={item.key}>
                        <span><strong>{itemName}{item.count > 1 && <em className="dashboard-count" aria-label={`${item.count} item`}>X {item.count}</em>}</strong><small>Langganan {(periodLabels[item.period] || item.period || '-').toLowerCase()}</small></span>
                        <strong>{formatFullPrice(item.total, cart.currency)}</strong>
                        <button type="button" aria-label={`Hapus satu ${item.title}`} disabled={isCartBusy} onClick={() => updateCart('cart-remove', { id: item.lastId })}><X size={14} /></button>
                      </li>
                    )
                  })}
                </ul>
                {cartError && <p className="dashboard-checkout-error" role="alert">{cartError}</p>}

                <h3 className="dashboard-checkout-title">Metode pembayaran</h3>
                {paymentMethods.status === 'loading' && <p className="dashboard-powered-by">Memuat metode pembayaran...</p>}
                {paymentMethods.status === 'error' && <p className="dashboard-checkout-error" role="alert">{paymentMethods.error}</p>}
                {(() => {
                  const methodId = (method) => `${method.payment_type}:${method.bank_code || ''}`
                  const vaMethods = paymentMethods.items.filter((method) => method.payment_type === 'va' && method.bank_code !== 'BJB' && method.bank_code !== 'SMBC' && method.bank_code !== 'DBS')
                  const qrisMethod = paymentMethods.items.find((method) => method.payment_type === 'qris')
                  const otherMethods = paymentMethods.items.filter((method) => method.payment_type !== 'va' && method.payment_type !== 'qris')
                  return (
                    <>
                      {(vaMethods.length > 0 || qrisMethod) && (
                        <>
                          <p className="dashboard-payment-group">Virtual Account</p>
                          <div className="dashboard-bank-grid" role="radiogroup" aria-label="Virtual Account">
                            {vaMethods.map((method) => (
                              <button type="button" role="radio" aria-checked={paymentMethod === methodId(method)} aria-label={`Virtual Account ${method.display_name}`} title={method.display_name} className={`dashboard-bank-option${paymentMethod === methodId(method) ? ' is-active' : ''}`} key={methodId(method)} onClick={() => { setPaymentMethod(methodId(method)); setCheckoutError('') }}>
                                {typeof method.logo_url === 'string' && method.logo_url.startsWith('https://')
                                  ? <img src={method.logo_url} alt="" loading="lazy" />
                                  : <span>{method.bank_code}</span>}
                              </button>
                            ))}
                            {qrisMethod && (
                              <button type="button" role="radio" aria-checked={paymentMethod === methodId(qrisMethod)} aria-label="QRIS Komerce" title="QRIS Komerce" className={`dashboard-bank-option dashboard-bank-qris${paymentMethod === methodId(qrisMethod) ? ' is-active' : ''}`} onClick={() => { setPaymentMethod(methodId(qrisMethod)); setCheckoutError('') }}>
                                <img src={QRIS_LOGO_URL} alt="" loading="lazy" referrerPolicy="no-referrer" />
                                <span>Komerce</span>
                              </button>
                            )}
                            <button type="button" role="radio" aria-checked={paymentMethod === 'gopay:'} aria-label="QRIS GoPay" title="QRIS GoPay" className={`dashboard-bank-option dashboard-bank-qris${paymentMethod === 'gopay:' ? ' is-active' : ''}`} onClick={() => { setPaymentMethod('gopay:'); setCheckoutError('') }}>
                              <img src={QRIS_LOGO_URL} alt="" loading="lazy" referrerPolicy="no-referrer" />
                              <span>GoPay</span>
                            </button>
                            <button type="button" className="dashboard-bank-option dashboard-bank-balance" aria-label="Bayar dengan saldo" title="Bayar dengan saldo" onClick={() => { setCheckoutBalancePassword(''); setCheckoutBalanceError(''); setCheckoutBalanceOpen(true) }}>
                              <Wallet size={22} />
                              <span>Saldo</span>
                            </button>
                          </div>
                          <p className="dashboard-fee-note">* Biaya transaksi virtual account Rp 4.440,-</p>
                          <p className="dashboard-fee-note">* Biaya transaksi menggunakan QRIS Komerce 0,7% + 0,29%.</p>
                          <p className="dashboard-fee-note">* QRIS GoPay tanpa biaya tambahan; nominal akhir mendapat kode unik.</p>
                        </>
                      )}
                      {otherMethods.length > 0 && (
                        <div className="dashboard-payment-options" role="radiogroup" aria-label="Metode lainnya">
                          {otherMethods.map((method) => (
                            <button type="button" role="radio" aria-checked={paymentMethod === methodId(method)} className={`dashboard-payment-option${paymentMethod === methodId(method) ? ' is-active' : ''}`} key={methodId(method)} onClick={() => { setPaymentMethod(methodId(method)); setCheckoutError('') }}>
                              <span className="dashboard-payment-radio" />
                              <span><strong>{method.display_name}</strong><small>Minimal Rp {Number(method.min_amount || 0).toLocaleString('id-ID')}</small></span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              <aside className="dashboard-checkout-summary">
                <h3 className="dashboard-checkout-title">Total pembayaran</h3>
                <dl>
                  <div><dt>Pelanggan</dt><dd>{customerLabel}</dd></div>
                  <div><dt>Jumlah item</dt><dd>{cart.items.length}</dd></div>
                  <div><dt>Subtotal</dt><dd>{formatFullPrice(cart.total, cart.currency)}</dd></div>
                  {paymentMethod && <div><dt>Biaya transaksi</dt><dd>{formatFullPrice(transactionFee(paymentMethod, cart.total), cart.currency)}</dd></div>}
                </dl>
                {cart.items.some((item) => activeProductExpiry[String(item.product_id)]) && (
                  <p className="dashboard-product-renew-note">Beberapa produk di keranjang masih aktif di akunmu — setelah pembayaran berhasil, durasi produk yang sama akan bertambah, bukan membuat produk baru.</p>
                )}
                <div className="dashboard-checkout-total"><span>Total</span><strong>{formatFullPrice(Number(cart.total) + transactionFee(paymentMethod, cart.total), cart.currency)}</strong></div>
                <button className="dashboard-primary-action dashboard-checkout-button" type="button" disabled={cart.items.length === 0 || isCartBusy || isPaying} onClick={handleCheckout}>
                  <CreditCard size={16} /> Checkout
                </button>
                {checkoutError && <p className="dashboard-checkout-error" role="alert">{checkoutError}</p>}
              </aside>
            </div>
          )}
          {isPaying && <div className="dashboard-pay-overlay" role="status"><span className="dashboard-pay-spinner" /><strong>Membuat pembayaran...</strong><small>Mohon tunggu, jangan tutup halaman ini.</small></div>}
        </section>
      )
    }

    if (activePage === 'orders') {
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading">
            <div><span className="dashboard-section-kicker">PRODUK SANGATTA CLOUD</span><h2>Order</h2><p>Pilih produk yang sesuai dengan kebutuhanmu.</p></div>
          </div>
          {orderState === 'loading' ? (
            <div className="dashboard-profile-loading" role="status">Memuat daftar produk...</div>
          ) : orderState === 'error' ? (
            <div className="dashboard-profile-load-error" role="alert">
              <p>{orderError}</p>
              <button type="button" className="dashboard-profile-retry" onClick={() => setOrderLoadAttempt((attempt) => attempt + 1)}>Coba lagi</button>
            </div>
          ) : orderProducts.length > 0 ? (
            <>
            {orderCategories.length > 1 && (
              <div className="dashboard-filter-tabs" role="tablist" aria-label="Kategori produk">
                {orderCategories.map((item) => <button type="button" role="tab" aria-selected={orderCategory === item.id} className={orderCategory === item.id ? 'dashboard-filter-active' : ''} key={item.id} onClick={() => selectOrderCategory(item.id)}>{item.name}</button>)}
              </div>
            )}
            <div className={`dashboard-product-grid pager-${orderSlide}`} key={orderCategory}>
              {orderProducts.filter((product) => (orderCategory === null || product.category_id === orderCategory) && (selectedProductId === null || product.id === selectedProductId)).map((product) => {
                const isSelected = selectedProductId === product.id
                const periods = [
                  { id: '1M', label: 'Bulanan', price: product.monthly_price, unit: 'bulan' },
                  { id: '1Y', label: 'Tahunan', price: product.annual_price, unit: 'tahun' },
                ]
                const productExpiry = activeProductExpiry[String(product.id)]
                const expiryLabel = productExpiry
                  ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(productExpiry))
                  : null
                const head = (
                  <div className="dashboard-product-head">
                    <h3>{product.name}</h3>
                    {productExpiry && <span className="dashboard-product-active-badge">Aktif s.d. {expiryLabel}</span>}
                    {product.storage && <strong className="dashboard-product-storage">{product.storage}</strong>}
                  </div>
                )

                if (!isSelected) {
                  return (
                    <article className="dashboard-product-card is-selectable" key={product.id} role="button" tabIndex={0} onClick={() => { setSelectedProductId(product.id); setSelectedPeriod(null) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedProductId(product.id); setSelectedPeriod(null) } }}>
                      {head}
                      {product.description && <p>{product.description}</p>}
                      <div className="dashboard-product-prices">
                        {periods.map((period) => <span key={period.id}><small>{period.label}</small><strong>{orderCurrency} {formatCompactPrice(period.price)}<small> / {period.unit}</small></strong></span>)}
                      </div>
                    </article>
                  )
                }

                return (
                  <article className="dashboard-product-card is-expanded" key={product.id}>
                    <button className="dashboard-product-back" type="button" onClick={() => { setSelectedProductId(null); setSelectedPeriod(null) }}><ArrowLeft size={14} /> Pilih produk lain</button>
                    {head}
                    {product.description && <p>{product.description}</p>}
                    {productExpiry && (
                      <p className="dashboard-product-renew-note">
                        Produk ini masih aktif hingga <strong>{expiryLabel}</strong>. Pembelian ini akan menambah durasi masa aktif produk yang sama, bukan membuat produk baru.
                      </p>
                    )}
                    <div className="dashboard-period-options" role="radiogroup" aria-label="Periode berlangganan">
                      {periods.map((period) => (
                        <button type="button" role="radio" aria-checked={selectedPeriod === period.id} className={`dashboard-period-option${selectedPeriod === period.id ? ' is-active' : ''}`} key={period.id} onClick={() => setSelectedPeriod(period.id)}>
                          <small>{period.label}</small>
                          <strong>{formatFullPrice(period.price, orderCurrency)}</strong>
                          <span>/ {period.unit}</span>
                        </button>
                      ))}
                    </div>
                    {selectedPeriod && (
                      <button className="dashboard-primary-action dashboard-product-next" type="button" disabled={isCartBusy} onClick={() => handleAddToCart(product)}>
                        {isCartBusy ? 'Menambahkan...' : 'Next'} <ArrowRight size={16} />
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
            </>
          ) : (
            <div className="dashboard-empty-state"><span><PackagePlus size={22} /></span><strong>Belum ada produk</strong><p>Produk yang tersedia akan ditampilkan di sini.</p></div>
          )}
        </section>
      )
    }

    if (activePage === 'profile') {
      return (
        <section className="dashboard-page-panel dashboard-profile-page">
          <div className="dashboard-page-heading">
            <div className="dashboard-breadcrumb"><button type="button" onClick={() => openPage('dashboard')}>Ringkasan</button><span>/</span><strong>Profil</strong></div>
          </div>
          <div className="dashboard-profile-tabs" role="tablist" aria-label="Pengaturan profil">
            <button type="button" role="tab" aria-selected={profileTab === 'details'} className={profileTab === 'details' ? 'dashboard-profile-tab-active' : ''} onClick={() => setProfileTab('details')}>Detail</button>
            <button type="button" role="tab" aria-selected={profileTab === 'password'} className={profileTab === 'password' ? 'dashboard-profile-tab-active' : ''} onClick={() => setProfileTab('password')}>Ganti password</button>
          </div>
          {profileTab === 'details' && profileState === 'loading' ? (
            <div className="dashboard-profile-loading" role="status">Memuat detail profil...</div>
          ) : profileTab === 'details' && profileState === 'error' ? (
            <div className="dashboard-profile-load-error" role="alert">
              <p>{profileError}</p>
              <button type="button" className="dashboard-profile-retry" onClick={() => setProfileLoadAttempt((attempt) => attempt + 1)}>Coba lagi</button>
            </div>
          ) : profileTab === 'details' && profile ? (
            <form className="dashboard-profile-form" onSubmit={handleProfileUpdate}>
              <div className="dashboard-profile-form-heading">
                <h2>Perbarui detail</h2>
                <p>Jaga agar informasi pribadimu selalu terbaru.</p>
              </div>
              <div className="dashboard-profile-avatar-row">
                <span className="dashboard-avatar dashboard-avatar-large">{customerInitials}</span>
                <span>Avatar ditampilkan berdasarkan identitas akunmu.</span>
              </div>
              <div className="dashboard-profile-fields">
                <label className="dashboard-profile-field"><span>Nama depan <b>*</b></span><input name="first_name" defaultValue={profile.first_name || ''} required maxLength={100} /></label>
                <label className="dashboard-profile-field"><span>Nama belakang</span><input name="last_name" defaultValue={profile.last_name || ''} maxLength={100} /></label>
                <label className="dashboard-profile-field"><span>Email <b>*</b></span><input name="email" type="email" defaultValue={profile.email || ''} required maxLength={254} /></label>
                <label className="dashboard-profile-field"><span>Nomor telepon</span><input name="phone" type="tel" defaultValue={profile.phone || ''} placeholder="Nomor telepon" maxLength={32} pattern="[+0-9() .-]+" /></label>
                <label className="dashboard-profile-field dashboard-profile-field-wide"><span>Email tagihan</span><input name="billing_email" type="email" defaultValue={profile.billing_email || ''} maxLength={254} /><small>Pemberitahuan tagihan dikirim ke alamat ini. Biarkan kosong untuk memakai email akun.</small></label>
                <label className="dashboard-profile-field"><span>Tanggal lahir</span><input name="birthday" type="date" defaultValue={typeof profile.birthday === 'string' && /^\d{4}-\d{2}-\d{2}/.test(profile.birthday) ? profile.birthday.slice(0, 10) : ''} /></label>
                <label className="dashboard-profile-field"><span>Jenis kelamin</span><select name="gender" defaultValue={profile.gender || ''}><option value="">Pilih</option><option value="female">Perempuan</option><option value="male">Laki-laki</option><option value="other">Lainnya</option></select></label>
                <label className="dashboard-profile-field dashboard-profile-field-wide"><span>Nama perusahaan</span><input name="company" defaultValue={profile.company || ''} maxLength={255} /></label>
                <label className="dashboard-profile-field"><span>NPWP perusahaan</span><input name="company_vat" defaultValue={profile.company_vat || ''} maxLength={64} /></label>
                <label className="dashboard-profile-field"><span>Nomor perusahaan</span><input name="company_number" defaultValue={profile.company_number || ''} maxLength={64} /></label>
                <label className="dashboard-profile-field"><span>Alamat</span><input name="address_1" defaultValue={profile.address_1 || ''} maxLength={255} /></label>
                <label className="dashboard-profile-field"><span>Alamat 2</span><input name="address_2" defaultValue={profile.address_2 || ''} maxLength={255} /></label>
                <label className="dashboard-profile-field"><span>Kota</span><input name="city" defaultValue={profile.city || ''} maxLength={100} /></label>
                <label className="dashboard-profile-field"><span>Negara</span><select name="country" defaultValue={countryCodes.includes(profile.country?.toUpperCase()) ? profile.country.toUpperCase() : 'ID'}><option value="ID">Indonesia</option>{countryOptions.filter(({ code }) => code !== 'ID').map(({ code, name }) => <option key={code} value={code}>{name}</option>)}</select></label>
                <label className="dashboard-profile-field"><span>Provinsi</span><input name="state" defaultValue={profile.state || ''} maxLength={100} /></label>
                <label className="dashboard-profile-field"><span>Kode pos</span><input name="postcode" defaultValue={profile.postcode || ''} maxLength={32} /></label>
                <label className="dashboard-profile-field dashboard-profile-field-wide"><span>Zona waktu</span><select name="timezone" defaultValue={profile.timezone || 'Asia/Makassar'}>{profile.timezone && !['Asia/Makassar', 'Asia/Jakarta', 'Asia/Jayapura', 'UTC'].includes(profile.timezone) && <option value={profile.timezone}>{profile.timezone}</option>}<option value="Asia/Makassar">Asia/Makassar</option><option value="Asia/Jakarta">Asia/Jakarta</option><option value="Asia/Jayapura">Asia/Jayapura</option><option value="UTC">UTC</option></select><small>Digunakan untuk menampilkan tanggal dan waktu lokal.</small></label>
              </div>
              <button className="dashboard-primary-action" type="submit" disabled={isSavingProfile}>{isSavingProfile ? 'Menyimpan...' : <><UserRound size={15} /> Perbarui profil</>}</button>
            </form>
          ) : profileTab === 'password' ? (
            <form className="dashboard-password-form" onSubmit={handlePasswordUpdate}>
              <div className="dashboard-profile-form-heading">
                <h2>Ganti password</h2>
                <p>Gunakan password yang kuat dan belum pernah dipakai sebelumnya.</p>
              </div>
              <label className="dashboard-profile-field dashboard-profile-field-wide"><span>Password saat ini <b>*</b></span><input name="current_password" type="password" autoComplete="current-password" required /></label>
              <label className="dashboard-profile-field dashboard-profile-field-wide"><span>Password baru <b>*</b></span><input name="new_password" type="password" autoComplete="new-password" minLength={8} required /><small>Minimal 8 karakter, dengan 1 huruf uppercase, 1 huruf lowercase, dan 1 simbol.</small></label>
              <label className="dashboard-profile-field dashboard-profile-field-wide"><span>Konfirmasi password baru <b>*</b></span><input name="confirm_password" type="password" autoComplete="new-password" minLength={8} required /></label>
              <button className="dashboard-primary-action" type="submit" disabled={isChangingPassword}>{isChangingPassword ? 'Menyimpan...' : <><ShieldCheck size={15} /> Simpan password</>}</button>
              <p className="dashboard-profile-api-note">Password baru harus memenuhi semua kriteria sebelum disimpan.</p>
            </form>
          ) : null}
        </section>
      )
    }

    if (activePage === 'orders') {
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading">
            <div><span className="dashboard-section-kicker">PESANAN</span><h2>Mulai order baru</h2><p>Pilih produk, atur layanan, lalu lanjutkan ke pembayaran.</p></div>
          </div>
          <div className="dashboard-order-steps">
            {[
              ['Pilih produk', '3 produk tersedia', PackagePlus],
              ['Konfigurasi produk', 'Sesuaikan kebutuhan layanan', Settings2],
              ['Keranjang', '1 item dalam keranjang', ShoppingCart],
              ['Pembayaran', 'Pilih metode pembayaran', CreditCard],
            ].map(([title, detail, Icon], index) => (
              <button className="dashboard-order-step" type="button" key={title} onClick={() => setNotice('Langkah pemesanan akan terhubung ke FossBilling.')}>
                <Icon size={18} />
                <span><strong>{title}</strong><small>{detail}</small></span>
                {index === 0 && <span className="dashboard-step-count">3 produk</span>}
                <ChevronRight className="dashboard-step-chevron" size={16} />
              </button>
            ))}
          </div>
          <p className="dashboard-powered-by">Proses pemesanan akan menggunakan sistem FossBilling.</p>
        </section>
      )
    }

    if (activePage === 'support') {
      if (activeTicketId) {
        const formatTicketDate = (value) => {
          const date = value ? new Date(`${String(value).replace(' ', 'T')}Z`) : null
          return date && !Number.isNaN(date.getTime())
            ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
            : value || '-'
        }
        const ticketStatusLabels = { open: 'Terbuka', on_hold: 'Ditunda', closed: 'Ditutup' }
        const ticketStatus = ticket ? ticket.status.toLowerCase() : ''
        const ticketStatusLabel = ticketStatusLabels[ticketStatus]
          || ticketStatus.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

        return (
          <section className="dashboard-page-panel">
            <div className="dashboard-page-heading dashboard-page-heading-action">
              <div><span className="dashboard-section-kicker">BANTUAN PELANGGAN</span><h2>Tiket #{activeTicketId}</h2></div>
              <div className="dashboard-ticket-actions">
                {ticketStatus !== 'closed' && ticket ? (
                  <>
                    <button className="dashboard-primary-action" type="button" onClick={() => openReply()}>Balas</button>
                    <button className="dashboard-profile-retry" type="button" onClick={handleTicketClose} disabled={isClosingTicket}>{isClosingTicket ? 'Menutup...' : 'Tutup tiket'}</button>
                  </>
                ) : null}
                <button className="dashboard-profile-retry" type="button" onClick={() => { setActiveTicketId(null); setTicket(null); setReplyOpen(false); setReplyText('') }}>Kembali</button>
              </div>
            </div>
            {ticketState === 'loading' ? (
              <div className="dashboard-profile-loading" role="status">Memuat tiket...</div>
            ) : ticketState === 'error' ? (
              <div className="dashboard-profile-load-error" role="alert">
                <p>{ticketError}</p>
                <button type="button" className="dashboard-profile-retry" onClick={() => { const id = activeTicketId; setActiveTicketId(null); setTimeout(() => setActiveTicketId(id), 0) }}>Coba lagi</button>
              </div>
            ) : ticket ? (
              <>
                <dl className="dashboard-ticket-meta">
                  <div><dt>Helpdesk</dt><dd>{ticket.helpdesk || '-'}</dd></div>
                  <div><dt>Status</dt><dd><span className={`dashboard-status ${ticketStatus === 'open' ? 'status-active' : ticketStatus === 'on_hold' ? 'status-pending' : 'status-closed'}`}><i />{ticketStatusLabel}</span></dd></div>
                  <div><dt>Dibuka</dt><dd>{formatTicketDate(ticket.created_at)}</dd></div>
                </dl>
                <div className="dashboard-ticket-messages">
                  {ticket.messages.map((message) => (
                    <article className={`dashboard-ticket-message${message.is_staff ? ' is-staff' : ''}`} key={message.id}>
                      <header>
                        <strong>{message.author || (message.is_staff ? 'Tim dukungan' : 'Kamu')}</strong>
                        <span className="dashboard-ticket-role">{message.is_staff ? 'Operator' : 'Kamu'}</span>
                        <small>pada {formatTicketDate(message.created_at)}</small>
                        <span className="dashboard-ticket-number">#{message.id}</span>
                        {ticketStatus !== 'closed' ? <button className="dashboard-ticket-quote" type="button" onClick={() => openReply(message.content)} aria-label={`Kutip pesan #${message.id}`} title="Kutip balasan"><Quote size={14} /></button> : null}
                      </header>
                      <p>{message.content}</p>
                    </article>
                  ))}
                </div>
                {replyOpen && ticketStatus !== 'closed' ? (
                  <form className="dashboard-ticket-reply" onSubmit={handleTicketReply}>
                    <textarea id="ticket-reply-text" rows={6} value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Tulis balasan..." required />
                    <div>
                      <button className="dashboard-primary-action" type="submit" disabled={isReplying || replyText.trim() === ''}>{isReplying ? 'Mengirim...' : 'Kirim'}</button>
                      <button className="dashboard-profile-retry" type="button" onClick={() => { setReplyOpen(false); setReplyText('') }}>Batal</button>
                    </div>
                  </form>
                ) : null}
                {ticketStatus === 'closed' ? <p className="dashboard-ticket-closed" role="status">Tiket ini sudah ditutup dan tidak dapat dibuka kembali.</p> : null}
              </>
            ) : null}
          </section>
        )
      }

      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading dashboard-page-heading-action">
            <div><span className="dashboard-section-kicker">BANTUAN PELANGGAN</span><h2>Tiket dukungan</h2><p>Ada pertanyaan? Tim kami siap membantu.</p></div>
            <button className="dashboard-primary-action" type="button" onClick={() => setTicketModalOpen(true)}><LifeBuoy size={16} /> Tiket baru</button>
          </div>
          {ticketListState === 'loading' || ticketListState === 'idle' ? (
            <div className="dashboard-profile-loading" role="status">Memuat tiket...</div>
          ) : ticketListState === 'error' ? (
            <div className="dashboard-profile-load-error" role="alert">
              <p>{ticketListError}</p>
              <button type="button" className="dashboard-profile-retry" onClick={() => setTicketListAttempt((attempt) => attempt + 1)}>Coba lagi</button>
            </div>
          ) : ticketList.length === 0 ? (
            <div className="dashboard-empty-state"><span><LifeBuoy size={22} /></span><strong>Belum ada tiket dukungan</strong><p>Tiket yang kamu buat akan muncul di halaman ini.</p></div>
          ) : (
            <div className="dashboard-table-wrap dashboard-wide-table">
              <table>
                <thead><tr><th>ID</th><th>SUBJEK</th><th>HELPDESK</th><th>STATUS</th><th>DIKIRIM</th><th>AKSI</th></tr></thead>
                <tbody>{ticketList.map((item) => {
                  const itemStatus = item.status.toLowerCase()
                  const itemStatusLabel = { open: 'Terbuka', on_hold: 'Ditunda', closed: 'Ditutup' }[itemStatus]
                    || itemStatus.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
                  const openItem = () => { markTicketRead(item.id); setTicket(null); setReplyOpen(false); setReplyText(''); setActiveTicketId(item.id) }
                  return (
                    <tr key={item.id}>
                      <td>#{item.id}</td>
                      <td><button className={`dashboard-ticket-link${unreadTicketIds.has(String(item.id)) ? ' is-unread' : ''}`} type="button" onClick={openItem}>{unreadTicketIds.has(String(item.id)) && <i className="dashboard-unread-dot" aria-label="Belum dibaca" />}{item.subject}</button></td>
                      <td>{item.helpdesk || '-'}</td>
                      <td><span className={`dashboard-status ${itemStatus === 'open' ? 'status-active' : itemStatus === 'on_hold' ? 'status-pending' : 'status-closed'}`}><i />{itemStatusLabel}</span></td>
                      <td>{formatRelativeTime(item.created_at)}</td>
                      <td><button className="dashboard-profile-retry" type="button" onClick={openItem}>{itemStatus === 'closed' ? 'Lihat' : 'Balas'}</button></td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          )}
        </section>
      )
    }

    if (activePage === 'services') {
      const startOfTodaySort = new Date()
      startOfTodaySort.setHours(0, 0, 0, 0)
      const serviceStatusRank = (service) => {
        const status = String(service.status || '').toLowerCase()
        if (['canceled', 'cancelled'].includes(status)) return 2
        if (status === 'active' || status === 'paid') {
          const expiry = service.expires_at ? new Date(String(service.expires_at).replace(' ', 'T')) : null
          const expired = expiry && !Number.isNaN(expiry.getTime()) && expiry < startOfTodaySort
          return expired ? 1 : 0
        }
        return 1
      }
      const sortedServiceOrders = [...serviceOrders].sort((a, b) => {
        const rankDiff = serviceStatusRank(a) - serviceStatusRank(b)
        if (rankDiff !== 0) return rankDiff
        const aExp = a.expires_at ? new Date(String(a.expires_at).replace(' ', 'T')).getTime() : Number.MAX_SAFE_INTEGER
        const bExp = b.expires_at ? new Date(String(b.expires_at).replace(' ', 'T')).getTime() : Number.MAX_SAFE_INTEGER
        if (aExp !== bExp) return aExp - bExp
        return Number(b.id) - Number(a.id)
      })
      const pageCount = Math.ceil(sortedServiceOrders.length / servicesPerPage)
      const visibleOrders = sortedServiceOrders.slice((servicePage - 1) * servicesPerPage, servicePage * servicesPerPage)
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading"><div><span className="dashboard-section-kicker">AKUN PELANGGAN</span><h2>Layanan</h2><p>Kelola layanan dan lihat jadwal perpanjanganmu.</p></div></div>
          {serviceState === 'loading' ? (
            <div className="dashboard-profile-loading" role="status">Memuat daftar layanan...</div>
          ) : serviceState === 'error' ? (
            <div className="dashboard-profile-load-error" role="alert">
              <p>{serviceError}</p>
              <button type="button" className="dashboard-profile-retry" onClick={() => setServiceLoadAttempt((attempt) => attempt + 1)}>Coba lagi</button>
            </div>
          ) : (
            <>
              <div className="dashboard-table-wrap dashboard-wide-table">
                <table>
                  <thead><tr><th>ORDER</th><th>PRODUK / LAYANAN</th><th>HARGA</th><th>JATUH TEMPO</th><th>STATUS</th><th>AKSI</th></tr></thead>
                  <tbody>{visibleOrders.length ? visibleOrders.map((service) => {
                    const status = String(service.status || '').toLowerCase()
                    const currency = typeof service.currency === 'string' && /^[A-Za-z]{3}$/.test(service.currency)
                      ? service.currency.toUpperCase()
                      : ''
                    const priceValue = service.price === null || service.price === undefined || service.price === ''
                      ? null
                      : Number(service.price)
                    const periodName = servicePeriodLabel(service.period)
                    const priceLabel = Number.isFinite(priceValue)
                      ? `${formatFullPrice(priceValue, currency || 'IDR')}${periodName ? ` / ${periodName}` : ''}`
                      : '-'
                    const dueDate = service.expires_at
                      ? new Date(String(service.expires_at).replace(' ', 'T'))
                      : null
                    const dueValid = dueDate && !Number.isNaN(dueDate.getTime())
                    const dueLabel = dueValid
                      ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(dueDate)
                      : service.expires_at || '-'
                    const startOfToday = new Date()
                    startOfToday.setHours(0, 0, 0, 0)
                    const isPastDue = Boolean(dueValid) && dueDate < startOfToday
                    const pendingStatuses = ['pending', 'pending_setup', 'unpaid', 'awaiting_payment']
                    const paidStatuses = ['paid', 'active']
                    const cancelledStatuses = ['canceled', 'cancelled']
                    const expiredStatuses = ['expired', 'overdue', 'failed', 'failed_setup']
                    const fallbackLabel = status.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

                    let statusLabel = fallbackLabel || 'Tidak diketahui'
                    let statusTone = 'status-closed'
                    if (paidStatuses.includes(status)) {
                      statusLabel = 'Aktif'
                      statusTone = 'status-active'
                    } else if (cancelledStatuses.includes(status)) {
                      statusLabel = 'Dibatalkan'
                    } else if (expiredStatuses.includes(status) || (isPastDue && pendingStatuses.includes(status))) {
                      statusLabel = 'Kedaluwarsa'
                    } else if (pendingStatuses.includes(status)) {
                      statusLabel = 'Menunggu pembayaran'
                      statusTone = 'status-pending'
                    } else if (status === 'suspended') {
                      statusLabel = 'Ditangguhkan'
                    }

                    return (
                      <tr key={service.id}>
                        <td><button className="dashboard-text-action" type="button" onClick={() => setNotice(`Detail order #${service.id} akan tersedia setelah API FossBilling terhubung.`)}>#{service.id}</button></td>
                        <td>{service.title}</td><td>{priceLabel}</td><td>{dueLabel}</td>
                        <td><span className={`dashboard-status ${statusTone}`}><i />{statusLabel}</span></td>
                        <td><button className="dashboard-outline-action" type="button" onClick={() => setNotice(`Pengelolaan ${service.title} akan tersedia setelah API FossBilling terhubung.`)}>Kelola</button></td>
                      </tr>
                    )
                  }) : <tr><td className="dashboard-table-empty" colSpan="6">Belum ada layanan.</td></tr>}</tbody>
                </table>
              </div>
              {pageCount > 1 && (
                <div className="dashboard-pagination">
                  <span>Halaman {servicePage} dari {pageCount}</span>
                  <div>
                    <button type="button" className="dashboard-outline-action" onClick={() => setServicePage((page) => page - 1)} disabled={servicePage === 1}>Sebelumnya</button>
                    <button type="button" className="dashboard-outline-action" onClick={() => setServicePage((page) => page + 1)} disabled={servicePage === pageCount}>Selanjutnya</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )
    }

    if (activePage === 'invoices') {
      // ── Invoice detail sub-page ──────────────────────────────────────────────
      if (invoiceDetail !== null) {
        const inv = invoiceDetail
        const currency = typeof inv.currency === 'string' && /^[A-Za-z]{3}$/.test(inv.currency)
          ? inv.currency.toUpperCase()
          : 'IDR'
        const { label: statusLabel, tone: statusTone } = invoiceStatusDisplay(inv.status)
        const lines = Array.isArray(inv.lines) ? inv.lines : []

        const handlePdfDownload = async () => {
          if (isPdfDownloading) return
          setIsPdfDownloading(true)
          try {
            const response = await fetch(`/api/fossbilling-auth.php?action=invoice-pdf&id=${encodeURIComponent(inv.id)}`, { credentials: 'same-origin' })
            if (!response.ok) {
              const result = await response.json().catch(() => null)
              throw new Error(result?.error || 'PDF tidak dapat diunduh.')
            }
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${inv.number || `invoice-${inv.id}`}.pdf`
            a.click()
            URL.revokeObjectURL(url)
          } catch (err) {
            setNotice(err.message || 'PDF tidak dapat diunduh.')
          } finally {
            setIsPdfDownloading(false)
          }
        }

        const handlePrint = () => {
          window.print()
        }

        return (
          <section className="dashboard-page-panel">
            <div className="dashboard-page-heading dashboard-invoice-detail-heading">
              <div>
                <nav className="dashboard-breadcrumb" aria-label="Navigasi">
                  <button type="button" onClick={() => { setInvoiceDetail(null); setInvoiceDetailState('idle'); setInvoiceDetailError('') }}>
                    <ArrowLeft size={13} /> Tagihan
                  </button>
                  <ChevronRight size={13} />
                  <strong>{inv.number || `#${inv.id}`}</strong>
                </nav>
                <h2>Ringkasan Tagihan</h2>
                <p>Rincian tagihan {inv.number || `#${inv.id}`}.</p>
              </div>
              <div className="dashboard-invoice-detail-actions no-print">
                <button
                  type="button"
                  className="dashboard-outline-action"
                  onClick={handlePdfDownload}
                  disabled={isPdfDownloading}
                  title="Unduh PDF"
                >
                  <ArrowDownToLine size={15} />
                  {isPdfDownloading ? 'Mengunduh...' : 'Unduh PDF'}
                </button>
                <button
                  type="button"
                  className="dashboard-outline-action"
                  onClick={handlePrint}
                  title="Cetak tagihan"
                >
                  <FileText size={15} />
                  Cetak
                </button>
              </div>
            </div>

            <div className="dashboard-invoice-summary">
              {/* Header info */}
              <div className="dashboard-invoice-summary-header">
                <div className="dashboard-invoice-summary-meta">
                  <div className="dashboard-invoice-meta-row">
                    <span>Nomor Tagihan</span>
                    <strong>{inv.number || `#${inv.id}`}</strong>
                  </div>
                  <div className="dashboard-invoice-meta-row">
                    <span>Status</span>
                    <span className={`dashboard-status ${statusTone}`}><i />{statusLabel}</span>
                  </div>
                  <div className="dashboard-invoice-meta-row">
                    <span>Tanggal Tagihan</span>
                    <strong>{formatInvoiceDate(inv.created_at)}</strong>
                  </div>
                  {inv.due_at && (
                    <div className="dashboard-invoice-meta-row">
                      <span>Jatuh Tempo</span>
                      <strong>{formatInvoiceDate(inv.due_at)}</strong>
                    </div>
                  )}
                  {inv.paid_at && (
                    <div className="dashboard-invoice-meta-row">
                      <span>Tanggal Lunas</span>
                      <strong>{formatInvoiceDate(inv.paid_at)}</strong>
                    </div>
                  )}
                </div>
                {/* Seller / Buyer */}
                <div className="dashboard-invoice-parties">
                  {inv.seller && (
                    <div className="dashboard-invoice-party">
                      <small>DARI</small>
                      {inv.seller.company && <strong>{inv.seller.company}</strong>}
                      {inv.seller.address && <span>{inv.seller.address}</span>}
                      {inv.seller.phone && <span>{inv.seller.phone}</span>}
                      {inv.seller.email && <span>{inv.seller.email}</span>}
                    </div>
                  )}
                  {inv.buyer && (
                    <div className="dashboard-invoice-party">
                      <small>KEPADA</small>
                      {(inv.buyer.first_name || inv.buyer.last_name) && (
                        <strong>{[inv.buyer.first_name, inv.buyer.last_name].filter(Boolean).join(' ')}</strong>
                      )}
                      {inv.buyer.company && <span>{inv.buyer.company}</span>}
                      {inv.buyer.email && <span>{inv.buyer.email}</span>}
                      {inv.buyer.phone && <span>{inv.buyer.phone}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Line items */}
              {lines.length > 0 && (
                <div className="dashboard-invoice-lines">
                  <table>
                    <thead>
                      <tr>
                        <th>Deskripsi</th>
                        <th>Qty</th>
                        <th>Harga Satuan</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{line.title || '-'}</strong>
                            {line.period && <small>{servicePeriodLabel(line.period) || line.period}</small>}
                          </td>
                          <td>{line.quantity ?? 1}</td>
                          <td>{formatFullPrice(line.price, currency)}</td>
                          <td>{formatFullPrice(line.total, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div className="dashboard-invoice-totals">
                {inv.subtotal !== null && inv.subtotal !== undefined && inv.subtotal !== inv.total && (
                  <div className="dashboard-invoice-total-row">
                    <span>Subtotal</span>
                    <span>{formatFullPrice(inv.subtotal, currency)}</span>
                  </div>
                )}
                {inv.tax !== null && inv.tax !== undefined && inv.tax > 0 && (
                  <div className="dashboard-invoice-total-row">
                    <span>{inv.taxname || 'Pajak'}{inv.taxrate ? ` (${inv.taxrate}%)` : ''}</span>
                    <span>{formatFullPrice(inv.tax, currency)}</span>
                  </div>
                )}
                <div className="dashboard-invoice-total-row dashboard-invoice-grand-total">
                  <span>Total</span>
                  <strong>{formatFullPrice(inv.total, currency)}</strong>
                </div>
              </div>

              {inv.notes && (
                <div className="dashboard-invoice-notes">
                  <small>Catatan</small>
                  <p>{inv.notes}</p>
                </div>
              )}
            </div>

            {/* Bottom action bar (no-print) */}
            <div className="dashboard-invoice-bottom-actions no-print">
              <button
                type="button"
                className="dashboard-outline-action"
                onClick={() => { setInvoiceDetail(null); setInvoiceDetailState('idle'); setInvoiceDetailError('') }}
              >
                <ArrowLeft size={15} /> Kembali ke Tagihan
              </button>
              <button
                type="button"
                className="dashboard-outline-action"
                onClick={handlePdfDownload}
                disabled={isPdfDownloading}
              >
                <ArrowDownToLine size={15} />
                {isPdfDownloading ? 'Mengunduh...' : 'Unduh PDF'}
              </button>
              <button
                type="button"
                className="dashboard-outline-action"
                onClick={handlePrint}
              >
                <FileText size={15} /> Cetak
              </button>
            </div>
          </section>
        )
      }

      // ── Invoice detail loading / error state ─────────────────────────────────
      if (invoiceDetailState === 'loading') {
        return (
          <section className="dashboard-page-panel">
            <div className="dashboard-profile-loading" role="status">Memuat rincian tagihan...</div>
          </section>
        )
      }
      if (invoiceDetailState === 'error') {
        return (
          <section className="dashboard-page-panel">
            <div className="dashboard-profile-load-error" role="alert">
              <p>{invoiceDetailError}</p>
              <button type="button" className="dashboard-profile-retry" onClick={() => { setInvoiceDetailState('idle'); setInvoiceDetailError('') }}>Kembali</button>
            </div>
          </section>
        )
      }

      // ── Invoice list ─────────────────────────────────────────────────────────
      const invoiceStatusFilters = [
        { label: 'Menunggu', statuses: ['unpaid'] },
        { label: 'Lunas', statuses: ['paid'] },
        { label: 'Dikembalikan', statuses: ['refunded'] },
        { label: 'Dibatalkan', statuses: ['canceled'] },
      ]
      const activeFilter = invoiceStatusFilters.find((filter) => filter.label === invoiceFilter) || invoiceStatusFilters[0]
      const filteredInvoices = invoiceRecords.filter((invoice) => activeFilter.statuses.includes(invoice.status))
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const openInvoiceDetail = (invoice) => {
        setInvoiceDetailState('loading')
        setInvoiceDetailError('')
        setInvoiceDetail(null)
        fetch(`/api/fossbilling-auth.php?action=invoice&id=${encodeURIComponent(invoice.id)}`, { credentials: 'same-origin' })
          .then(async (response) => {
            const result = await response.json().catch(() => null)
            if (!response.ok || !result?.invoice) {
              throw new Error(result?.error || 'Rincian tagihan tidak dapat dimuat.')
            }
            setInvoiceDetail(result.invoice)
            setInvoiceDetailState('loaded')
          })
          .catch((error) => {
            setInvoiceDetailError(error.message || 'Rincian tagihan tidak dapat dimuat.')
            setInvoiceDetailState('error')
          })
      }

      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading"><div><span className="dashboard-section-kicker">PEMBAYARAN</span><h2>Tagihan</h2><p>Lihat status dan riwayat tagihan akunmu.</p></div></div>
          <div className="dashboard-filter-tabs" role="tablist" aria-label="Filter tagihan">
            {invoiceStatusFilters.map((filter) => <button type="button" role="tab" aria-selected={invoiceFilter === filter.label} className={invoiceFilter === filter.label ? 'dashboard-filter-active' : ''} key={filter.label} onClick={() => { setInvoiceFilter(filter.label); setInvoicePage(1) }}>{filter.label}</button>)}
          </div>
          {invoiceState === 'loading' ? (
            <div className="dashboard-profile-loading" role="status">Memuat daftar tagihan...</div>
          ) : invoiceState === 'error' ? (
            <div className="dashboard-profile-load-error" role="alert">
              <p>{invoiceError}</p>
              <button type="button" className="dashboard-profile-retry" onClick={() => setInvoiceLoadAttempt((attempt) => attempt + 1)}>Coba lagi</button>
            </div>
          ) : (() => {
            const invoicesPerPage = 10
            const pageCount = Math.ceil(filteredInvoices.length / invoicesPerPage)
            const safePage = Math.min(invoicePage, pageCount || 1)
            const visibleInvoices = filteredInvoices.slice((safePage - 1) * invoicesPerPage, safePage * invoicesPerPage)
            return (
              <>
                <div className="dashboard-table-wrap dashboard-wide-table">
                  <table>
                    <thead><tr><th>NOMOR</th><th>TANGGAL TAGIHAN</th><th>JATUH TEMPO</th><th>TOTAL</th><th>STATUS</th><th>AKSI</th></tr></thead>
                    <tbody>{visibleInvoices.length ? visibleInvoices.map((invoice) => {
                      const status = String(invoice.status || '').toLowerCase()
                      const currency = typeof invoice.currency === 'string' && /^[A-Za-z]{3}$/.test(invoice.currency)
                        ? invoice.currency.toUpperCase()
                        : 'IDR'
                      const amountLabel = invoice.total === null || invoice.total === undefined
                        ? '-'
                        : formatFullPrice(invoice.total, currency)
                      const dueDate = invoice.due_at ? new Date(String(invoice.due_at).replace(' ', 'T')) : null
                      const dueValid = dueDate && !Number.isNaN(dueDate.getTime())
                      const dueLabel = formatInvoiceDate(invoice.due_at)
                      const isPastDue = status === 'unpaid' && dueValid && dueDate < startOfToday

                      let statusLabel = 'Menunggu pembayaran'
                      let statusTone = 'status-pending'
                      if (status === 'paid') {
                        statusLabel = 'Lunas'
                        statusTone = 'status-paid'
                      } else if (status === 'refunded') {
                        statusLabel = 'Dikembalikan'
                        statusTone = 'status-closed'
                      } else if (status === 'canceled' || status === 'cancelled') {
                        statusLabel = 'Dibatalkan'
                        statusTone = 'status-closed'
                      } else if (status === 'unpaid' && isPastDue) {
                        statusTone = 'status-closed'
                      }
                      const isPayable = status === 'unpaid'

                      return (
                        <tr key={invoice.id}>
                          <td><strong>{invoice.number || `#${invoice.id}`}</strong>{invoice.title ? <small>{invoice.title}</small> : null}</td>
                          <td>{formatInvoiceDate(invoice.created_at)}</td>
                          <td>{dueLabel}</td>
                          <td className="invoice-amount">{amountLabel}</td>
                          <td><span className={`dashboard-status ${statusTone}`}><i />{statusLabel}</span></td>
                          <td>
                            <button
                              className="dashboard-outline-action"
                              type="button"
                              onClick={() => {
                                if (isPayable && !isPastDue) {
                                  setInvoicePayModal(invoice)
                                  setInvoicePayMethod('')
                                  setInvoicePayError('')
                                } else {
                                  openInvoiceDetail(invoice)
                                }
                              }}
                            >{isPayable && !isPastDue ? 'Bayar' : 'Lihat'}</button>
                          </td>
                        </tr>
                      )
                    }) : <tr><td className="dashboard-table-empty" colSpan="6">Belum ada tagihan dengan status ini.</td></tr>}</tbody>
                  </table>
                </div>
                {pageCount > 1 && (
                  <div className="dashboard-pagination">
                    <span>Halaman {safePage} dari {pageCount}</span>
                    <div>
                      <button type="button" className="dashboard-outline-action" onClick={() => setInvoicePage((p) => p - 1)} disabled={safePage === 1}>Sebelumnya</button>
                      <button type="button" className="dashboard-outline-action" onClick={() => setInvoicePage((p) => p + 1)} disabled={safePage === pageCount}>Selanjutnya</button>
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </section>
      )
    }

    if (activePage === 'emails') {
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading"><div><span className="dashboard-section-kicker">RIWAYAT AKUN</span><h2>Email</h2><p>Salinan email yang dikirim untuk akunmu akan ditampilkan di sini.</p></div></div>
          <div className="dashboard-empty-state"><span><Mail size={22} /></span><strong>Belum ada email</strong><p>Email yang kami kirim akan tersedia di sini.</p></div>
        </section>
      )
    }

    if (activePage === 'wallet') {
      const walletLoading = wallet.status === 'idle' || wallet.status === 'loading'
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading"><div><span className="dashboard-section-kicker">PEMBAYARAN</span><h2>Dompet</h2><p>Saldo akun dan aktivitas transaksi.</p></div></div>
          {wallet.status === 'error' ? (
            <div className="dashboard-profile-load-error" role="alert">
              <p>{wallet.error}</p>
              <button type="button" className="dashboard-profile-retry" onClick={() => setWalletLoadAttempt((attempt) => attempt + 1)}>Coba lagi</button>
            </div>
          ) : walletLoading ? (
            <div className="dashboard-profile-loading" role="status">Memuat dompet...</div>
          ) : (
            <>
              <div className="dashboard-wallet-card"><span className="dashboard-stat-icon stat-icon-teal"><Wallet size={19} /></span><span>Saldo akun</span><strong>{formatFullPrice(wallet.balance, wallet.currency)}</strong><small>Saldo tersinkron dengan FossBilling</small><button className="dashboard-primary-action" type="button" onClick={() => { setTopupAmount(''); setTopupMethod(''); setTopupError(''); setTopupOpen(true) }}><CreditCard size={16} /> Tambah saldo</button></div>
              <div className="dashboard-section-heading dashboard-wallet-heading"><div><span className="dashboard-section-kicker">AKTIVITAS</span><h2>Transaksi terbaru</h2></div></div>
              {wallet.transactions.length ? wallet.transactions.map((transaction) => {
                const amount = Number(transaction.amount)
                const credit = Number.isFinite(amount) && amount >= 0
                return (
                  <div className="dashboard-transaction-row" key={transaction.id}>
                    <span className="dashboard-transaction-icon">{credit ? <Wallet size={17} /> : <CreditCard size={17} />}</span>
                    <span><strong>{transaction.description || 'Transaksi saldo'}</strong><small>{formatInvoiceDate(transaction.created_at)}</small></span>
                    <strong className={credit ? 'dashboard-transaction-credit' : 'dashboard-transaction-amount'}>{credit ? '+ ' : '− '}{formatFullPrice(Math.abs(amount), transaction.currency || wallet.currency)}</strong>
                  </div>
                )
              }) : (
                <div className="dashboard-empty-state"><span><Wallet size={22} /></span><strong>Belum ada transaksi</strong><p>Aktivitas saldo akan muncul di sini.</p></div>
              )}
            </>
          )}
        </section>
      )
    }

    if (activePage === 'news') {
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading"><div><span className="dashboard-section-kicker">PEMBARUAN</span><h2>Berita & pengumuman</h2><p>Informasi terbaru dari Sangatta Cloud.</p></div></div>
          <div className="dashboard-news-list">
            {[['Pemeliharaan sistem terjadwal', 'Kami akan melakukan pemeliharaan rutin untuk menjaga layanan tetap optimal.', '20 Okt 2026'], ['Selamat datang di Sangatta Cloud', 'Terima kasih telah menjadi bagian dari ruang digital yang lebih personal.', '1 Okt 2026']].map(([title, description, date]) => (
              <article className="dashboard-news-item" key={title}><span className="dashboard-news-icon"><Newspaper size={18} /></span><div><span className="dashboard-news-date">{date}</span><h3>{title}</h3><p>{description}</p><button className="dashboard-text-action" type="button" onClick={() => setNotice('Artikel berita akan tersedia setelah konten terhubung ke FossBilling.')}>Baca selengkapnya <ArrowRight size={14} /></button></div></article>
            ))}
          </div>
        </section>
      )
    }

    if (activePage === 'knowledge-base') {
      const visibleArticles = supportArticles.filter((article) => `${article.title} ${article.category}`.toLowerCase().includes(articleQuery.toLowerCase()))
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading"><div><span className="dashboard-section-kicker">PANDUAN</span><h2>Pusat bantuan</h2><p>Temukan jawaban untuk pertanyaan seputar akun dan layanan.</p></div></div>
          <label className="dashboard-article-search"><Search size={16} /><input value={articleQuery} onChange={(event) => setArticleQuery(event.target.value)} placeholder="Cari artikel bantuan..." /></label>
          <div className="dashboard-article-list">{visibleArticles.length ? visibleArticles.map((article) => (
            <button className="dashboard-article-item" type="button" key={article.title} onClick={() => setNotice('Artikel bantuan akan tersedia setelah konten terhubung ke FossBilling.')}><span className="dashboard-article-icon"><BookOpen size={17} /></span><span><small>{article.category}</small><strong>{article.title}</strong><small>{article.readTime}</small></span><ChevronRight size={17} /></button>
          )) : <div className="dashboard-table-empty">Tidak ada artikel yang cocok dengan pencarianmu.</div>}</div>
        </section>
      )
    }

    return null
  }

  if (authState === 'loading') {
    return <main className="auth-loading-screen" role="status"><div className="auth-loading-card"><span className="auth-loading-mark"><Cloud size={26} /></span><span className="auth-card-kicker">AREA PELANGGAN</span><h1>Memeriksa sesi akun</h1><p>Menyiapkan dashboard pribadimu...</p></div></main>
  }

  if (authState === 'error') {
    return <main className="auth-loading-screen"><div className="auth-loading-card"><span className="auth-loading-mark"><ShieldCheck size={26} /></span><span className="auth-card-kicker">AREA PELANGGAN</span><h1>Sesi belum dapat diverifikasi</h1><p>{authError}</p><a className="dashboard-outline-action" href="/login">Kembali ke login</a><button className="dashboard-profile-retry" type="button" onClick={() => window.location.reload()}>Coba lagi</button></div></main>
  }

  return (
    <main className="client-dashboard">
      <aside className={`dashboard-sidebar ${menuOpen ? 'dashboard-sidebar-open' : ''}`}>
        <a className="dashboard-brand" href="/dashboard" onClick={(event) => { event.preventDefault(); openPage('dashboard') }}>
          <span className="dashboard-brand-mark"><Cloud size={22} /></span>
          <span>Sangatta <b>Cloud</b><i>.</i></span>
        </a>
        <p className="dashboard-nav-label">MENU UTAMA</p>
        <nav className="dashboard-nav">
          {dashboardMenuItems.map(({ id, label, icon: Icon }) => (
            <button
              className={`dashboard-nav-link ${activePage === id ? 'dashboard-nav-active' : ''}`}
              type="button"
              aria-current={activePage === id ? 'page' : undefined}
              key={label}
              onClick={() => openPage(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'invoices' && unpaidInvoiceCount > 0 && <span className="dashboard-nav-count">{unpaidInvoiceCount}</span>}
              {id === 'support' && supportUnread > 0 && <span className="dashboard-nav-count">{supportUnread}</span>}
            </button>
          ))}
          <button className="dashboard-nav-link" type="button" onClick={handleOpenStorage}>
            <HardDrive size={18} />
            <span>Storage Area</span>
          </button>
        </nav>
        <div className="dashboard-sidebar-bottom">
          <div className="dashboard-help-card">
            <span className="dashboard-help-icon"><CircleHelp size={19} /></span>
            <strong>Butuh bantuan?</strong>
            <span>Tim kami siap membantu.</span>
            <button type="button" onClick={() => openPage('support')}>Hubungi dukungan <ArrowRight size={13} /></button>
          </div>
          <a className="dashboard-nav-link" href="/"><Settings2 size={18} /><span>Beranda website</span></a>
          <p className="dashboard-sidebar-copy">© 2026 Sangatta Cloud</p>
        </div>
      </aside>

      <section className="dashboard-main" id="dashboard">
        <header className="dashboard-topbar">
          <button className="dashboard-menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="dashboard-search">
            <Search size={16} />
            <input aria-label="Cari" placeholder="Cari layanan, tagihan..." />
            <kbd>⌘ K</kbd>
          </div>
          <div className="dashboard-notification-wrap" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setCartOpen(false)
          }} onKeyDown={(event) => {
            if (event.key === 'Escape') setCartOpen(false)
          }}>
            <button className="dashboard-icon-button" type="button" aria-label="Keranjang" aria-haspopup="true" aria-expanded={cartOpen} onClick={() => { setBellOpen(false); setCartOpen((open) => !open) }}>
              <ShoppingCart size={18} />{cart.items.length > 0 && <span className="dashboard-cart-count">{cart.items.length}</span>}
            </button>
            {cartOpen && (
              <div className="dashboard-notification-panel dashboard-cart-panel">
                <div className="dashboard-notification-head"><strong>Keranjang</strong></div>
                {cartError && <p role="alert">{cartError}</p>}
                {cart.items.length === 0 ? <p>Keranjang masih kosong.</p> : (
                  <>
                    <ul>
                      {groupCartItems(cart.items).map((item) => {
                        const categoryId = orderProducts.find((product) => String(product.id) === item.product_id)?.category_id
                        const categoryName = orderCategories.find((category) => category.id === categoryId)?.name
                        return (
                        <li className="dashboard-cart-item" key={item.key}>
                          <span><strong>{categoryName ? `${item.title} - ${categoryName}` : item.title}{item.count > 1 && <em className="dashboard-count" aria-label={`${item.count} item`}>X {item.count}</em>}</strong><small>{periodLabels[item.period] || item.period || '-'} · {formatFullPrice(item.price, cart.currency)}</small></span>
                          <button type="button" aria-label={`Hapus satu ${item.title}`} disabled={isCartBusy} onClick={() => updateCart('cart-remove', { id: item.lastId })}><X size={14} /></button>
                        </li>
                        )
                      })}
                    </ul>
                    <div className="dashboard-cart-total"><span>Total</span><strong>{formatFullPrice(cart.total, cart.currency)}</strong></div>
                    <button className="dashboard-primary-action dashboard-cart-checkout" type="button" onClick={() => openPage('checkout')}>Checkout <ArrowRight size={15} /></button>
                  </>
                )}
              </div>
            )}
          </div>
          <button className="dashboard-topbar-balance" type="button" onClick={() => openPage('wallet')} title="Buka dompet">
            <Wallet size={16} />
            <span className="dashboard-topbar-balance-copy"><small>Saldo akun</small><strong>{wallet.status === 'loaded' ? formatFullPrice(wallet.balance, wallet.currency) : wallet.status === 'error' ? '—' : '…'}</strong></span>
          </button>
          <NotificationBell
            notifications={notifications}
            open={bellOpen}
            onOpenChange={(open) => { if (open) setCartOpen(false); setBellOpen(open) }}
            onSelect={(item) => { markTicketRead(item.ticketId); openPage('support'); setActiveTicketId(String(item.ticketId)) }}
          />
          <div className="dashboard-account-menu-wrap" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setAccountMenuOpen(false)
          }} onKeyDown={(event) => {
            if (event.key === 'Escape') setAccountMenuOpen(false)
          }}>
            <button className="dashboard-account" type="button" aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}>
              <span className="dashboard-avatar">{customerInitials}</span>
              <span className="dashboard-account-copy"><strong>{customerName}</strong><small>Akun pelanggan</small></span>
              <ChevronDown size={15} />
            </button>
            {accountMenuOpen && (
              <div className="dashboard-account-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => {
                  setProfileTab('details')
                  setAccountMenuOpen(false)
                  openPage('profile')
                }}><UserRound size={15} /> Profil</button>
                <button type="button" role="menuitem" className="dashboard-account-menu-logout" onClick={handleLogout} disabled={isLoggingOut}><LogOut size={15} /> {isLoggingOut ? 'Keluar...' : 'Keluar'}</button>
              </div>
            )}
          </div>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-preview-alert" role="note">
            <span><ShieldCheck size={17} /></span>
            <p><strong>Pratinjau dashboard</strong> — beberapa data masih contoh; daftar layanan dimuat dari FossBilling.</p>
          </div>

          {activePage === 'dashboard' ? (
            <>
          <section className="dashboard-welcome">
            <div>
              <span className="dashboard-eyebrow"><Gauge size={14} /> AREA PELANGGAN</span>
              <h1>Selamat datang kembali<span>.</span></h1>
              <p>Ringkasan layanan dan tagihanmu ada di sini.</p>
            </div>
            <button className="dashboard-primary-action" type="button" onClick={() => openPage('orders')}>
              <PackagePlus size={17} /> Pesan layanan
            </button>
          </section>

          <section className="dashboard-stat-grid" aria-label="Ringkasan akun">
            <article className="dashboard-stat-card">
              <span className="dashboard-stat-icon stat-icon-teal"><Cloud size={19} /></span>
              <span className="dashboard-stat-label">Layanan aktif</span>
              <strong>2</strong>
              <small><span className="stat-positive">Semua berjalan</span></small>
            </article>
            <article className="dashboard-stat-card">
              <span className="dashboard-stat-icon stat-icon-orange"><CreditCard size={19} /></span>
              <span className="dashboard-stat-label">Tagihan terbuka</span>
              <strong>Rp149.000</strong>
              <small>Jatuh tempo 28 Okt 2026</small>
            </article>
            <article className="dashboard-stat-card">
              <span className="dashboard-stat-icon stat-icon-blue"><HardDrive size={19} /></span>
              <span className="dashboard-stat-label">Penyimpanan terpakai</span>
              <strong>92 <small>GB</small></strong>
              <div className="dashboard-usage"><span /></div>
              <small>92 GB dari 350 GB</small>
            </article>
          </section>

          <section className="dashboard-section" id="services">
            <div className="dashboard-section-heading">
              <div><span className="dashboard-section-kicker">LAYANANMU</span><h2>Layanan aktif</h2></div>
              <button type="button" onClick={() => openPage('services')}>Lihat semua <ArrowRight size={15} /></button>
            </div>
            <div className="dashboard-services-grid">
              {services.map((service) => (
                <article className="dashboard-service-card" key={service.name}>
                  <div className="dashboard-service-top">
                    <span className="dashboard-service-icon"><Cloud size={20} /></span>
                    <span className="dashboard-status status-active"><i /> Aktif</span>
                  </div>
                  <h3>{service.name}</h3>
                  <p>{service.detail}</p>
                  <div className="dashboard-service-usage">
                    <div><span>Penyimpanan</span><strong>{service.used} <small>/ {service.total}</small></strong></div>
                    <div className="dashboard-usage"><span style={{ width: `${service.progress}%` }} /></div>
                  </div>
                  <div className="dashboard-service-footer">
                    <span>Perpanjangan <strong>{service.next}</strong></span>
                    <button type="button" onClick={() => setNotice('Detail layanan akan aktif setelah data FossBilling tersedia.')}>Kelola <ArrowRight size={14} /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-lower-grid">
            <div className="dashboard-panel dashboard-invoices" id="invoices">
              <div className="dashboard-section-heading">
                <div><span className="dashboard-section-kicker">PEMBAYARAN</span><h2>Tagihan terbaru</h2></div>
                <button type="button" onClick={() => openPage('invoices')}>Semua tagihan <ArrowRight size={15} /></button>
              </div>
              <div className="dashboard-table-wrap">
                <table>
                  <thead><tr><th>Nomor</th><th>Tanggal</th><th>Total</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {(invoiceState === 'loaded'
                      ? invoiceRecords.slice(0, 3).map((invoice) => ({
                          id: invoice.number || `#${invoice.id}`,
                          date: formatInvoiceDate(invoice.created_at),
                          due: formatInvoiceDate(invoice.due_at),
                          amount: invoice.total === null || invoice.total === undefined
                            ? '-'
                            : formatFullPrice(invoice.total, invoice.currency || 'IDR'),
                          status: invoice.status,
                        }))
                      : invoices
                    ).map((invoice) => (
                      <tr key={invoice.id}>
                        <td><strong>{invoice.id}</strong><small>Jatuh tempo {invoice.due}</small></td>
                        <td>{invoice.date}</td>
                        <td className="invoice-amount">{invoice.amount}</td>
                        <td><span className={`dashboard-status ${invoiceStatusDisplay(invoice.status).tone}`}><i />{invoiceStatusDisplay(invoice.status).label}</span></td>
                        <td><button type="button" className="invoice-download" aria-label={`Unduh ${invoice.id}`} onClick={() => setNotice('Unduh invoice akan tersedia setelah API FossBilling dihubungkan.')}><ArrowDownToLine size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="dashboard-side-stack">
              <article className="dashboard-account-card">
                <div className="dashboard-section-heading"><div><span className="dashboard-section-kicker">AKUN</span><h2>Profil singkat</h2></div></div>
                <div className="dashboard-profile">
                  <span className="dashboard-avatar dashboard-avatar-large">SC</span>
                  <div><strong>Nama Pelanggan</strong><span>pelanggan@example.com</span></div>
                </div>
                <div className="dashboard-profile-meta"><span>ID Pelanggan</span><strong>SC-00042</strong></div>
                <div className="dashboard-profile-meta"><span>Mata uang</span><strong>IDR · Rupiah</strong></div>
                <button type="button" className="dashboard-profile-link" onClick={() => setNotice('Pengaturan profil akan tersedia setelah integrasi API.')}>Kelola profil <ArrowRight size={14} /></button>
              </article>
              <article className="dashboard-support-card" id="support">
                <span className="dashboard-support-icon"><LifeBuoy size={19} /></span>
                <div><strong>Perlu bantuan?</strong><p>Buat tiket dan tim kami akan segera membantu.</p></div>
                <button type="button" onClick={() => openPage('support')}>Hubungi tim <ArrowRight size={14} /></button>
              </article>
            </aside>
          </section>
            </>
          ) : renderMenuPage()}
          <footer className="dashboard-footer"><span>Ruang digital yang lebih personal.</span><span><FileText size={13} /> Privasi & keamanan adalah prioritas kami.</span></footer>
        </div>
        {periodConflict && (
          <div className="dashboard-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPeriodConflict(null) }}>
            <div className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="period-conflict-title">
              <h3 id="period-conflict-title">Ganti durasi produk?</h3>
              <p>
                <strong>{periodConflict.title}</strong> sudah ada di keranjang dengan durasi{' '}
                <strong>{periodLabels[periodConflict.existing_period] || periodConflict.existing_period}</strong>.
                Produk itu akan dihapus dan digantikan dengan durasi{' '}
                <strong>{periodLabels[periodConflict.new_period] || periodConflict.new_period}</strong>.
              </p>
              <div className="dashboard-modal-actions">
                <button className="dashboard-outline-action" type="button" disabled={isCartBusy} onClick={() => setPeriodConflict(null)}>Batal</button>
                <button className="dashboard-primary-action" type="button" disabled={isCartBusy} onClick={handleReplacePeriod}>{isCartBusy ? 'Mengganti...' : 'Ya, ganti durasi'}</button>
              </div>
            </div>
          </div>
        )}
        {ticketModalOpen && (
          <div className="dashboard-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTicketModalOpen(false) }}>
            <form
              className="dashboard-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ticket-modal-title"
              onKeyDown={(event) => { if (event.key === 'Escape') setTicketModalOpen(false) }}
              onSubmit={handleTicketCreate}
            >
              <div className="dashboard-modal-header">
                <h3 id="ticket-modal-title">Buat tiket baru</h3>
                <button type="button" onClick={() => setTicketModalOpen(false)} aria-label="Tutup"><X size={18} /></button>
              </div>
              <div className="dashboard-modal-body">
                <label className="dashboard-profile-field"><span>Helpdesk</span><select name="support_helpdesk_id" disabled={helpdeskState === 'loading'}>
                  {helpdeskState === 'loading' && <option>Memuat...</option>}
                  {helpdeskState === 'error' && <option value="">Helpdesk tidak dapat dimuat</option>}
                  {helpdesks.map((helpdesk) => <option key={helpdesk.value} value={helpdesk.value}>{helpdesk.label}</option>)}
                </select></label>
                <label className="dashboard-profile-field"><span>Subjek <b>*</b></span><input name="subject" type="text" required autoFocus /></label>
                <label className="dashboard-profile-field"><span>Pesan <b>*</b></span><textarea name="message" rows={6} required /></label>
              </div>
              <div className="dashboard-modal-footer">
                <button className="dashboard-primary-action" type="submit" disabled={isCreatingTicket || helpdeskState !== 'loaded'}>{isCreatingTicket ? 'Mengirim...' : 'Kirim'}</button>
              </div>
            </form>
          </div>
        )}
        {invoicePayModal && (
          <div
            className="dashboard-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => { if (event.target === event.currentTarget && !isPayingInvoice) { setInvoicePayModal(null); setBalancePayOpen(false); setInvoicePayMethod(''); setInvoicePayError('') } }}
          >
            <div className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-pay-modal-title" onKeyDown={(event) => { if (event.key === 'Escape' && !isPayingInvoice) { setInvoicePayModal(null); setBalancePayOpen(false); setInvoicePayMethod(''); setInvoicePayError('') } }}>
              <div className="dashboard-modal-header">
                <h3 id="invoice-pay-modal-title">Bayar tagihan {invoicePayModal.number || `#${invoicePayModal.id}`}</h3>
                <button type="button" onClick={() => { if (!isPayingInvoice) { setInvoicePayModal(null); setBalancePayOpen(false); setInvoicePayMethod(''); setInvoicePayError('') } }} aria-label="Tutup" disabled={isPayingInvoice}><X size={18} /></button>
              </div>
              <div className="dashboard-modal-body">
                <p className="dashboard-powered-by">
                  Total: <strong>{invoicePayModal.total === null || invoicePayModal.total === undefined ? '-' : formatFullPrice(invoicePayModal.total, invoicePayModal.currency || 'IDR')}</strong>
                  {invoicePayModal.due_at ? ` · Jatuh tempo ${formatInvoiceDate(invoicePayModal.due_at)}` : ''}
                </p>
                {paymentMethods.status === 'loading' && <p className="dashboard-powered-by">Memuat metode pembayaran...</p>}
                {paymentMethods.status === 'error' && <p className="dashboard-checkout-error" role="alert">{paymentMethods.error}</p>}
                {paymentMethods.status === 'ready' && (() => {
                  const methodId = (method) => `${method.payment_type}:${method.bank_code || ''}`
                  const vaMethods = paymentMethods.items.filter((method) => method.payment_type === 'va' && method.bank_code !== 'BJB' && method.bank_code !== 'SMBC' && method.bank_code !== 'DBS')
                  const qrisMethod = paymentMethods.items.find((method) => method.payment_type === 'qris')
                  return (
                    <>
                      {(vaMethods.length > 0 || qrisMethod) && (
                        <>
                          <p className="dashboard-payment-group">Virtual Account</p>
                          <div className="dashboard-bank-grid" role="radiogroup" aria-label="Virtual Account">
                            {vaMethods.map((method) => (
                              <button type="button" role="radio" aria-checked={invoicePayMethod === methodId(method)} aria-label={`Virtual Account ${method.display_name}`} title={method.display_name} className={`dashboard-bank-option${invoicePayMethod === methodId(method) ? ' is-active' : ''}`} key={methodId(method)} onClick={() => { setInvoicePayMethod(methodId(method)); setInvoicePayError('') }}>
                                {typeof method.logo_url === 'string' && method.logo_url.startsWith('https://')
                                  ? <img src={method.logo_url} alt="" loading="lazy" />
                                  : <span>{method.bank_code}</span>}
                              </button>
                            ))}
                            {qrisMethod && (
                              <button type="button" role="radio" aria-checked={invoicePayMethod === methodId(qrisMethod)} aria-label="QRIS Komerce" title="QRIS Komerce" className={`dashboard-bank-option dashboard-bank-qris${invoicePayMethod === methodId(qrisMethod) ? ' is-active' : ''}`} onClick={() => { setInvoicePayMethod(methodId(qrisMethod)); setInvoicePayError('') }}>
                                <img src={QRIS_LOGO_URL} alt="" loading="lazy" referrerPolicy="no-referrer" />
                                <span>Komerce</span>
                              </button>
                            )}
                            <button type="button" role="radio" aria-checked={invoicePayMethod === 'gopay:'} aria-label="QRIS GoPay" title="QRIS GoPay" className={`dashboard-bank-option dashboard-bank-qris${invoicePayMethod === 'gopay:' ? ' is-active' : ''}`} onClick={() => { setInvoicePayMethod('gopay:'); setInvoicePayError('') }}>
                              <img src={QRIS_LOGO_URL} alt="" loading="lazy" referrerPolicy="no-referrer" />
                              <span>GoPay</span>
                            </button>
                            <button type="button" className="dashboard-bank-option dashboard-bank-balance" aria-label="Bayar dengan saldo" title="Bayar dengan saldo" onClick={() => { setBalancePayPassword(''); setBalancePayError(''); setBalancePayOpen(true) }}>
                              <Wallet size={22} />
                              <span>Saldo</span>
                            </button>
                          </div>
                          <p className="dashboard-fee-note">* Biaya transaksi virtual account Rp 4.440,-</p>
                          <p className="dashboard-fee-note">* Biaya transaksi QRIS Komerce 0,7% + 0,29%.</p>
                          <p className="dashboard-fee-note">* QRIS GoPay tanpa biaya tambahan; nominal akhir mendapat kode unik.</p>
                        </>
                      )}
                    </>
                  )
                })()}
                {invoicePayError && <p className="dashboard-checkout-error" role="alert">{invoicePayError}</p>}
              </div>
              <div className="dashboard-modal-footer">
                <button className="dashboard-outline-action" type="button" disabled={isPayingInvoice} onClick={() => { setInvoicePayModal(null); setBalancePayOpen(false); setInvoicePayMethod(''); setInvoicePayError('') }}>Batal</button>
                <button className="dashboard-primary-action" type="button" disabled={isPayingInvoice || isBalancePayBusy || !invoicePayMethod || paymentMethods.status !== 'ready'} onClick={handlePayInvoice}>
                  {isPayingInvoice ? 'Memproses...' : <><CreditCard size={15} /> Bayar sekarang</>}
                </button>
              </div>
            </div>
          </div>
        )}
        {balancePayOpen && invoicePayModal && (
          <div
            className="dashboard-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => { if (event.target === event.currentTarget && !isBalancePayBusy) { setBalancePayOpen(false); setBalancePayError('') } }}
          >
            <div className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="balance-pay-modal-title" onKeyDown={(event) => { if (event.key === 'Escape' && !isBalancePayBusy) { setBalancePayOpen(false); setBalancePayError('') } }}>
              <div className="dashboard-modal-header">
                <h3 id="balance-pay-modal-title">Bayar dengan saldo</h3>
                <button type="button" onClick={() => { if (!isBalancePayBusy) { setBalancePayOpen(false); setBalancePayError('') } }} aria-label="Tutup" disabled={isBalancePayBusy}><X size={18} /></button>
              </div>
              <div className="dashboard-modal-body">
                <p className="dashboard-powered-by">
                  Tagihan {invoicePayModal.number || `#${invoicePayModal.id}`}: <strong style={{ fontSize: '1.35rem' }}>{invoicePayModal.total === null || invoicePayModal.total === undefined ? '-' : formatFullPrice(invoicePayModal.total, invoicePayModal.currency || 'IDR')}</strong>
                </p>
                <p className="dashboard-powered-by">
                  Saldo tersedia: <strong>{wallet.status === 'loaded' ? formatFullPrice(wallet.balance, wallet.currency) : 'Memuat…'}</strong>
                </p>
                <label className="dashboard-profile-field dashboard-profile-field-wide">
                  <span>Password akun <b>*</b></span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Konfirmasi password"
                    value={balancePayPassword}
                    onChange={(event) => { setBalancePayPassword(event.target.value); setBalancePayError('') }}
                  />
                </label>
                {balancePayError && <p className="dashboard-checkout-error" role="alert">{balancePayError}</p>}
              </div>
              <div className="dashboard-modal-footer">
                <button className="dashboard-outline-action" type="button" disabled={isBalancePayBusy} onClick={() => { setBalancePayOpen(false); setBalancePayError('') }}>Batal</button>
                <button className="dashboard-primary-action" type="button" disabled={isBalancePayBusy || !balancePayPassword || wallet.status !== 'loaded'} onClick={handlePayWithBalance}>
                  {isBalancePayBusy ? 'Memproses...' : <><Wallet size={15} /> Bayar dengan saldo</>}
                </button>
              </div>
            </div>
          </div>
        )}
        {checkoutBalanceOpen && (
          <div
            className="dashboard-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => { if (event.target === event.currentTarget && !isCheckoutBalanceBusy) { setCheckoutBalanceOpen(false); setCheckoutBalanceError('') } }}
          >
            <div className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-balance-modal-title" onKeyDown={(event) => { if (event.key === 'Escape' && !isCheckoutBalanceBusy) { setCheckoutBalanceOpen(false); setCheckoutBalanceError('') } }}>
              <div className="dashboard-modal-header">
                <h3 id="checkout-balance-modal-title">Bayar dengan saldo</h3>
                <button type="button" onClick={() => { if (!isCheckoutBalanceBusy) { setCheckoutBalanceOpen(false); setCheckoutBalanceError('') } }} aria-label="Tutup" disabled={isCheckoutBalanceBusy}><X size={18} /></button>
              </div>
              <div className="dashboard-modal-body">
                <p className="dashboard-powered-by">
                  Total pembayaran: <strong style={{ fontSize: '1.35rem' }}>{formatFullPrice(cart.total, cart.currency)}</strong>
                </p>
                <p className="dashboard-powered-by">
                  Saldo tersedia: <strong>{wallet.status === 'loaded' ? formatFullPrice(wallet.balance, wallet.currency) : 'Memuat…'}</strong>
                </p>
                <label className="dashboard-profile-field dashboard-profile-field-wide">
                  <span>Password akun <b>*</b></span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Konfirmasi password"
                    value={checkoutBalancePassword}
                    onChange={(event) => { setCheckoutBalancePassword(event.target.value); setCheckoutBalanceError('') }}
                  />
                </label>
                {checkoutBalanceError && <p className="dashboard-checkout-error" role="alert">{checkoutBalanceError}</p>}
              </div>
              <div className="dashboard-modal-footer">
                <button className="dashboard-outline-action" type="button" disabled={isCheckoutBalanceBusy} onClick={() => { setCheckoutBalanceOpen(false); setCheckoutBalanceError('') }}>Batal</button>
                <button className="dashboard-primary-action" type="button" disabled={isCheckoutBalanceBusy || !checkoutBalancePassword || wallet.status !== 'loaded' || cart.items.length === 0} onClick={handleCheckoutBalance}>
                  {isCheckoutBalanceBusy ? 'Memproses...' : <><Wallet size={15} /> Bayar dengan saldo</>}
                </button>
              </div>
            </div>
          </div>
        )}
        {topupOpen && (
          <div
            className="dashboard-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => { if (event.target === event.currentTarget && !isTopupBusy) { setTopupOpen(false); setTopupError('') } }}
          >
            <div className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="topup-modal-title" onKeyDown={(event) => { if (event.key === 'Escape' && !isTopupBusy) { setTopupOpen(false); setTopupError('') } }}>
              <div className="dashboard-modal-header">
                <h3 id="topup-modal-title">Tambah saldo</h3>
                <button type="button" onClick={() => { if (!isTopupBusy) { setTopupOpen(false); setTopupError('') } }} aria-label="Tutup" disabled={isTopupBusy}><X size={18} /></button>
              </div>
              <div className="dashboard-modal-body">
                <label className="dashboard-profile-field dashboard-profile-field-wide">
                  <span>Nominal <b>*</b></span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="contoh: 50000"
                    value={topupAmount}
                    onChange={(event) => { setTopupAmount(event.target.value.replace(/[^0-9]/g, '')); setTopupError('') }}
                    maxLength={12}
                  />
                  <small>Minimal Rp 10.000, maksimal Rp 100.000.000 per transaksi.</small>
                </label>
                {Number(topupAmount) > 0 && <p className="dashboard-powered-by">Total: <strong>{formatFullPrice(Number(topupAmount), 'IDR')}</strong></p>}
                {paymentMethods.status === 'loading' && <p className="dashboard-powered-by">Memuat metode pembayaran...</p>}
                {paymentMethods.status === 'error' && <p className="dashboard-checkout-error" role="alert">{paymentMethods.error}</p>}
                {paymentMethods.status === 'ready' && (() => {
                  const methodId = (method) => `${method.payment_type}:${method.bank_code || ''}`
                  const vaMethods = paymentMethods.items.filter((method) => method.payment_type === 'va' && method.bank_code !== 'BJB' && method.bank_code !== 'SMBC' && method.bank_code !== 'DBS')
                  const qrisMethod = paymentMethods.items.find((method) => method.payment_type === 'qris')
                  return (
                    <>
                      {(vaMethods.length > 0 || qrisMethod) && (
                        <>
                          <p className="dashboard-payment-group">Virtual Account</p>
                          <div className="dashboard-bank-grid" role="radiogroup" aria-label="Virtual Account">
                            {vaMethods.map((method) => (
                              <button type="button" role="radio" aria-checked={topupMethod === methodId(method)} aria-label={`Virtual Account ${method.display_name}`} title={method.display_name} className={`dashboard-bank-option${topupMethod === methodId(method) ? ' is-active' : ''}`} key={methodId(method)} onClick={() => { setTopupMethod(methodId(method)); setTopupError('') }}>
                                {typeof method.logo_url === 'string' && method.logo_url.startsWith('https://')
                                  ? <img src={method.logo_url} alt="" loading="lazy" />
                                  : <span>{method.bank_code}</span>}
                              </button>
                            ))}
                            {qrisMethod && (
                              <button type="button" role="radio" aria-checked={topupMethod === methodId(qrisMethod)} aria-label="QRIS Komerce" title="QRIS Komerce" className={`dashboard-bank-option dashboard-bank-qris${topupMethod === methodId(qrisMethod) ? ' is-active' : ''}`} onClick={() => { setTopupMethod(methodId(qrisMethod)); setTopupError('') }}>
                                <img src={QRIS_LOGO_URL} alt="" loading="lazy" referrerPolicy="no-referrer" />
                                <span>Komerce</span>
                              </button>
                            )}
                            <button type="button" role="radio" aria-checked={topupMethod === 'gopay:'} aria-label="QRIS GoPay" title="QRIS GoPay" className={`dashboard-bank-option dashboard-bank-qris${topupMethod === 'gopay:' ? ' is-active' : ''}`} onClick={() => { setTopupMethod('gopay:'); setTopupError('') }}>
                              <img src={QRIS_LOGO_URL} alt="" loading="lazy" referrerPolicy="no-referrer" />
                              <span>GoPay</span>
                            </button>
                          </div>
                          <p className="dashboard-fee-note">* Biaya transaksi virtual account Rp 4.440,-</p>
                          <p className="dashboard-fee-note">* Biaya transaksi QRIS Komerce 0,7% + 0,29%.</p>
                          <p className="dashboard-fee-note">* QRIS GoPay tanpa biaya tambahan; nominal akhir mendapat kode unik.</p>
                        </>
                      )}
                    </>
                  )
                })()}
                {topupError && <p className="dashboard-checkout-error" role="alert">{topupError}</p>}
              </div>
              <div className="dashboard-modal-footer">
                <button className="dashboard-outline-action" type="button" disabled={isTopupBusy} onClick={() => { setTopupOpen(false); setTopupError('') }}>Batal</button>
                <button className="dashboard-primary-action" type="button" disabled={isTopupBusy || !topupMethod || paymentMethods.status !== 'ready' || Number(topupAmount) < 10000} onClick={handleTopup}>
                  {isTopupBusy ? 'Memproses...' : <><CreditCard size={15} /> Lanjut bayar</>}
                </button>
              </div>
            </div>
          </div>
        )}
        {notice && (
          <div className="dashboard-toast" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="Tutup"><X size={15} /></button>
          </div>
        )}
      </section>
    </main>
  )
}

export default ClientDashboardPage
