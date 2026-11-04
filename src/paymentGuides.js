// Petunjuk pembayaran VA (terjemahan Indonesia) berdasarkan halaman payment_url Komerce.
const paymentGuides = {
  "Permata Bank": {
    "logo": "/bank-logos/permata_bank_new.png",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Masukkan kartu ATM Permata dan PIN Anda",
              "Masukkan PIN ATM Anda"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih Menu \"Transaksi Lainnya\"",
              "Pilih \"Pembayaran\"",
              "Pilih \"Pembayaran Lainnya\"",
              "Pilih menu \"Virtual Account\"",
              "Masukkan Nomor Virtual Account",
              "Pilih jenis rekening yang digunakan untuk transfer (misalnya rekening Tabungan)",
              "Konfirmasi detail transaksi yang ditampilkan"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "IBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka https://www.permatanet.com lalu masuk"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Pembayaran Tagihan\"",
              "Pilih \"Virtual Account\"",
              "Masukkan Nomor Virtual Account Anda",
              "Periksa detail informasi Anda lalu lanjutkan",
              "Masukkan kode respons token SMS"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka aplikasi Permata ME",
              "Masukkan User ID dan Password"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Pay Bills\"",
              "Pilih \"My Trees\" di \"Others\"",
              "Masukkan Nomor Virtual Account Anda",
              "Konfirmasi detail transaksi Anda",
              "Masukkan PIN"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      }
    ]
  },
  "Bank Sahabat Sampoerna": {
    "logo": "/bank-logos/sahabat_sampoerna.png",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Masukkan Kartu ATM Anda",
              "Pilih bahasa yang Anda inginkan",
              "Masukkan PIN ATM Anda"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Transaksi Lainnya\"",
              "Pilih \"Transfer ke Bank Sahabat Sampoerna\"",
              "Masukkan nomor virtual account. Pastikan nomor yang dimasukkan sudah benar",
              "Masukkan total nominal dalam Rupiah sesuai invoice atau tagihan. Pastikan nominal yang dimasukkan sudah benar. Nominal yang tidak sesuai dapat menyebabkan transaksi gagal dan dikembalikan",
              "Konfirmasi detail transaksi"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "IBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka https://ibank.banksampoerna.co.id",
              "Masukkan User ID dan Password",
              "Pilih \"Transfer\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih sumber dana Anda",
              "Pilih \"Bank Sahabat Sampoerna\" sebagai rekening bank tujuan",
              "Masukkan nomor virtual account. Pastikan nomor yang dimasukkan sudah benar",
              "Masukkan total nominal dalam Rupiah sesuai invoice atau tagihan. Pastikan nominal yang dimasukkan sudah benar. Nominal yang tidak sesuai dapat menyebabkan transaksi gagal dan dikembalikan",
              "Selesaikan verifikasi transaksi dengan token bank serta konfirmasi PIN dan/atau password"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka Sampoerna Mobile Banking melalui ponsel Anda",
              "Masukkan User ID dan Password",
              "Pilih \"Transfer\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih sumber dana Anda",
              "Pilih \"Bank Sahabat Sampoerna\" sebagai rekening bank tujuan",
              "Masukkan nomor virtual account. Pastikan nomor yang dimasukkan sudah benar",
              "Masukkan total nominal dalam Rupiah sesuai invoice atau tagihan. Pastikan nominal yang dimasukkan sudah benar. Nominal yang tidak sesuai dapat menyebabkan transaksi gagal dan dikembalikan",
              "Konfirmasi transaksi lalu masukkan password Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      }
    ]
  },
  "BRI": {
    "logo": "/bank-logos/bank_bri_full.png",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Masukkan kartu, pilih bahasa, lalu masukkan PIN Anda",
              "Pilih \"Menu Lain\" lalu pilih \"Pembayaran\"",
              "Pilih \"Pembayaran Lain\" lalu pilih \"Briva\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Masukkan nomor virtual account dan nominal yang ingin dibayar",
              "Periksa data transaksi lalu tekan \"YA\""
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Masuk ke BRI Mobile Banking, masukkan USER ID dan PIN Anda",
              "Pilih \"Pembayaran\" lalu pilih \"Briva\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Masukkan Nomor Virtual Account dan nominal yang ingin dibayar",
              "Masukkan PIN Anda lalu klik \"Kirim\""
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      }
    ]
  },
  "NEOBANK": {
    "logo": "/bank-logos/Bank_Neo_Commerce.png",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Buka ATM Bersama/Prima"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Transfer\"",
              "Pilih \"Transfer ke Bank Lain\"",
              "Masukkan Kode 490 + VA"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Waktu proses dapat berbeda tergantung bank Anda."
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka neobank"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Transfer\"",
              "Pilih \"Transfer VA\"",
              "Masukkan Nomor VA Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Waktu proses dapat berbeda tergantung bank Anda."
            ]
          }
        ]
      }
    ]
  },
  "BCA": {
    "logo": "/bank-logos/BCA_2.png",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Masukkan kartu ATM BCA dan PIN Anda",
              "Masukkan PIN ATM Anda"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih Menu \"Transaksi Lainnya\"",
              "Pilih \"Transfer\"",
              "Pilih \"Ke Rekening BCA Virtual Account\"",
              "Masukkan Nomor Virtual Account. Tekan \"Benar\" untuk melanjutkan",
              "Verifikasi detail Virtual Account, lalu masukkan nominal yang akan ditransfer dan pilih \"Benar\" untuk konfirmasi",
              "Konfirmasi detail transaksi yang ditampilkan",
              "Pilih \"Ya\" jika detail sudah benar atau \"Tidak\" jika belum benar"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai. Pilih \"Tidak\" untuk mengakhiri transaksi",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "IBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Masuk ke KlikBCA Individu (https://ibank.klikbca.com)",
              "Pilih \"Transfer\", lalu pilih \"Transfer ke BCA Virtual Account\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Masukkan Nomor Virtual Account",
              "Pilih \"Lanjutkan\" untuk meneruskan pembayaran",
              "Masukkan \"RESPON KEYBCA APPLI 1\" yang tampil di Token BCA Anda, lalu klik tombol \"Kirim\"",
              "Masukkan kode token autentikasi"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda berhasil",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka aplikasi BCA Mobile",
              "Pilih \"m-BCA\", lalu pilih \"m-Transfer\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"m-BCA\", lalu pilih \"m-Transfer\"",
              "Masukkan Nomor Virtual Account Anda, lalu tekan \"OK\"",
              "Klik tombol \"Kirim\" di pojok kanan atas untuk melanjutkan",
              "Klik \"OK\" untuk melanjutkan",
              "Masukkan PIN Anda untuk mengotorisasi transaksi"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda berhasil",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      }
    ]
  },
  "BJB": {
    "logo": "/bank-logos/bjb.png",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Masukkan kartu ATM BJB dan PIN Anda",
              "Masukkan PIN ATM Anda"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih Menu \"Transaksi Lainnya\"",
              "Pilih \"Virtual Account\"",
              "Pilih jenis rekening yang digunakan untuk transfer (misalnya rekening Tabungan)",
              "Masukkan Nomor Virtual Account",
              "Konfirmasi detail transaksi yang ditampilkan"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "IBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka https://ib.bankbjb.co.id/bjb.net",
              "Masukkan User ID dan Password"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Virtual Account\"",
              "Pilih jenis rekening yang digunakan untuk transfer (misalnya rekening Tabungan)",
              "Masukkan Nomor Virtual Account",
              "Konfirmasi detail transaksi yang ditampilkan"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka aplikasi BJB Mobile",
              "Masukkan User ID dan Password"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Virtual Account\"",
              "Pilih jenis rekening yang digunakan untuk transfer (misalnya rekening Tabungan)",
              "Masukkan Nomor Virtual Account",
              "Konfirmasi detail transaksi yang ditampilkan"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      }
    ]
  },
  "BNI": {
    "logo": "/bank-logos/bni.png",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Masukkan Kartu ATM Anda",
              "Pilih bahasa yang Anda inginkan",
              "Masukkan PIN ATM Anda"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Transaksi Lainnya\"",
              "Pilih \"Transfer\"",
              "Pilih jenis rekening yang digunakan untuk transfer (misalnya rekening Tabungan)",
              "Pilih \"Virtual Account Billing\"",
              "Masukkan Nomor Virtual Account",
              "Nominal tagihan akan tampil di layar",
              "Konfirmasi transaksi, jika sudah benar lanjutkan"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "IBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Masukkan alamat berikut https://ibank.bni.co.id lalu klik \"Enter\"",
              "Masukkan User ID dan Password Anda"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih menu \"Transfer\"",
              "Pilih menu \"Virtual Account Billing\"",
              "Masukkan nomor Virtual Account Anda",
              "Pilih jenis rekening yang digunakan untuk transfer lalu tekan \"Lanjutkan\"",
              "Nominal tagihan akan tampil di layar",
              "Masukkan kode token autentikasi"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka BNI Mobile Banking dari ponsel Anda",
              "Masukkan User ID dan Password Anda",
              "Pilih menu \"Transfer\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih menu \"Virtual Account Billing\" lalu pilih rekening debit",
              "Masukkan Nomor Virtual Account Anda pada menu \"Input Baru\"",
              "Nominal tagihan akan tampil di layar",
              "Konfirmasi transaksi lalu masukkan password Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      }
    ]
  },
  "MANDIRI": {
    "logo": "/bank-logos/mandiri.png",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Masukkan kartu ATM Anda dan pilih \"Bahasa Indonesia\"",
              "Masukkan PIN, lalu pilih \"ENTER\"",
              "Pilih \"PEMBAYARAN\", lalu pilih \"MULTI PAYMENT\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Masukkan kode perusahaan '88608', lalu tekan \"BENAR\"",
              "Masukkan Nomor Virtual Account, lalu tekan \"BENAR\"",
              "Masukkan nominal transfer, lalu tekan \"BENAR\"",
              "Detail merchant akan tampil, pilih nomor 1 sesuai nominal tagihan lalu tekan \"YA\"",
              "Konfirmasi pembayaran akan tampil. Pilih \"YA\" untuk melanjutkan"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Simpan struk sebagai bukti pembayaran",
              "Transaksi Anda berhasil",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka Livin by Mandiri, lalu masukkan PASSWORD atau lakukan verifikasi wajah",
              "Pilih \"Transfer IDR\"",
              "Pilih \"Transfer ke penerima baru\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Masukkan Nomor Virtual Account Anda",
              "Konfirmasi detail VA lalu klik \"Lanjutkan\"",
              "Masukkan nominal transfer (jika tidak terisi otomatis)",
              "Tinjau dan konfirmasi detail transaksi lalu klik \"Lanjutkan\"",
              "Selesaikan transaksi dengan memasukkan MPIN Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran berhasil, simpan struk transaksi atau tangkapan layar sebagai bukti pembayaran",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      }
    ]
  },
  "BSI": {
    "logo": "/bank-logos/Bank_Syariah_Indonesia.svg",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Buka Menu \"Lainnya\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Virtual Account Billing\"",
              "Masukkan Nomor VA Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Waktu proses dapat berbeda tergantung bank Anda."
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Masuk ke BSI Mobile"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Transfer\"",
              "Pilih \"Virtual Account Billing\"",
              "Masukkan Nomor VA Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Waktu proses dapat berbeda tergantung bank Anda."
            ]
          }
        ]
      }
    ]
  },
  "DANAMON": {
    "logo": "/bank-logos/Danamon.svg",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Buka Menu \"Pembayaran\""
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Lainnya\"",
              "Pilih \"Virtual Account\"",
              "Masukkan Nomor VA Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Waktu proses dapat berbeda tergantung bank Anda."
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka D-Bank PRO"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih Menu \"Pembayaran\"",
              "Pilih \"Virtual Account\"",
              "Pilih \"Tambah Biller Baru\"",
              "Masukkan Nomor VA Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Waktu proses dapat berbeda tergantung bank Anda."
            ]
          }
        ]
      }
    ]
  },
  "SMBC": {
    "logo": "/bank-logos/SMBC_Indonesia_logo.svg",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Buka ATM Bersama/BTPN"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih \"Transfer\"",
              "Pilih \"Ke Rekening Bank Lain\"",
              "Masukkan Kode 213 + Nomor VA"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Waktu proses dapat berbeda tergantung bank Anda."
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Masuk ke Jenius"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Klik tombol \"Mobius\"",
              "Pilih \"Bayar Tagihan\"",
              "Pilih \"Virtual Account SMBC Indonesia\"",
              "Masukkan Nomor VA Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Waktu proses dapat berbeda tergantung bank Anda."
            ]
          }
        ]
      }
    ]
  },
  "CIMB": {
    "logo": "/bank-logos/cimb.png",
    "methods": [
      {
        "method": "ATM",
        "steps": [
          {
            "title": "Cari ATM Terdekat",
            "content": [
              "Masukkan Kartu ATM Anda",
              "Pilih bahasa yang Anda inginkan",
              "Masukkan PIN ATM Anda"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih menu \"Transfer\" lalu pilih \"Other CIMB Niaga\"",
              "Masukkan Nomor Virtual Account Anda pada menu \"Input Baru\"",
              "Masukkan nominal pembayaran sesuai tagihan",
              "Konfirmasi transaksi lalu masukkan password Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "IBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Masukkan alamat berikut https://www.octoclicks.co.id/login lalu klik \"Enter\"",
              "Masukkan User ID dan Password"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih menu \"Transfer\" lalu pilih \"Other CIMB Niaga\"",
              "Masukkan Nomor Virtual Account Anda pada menu \"Input Baru\"",
              "Masukkan nominal pembayaran sesuai tagihan",
              "Konfirmasi transaksi lalu masukkan password Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      },
      {
        "method": "MBANKING",
        "steps": [
          {
            "title": "Masuk ke Akun Anda",
            "content": [
              "Buka Octo Mobile lalu masukkan User ID dan Password Anda"
            ]
          },
          {
            "title": "Detail Pembayaran",
            "content": [
              "Pilih menu \"Transfer\" lalu pilih \"Other CIMB Niaga\"",
              "Masukkan Nomor Virtual Account Anda pada menu \"Input Baru\"",
              "Masukkan nominal pembayaran sesuai tagihan",
              "Konfirmasi transaksi lalu masukkan password Anda"
            ]
          },
          {
            "title": "Transaksi Selesai",
            "content": [
              "Transaksi Anda telah selesai",
              "Setelah pembayaran selesai, invoice ini akan diperbarui otomatis. Proses ini dapat memakan waktu hingga 5 menit"
            ]
          }
        ]
      }
    ]
  }
}

const bankAliases = {
  BNC: 'NEOBANK', BANK_NEO: 'NEOBANK', NEO: 'NEOBANK', BTPN: 'SMBC', PERMATA: 'Permata Bank',
  CIMB_NIAGA: 'CIMB', SAHABAT_SAMPOERNA: 'Bank Sahabat Sampoerna',
}

export function getPaymentGuide(bankCode) {
  const code = String(bankCode || '').toUpperCase().replace(/ /g, '_')
  return paymentGuides[bankAliases[code] || code] || null
}

export const guideMethodLabels = { ATM: 'ATM', IBANKING: 'Internet Banking', MBANKING: 'Mobile Banking' }
