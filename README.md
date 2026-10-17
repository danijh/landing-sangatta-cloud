# RuangAwan

Landing page responsif berbasis React, Vite, Tailwind CSS, dan endpoint PHP. Bahasa Indonesia dipakai sebagai default; tombol bahasa di navigasi mengubah halaman ke bahasa Inggris.

## Menjalankan secara lokal

Perlu Node.js, npm, dan PHP 8+.

```sh
npm install
```

Jalankan API PHP di terminal pertama:

```sh
npm run dev:api
```

Jalankan Vite di terminal kedua:

```sh
npm run dev
```

Buka URL lokal yang ditampilkan Vite. Vite meneruskan permintaan `/api/*` ke server PHP di `http://127.0.0.1:8001`.

Setelah mengubah file, simpan lalu refresh browser. Untuk memeriksa hasil build produksi:

```sh
npm run build
```

## Panduan mengubah website

| Yang ingin diubah | Lokasi |
| --- | --- |
| Teks website, navigasi, tombol, fitur, dan terjemahan | `src/App.jsx` |
| Paket, harga, deskripsi, dan fitur tiap paket | `public/api/pricing.php` |
| Warna, font, ukuran, jarak, dan tampilan responsif | `src/styles.css` |
| Warna dan konfigurasi tema Tailwind | `tailwind.config.js` |
| Judul awal, deskripsi SEO, warna browser | `index.html` |
| Gambar, logo, favicon, dan aset statis | `public/` |
| Halaman Tentang, Kontak, Ketentuan, dan Privasi | `src/InfoPage.jsx` |

### Mengubah teks dan bahasa

Di `src/App.jsx`, teks halaman tersimpan di objek `content`:

- `content.id` berisi teks Bahasa Indonesia.
- `content.en` berisi terjemahan Bahasa Inggris.

Ubah teks pada kedua bagian agar konten tetap tersedia saat pengunjung mengganti bahasa. Contohnya, judul utama ada di `heroTitle`, deskripsinya di `heroBody`, dan teks tombol di `explorePlans`. Teks pada bagian fitur ada di `features`, sedangkan teks bagian privasi ada di `promises`.

Beberapa teks pada ilustrasi/mockup hero ditulis langsung di JSX, tidak di objek `content`. Cari teks tersebut di `src/App.jsx` dan ubah versi Indonesia maupun Inggris yang menggunakan kondisi `language === 'id'`.

### Mengubah paket dan harga

Buka `public/api/pricing.php`. Setiap paket berada di dalam array `$plans`. Ubah nama, kapasitas (`storage`), jumlah pengguna (`users`), harga bulanan (`monthly_price`), harga tahunan (`annual_price`), deskripsi, dan daftar `features` sesuai kebutuhan.

Teks Bahasa Inggris untuk paket berada di `translations.en`. Pertahankan struktur data yang sudah ada agar kartu paket tetap dapat ditampilkan. `featured: true` menandai paket unggulan. Nilai `currency` menentukan mata uang yang ditampilkan, misalnya `IDR`.

File ini sekarang menggunakan data contoh (`"source": "placeholder"`). Untuk harga sungguhan, sambungkan endpoint ini ke FossBilling dari sisi server; jangan menaruh API key, password, atau kredensial di kode React yang dikirim ke browser.

### Mengganti logo

Belum ada file logo gambar di proyek ini. Logo saat ini terdiri dari ikon `Cloud` dari Lucide dan teks nama brand di dua tempat dalam `src/App.jsx`: bagian navigasi atas dan footer. Ikon kecil pada mockup aplikasi hero juga ditulis terpisah sebagai `sidebar-logo`.

Untuk menggunakan logo sendiri:

1. Simpan file logo, misalnya `logo.svg`, di `public/images/`. Buat folder `images` jika belum ada.
2. Di `src/App.jsx`, cari blok `<span className="brand-mark">` pada navigasi dan footer.
3. Ganti ikon di dalamnya dengan elemen gambar. Contoh:

   ```jsx
   <img
     src="/images/logo.svg"
     alt=""
     className="h-[34px] w-[34px] object-contain"
   />
   ```

4. Ganti teks `ruangawan` di dekat ikon jika nama brand juga berubah. Ulangi untuk logo di footer.

File di dalam `public/` dipanggil memakai alamat dari root website: `public/images/logo.svg` menjadi `/images/logo.svg`. Jika ingin ikon di mockup hero ikut berubah, cari `sidebar-logo` secara terpisah.

### Menambahkan atau mengganti gambar

Taruh gambar di dalam `public/`, misalnya `public/images/hero.webp`, lalu gunakan alamat `/images/hero.webp` di JSX. Contoh elemen gambar:

```jsx
<img
  src="/images/hero.webp"
  alt="Deskripsi singkat gambar"
  className="h-auto w-full rounded-xl object-cover"
/>
```

