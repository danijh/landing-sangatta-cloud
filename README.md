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
| Halaman login dan pendaftaran pelanggan | `src/AuthPage.jsx` (`/login`, `/signup`) |
| Pratinjau dashboard pelanggan | `src/ClientDashboardPage.jsx` (`/dashboard`) |
| Konten awal halaman Tentang, Kontak, Ketentuan, dan Privasi | `src/InfoPage.jsx` |
| Konten halaman setelah diedit di panel admin | `/admin` (disimpan di `storage/site-content.json`) |

Halaman `/login`, `/signup`, dan `/dashboard` saat ini merupakan pratinjau UI.
Form login/pendaftaran dan tombol Google belum terhubung ke autentikasi; data
yang terlihat di dashboard adalah contoh, bukan data akun atau tagihan nyata.
API key FossBilling dan OAuth client secret harus tetap disimpan di environment
server, bukan di frontend.

### Mengubah teks dan bahasa

Di `src/App.jsx`, teks halaman tersimpan di objek `content`:

- `content.id` berisi teks Bahasa Indonesia.
- `content.en` berisi terjemahan Bahasa Inggris.

Ubah teks pada kedua bagian agar konten tetap tersedia saat pengunjung mengganti bahasa. Contohnya, judul utama ada di `heroTitle`, deskripsinya di `heroBody`, dan teks tombol di `explorePlans`. Teks pada bagian fitur ada di `features`, sedangkan teks bagian privasi ada di `promises`.

Beberapa teks pada ilustrasi/mockup hero ditulis langsung di JSX, tidak di objek `content`. Cari teks tersebut di `src/App.jsx` dan ubah versi Indonesia maupun Inggris yang menggunakan kondisi `language === 'id'`.

### Mengubah paket dan harga

