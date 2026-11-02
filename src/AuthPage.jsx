import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Eye,
  EyeOff,
  LockKeyhole,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

function GoogleMark() {
  return <span className="google-mark" aria-hidden="true">G</span>
}

function friendlyAuthError(message) {
  const normalized = message.trim().toLowerCase()

  if (/email.*(already|exist|registered|taken)|(already|exist|registered|taken).*email/.test(normalized)) {
    return 'Email ini sudah terdaftar. Coba masuk atau gunakan alamat email lain.'
  }
  if (/please check your login details|check.*(login details|credentials)/.test(normalized)) {
    return 'Email atau kata sandi tidak sesuai. Periksa kembali lalu coba lagi.'
  }
  if (/invalid.*(email|password)|(email|password).*(invalid|incorrect|wrong)|credentials/.test(normalized)) {
    return 'Email atau kata sandi tidak sesuai. Periksa kembali lalu coba lagi.'
  }
  if (/csrf|session expired|sesi kedaluwarsa/.test(normalized)) {
    return 'Sesi formulir sudah kedaluwarsa. Muat ulang halaman lalu coba lagi.'
  }
  if (/password.*(confirm|match)|confirm.*password/.test(normalized)) {
    return 'Konfirmasi kata sandi belum sesuai.'
  }
  if (/email/.test(normalized) && /(valid|format|required|empty)/.test(normalized)) {
    return 'Masukkan alamat email yang valid.'
  }
  if (/networkerror|failed to fetch|fetch failed/.test(normalized)) {
    return 'Tidak dapat terhubung ke layanan akun. Periksa koneksi internet lalu coba lagi.'
  }

  return message || 'Layanan akun sedang tidak tersedia. Coba lagi nanti.'
}

const wantsStorage = () => new URLSearchParams(window.location.search).get('next') === 'storage'

async function openStorageArea(csrfToken) {
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
  window.location.assign(result.url)
}

