import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  ChevronDown,
  CircleHelp,
  Cloud,
  CreditCard,
  FileText,
  Gauge,
  HardDrive,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  PackagePlus,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useState } from 'react'

const services = [
  { name: 'Cloud Personal', detail: 'Penyimpanan privat', used: '24 GB', total: '100 GB', progress: 24, next: '26 Nov 2026' },
  { name: 'Cloud Team', detail: 'Ruang kerja bersama', used: '68 GB', total: '250 GB', progress: 27, next: '12 Des 2026' },
]

const invoices = [
  { id: 'INV-2026-018', date: '18 Okt 2026', due: '28 Okt 2026', amount: 'Rp149.000', status: 'Menunggu' },
  { id: 'INV-2026-012', date: '18 Sep 2026', due: '28 Sep 2026', amount: 'Rp149.000', status: 'Lunas' },
  { id: 'INV-2026-006', date: '18 Agu 2026', due: '28 Agu 2026', amount: 'Rp149.000', status: 'Lunas' },
]

function ClientDashboardPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const menuItems = [
    { label: 'Ringkasan', href: '#dashboard', icon: LayoutDashboard },
    { label: 'Layanan', href: '#services', icon: Cloud },
    { label: 'Tagihan', href: '#invoices', icon: FileText },
    { label: 'Dukungan', href: '#support', icon: LifeBuoy },
  ]

  return (
    <main className="client-dashboard">
      <aside className={`dashboard-sidebar ${menuOpen ? 'dashboard-sidebar-open' : ''}`}>
        <a className="dashboard-brand" href="/">
          <span className="dashboard-brand-mark"><Cloud size={22} /></span>
          <span>Sangatta <b>Cloud</b><i>.</i></span>
        </a>
        <p className="dashboard-nav-label">MENU UTAMA</p>
        <nav className="dashboard-nav">
          {menuItems.map(({ label, href, icon: Icon }, index) => (
            <a
              className={`dashboard-nav-link ${index === 0 ? 'dashboard-nav-active' : ''}`}
              href={href}
              key={label}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Tagihan' && <span className="dashboard-nav-count">1</span>}
            </a>
          ))}
        </nav>
        <div className="dashboard-sidebar-bottom">
          <div className="dashboard-help-card">
            <span className="dashboard-help-icon"><CircleHelp size={19} /></span>
            <strong>Butuh bantuan?</strong>
            <span>Tim kami siap membantu.</span>
            <a href="#support">Hubungi dukungan <ArrowRight size={13} /></a>
          </div>
          <a className="dashboard-nav-link" href="/"><Settings2 size={18} /><span>Beranda website</span></a>
          <a className="dashboard-nav-link dashboard-logout" href="/login"><LogOut size={18} /><span>Keluar</span></a>
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
          <button className="dashboard-account" type="button" onClick={() => setNotice('Menu akun akan aktif setelah data profil terhubung.')}>
            <span className="dashboard-avatar">SC</span>
            <span className="dashboard-account-copy"><strong>Nama Pelanggan</strong><small>Akun pelanggan</small></span>
            <ChevronDown size={15} />
          </button>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-preview-alert" role="note">
            <span><ShieldCheck size={17} /></span>
            <p><strong>Pratinjau dashboard</strong> — data di halaman ini hanya contoh dan belum diambil dari FossBilling.</p>
          </div>

          <section className="dashboard-welcome">
            <div>
              <span className="dashboard-eyebrow"><Gauge size={14} /> AREA PELANGGAN</span>
              <h1>Selamat datang kembali<span>.</span></h1>
              <p>Ringkasan layanan dan tagihanmu ada di sini.</p>
            </div>
            <button className="dashboard-primary-action" type="button" onClick={() => setNotice('Pemesanan layanan akan aktif setelah API FossBilling dihubungkan.')}>
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
              <a href="#services">Lihat semua <ArrowRight size={15} /></a>
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
                <a href="#invoices">Semua tagihan <ArrowRight size={15} /></a>
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
                <button type="button" onClick={() => setNotice('Dukungan pelanggan akan aktif setelah API FossBilling dihubungkan.')}>Hubungi tim <ArrowRight size={14} /></button>
              </article>
            </aside>
          </section>
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
