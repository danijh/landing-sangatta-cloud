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

const contactDetails = {
  email: '',
  whatsapp: '',
  address: '',
  officeHours: '',
}

const copy = {
  id: {
    brand: 'Sangatta Cloud',
    home: 'Beranda',
    plans: 'Paket',
    features: 'Fitur',
    language: 'Bahasa',
    back: 'Kembali ke beranda',
    updated: 'Informasi',
    footer: 'Ruang digital yang lebih tenang, untuk semua orang.',
    links: ['Tentang Kami', 'Hubungi Kami', 'Ketentuan Layanan', 'Kebijakan Privasi'],
    contactUnavailable: 'Belum tersedia',
    contactLabels: ['Email', 'WhatsApp', 'Alamat perusahaan', 'Jam operasional'],
    contactFormTitle: 'Buat tiket bantuan',
    contactFormBody:
      'Ceritakan kendala atau pertanyaanmu. Tim kami akan menindaklanjuti melalui email yang kamu cantumkan.',
    nameLabel: 'Nama',
    emailLabel: 'Email balasan',
    categoryLabel: 'Kategori',
    subjectLabel: 'Subjek',
    messageLabel: 'Pesan',
    namePlaceholder: 'Nama lengkap',
    emailPlaceholder: 'nama@email.com',
    subjectPlaceholder: 'Ringkasan kendala atau pertanyaan',
    messagePlaceholder: 'Jelaskan kebutuhanmu dengan detail. Jangan sertakan kata sandi atau kode verifikasi.',
    categories: ['Pilih kategori', 'Akun', 'Tagihan dan pembayaran', 'Masalah teknis', 'Lainnya'],
    submitTicket: 'Kirim permintaan',
    ticketPreviewNotice:
      'Formulir ini baru berupa tampilan placeholder. Belum terhubung ke FossBilling; jangan masukkan data sungguhan.',
    ticketNotConnected:
      'Tiket belum dibuat atau dikirim. Hubungkan formulir ini ke API FossBilling untuk mengaktifkan pengiriman.',
    privacyHint:
      'Informasi yang kamu kirim nantinya digunakan untuk menangani tiket dukungan. Jangan masukkan kata sandi, kode verifikasi, atau data pembayaran lengkap.',
    legalNotice:
      'Dokumen ini adalah draf umum untuk situs ini, bukan nasihat hukum. Sesuaikan dengan badan usaha, fitur yang benar-benar tersedia, proses pembayaran, dan hukum yang berlaku sebelum dipublikasikan.',
    pages: {
      about: {
        title: 'Tentang Sangatta Cloud',
        subtitle: 'Ruang digital yang lebih personal, dirancang untuk hal-hal yang penting.',
        sections: [
          {
            title: 'Ruang digital yang terasa lebih tenang',
            body: 'Sangatta Cloud hadir dengan gagasan sederhana: menyimpan dan mengelola file seharusnya terasa mudah, jelas, dan tetap berada dalam kendali penggunanya.',
          },
          {
            title: 'Apa yang kami bangun',
            body: 'Kami mengembangkan pengalaman cloud untuk membantu orang menyimpan, mengatur, menyinkronkan, dan berbagi file dari berbagai perangkat. Tujuannya adalah membuat kebutuhan digital sehari-hari terasa lebih praktis.',
          },
          {
            title: 'Privasi sebagai pertimbangan utama',
            body: 'Privasi bukan sekadar tambahan. Kami berupaya menjelaskan cara layanan bekerja, membatasi penggunaan data sesuai kebutuhan layanan, dan memberi pengguna kendali atas file serta informasi mereka.',
          },
          {
            title: 'Terus bertumbuh bersama pengguna',
            body: 'Sangatta Cloud terus dikembangkan. Ketersediaan fitur, paket, dan dukungan dapat berubah seiring layanan bertumbuh. Kami menyambut masukan yang membantu membuatnya lebih bermanfaat.',
          },
        ],
      },
      contact: {
        title: 'Hubungi Kami',
        subtitle: 'Butuh bantuan? Buat tiket atau hubungi kami melalui informasi berikut.',
      },
      terms: {
        title: 'Ketentuan Layanan',
        subtitle: 'Ketentuan dasar penggunaan Sangatta Cloud.',
        sections: [
          {
            title: '1. Ruang lingkup',
            body: 'Ketentuan ini mengatur akses dan penggunaan website serta layanan Sangatta Cloud. Dengan menggunakan layanan, kamu menyatakan telah membaca dan menyetujui ketentuan ini. Jika tidak setuju, hentikan penggunaan layanan.',
          },
          {
            title: '2. Akun dan keamanan',
            body: 'Kamu bertanggung jawab memberikan informasi pendaftaran yang akurat, menjaga kerahasiaan kredensial akun, dan memberi tahu kami jika mengetahui akses yang tidak sah. Aktivitas yang terjadi melalui akunmu menjadi tanggung jawabmu sejauh diizinkan oleh hukum.',
          },
          {
            title: '3. Penggunaan yang diperbolehkan',
            body: 'Gunakan layanan sesuai hukum dan jangan menggunakannya untuk melanggar hak orang lain, menyebarkan malware, mengganggu sistem, mencoba memperoleh akses tanpa izin, atau menyimpan maupun membagikan konten yang dilarang oleh hukum.',
          },
          {
            title: '4. File dan berbagi',
            body: 'Kamu tetap memiliki hak atas konten yang kamu unggah. Kamu memberi izin terbatas kepada operator layanan untuk menyimpan, memproses, dan mengirimkan konten sejauh diperlukan untuk menyediakan fitur yang kamu gunakan. Kamu bertanggung jawab memastikan bahwa kamu berhak mengunggah dan membagikan konten tersebut.',
          },
          {
            title: '5. Paket, pembayaran, dan pembatalan',
            body: 'Fitur, batas penyimpanan, harga, periode tagihan, metode pembayaran, dan aturan pembatalan mengikuti informasi yang ditampilkan saat pemesanan. Ketentuan pembayaran dan pengembalian dana perlu disesuaikan dengan kebijakan operator serta hukum yang berlaku sebelum layanan berbayar diluncurkan.',
          },
          {
            title: '6. Ketersediaan layanan',
            body: 'Kami berupaya menjaga layanan tetap tersedia dan aman, tetapi tidak menjamin layanan bebas gangguan atau selalu tersedia. Pemeliharaan, masalah jaringan, keadaan di luar kendali, atau perubahan layanan dapat memengaruhi akses.',
          },
          {
            title: '7. Penangguhan dan perubahan',
            body: 'Akses dapat dibatasi jika diperlukan untuk melindungi pengguna, sistem, atau mematuhi hukum, termasuk jika terjadi pelanggaran ketentuan. Kami dapat memperbarui fitur atau ketentuan; perubahan penting akan diumumkan melalui saluran yang wajar.',
          },
          {
            title: '8. Tanggung jawab dan hukum',
            body: 'Sejauh diizinkan hukum, layanan disediakan sebagaimana tersedia. Tidak ada bagian ketentuan ini yang menghapus hak konsumen atau tanggung jawab yang tidak dapat dikesampingkan berdasarkan hukum. Identitas operator, hukum yang berlaku, dan mekanisme penyelesaian sengketa harus dilengkapi sebelum publikasi.',
          },
        ],
      },
      privacy: {
        title: 'Kebijakan Privasi',
        subtitle: 'Penjelasan mengenai informasi yang dapat diproses saat menggunakan layanan.',
        sections: [
          {
            title: '1. Informasi yang dapat diproses',
            body: 'Bergantung pada fitur yang digunakan, layanan dapat memproses informasi akun dan kontak, informasi transaksi yang diperlukan untuk pembayaran, detail penggunaan dan perangkat untuk menjaga fungsi serta keamanan layanan, serta file yang kamu pilih untuk disimpan atau dibagikan.',
          },
          {
            title: '2. Cara informasi digunakan',
            body: 'Informasi dapat digunakan untuk menyediakan dan mengelola akun, menjalankan fitur yang diminta, memproses pembayaran melalui penyedia terkait, menjawab permintaan dukungan, menjaga keamanan, memenuhi kewajiban hukum, dan memperbaiki layanan. Operator harus menyesuaikan daftar ini dengan praktik yang benar-benar diterapkan.',
          },
          {
            title: '3. File dan konten pengguna',
            body: 'File dan konten yang kamu simpan tetap milikmu. Operator hanya boleh memprosesnya sejauh diperlukan untuk menyediakan, mengamankan, dan mendukung fitur layanan atau sebagaimana diwajibkan hukum. Rincian teknis seperti enkripsi, lokasi penyimpanan, pencadangan, dan akses staf harus dijelaskan sesuai implementasi sebenarnya.',
          },
          {
            title: '4. Pembagian informasi',
            body: 'Informasi dapat dibagikan kepada penyedia infrastruktur, pembayaran, atau dukungan yang membantu menjalankan layanan; kepada pihak yang kamu pilih saat menggunakan fitur berbagi; atau jika diwajibkan oleh hukum. Operator perlu mencantumkan kategori penerima dan perlindungan yang berlaku secara akurat.',
          },
          {
            title: '5. Penyimpanan dan keamanan',
            body: 'Informasi disimpan selama diperlukan untuk tujuan layanan, kewajiban hukum, penyelesaian sengketa, atau penegakan perjanjian. Kami menerapkan langkah perlindungan yang sesuai, tetapi tidak ada sistem yang dapat dijamin sepenuhnya bebas risiko. Aturan retensi dan penghapusan perlu disesuaikan dengan sistem yang digunakan.',
          },
          {
            title: '6. Pilihan dan hak pengguna',
            body: 'Kamu dapat meminta akses, koreksi, penghapusan, atau menggunakan hak lain yang tersedia berdasarkan hukum perlindungan data yang berlaku. Permintaan dapat memerlukan verifikasi identitas dan tunduk pada kewajiban hukum. Cantumkan cara mengajukan permintaan melalui kontak resmi layanan.',
          },
          {
            title: '7. Cookie dan perubahan kebijakan',
            body: 'Website dapat menggunakan penyimpanan browser atau teknologi serupa yang diperlukan untuk menjalankan fitur. Jika analitik atau cookie opsional ditambahkan, tujuan dan pilihan pengguna harus dijelaskan di sini. Kebijakan ini dapat diperbarui; perubahan penting akan disampaikan melalui website atau saluran lain yang sesuai.',
          },
          {
            title: '8. Operator dan kontak privasi',
            body: 'Sebelum kebijakan ini dipublikasikan, lengkapi nama badan atau pihak yang bertindak sebagai pengendali data, alamat atau domisili yang relevan, alamat kontak privasi, serta informasi lain yang diwajibkan hukum.',
          },
        ],
      },
    },
  },
  en: {
    brand: 'Sangatta Cloud',
    home: 'Home',
    plans: 'Plans',
    features: 'Features',
    language: 'Language',
    back: 'Back to home',
    updated: 'Information',
    footer: 'A calmer digital space, made for everyone.',
    links: ['About', 'Contact Us', 'Terms of Service', 'Privacy Policy'],
    contactUnavailable: 'Not available yet',
    contactLabels: ['Email', 'WhatsApp', 'Company address', 'Office hours'],
    contactFormTitle: 'Create a support ticket',
    contactFormBody:
      'Tell us about your issue or question. Our team will follow up using the email address you provide.',
    nameLabel: 'Name',
    emailLabel: 'Reply email',
    categoryLabel: 'Category',
    subjectLabel: 'Subject',
    messageLabel: 'Message',
    namePlaceholder: 'Full name',
    emailPlaceholder: 'name@email.com',
    subjectPlaceholder: 'Brief summary of your issue or question',
    messagePlaceholder: 'Describe what you need. Do not include passwords or verification codes.',
    categories: ['Select a category', 'Account', 'Billing and payments', 'Technical issue', 'Other'],
    submitTicket: 'Send request',
    ticketPreviewNotice:
      'This form is a UI placeholder only. It is not connected to FossBilling; do not enter real information.',
    ticketNotConnected:
      'No ticket has been created or sent. Connect this form to the FossBilling API to enable submissions.',
    privacyHint:
      'Information you submit will be used to handle your support ticket. Do not include passwords, verification codes, or full payment details.',
    legalNotice:
      'This is a general draft for this website, not legal advice. Tailor it to the operating entity, actual features, payment process, and applicable law before publication.',
    pages: {
      about: {
        title: 'About Sangatta Cloud',
        subtitle: 'A more personal digital space, designed for the things that matter.',
        sections: [
          {
            title: 'A calmer digital space',
            body: 'Sangatta Cloud starts with a simple idea: storing and managing files should feel straightforward, clear, and remain under the user’s control.',
          },
          {
            title: 'What we are building',
            body: 'We are building a cloud experience to help people store, organise, sync, and share files across devices, making everyday digital tasks more convenient.',
          },
          {
            title: 'Privacy as a core consideration',
            body: 'Privacy is not an add-on. We aim to explain how the service works, limit data use to service needs, and give users control over their files and information.',
          },
          {
            title: 'Growing with our users',
            body: 'Sangatta Cloud is evolving. Features, plans, and support may change as the service grows. We welcome feedback that helps make it more useful.',
          },
        ],
      },
      contact: {
        title: 'Contact Us',
        subtitle: 'Have a question or suggestion? We would like to hear from you.',
        sections: [
          {
            title: 'Customer support',
            body: 'For help with an account, plan, or using the service, contact our support team using the official email address below.',
          },
          {
            title: 'General questions and feedback',
            body: 'Include enough context for us to understand your question. Do not send passwords, verification codes, or full payment details by email.',
          },
          {
            title: 'Partnerships',
            body: 'For partnership enquiries or other matters, use the same contact address and include the topic in your subject line.',
          },
        ],
      },
      terms: {
        title: 'Terms of Service',
        subtitle: 'Basic terms for using Sangatta Cloud.',
        sections: [
          {
            title: '1. Scope',
            body: 'These terms govern access to and use of the Sangatta Cloud website and services. By using the service, you confirm that you have read and agree to these terms. If you disagree, stop using the service.',
          },
          {
            title: '2. Accounts and security',
            body: 'You are responsible for providing accurate registration information, keeping your credentials confidential, and notifying us if you become aware of unauthorised access. You are responsible for activity through your account to the extent permitted by law.',
          },
          {
            title: '3. Acceptable use',
            body: 'Use the service lawfully. Do not use it to violate others’ rights, distribute malware, disrupt systems, attempt unauthorised access, or store or share content prohibited by law.',
          },
          {
            title: '4. Files and sharing',
            body: 'You retain your rights to content you upload. You grant the service operator a limited permission to store, process, and transmit content as needed to provide the features you use. You are responsible for having the rights to upload and share that content.',
          },
          {
            title: '5. Plans, payments, and cancellation',
            body: 'Features, storage limits, prices, billing periods, payment methods, and cancellation rules are governed by the information shown at checkout. Payment and refund terms must be tailored to the operator’s actual policies and applicable law before paid services launch.',
          },
          {
            title: '6. Service availability',
            body: 'We aim to keep the service available and secure but do not guarantee uninterrupted or continuous availability. Maintenance, network issues, events beyond our control, or service changes may affect access.',
          },
          {
            title: '7. Suspension and changes',
            body: 'Access may be restricted when necessary to protect users or systems, or to comply with law, including in response to a breach of these terms. We may update features or terms and will communicate material changes through reasonable channels.',
          },
          {
            title: '8. Liability and governing law',
            body: 'To the extent permitted by law, the service is provided as available. Nothing in these terms removes consumer rights or liabilities that cannot be excluded by law. The operator’s identity, governing law, and dispute process must be completed before publication.',
          },
        ],
      },
      privacy: {
        title: 'Privacy Policy',
        subtitle: 'How information may be processed when you use the service.',
        sections: [
          {
            title: '1. Information that may be processed',
            body: 'Depending on the features you use, the service may process account and contact information, transaction details needed for payment, usage and device details to maintain service functionality and security, and files you choose to store or share.',
          },
          {
            title: '2. How information is used',
            body: 'Information may be used to provide and manage accounts, deliver requested features, process payments through relevant providers, respond to support requests, maintain security, meet legal obligations, and improve the service. The operator must tailor this list to actual practices.',
          },
          {
            title: '3. User files and content',
            body: 'Files and content you store remain yours. The operator should process them only as needed to provide, secure, and support service features or as required by law. Technical details such as encryption, storage location, backups, and staff access must reflect the actual implementation.',
          },
          {
            title: '4. Sharing information',
            body: 'Information may be shared with infrastructure, payment, or support providers that help operate the service; with people you choose through sharing features; or when required by law. The operator should accurately describe recipient categories and applicable safeguards.',
          },
          {
            title: '5. Retention and security',
            body: 'Information is kept as long as needed for service purposes, legal obligations, dispute resolution, or enforcement of agreements. We use appropriate safeguards, but no system can be guaranteed entirely risk-free. Retention and deletion rules must reflect the systems in use.',
          },
          {
            title: '6. Choices and user rights',
            body: 'You may request access, correction, deletion, or exercise other rights available under applicable data protection law. Requests may require identity verification and remain subject to legal obligations. Provide a way to submit requests through the service’s official contact.',
          },
          {
            title: '7. Cookies and policy changes',
            body: 'The website may use browser storage or similar technologies needed to operate features. If analytics or optional cookies are added, their purposes and user choices should be described here. This policy may be updated; material changes will be communicated through the website or another appropriate channel.',
          },
          {
            title: '8. Operator and privacy contact',
            body: 'Before publishing this policy, identify the legal entity or person acting as data controller, relevant address or domicile, privacy contact address, and any other details required by law.',
          },
        ],
      },
    },
  },
}

