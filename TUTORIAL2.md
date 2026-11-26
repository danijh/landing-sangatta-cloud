Berikut tutorial lengkap + penilaian keamanannya.

 1. Install  mc  permanen

 
   sudo install -m 755 /tmp/mc /usr/local/bin/mc
   mc --version   # verifikasi
 

 2. File environment untuk root credential MinIO

 Jangan taruh password di crontab (terlihat di  ps  dan world-readable). Buat file khusus:

 
   sudo tee /etc/nextcloud-storage.env > /dev/null <<'EOF'
   MINIO_ROOT_USER=<root-user-minio>
   MINIO_ROOT_PASSWORD=<root-password-minio>
   EOF
   sudo chown root:www-data /etc/nextcloud-storage.env
   sudo chmod 640 /etc/nextcloud-storage.env
 

  www-data  bisa membaca lewat grup, user lain tidak bisa.

 3. Entry cron untuk www-data

 
   sudo tee /etc/cron.d/nextcloud-storage > /dev/null <<'EOF'
   # Provisioning Storage Area — sinkron bucket/user/mount MinIO+Nextcloud
   */15 * * * * www-data set -a; . /etc/nextcloud-storage.env; set +a; \
     NC_DIR=/home/danijh/Projects/nextcloud \
     MC=/usr/local/bin/mc \
     /home/danijh/Projects/website-2/deploy/nextcloud-storage-sync.sh \
     /home/danijh/Projects/website-2/storage \
     >> /var/log/nextcloud-storage.log 2>&1
   EOF
   sudo chmod 644 /etc/cron.d/nextcloud-storage
 

 Tes manual dulu sebelum andalkan cron:

 
   sudo -u www-data bash -c 'set -a; . /etc/nextcloud-storage.env; set +a; \
     NC_DIR=/home/danijh/Projects/nextcloud MC=/usr/local/bin/mc \
     /home/danijh/Projects/website-2/deploy/nextcloud-storage-sync.sh \
     /home/danijh/Projects/website-2/storage'
   tail -20 /var/log/nextcloud-storage.log
 

 Script idempotent — aman dijalankan berulang; interval 15 menit cukup (spec diperbarui tiap user membuka halaman Layanan). Kalau mau lebih
 responsif, bisa tiap 5 menit.

 4. Penilaian keamanan

 Yang sudah aman / baru saya perketat:

   •  storage/s3-credentials.json  tadi  666  (world-readable, berisi secret key semua user) → sekarang  660  + ACL  www-data:rw  — hanya owner
     dan www-data yang bisa akses.
   •  storage/nextcloud.php  (berisi app password admin Nextcloud) →  600 .
   • Root credential MinIO tidak lagi di command line — lewat env file  640 root:www-data .
   • Mount Nextcloud pakai access key per user yang hanya bisa akses bucket-nya sendiri — kebocoran satu kredensial tidak membuka data user lain.
   • MinIO root credential hanya dipakai sesaat oleh script untuk admin API — tidak disimpan di Nextcloud.

 Risiko yang tersisa & mitigasi:

   •  www-data  = user PHP/web server. Script jalan sebagai www-data karena  occ  menuntutnya. Artinya kalau website di-compromise, attacker
     sudah bisa menjalankan  occ  juga — tidak ada eskalasi privilege baru, tapi perimeter-nya sama dengan web app itu sendiri. Tidak bisa
     dihindari selama provisioning lewat  occ .
   • Root credential MinIO = kendali penuh semua bucket. Siapapun yang membaca  /etc/nextcloud-storage.env  bisa wipe semua storage. Pastikan
     hanya root + grup www-data. Kalau mau lebih ketat: buat MinIO user admin khusus (bukan root) dengan policy admin seperlunya —  mc admin user
     add  + attach policy  consoleAdmin /admin; tapi operasi  admin user/policy  pada dasarnya butuh root, jadi praktisnya root tetap diperlukan.
   • Port 9000/9001 terekspos  0.0.0.0  di docker nginx — MinIO + console bisa diakses dari LAN. Sebaiknya bind ke  127.0.0.1  atau pasang
     firewall, karena siapa pun yang bisa reach endpoint dengan root cred = game over. Console UI juga jangan diekspos publik.
   •  /tmp/mc  di environment dev tidak masalah, tapi di server jangan jalankan script tanpa mc terverifikasi.
   • PHP dev server  0.0.0.0:8001  — hanya untuk development; di produksi pastikan  storage/  tidak bisa diakses via HTTP (cek nginx/apache tidak
     melayani direktori itu — sebaiknya di luar docroot).

 Catatan deploy:  storage/nextcloud.php  sekarang  600  milik  danijh  — kalau PHP produksi jalan sebagai user lain (php-fpm/www-data), file
 tidak terbaca → fallback ke env var. Solusinya: set  NEXTCLOUD_ADMIN_APP_PASSWORD  dkk sebagai env PHP-FPM, atau  chgrp  file ke group PHP.
