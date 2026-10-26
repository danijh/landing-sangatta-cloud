import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

function GoogleMark() {
  return <span className="google-mark" aria-hidden="true">G</span>
}

function AuthPage({ mode = 'login' }) {
  const isSignup = mode === 'signup'
  const [showPassword, setShowPassword] = useState(false)
  const [notice, setNotice] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    if (isSignup && formData.get('password') !== formData.get('password_confirm')) {
      setNotice('Konfirmasi kata sandi belum sama.')
      return
    }
    setNotice('Form ini belum terhubung ke FossBilling. Data belum dikirim.')
  }

  const handleGoogle = () => {
    setNotice('Google OAuth belum dikonfigurasi. Tidak ada data yang dikirim.')
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
                <span>Alamat email</span>
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

              {isSignup && (
                <label className="auth-field">
                  <span>Zona waktu</span>
                  <select name="timezone" defaultValue="Asia/Makassar">
                    <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                    <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                    <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                  </select>
                  <small>Digunakan untuk menampilkan tanggal dan waktu lokal.</small>
                </label>
              )}

              <label className="auth-field">
                <span>{isSignup ? 'Kata sandi' : 'Kata sandi'}</span>
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
                  <span>Konfirmasi kata sandi</span>
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

              <button className="auth-primary-button" type="submit">
                {isSignup ? 'Buat akun' : 'Masuk'}
                <ArrowRight size={17} />
              </button>
            </form>

            <div className="auth-divider"><span>atau lanjutkan dengan</span></div>
            <button className="auth-google-button" type="button" onClick={handleGoogle}>
              <GoogleMark />
              {isSignup ? 'Daftar dengan Google' : 'Lanjutkan dengan Google'}
            </button>

            {notice && <p className="auth-notice" role="status">{notice}</p>}

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