Nama, deskripsi, dan harga bulanan/tahunan berasal dari FossBilling. Cara
menambahkan fitur paket dan konfigurasi API dijelaskan di
[bagian endpoint harga dan FossBilling](#endpoint-harga-dan-fossbilling).

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

Konten Tentang, Ketentuan, Privasi, dan informasi kontak juga dapat diubah melalui panel `/admin`. Perubahan disimpan sebagai JSON di direktori `storage/` di luar document root, bukan di database atau browser. PHP harus memiliki izin menulis ke direktori tersebut; lakukan pencadangan file `storage/site-content.json` secara berkala.

Untuk pengembangan lokal, isi `storage/admin-credentials.php` dengan username dan hash password. File ini tidak masuk Git dan hanya dibaca ketika PHP berjalan melalui server pengembangan bawaan PHP (`npm run dev:api`); jangan salin file ini ke server produksi. Buat hash password menggunakan PHP, lalu tempel hasilnya ke nilai `password_hash` (jangan menaruh password asli di file atau command shell):

```sh
php -r 'echo password_hash(trim(fgets(STDIN)), PASSWORD_DEFAULT), PHP_EOL;'
```

Jalankan perintah tersebut dan masukkan password saat diminta. `ADMIN_USERNAME` dan `ADMIN_PASSWORD_HASH` dari environment, jika disetel, tetap menjadi sumber utama.

Di produksi, atur environment variable `ADMIN_USERNAME` dan `ADMIN_PASSWORD_HASH` melalui konfigurasi PHP-FPM pool/server. Buat hash password dengan `password_hash()` PHP dan jangan masukkan password atau hash ke kode frontend maupun repository. Sajikan panel melalui HTTPS. Cookie sesi admin menggunakan `HttpOnly` dan `SameSite=Strict`, dan ditandai `Secure` ketika PHP mendeteksi HTTPS. Pastikan file konten berada di luar document root; jika memakai `SITE_CONTENT_FILE`, arahkan ke file JSON di luar document root dan pastikan PHP dapat membuat serta menulis file tersebut.

Endpoint panel memeriksa sesi, token CSRF, membatasi percobaan login per alamat IP, memvalidasi ukuran/struktur konten, dan menyimpan perubahan secara atomik. Konten ditampilkan sebagai teks biasa (bukan HTML). Hapus akses PHP/web ke `/admin` atau batasi lewat konfigurasi server jika panel tidak lagi digunakan.

Sebelum mempublikasikan:

- Jika konten kontak belum pernah disimpan dari panel, nilai awalnya berada di `contactDetails` pada `src/InfoPage.jsx`. Nilai kosong ditampilkan sebagai "Belum tersedia".
- Form tiket di `/contact` adalah placeholder antarmuka dan belum mengirim atau menyimpan data. Jangan minta pengunjung memasukkan data sungguhan sebelum dihubungkan ke API pembuatan tiket FossBilling. Implementasikan pengiriman di server, validasi input di server, dan perlindungan spam; jangan menaruh kredensial FossBilling di React/browser.
- Tinjau dan sesuaikan Ketentuan Layanan serta Kebijakan Privasi di file yang sama dengan badan usaha/operator, layanan, pemrosesan data, pembayaran, dan hukum yang benar-benar berlaku. Teks saat ini adalah draf umum, bukan nasihat hukum.
- Pastikan web server produksi mengarahkan permintaan halaman frontend seperti `/about`, `/privacy`, dan `/admin` ke `index.html` (SPA fallback). Jangan mengalihkan endpoint `/api/*` PHP ke `index.html`; endpoint itu harus tetap dijalankan oleh PHP.

## Endpoint harga dan FossBilling

`public/api/pricing.php` mengambil daftar dari endpoint publik FossBilling:
`/api/guest/product/get_list`. PHP di server website mengubah data `result.list`
menjadi format yang dipakai frontend. Harga bulanan dan tahunan diambil dari
`pricing.recurrent["1M"]` dan `pricing.recurrent["1Y"]`; produk tanpa kedua
periode aktif atau tanpa harga valid tidak ditampilkan.

Frontend hanya mengakses `/api/pricing.php` di domain website. Jangan panggil
FossBilling langsung dari browser. Endpoint guest yang digunakan untuk daftar
produk tidak memerlukan token admin. Endpoint `/api/admin` yang membutuhkan
token tidak dipakai untuk menampilkan harga; jangan pernah memasukkan token itu
ke React, URL browser, atau file yang dipublikasikan. Jika kelak server perlu
memanggil endpoint terproteksi, panggilan harus dibuat dari PHP dan token hanya
disimpan sebagai environment variable rahasia di server.

Konfigurasikan alamat dasar server FossBilling melalui `FOSSBILLING_BASE_URL`
(tanpa path `/api/...`) dan mata uang melalui `PRICING_CURRENCY` (default `IDR`).
HTTPS diwajibkan untuk host publik. HTTP hanya diterima untuk alamat IP private
atau loopback, agar development dapat mengakses FossBilling di LAN atau API
Docker yang dipublikasikan hanya ke `127.0.0.1` pada VPS.

Untuk development lokal, jalankan API PHP dengan konfigurasi berikut:

```sh
FOSSBILLING_BASE_URL=http://192.168.1.22:8085 PRICING_CURRENCY=IDR npm run dev:api
```

`npm run dev` menjalankan frontend secara terpisah. Vite meneruskan `/api` ke
server PHP lokal di port 8001.

### Menambahkan fitur paket

Endpoint FossBilling yang tersedia belum mengirim kapasitas, jumlah pengguna,
atau daftar fitur. Tambahkan informasi yang benar di `$productPresentation`
pada `public/api/pricing.php`, menggunakan `slug` produk dari FossBilling
sebagai key. Contoh berikut hanya menunjukkan bentuk datanya; ganti nilainya
dengan detail paket yang benar:

```php
$productPresentation = [
    'active' => [
        'storage' => '100 GB',
        'users' => 1,
        'featured' => false,
        'features' => [
            'Fitur paket dalam Bahasa Indonesia',
        ],
        'translations' => [
            'en' => [
                'name' => 'Active',
                'description' => 'English plan description.',
                'features' => ['Plan feature in English'],
            ],
        ],
    ],
];
```

`storage` dan `users` bersifat opsional, dan fitur/kapasitas tidak akan dibuat
otomatis dari data yang tidak disediakan API. Fitur dan terjemahan di atas
hanya contoh. Tanpa metadata, kartu tetap menampilkan nama, deskripsi, dan
harga dari FossBilling; bagian fitur dan kapasitas tidak ditampilkan.

### Konfigurasi VPS Debian 13 + Nginx + PHP-FPM

Untuk setup ini, landing page tidak perlu dijalankan dalam Docker. React dibuild
menjadi file statis, sedangkan Nginx menyajikannya dan meneruskan dua endpoint
PHP ke PHP-FPM yang sudah tersedia. Ini lebih sederhana daripada menambah
container, volume/session tambahan, dan jalur jaringan baru. API yang sudah
berjalan di Docker tetap dapat diakses secara privat dari PHP-FPM host.

Contoh konfigurasi Nginx tersedia di
[`deploy/nginx/sangatta-cloud.conf.example`](./deploy/nginx/sangatta-cloud.conf.example).
Sesuaikan domain, path rilis, dan socket PHP-FPM sebelum mengaktifkannya.

1. **Arahkan domain ke VPS.** Setelah domain didaftarkan, atur DNS `A` ke IPv4
   VPS dan `AAAA` hanya jika IPv6 VPS sudah benar-benar siap. Izinkan port 80
   dan 443 di firewall; batasi SSH dan jangan publikasikan port internal API
   atau database.
2. **Siapkan PHP-FPM.** Debian 13 memakai PHP 8.4. Pasang/aktifkan PHP-FPM dan
   ekstensi cURL:

   ```sh
   sudo apt update
   sudo apt install nginx php8.4-fpm php8.4-curl certbot
   ls /run/php/php*-fpm.sock
   ```

   Jika socket bukan `/run/php/php8.4-fpm.sock`, sesuaikan `fastcgi_pass` di
   konfigurasi Nginx. Pastikan worker PHP-FPM dapat membaca environment
   variable berikut. Tambahkan baris ini di bagian `[www]` pada
   `/etc/php/8.4/fpm/pool.d/www.conf`:

   ```ini
   env[FOSSBILLING_BASE_URL] = "https://billing.example.com"
   env[PRICING_CURRENCY] = "IDR"
   env[SITE_CONTENT_FILE] = "/var/lib/sangatta-cloud/site-content.json"
   env[ADMIN_USERNAME] = "ganti-dengan-username-admin"
   env[ADMIN_PASSWORD_HASH] = "ganti-dengan-hash-password"
   ```

   Buat password hash di VPS dengan `password_hash()` PHP, lalu salin hash ke
   konfigurasi FPM. Jangan menaruh password/token asli di Git. File konten dan
   rate limit admin disimpan di direktori data terpisah dari document root:

   ```sh
   sudo install -d -o www-data -g www-data -m 0750 /var/lib/sangatta-cloud
   sudo systemctl reload php8.4-fpm
   ```

   Pastikan direktori itu masuk ke backup rutin. Endpoint harga guest tidak
   memerlukan token FossBilling admin. Jika suatu saat token admin dibutuhkan,
   simpan sebagai secret server dan hanya gunakan melalui kode PHP server.
3. **Jangkau API FossBilling secara privat.** Jika API ada di container pada
   VPS yang sama, publikasikan hanya ke loopback host, misalnya
   `127.0.0.1:8085:80`, lalu atur `FOSSBILLING_BASE_URL` ke
   `http://127.0.0.1:8085`. Jangan bind port API ke `0.0.0.0` kecuali memang
   dilindungi firewall/reverse proxy. Jika API berada di host lain, gunakan
   koneksi private/VPN atau domain HTTPS yang sertifikatnya valid.
4. **Build dan deploy hanya isi `dist/`.** Jalankan `npm ci && npm run build`
   pada mesin build/CI, lalu upload isi `dist/` ke direktori rilis misalnya
   `/var/www/sangatta-cloud/releases/<rilis>/`. Jangan jadikan checkout Git
   sebagai document root. Atur symlink `current` ke rilis aktif dan pastikan
   Nginx/PHP-FPM dapat membaca file dan direktori. Direktori `storage/` lokal
   dan hasil konten admin tidak boleh masuk ke Git atau ke document root
   production.
5. **Aktifkan HTTPS.** Sebelum memasang konfigurasi contoh, ganti
   `example.com` dan path/socket sesuai server. Terbitkan sertifikat Let's
   Encrypt setelah DNS aktif, misalnya dengan Certbot menggunakan plugin
   Nginx atau webroot `/var/www/html`. Pastikan file sertifikat yang dirujuk
   konfigurasi tersedia. Aktifkan site, lalu validasi dan reload:

   ```sh
   sudo nginx -t
   sudo systemctl reload nginx
   ```

   Konfigurasi contoh mengalihkan HTTP ke HTTPS dan mengatur cookie HTTPS untuk
   panel admin. Jangan membuka panel login ke internet sebelum HTTPS aktif.
6. **Verifikasi endpoint dan halaman.** Dari VPS, jalankan
   `curl -i https://domain-website.example/api/pricing.php`. Pastikan respons
   JSON memiliki `"source": "fossbilling"` dan harga benar. Uji juga `/admin`,
   login, penyimpanan konten, dan halaman `/about`. Jika endpoint gagal, cek
   log Nginx/PHP-FPM; respons API publik memang hanya menampilkan error umum.

Docker dapat dipertimbangkan nanti jika seluruh stack ingin dikelola sebagai
Compose. Untuk itu, landing/PHP-FPM harus berada di jaringan internal yang sama
dengan API, data admin harus memakai volume persisten di luar web root, dan
Nginx host tetap menjadi reverse proxy. Jangan menambahkan container hanya
karena API lain sudah memakai Docker.

Hasil build berada di `dist/`, termasuk endpoint PHP dari folder `public/api`.

## Menyimpan perubahan ke GitHub

Setelah perubahan selesai dan sudah diperiksa di browser, simpan perubahan dengan Git:

```sh
git add -A
git commit -m "Update website content"
git push
```

Jangan commit file rahasia seperti `.env`, password, atau API key. File `.env` dan hasil build `dist/` sudah dikecualikan lewat `.gitignore`.
