import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cloud,
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
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

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

function formatServicePeriod(period) {
  const unit = typeof period === 'string' ? period.match(/[YMW]$/i)?.[0].toUpperCase() : null
  const units = { Y: 'tahun', M: 'bulan', W: 'pekan' }
  return unit && units[unit] ? `/${units[unit]}` : ''
}

function ClientDashboardPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [activePage, setActivePage] = useState('dashboard')
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
    if (authState !== 'authenticated' || activePage !== 'services') return undefined

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

  const openPage = (page) => {
    setActivePage(page)
    setMenuOpen(false)
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  const renderMenuPage = () => {
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
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading dashboard-page-heading-action">
            <div><span className="dashboard-section-kicker">BANTUAN PELANGGAN</span><h2>Tiket dukungan</h2><p>Ada pertanyaan? Tim kami siap membantu.</p></div>
            <button className="dashboard-primary-action" type="button" onClick={() => setNotice('Pembuatan tiket dukungan akan tersedia setelah API FossBilling terhubung.')}><LifeBuoy size={16} /> Tiket baru</button>
          </div>
          <div className="dashboard-empty-state"><span><LifeBuoy size={22} /></span><strong>Belum ada tiket dukungan</strong><p>Tiket yang kamu buat akan muncul di halaman ini.</p></div>
        </section>
      )
    }

    if (activePage === 'services') {
      const pageCount = Math.ceil(serviceOrders.length / servicesPerPage)
      const visibleOrders = serviceOrders.slice((servicePage - 1) * servicesPerPage, servicePage * servicesPerPage)
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
                    const status = service.status.toLowerCase()
                    const statusLabels = {
                      active: 'Aktif',
                      canceled: 'Dibatalkan',
                      cancelled: 'Dibatalkan',
                      expired: 'Kedaluwarsa',
                      pending: 'Menunggu',
                      pending_setup: 'Menunggu pembayaran',
                      suspended: 'Ditangguhkan',
                    }
                    const currency = typeof service.currency === 'string' && /^[A-Za-z]{3}$/.test(service.currency)
                      ? service.currency.toUpperCase()
                      : ''
                    const priceLabel = currency && service.price !== null && service.price !== undefined
                      ? `${currency} ${formatCompactPrice(service.price)}${formatServicePeriod(service.period)}`
                      : '-'
                    const dueDate = service.expires_at
                      ? new Date(service.expires_at.replace(' ', 'T'))
                      : null
                    const dueLabel = dueDate && !Number.isNaN(dueDate.getTime())
                      ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(dueDate)
                      : service.expires_at || '-'
                    const statusLabel = statusLabels[status]
                      || status.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

                    return (
                      <tr key={service.id}>
                        <td><button className="dashboard-text-action" type="button" onClick={() => setNotice(`Detail order #${service.id} akan tersedia setelah API FossBilling terhubung.`)}>#{service.id}</button></td>
                        <td>{service.title}</td><td>{priceLabel}</td><td>{dueLabel}</td>
                        <td><span className={`dashboard-status ${status === 'active' ? 'status-active' : 'status-pending'}`}><i />{statusLabel}</span></td>
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
      const filterStatuses = ['Menunggu', 'Lunas', 'Dikembalikan', 'Dibatalkan']
      const filteredInvoices = invoices.filter((invoice) => invoice.status === invoiceFilter)
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading"><div><span className="dashboard-section-kicker">PEMBAYARAN</span><h2>Tagihan</h2><p>Lihat status dan riwayat tagihan akunmu.</p></div></div>
          <div className="dashboard-filter-tabs" role="tablist" aria-label="Filter tagihan">
            {filterStatuses.map((status) => <button type="button" role="tab" aria-selected={invoiceFilter === status} className={invoiceFilter === status ? 'dashboard-filter-active' : ''} key={status} onClick={() => setInvoiceFilter(status)}>{status}</button>)}
          </div>
          <div className="dashboard-table-wrap dashboard-wide-table">
            <table>
              <thead><tr><th>NOMOR</th><th>TANGGAL TAGIHAN</th><th>JATUH TEMPO</th><th>TOTAL</th><th>STATUS</th><th>AKSI</th></tr></thead>
              <tbody>{filteredInvoices.length ? filteredInvoices.map((invoice) => (
                <tr key={invoice.id}><td><strong>{invoice.id}</strong></td><td>{invoice.date}</td><td>{invoice.due}</td><td className="invoice-amount">{invoice.amount}</td><td><span className={`dashboard-status ${invoice.status === 'Lunas' ? 'status-paid' : 'status-pending'}`}><i />{invoice.status}</span></td><td><button className="dashboard-outline-action" type="button" onClick={() => setNotice('Detail tagihan akan tersedia setelah API FossBilling terhubung.')}>Lihat</button></td></tr>
              )) : <tr><td className="dashboard-table-empty" colSpan="6">Belum ada tagihan dengan status ini.</td></tr>}</tbody>
            </table>
          </div>
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
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading"><div><span className="dashboard-section-kicker">PEMBAYARAN</span><h2>Dompet</h2><p>Saldo akun dan aktivitas transaksi.</p></div></div>
          <div className="dashboard-wallet-card"><span className="dashboard-stat-icon stat-icon-teal"><Wallet size={19} /></span><span>Saldo akun</span><strong>Rp250.000</strong><small>Saldo contoh · belum tersinkron dengan FossBilling</small><button className="dashboard-primary-action" type="button" onClick={() => setNotice('Penambahan saldo akan tersedia setelah API FossBilling terhubung.')}><CreditCard size={16} /> Tambah saldo</button></div>
          <div className="dashboard-section-heading dashboard-wallet-heading"><div><span className="dashboard-section-kicker">AKTIVITAS</span><h2>Transaksi terbaru</h2></div></div>
          <div className="dashboard-transaction-row"><span className="dashboard-transaction-icon"><CreditCard size={17} /></span><span><strong>Pembayaran tagihan INV-2026-012</strong><small>18 Sep 2026</small></span><strong className="dashboard-transaction-amount">− Rp149.000</strong></div>
          <div className="dashboard-transaction-row"><span className="dashboard-transaction-icon"><Wallet size={17} /></span><span><strong>Pengisian saldo</strong><small>10 Sep 2026</small></span><strong className="dashboard-transaction-credit">+ Rp250.000</strong></div>
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
        <a className="dashboard-brand" href="/">
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
              {id === 'invoices' && <span className="dashboard-nav-count">1</span>}
            </button>
          ))}
        </nav>
        <div className="dashboard-sidebar-balance"><span>Saldo akun</span><strong>Rp250.000</strong></div>
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
          <button className="dashboard-icon-button" type="button" onClick={() => setNotice('Notifikasi akan tersedia setelah dashboard terhubung ke FossBilling.')} aria-label="Notifikasi">
            <Bell size={18} /><span />
          </button>
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
                <button type="button" role="menuitem" className="dashboard-account-menu-logout" onClick={handleLogout} disabled={isLoggingOut}><LogOut size={15} /> {isLoggingOut ? 'Keluar...' : 'Logout'}</button>
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
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td><strong>{invoice.id}</strong><small>Jatuh tempo {invoice.due}</small></td>
                        <td>{invoice.date}</td>
                        <td className="invoice-amount">{invoice.amount}</td>
                        <td><span className={`dashboard-status ${invoice.status === 'Lunas' ? 'status-paid' : 'status-pending'}`}><i />{invoice.status}</span></td>
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
