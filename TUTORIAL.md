# Tutorial — Dashboard Client, Wallet & Pembayaran (FossBilling + Komerce)

Dokumen ini merangkum seluruh penjelasan dan cara kerja integrasi dashboard website dengan FossBilling (Docker `/opt/sangatta-cloud`, source `~/Projects/fossbilling-mdb`).

## 1. Arsitektur

```
Browser (React/Vite :5173)
   │  /api/*  (same-origin, cookie sesi PHP)
   ▼
public/api/fossbilling-auth.php   ← proxy PHP (php -S :8001 atau php-fpm)
   │  cookie sesi FossBilling + CSRF, server-side only
   ▼
FossBilling API  http://localhost:8086  (Docker sangatta-cloud-staging-app-1)
   │
   ├── Komerce sandbox  api-sandbox.collaborator.komerce.id  (VA & QRISLY)
   ├── GoPay gateway    http://localhost:3000                (QRIS GoPay, custom)
   └── MySQL/MariaDB    sangatta-cloud-staging-db-1
```

Prinsip keamanan:
- Browser **tidak pernah** berbicara langsung ke FossBilling/Komerce — semua lewat proxy PHP.
- Cookie sesi FossBilling disimpan di `$_SESSION` PHP (HttpOnly, SameSite=Strict), bukan di browser.
- API key (`KOMERCE_API_KEY`, `FOSSBILLING_ADMIN_TOKEN`, dll) hanya hidup di environment server.
- Semua endpoint mutasi (POST) wajib header `X-CSRF-Token` + sesi login.
- Data selalu di-scope ke identitas client dari sesi — tidak ada `client_id` dari browser (anti-BOLA/IDOR).

## 2. Environment variable

| Variabel | Dipakai untuk | Default |
|---|---|---|
| `FOSSBILLING_BASE_URL` | URL internal API FossBilling | `http://localhost:8086` |
| `FOSSBILLING_PUBLIC_URL` | URL publik untuk `callback_url` webhook Komerce | fallback `https://fossbilling.danijh.my.id` |
| `FOSSBILLING_ADMIN_TOKEN` | Admin API (cancel invoice, pay_with_credits) | wajib untuk aksi tsb |
| `KOMERCE_API_KEY` | API key Komerce sandbox | wajib |
| `KOMERCE_BASE_URL` | Base URL Komerce | `https://api-sandbox.collaborator.komerce.id/user` |
| `KOMERCE_QRIS_ID` | ID QRIS Komerce (QRISLY) | `1438` |
| `GOPAY_GATEWAY_URL` | GoPay QRIS gateway | `http://localhost:3000` |
| `GOPAY_API_KEY` | API key GoPay gateway | opsional |

## 3. Dompet (Wallet)

- Sumber data: `client/balance_get_total` (saldo) dan `client/balance_get_list` (mutasi, 50 terbaru).
- Action proxy: `GET action=wallet` → `{ balance, currency, transactions[] }`.
- Saldo tampil di halaman **Dompet** dan sidebar ("Saldo akun") — auto-refresh saat pembayaran PAID.
- Mutasi `client_balance` di FossBilling: `type=transaction` = uang masuk, `type=invoice` = pemakaian saldo.

## 4. Tambah Saldo (Top-up)

Flow: `POST action=wallet-topup { amount, method }`

1. Validasi nominal **integer Rp10.000 – Rp100.000.000** dan metode (`va:KODE` / `qris:` / `gopay:`).
2. Guard: tolak 409 jika masih ada invoice deposit `unpaid` (maks 1 top-up pending per akun).
3. `invoice/funds_invoice` → invoice deposit "Add funds" di FossBilling (hash diverifikasi lewat `invoice/get`, wajib `client_id` = sesi, semua line `type=deposit`, currency IDR).
4. `respondInvoiceGatewayPayment()` membuat pembayaran VA/QRIS/GoPay — nominal ke Komerce diambil dari `total` invoice di server.
5. Settlement: webhook Komerce → `ipn.php` → adapter verifikasi ke API Komerce → `addFunds` (saldo masuk) + `markAsPaid`.

## 5. Pembayaran Tagihan / Produk

- `POST action=pay-invoice { invoice_id, method }` — invoice harus `unpaid` dan milik sesi.
- `POST action=checkout` — pembayaran order dari keranjang.
- VA: `payment/create` dengan `expiry_duration=86400`, `callback_url`, `callback_api_key` (HMAC).
- QRISLY: `qrisly/generate-qris` — tidak ada webhook, pakai self-heal.
- GoPay: gateway custom `localhost:3000/create-qris`.

## 6. Sinkronisasi Status & Webhook

Tiga lapis supaya invoice tidak menggantung:

