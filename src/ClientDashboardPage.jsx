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
  Wallet,
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

const serviceOrders = [
  { id: '#3', product: 'Cloud Team', price: 'Rp990.000 / tahun', due: '-', status: 'Menunggu setup' },
  { id: '#2', product: 'Cloud Personal', price: 'Rp149.000 / bulan', due: '-', status: 'Menunggu setup' },
  { id: '#1', product: 'Cloud Personal', price: 'Rp149.000 / bulan', due: '27 Okt 2027', status: 'Aktif' },
]

const supportArticles = [
  { category: 'Akun & keamanan', title: 'Cara mengamankan akun Sangatta Cloud', readTime: '3 menit baca' },
  { category: 'Layanan', title: 'Mengelola dan memperpanjang layanan', readTime: '4 menit baca' },
  { category: 'Pembayaran', title: 'Metode pembayaran dan status tagihan', readTime: '2 menit baca' },
]

function ClientDashboardPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [activePage, setActivePage] = useState('dashboard')
  const [invoiceFilter, setInvoiceFilter] = useState('Menunggu')
  const [articleQuery, setArticleQuery] = useState('')

  const openPage = (page) => {
    setActivePage(page)
    setMenuOpen(false)
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const renderMenuPage = () => {
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
      return (
        <section className="dashboard-page-panel">
          <div className="dashboard-page-heading"><div><span className="dashboard-section-kicker">AKUN PELANGGAN</span><h2>Layanan</h2><p>Kelola layanan dan lihat jadwal perpanjanganmu.</p></div></div>
          <div className="dashboard-table-wrap dashboard-wide-table">
            <table>
              <thead><tr><th>ORDER</th><th>PRODUK / LAYANAN</th><th>HARGA</th><th>JATUH TEMPO</th><th>STATUS</th><th>AKSI</th></tr></thead>
              <tbody>{serviceOrders.map((service) => (
                <tr key={service.id}>
                  <td><button className="dashboard-text-action" type="button" onClick={() => setNotice(`Detail order ${service.id} akan tersedia setelah API FossBilling terhubung.`)}>{service.id}</button></td>
                  <td>{service.product}</td><td>{service.price}</td><td>{service.due}</td>
                  <td><span className={`dashboard-status ${service.status === 'Aktif' ? 'status-active' : 'status-pending'}`}><i />{service.status}</span></td>
                  <td><button className="dashboard-outline-action" type="button" onClick={() => setNotice(`Pengelolaan ${service.product} akan tersedia setelah API FossBilling terhubung.`)}>Kelola</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
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