function AuthPage({ mode = 'login' }) {
  const isSignup = mode === 'signup'
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeType, setNoticeType] = useState('error')
  const [csrfToken, setCsrfToken] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    if (!isRedirecting) return undefined

    if (wantsStorage()) return undefined

    const timeout = window.setTimeout(() => window.location.assign('/dashboard'), 1400)
    return () => window.clearTimeout(timeout)
  }, [isRedirecting])

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/fossbilling-auth.php?action=status', { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok || typeof result.csrfToken !== 'string') {
          throw new Error(result.error || 'Sesi tidak dapat disiapkan. Muat ulang halaman.')
        }
        setCsrfToken(result.csrfToken)
        if (mode === 'login' && result.authenticated === true && wantsStorage()) {
          setIsRedirecting(true)
          await openStorageArea(result.csrfToken)
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setIsRedirecting(false)
          setNotice(error.message || 'Sesi tidak dapat disiapkan. Muat ulang halaman.')
        }
      })

    return () => controller.abort()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    if (isSignup && formData.get('password') !== formData.get('password_confirm')) {
      setNoticeType('error')
      setNotice('Konfirmasi kata sandi belum sama.')
      return
    }

    if (!csrfToken) {
      setNoticeType('error')
      setNotice('Sesi belum siap. Muat ulang halaman lalu coba lagi.')
      return
    }

    const payload = Object.fromEntries(formData.entries())
    delete payload.remember
    setIsSubmitting(true)
    setNotice('')
    try {
      const response = await fetch(`/api/fossbilling-auth.php?action=${isSignup ? 'create' : 'login'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok || result.result !== true || result.error !== null) {
        const errorMessage = typeof result.error === 'string'
          ? result.error
          : result.error?.message
        throw new Error(errorMessage || 'Permintaan tidak dapat diproses. Coba lagi.')
      }

      setIsRedirecting(true)
      if (!isSignup && wantsStorage()) {
        const status = await fetch('/api/fossbilling-auth.php?action=status', { credentials: 'same-origin' })
        const statusResult = await status.json()
        await openStorageArea(statusResult.csrfToken)
      }
    } catch (error) {
      setIsRedirecting(false)
      setNoticeType('error')
      setNotice(friendlyAuthError(error.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogle = () => {
    setNoticeType('error')
    setNotice('Google OAuth belum dikonfigurasi. Tidak ada data yang dikirim.')
  }

  if (isRedirecting) {
    return (
      <main className="auth-loading-screen" role="status" aria-live="polite">
        <div className="auth-loading-card">
          <span className="auth-loading-mark"><Cloud size={26} /></span>
          <span className="auth-loading-spinner"><LoaderCircle size={23} /></span>
          <span className="auth-card-kicker">{isSignup ? 'AKUN BERHASIL DIBUAT' : 'BERHASIL MASUK'}</span>
          <h1>{isSignup ? 'Selamat datang!' : 'Senang melihatmu kembali.'}</h1>
          <p>{wantsStorage() ? 'Membuka Storage Area...' : 'Menyiapkan dashboard pribadimu...'}</p>
          <div className="auth-loading-progress"><span /></div>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <div className="auth-atmosphere auth-atmosphere-one" />
      <div className="auth-atmosphere auth-atmosphere-two" />
      <a className="auth-back-home" href="/">
        <ArrowLeft size={16} />
        Kembali ke beranda
      </a>

      <div className="auth-layout">
        <section className="auth-story" aria-label="Tentang Sangatta Cloud">
          <a className="auth-brand" href="/">
            <span className="auth-brand-mark"><Cloud size={23} strokeWidth={2.2} /></span>
            <span>Sangatta <b>Cloud</b><i>.</i></span>
          </a>

          <div className="auth-story-copy">
            <span className="auth-eyebrow"><Sparkles size={14} /> CLOUD YANG LEBIH PERSONAL</span>
            <h1>{isSignup ? 'Mulai ruang digital yang terasa milikmu.' : 'Selamat datang kembali di cloud-mu.'}</h1>
            <p>
              Simpan, bagikan, dan kelola semuanya di satu tempat yang dirancang
              untuk membuat aktivitas digital terasa lebih tenang.
            </p>
          </div>

          <div className="auth-art" aria-hidden="true">
            <div className="auth-art-orbit auth-art-orbit-one" />
            <div className="auth-art-orbit auth-art-orbit-two" />
            <div className="auth-server auth-server-back"><span /><span /><span /></div>
            <div className="auth-server auth-server-front"><span /><span /><span /></div>
            <div className="auth-art-shield"><ShieldCheck size={39} strokeWidth={1.5} /></div>
            <div className="auth-art-lock"><LockKeyhole size={17} /></div>
            <div className="auth-art-glint auth-art-glint-one">✳</div>
            <div className="auth-art-glint auth-art-glint-two">✦</div>
          </div>

          <div className="auth-trust">
            <span className="auth-trust-icon"><Check size={14} /></span>
            <span>Privasi sejak awal, tanpa iklan dan pelacakan.</span>
          </div>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-card-heading">
              <span className="auth-mobile-mark"><Cloud size={20} /></span>
              <span className="auth-card-kicker">{isSignup ? 'BUAT AKUN' : 'AKUN SANGATTA CLOUD'}</span>
              <h2>{isSignup ? 'Buat akun baru' : 'Masuk ke akunmu'}</h2>
              <p>
                {isSignup
                  ? 'Satu langkah lagi menuju ruang digital milikmu.'
                  : 'Masuk untuk melanjutkan ke ruang digitalmu.'}
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {isSignup && (
                <div className="auth-name-fields">
                  <label className="auth-field">
                    <span>Nama depan <b>*</b></span>
                    <input autoComplete="given-name" name="first_name" placeholder="Nama depan" required />
                  </label>
                  <label className="auth-field">
                    <span>Nama belakang</span>
                    <input autoComplete="family-name" name="last_name" placeholder="Nama belakang" />
                  </label>
                </div>
              )}

              <label className="auth-field">
                <span>Alamat email <b>*</b></span>
                <span className="auth-input-wrap">
                  <Mail size={17} />
                  <input
                    autoComplete="email"
                    name="email"
                    type="email"
                    placeholder="nama@email.com"
                    required
                  />
                </span>
              </label>

              <label className="auth-field">
                <span>Kata sandi <b>*</b></span>
                <span className="auth-input-wrap">
                  <LockKeyhole size={17} />
                  <input
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    minLength={isSignup ? 8 : undefined}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isSignup ? 'Minimal 8 karakter' : 'Masukkan kata sandi'}
                    required
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>

              {isSignup ? (
                <label className="auth-field">
                  <span>Konfirmasi kata sandi <b>*</b></span>
                  <span className="auth-input-wrap">
                    <LockKeyhole size={17} />
                    <input
                      autoComplete="new-password"
                      minLength={8}
                      name="password_confirm"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Ulangi kata sandi"
                      required
                    />
                  </span>
                </label>
              ) : (
                <div className="auth-form-meta">
                  <label className="auth-checkbox"><input type="checkbox" name="remember" /> Ingat saya</label>
                  <a href="#forgot-password" onClick={(event) => {
                    event.preventDefault()
                    setNotice('Pemulihan kata sandi belum tersedia karena API belum dihubungkan.')
                  }}>Lupa kata sandi?</a>
                </div>
              )}

              <button className="auth-primary-button" type="submit" disabled={!csrfToken || isSubmitting}>
                {isSubmitting ? 'Memproses...' : isSignup ? 'Buat akun' : 'Masuk'}
                {!isSubmitting && <ArrowRight size={17} />}
              </button>
            </form>

            <div className="auth-divider"><span>atau lanjutkan dengan</span></div>
            <button className="auth-google-button" type="button" onClick={handleGoogle}>
              <GoogleMark />
              {isSignup ? 'Daftar dengan Google' : 'Lanjutkan dengan Google'}
            </button>

            {notice && (
              <p className={`auth-notice ${noticeType === 'success' ? 'auth-notice-success' : ''}`} role="status">
                {notice}
              </p>
            )}

            <p className="auth-switch">
              {isSignup ? 'Sudah punya akun?' : 'Belum punya akun?'}
              {' '}
              <a href={isSignup ? '/login' : '/signup'}>
                {isSignup ? 'Masuk' : 'Buat akun'}
              </a>
            </p>
            <p className="auth-legal">
              Dengan melanjutkan, kamu menyetujui <a href="/terms">Ketentuan Layanan</a>
              {' '}dan <a href="/privacy">Kebijakan Privasi</a>.
            </p>
          </div>
          <p className="auth-footer-note">SANGATTA CLOUD <span>·</span> RUANG DIGITAL MILIKMU</p>
        </section>
      </div>
    </main>
  )
}

export default AuthPage