1. **Webhook Komerce (VA)** → `callback_url` → `https://fossbilling.danijh.my.id/ipn.php?gateway_id=5&invoice_id=N`. Komerce memanggil sendiri saat PAID.
2. **Self-heal `payment-status`** → jika status PAID terlihat (polling/manual), server memicu `notifyFossBillingPaid()` → IPN yang sama. Berlaku untuk QRISLY, GoPay, **dan VA** (dengan fallback pencarian `gateway_id` untuk sesi lama).
3. **Adapter selalu verifikasi ulang** ke API Komerce (`payment/status`) — tidak pernah percaya body callback. Cek `merchant_receives` vs total invoice (VA fee flat ditanggung customer).

Frontend polling di halaman pembayaran:
- QRIS/GoPay: tiap **5 detik**.
- VA: tiap **15 detik**.
- Berhenti saat status terminal (`PAID`/`EXPIRED`/`CANCELED`/`FAILED`).
- Saat PAID: toast notifikasi + auto-refresh wallet/tagihan/layanan.

## 7. Bayar dengan Saldo

`POST action=pay-invoice-balance { invoice_id, password }`

1. Invoice unpaid milik sesi (anti-BOLA), tolak invoice deposit.
2. **Verifikasi password**: login ulang ke FossBilling (guest scope) — bukan sekadar cek field.
3. Cek `balance_get_total` >= total tagihan.
4. `admin/invoice/pay_with_credits` → `tryPayWithCredits` di FossBilling: lock saldo, potong `client_balance`, `markAsPaid` — semua dalam satu transaksi DB.

Saldo **tidak pernah terpotong otomatis** — cron `invoice_batch_pay_with_credits` sudah dinonaktifkan di `modules/Cron/Service.php` (source repo + container). Pemotongan hanya lewat aksi eksplisit user.

## 8. Invoice Kedaluwarsa

- `remove_after_days = 1` (tabel `setting`) → cron `removeExpiredUnpaidInvoices` me-void invoice unpaid yang `due_at` lewat >1 hari → status `canceled` → tampil di tab Dibatalkan.
- Invoice unpaid yang lewat tempo (tapi belum auto-void) tampil abu-abu dengan tombol "Lihat" — tidak bisa dibayar lewat UI.

## 9. Perpanjangan Produk (Merge Order)

Semua produk bertipe `custom` — tidak ada provisioning eksternal, jadi order yang "sama" digabung di level data:

- **Patch `Order\Service::createFromOrder`** (`fossbilling-mdb/src/modules/Order/Service.php`, juga di `/opt/sangatta-cloud/src` dan container `/var/www/html`): setelah order baru aktif, `mergeDuplicateActiveOrder()` mencari order `active` lain dengan `client_id`+`product_id` sama yang `expires_at`-nya masih di masa depan. Jika ada, durasi order baru (`expires_at − activated_at`) ditambahkan ke `expires_at` order canonical (yang expiry-nya terjauh), lalu order baru ditandai `canceled` dengan reason `Merged into order #X` — invoice & riwayat tetap ada.
- **Order expired diabaikan** — `expires_at <= now` tidak ikut merge; membeli lagi dianggap produk baru.
- **Migrasi data** (sudah dijalankan untuk client 4): order ganda digabung manual via SQL — canonical = expiry terjauh, order lain dibatalkan, sisa durasi tiap order diakumulasikan ke canonical.
- **Frontend**: `services` endpoint kini mengembalikan `product_id`; halaman produk menampilkan badge "Aktif s.d. {tanggal}" + notice bahwa pembelian menambah durasi; checkout menampilkan catatan serupa untuk item yang masih aktif.

## 10. File Penting

| File | Fungsi |
|---|---|
| `public/api/fossbilling-auth.php` | Proxy API: auth, cart, checkout, pay-invoice, wallet, wallet-topup, pay-invoice-balance, payment-status/cancel, ticket, storage |
| `src/ClientDashboardPage.jsx` | Dashboard React: wallet, tagihan, layanan, pembayaran, top-up modal, bayar-dengan-saldo |
| `fossbilling-mdb/src/library/Payment/Adapter/Komerce.php` | Adapter gateway Komerce (verifikasi, addFunds, markAsPaid) |
| `fossbilling-mdb/src/modules/Cron/Service.php` | Cron task (auto-pay-with-credits dinonaktifkan) |

## 11. Troubleshooting

| Gejala | Kemungkinan | Cek |
|---|---|---|
| Invoice PAID di Komerce tapi unpaid di FossBilling | IPN belum sampai/gagal | `transaction` table (error?), klik "Perbarui status" untuk retry self-heal |
| `Komerce API request failed` di transaction.error | Verifikasi adapter timeout ke sandbox | Retry — self-heal otomatis coba lagi |
| Saldo tidak masuk setelah top-up | Sama seperti di atas; cek `client_balance` & `invoice.status` | `docker exec ... mariadb` query |
| Tombol Bayar jadi "Lihat" abu-abu | Invoice lewat `due_at` | Normal — tunggu auto-void atau hubungi admin |
| Payment VA baru tidak ada webhook | `callback_url` tidak terkirim | Pastikan `fossbillingPublicUrl()` resolve (env atau fallback) |