`alt` sebaiknya menjelaskan isi gambar untuk aksesibilitas. Gunakan ukuran gambar yang sesuai kebutuhan dan format terkompresi seperti WebP agar halaman lebih ringan.

Ilustrasi besar di bagian hero saat ini bukan file gambar; tampilannya disusun dari JSX di `src/App.jsx` dan CSS di `src/styles.css` (cari `.hero-art`). Untuk menggantinya dengan gambar, simpan gambar di `public/images/`, lalu ganti elemen visual hero tersebut dengan elemen `<img>` seperti contoh di atas.

### Mengubah warna, font, dan tampilan

Ubah aturan visual di `src/styles.css`. Contohnya, `.brand-mark` mengatur latar ikon brand, `.hero-section` mengatur latar hero, dan `.button` mengatur bentuk tombol. Cari nama class terkait dari `src/App.jsx`, lalu cari class yang sama di `src/styles.css`.

Warna tema Tailwind seperti `ink` dan `teal` juga terdaftar di `tailwind.config.js`. Beberapa komponen menggunakan kode warna langsung di JSX atau CSS, jadi jika mengganti warna brand secara menyeluruh, cari dan sesuaikan juga kode warna terkait di kedua file tersebut.

### Mengubah judul tab dan deskripsi Google

Ubah `<title>`, `description`, atau `theme-color` di `index.html`. Judul halaman juga diperbarui berdasarkan bahasa dari `src/App.jsx`, jadi sesuaikan nilai `title` pada `content.id` dan `content.en` bila mengubah nama/judul website.

### Mengubah tautan tombol dan footer

Tautan tombol ditulis sebagai atribut `href` di `src/App.jsx`. Tombol paket memakai URL contoh `/order?plan=...`. Ganti nilainya dengan URL tujuan yang benar saat halaman checkout tersedia.

### Halaman informasi

Halaman informasi tersedia di alamat `/about`, `/contact`, `/terms`, dan `/privacy`. Isi halaman serta terjemahan Indonesia/Inggris berada di `src/InfoPage.jsx`; tampilannya diatur melalui class `info-*` di `src/styles.css`.

Sebelum mempublikasikan:

- Isi `contactDetails` di bagian atas `src/InfoPage.jsx` dengan email dukungan, nomor WhatsApp format internasional (angka saja atau dengan tanda `+`), alamat perusahaan, dan jam operasional. Nilai yang kosong ditampilkan sebagai "Belum tersedia".
- Form tiket di `/contact` adalah placeholder antarmuka dan belum mengirim atau menyimpan data. Jangan minta pengunjung memasukkan data sungguhan sebelum dihubungkan ke API pembuatan tiket FossBilling. Implementasikan pengiriman di server, validasi input di server, dan perlindungan spam; jangan menaruh kredensial FossBilling di React/browser.
- Tinjau dan sesuaikan Ketentuan Layanan serta Kebijakan Privasi di file yang sama dengan badan usaha/operator, layanan, pemrosesan data, pembayaran, dan hukum yang benar-benar berlaku. Teks saat ini adalah draf umum, bukan nasihat hukum.
- Pastikan web server produksi mengarahkan permintaan halaman frontend seperti `/about` dan `/privacy` ke `index.html` (SPA fallback). Jangan mengalihkan endpoint `/api/*` PHP ke `index.html`; endpoint itu harus tetap dijalankan oleh PHP.

## Endpoint harga dan FossBilling

`public/api/pricing.php` saat ini mengembalikan paket dan harga contoh dengan `"source": "placeholder"`. Frontend mengharapkan respons JSON berbentuk:

```json
{
  "source": "fossbilling",
  "currency": "IDR",
  "plans": [
    {
      "id": "personal",
      "name": "Personal",
      "storage": "100 GB",
      "users": 1,
      "monthly_price": 29000,
      "annual_price": 290000,
      "description": "Deskripsi paket",
      "features": ["Fitur paket"],
      "translations": {
        "en": {
          "name": "Personal",
          "description": "A plan description",
          "features": ["Plan feature"]
        }
      },
      "featured": false
    }
  ]
}
```

Bangun aset frontend untuk deployment dengan `npm run build`. Hasil build berada di `dist/`, termasuk endpoint PHP dari folder `public/api`. Pastikan VPS menyediakan PHP untuk menjalankan endpoint tersebut.

## Menyimpan perubahan ke GitHub

Setelah perubahan selesai dan sudah diperiksa di browser, simpan perubahan dengan Git:

```sh
git add -A
git commit -m "Update website content"
git push
```

Jangan commit file rahasia seperti `.env`, password, atau API key. File `.env` dan hasil build `dist/` sudah dikecualikan lewat `.gitignore`.