const pagePaths = ['/about', '/contact', '/terms', '/privacy']

function InfoPage({ page }) {
  const [language, setLanguage] = useState('id')
  const [ticketNotice, setTicketNotice] = useState(false)
  const t = copy[language]
  const pageContent = t.pages[page]
  const isLegalPage = page === 'terms' || page === 'privacy'
  const whatsappNumber = contactDetails.whatsapp.replace(/\D/g, '')
  const contactItems = [
    { icon: Mail, value: contactDetails.email, href: contactDetails.email ? `mailto:${contactDetails.email}` : '' },
    {
      icon: Phone,
      value: contactDetails.whatsapp,
      href: whatsappNumber ? `https://wa.me/${whatsappNumber}` : '',
    },
    { icon: MapPin, value: contactDetails.address },
    { icon: null, value: contactDetails.officeHours },
  ]

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
          <a className="brand-lockup info-brand" href="/" aria-label={`${t.brand} ${t.home}`}>
            <span className="brand-mark">
              <Cloud size={21} strokeWidth={2.2} />
            </span>
            <span className="text-[17px] font-bold tracking-[-0.04em]">
              Sangatta Cloud<span className="text-teal">.</span>
            </span>
          </a>
          <nav className="info-nav" aria-label={language === 'id' ? 'Navigasi utama' : 'Main navigation'}>
            <a href="/">{t.home}</a>
            <a href="/#paket">{t.plans}</a>
            <a href="/#fitur">{t.features}</a>
            <button
              className="info-language"
              type="button"
              onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
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
            <a className="info-back" href="/">
              <ArrowLeft size={15} />
              {t.back}
            </a>
            <p className="info-eyebrow">SANGATTA CLOUD</p>
            <h1>{pageContent.title}</h1>
            <p className="info-subtitle">{pageContent.subtitle}</p>
          </div>
        </section>

        <section className="info-content site-container">
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
                    ? 'Email, WhatsApp, alamat perusahaan, dan jam operasional dapat diatur di src/InfoPage.jsx.'
                    : 'Email, WhatsApp, company address, and office hours can be configured in src/InfoPage.jsx.'}
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
            <a className="brand-lockup info-brand" href="/">
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
              <a href={pagePaths[index]} key={label}>{label}</a>
            ))}
          </nav>
          <span className="info-copyright">© 2026 Sangatta Cloud</span>
        </div>
      </footer>
    </div>
  )
}

export default InfoPage
