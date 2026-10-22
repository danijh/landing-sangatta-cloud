import { useEffect, useState } from 'react'
import { ArrowLeft, Check, LogOut, Save, ShieldCheck } from 'lucide-react'
import { contactDetails, copy } from './InfoPage.jsx'

const sections = [
  { id: 'about', label: 'Tentang' },
  { id: 'privacy', label: 'Privasi' },
  { id: 'terms', label: 'Ketentuan' },
  { id: 'contact', label: 'Kontak' },
]

const initialContent = () => ({
  contacts: { ...contactDetails },
  pages: Object.fromEntries(
    ['id', 'en'].map((language) => [
      language,
      Object.fromEntries(
        ['about', 'contact', 'terms', 'privacy'].map((page) => [
          page,
          JSON.parse(JSON.stringify(copy[language].pages[page])),
        ]),
      ),
    ]),
  ),
})

async function request(action, options = {}, csrfToken = '') {
  const response = await fetch(`/api/admin-content.php?action=${action}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...options.headers,
    },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)
  return result
}

function AdminPage() {
  const [csrfToken, setCsrfToken] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [content, setContent] = useState(initialContent)
  const [section, setSection] = useState('about')
  const [language, setLanguage] = useState('id')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    request('status')
      .then((result) => {
        setCsrfToken(result.csrfToken)
        setAuthenticated(result.authenticated)
        if (result.content) setContent(result.content)
      })
      .catch((requestError) => setError(requestError.message))
  }, [])

  const updatePage = (field, value) => {
    setContent((current) => ({
      ...current,
      pages: {
        ...current.pages,
        [language]: {
          ...current.pages[language],
          [section]: {
            ...current.pages[language][section],
            [field]: value,
          },
        },
      },
    }))
  }

  const updateParagraph = (index, field, value) => {
    const page = content.pages[language][section]
    updatePage(
      'sections',
      page.sections.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    )
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await request(
        'login',
        {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        },
        csrfToken,
      )
      setCsrfToken(result.csrfToken)
      setAuthenticated(true)
      setContent(result.content || initialContent())
      setPassword('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(
        'save',
        { method: 'POST', body: JSON.stringify(content) },
        csrfToken,
      )
      setNotice(language === 'id' ? 'Perubahan berhasil disimpan.' : 'Changes saved.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    setError('')
    try {
      const result = await request('logout', { method: 'POST', body: '{}' }, csrfToken)
      setCsrfToken(result.csrfToken)
      setAuthenticated(false)
      setContent(initialContent())
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const page = content.pages[language][section]
  const updateContact = (field, value) => {
    setContent((current) => ({
      ...current,
      contacts: { ...current.contacts, [field]: value },
    }))
  }

  return (
    <main className="admin-shell">
      <div className="admin-card">
        <a className="admin-back" href="/">
          <ArrowLeft size={16} />
          Kembali ke website
        </a>
        <div className="admin-heading">
          <span className="admin-icon"><ShieldCheck size={22} /></span>
          <div>
            <p className="admin-eyebrow">SANGATTA CLOUD</p>
            <h1>Panel Konten</h1>
          </div>
        </div>

        {error && <p className="admin-alert" role="alert">{error}</p>}

        {!authenticated ? (
          <form className="admin-form" onSubmit={handleLogin}>
            <p className="admin-description">
              Masuk untuk mengelola halaman Tentang, Privasi, Ketentuan, dan Kontak.
            </p>
            <label>
              Nama pengguna
              <input
                autoComplete="username"
                onChange={(event) => setUsername(event.target.value)}
                required
                value={username}
              />
            </label>
            <label>
              Kata sandi
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button className="admin-primary" disabled={busy || !csrfToken} type="submit">
              {busy ? 'Memproses…' : 'Masuk'}
            </button>
          </form>
        ) : (
          <form className="admin-form" onSubmit={handleSave}>
            <div className="admin-toolbar">
              <div className="admin-tabs" role="tablist" aria-label="Pilih konten">
                {sections.map((item) => (
                  <button
                    aria-selected={section === item.id}
                    className={section === item.id ? 'active' : ''}
                    key={item.id}
                    onClick={() => setSection(item.id)}
                    role="tab"
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <select
                aria-label="Bahasa konten"
                onChange={(event) => setLanguage(event.target.value)}
                value={language}
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>

            <label>
              Judul halaman
              <input
                onChange={(event) => updatePage('title', event.target.value)}
                required
                value={page.title}
              />
            </label>
            <label>
              Deskripsi singkat
              <textarea
                onChange={(event) => updatePage('subtitle', event.target.value)}
                required
                rows="2"
                value={page.subtitle}
              />
            </label>

            {section === 'contact' ? (
              <div className="admin-contact-fields">
                {[
                  ['email', 'Email'],
                  ['whatsapp', 'WhatsApp'],
                  ['address', 'Alamat perusahaan'],
                  ['officeHours', 'Jam operasional'],
                ].map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <input
                      onChange={(event) => updateContact(field, event.target.value)}
                      value={content.contacts[field]}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="admin-sections">
                {page.sections.map((item, index) => (
                  <fieldset className="admin-section" key={`${section}-${index}`}>
                    <legend>Bagian {index + 1}</legend>
                    <label>
                      Subjudul
                      <input
                        onChange={(event) => updateParagraph(index, 'title', event.target.value)}
                        required
                        value={item.title}
                      />
                    </label>
                    <label>
                      Isi
                      <textarea
                        onChange={(event) => updateParagraph(index, 'body', event.target.value)}
                        required
                        rows="4"
                        value={item.body}
                      />
                    </label>
                  </fieldset>
                ))}
              </div>
            )}

            <div className="admin-actions">
              {notice && <span className="admin-success" role="status"><Check size={15} />{notice}</span>}
              <button className="admin-secondary" onClick={handleLogout} type="button">
                <LogOut size={15} />
                Keluar
              </button>
              <button className="admin-primary" disabled={busy} type="submit">
                <Save size={16} />
                {busy ? 'Menyimpan…' : 'Simpan perubahan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}

export default AdminPage
