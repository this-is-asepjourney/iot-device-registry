# IoT Device Installation Registry (Cloudflare D1 SQLite)

Aplikasi web modern berbasis **Next.js App Router**, **TypeScript**, **Tailwind CSS**, dan **Cloudflare D1 SQLite Database** untuk mencatat dan memetakan perangkat IoT yang diinstal pada mesin-mesin pabrik/fasilitas industri.

---

## 📌 Aturan Validasi Utama (Atomic 1-to-1 Mapping)
1. **Satu MCID hanya boleh memiliki satu MAC Address aktif.**
2. **Satu MAC Address hanya boleh terhubung ke satu MCID aktif.**
3. **Pelepasan & Pergantian Perangkat (Atomic Swap & History):**
   - Saat modul diganti, MAC lama dilepaskan dari tabel `mac_index`.
   - MAC baru diklaim secara atomik dalam satu transaksi SQL (`BEGIN TRANSACTION` ... `COMMIT`).
   - Riwayat siklus hidup mesin dan pergantian perangkat dicatat lengkap ke `installation_history`.
   - Jika status diubah menjadi `Removed` (dilepas), indeks MAC dibebaskan agar dapat dipasang ke mesin lain di masa depan.

---

## 🗄️ Skema Database Cloudflare D1 SQLite (`schema.sql`)

1. **`devices`**
   - `mcid` (TEXT PRIMARY KEY): ID unik mesin (contoh: `CNC-VF2-01`).
   - `mac_address` (TEXT NOT NULL): Format standar `XX:XX:XX:XX:XX:XX`.
   - `normalized_mac` (TEXT NOT NULL): 12 karakter hex tanpa separator (`B827EB4A8811`).
   - `machine_model` (TEXT NOT NULL): Model mesin (contoh: `Haas CNC Milling VF-2`).
   - `location` (TEXT NOT NULL): Lokasi workshop / lini produksi.
   - `status` (TEXT NOT NULL CHECK(status IN ('Installed', 'Maintenance', 'Removed'))).
   - `installed_at` (TEXT NOT NULL): Timestamp ISO 8601.
   - `updated_at` (TEXT NOT NULL): Timestamp ISO 8601.
   - `notes` (TEXT): Catatan teknis atau spesifikasi sensor.
   - `last_technician` (TEXT): Identitas teknisi penanggung jawab.

2. **`mac_index`** *(Penjamin Keunikan 1-to-1)*
   - `normalized_mac` (TEXT PRIMARY KEY): Menjamin keunikan MAC aktif pada level database SQLite.
   - `mcid` (TEXT NOT NULL): Terhubung dengan foreign key ke `devices(mcid)`.
   - `mac_address` (TEXT NOT NULL).
   - `status` (TEXT NOT NULL DEFAULT 'active').
   - `updated_at` (TEXT NOT NULL).

3. **`installation_history`** *(Audit Trail Lengkap)*
   - `id` (TEXT PRIMARY KEY): UUID/ID unik riwayat.
   - `event_type` (TEXT NOT NULL): `INSTALL`, `REPLACE_DEVICE`, `STATUS_CHANGE`, `REMOVE`.
   - `mcid` (TEXT NOT NULL).
   - `mac_address` (TEXT NOT NULL).
   - `previous_mac_address` (TEXT).
   - `previous_status` (TEXT).
   - `new_status` (TEXT NOT NULL).
   - `machine_model` (TEXT NOT NULL).
   - `location` (TEXT NOT NULL).
   - `notes` (TEXT).
   - `timestamp` (TEXT NOT NULL).
   - `performed_by` (TEXT NOT NULL).

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Mode Lokal (Siap Pakai Tanpa Cloudflare Terlebih Dahulu)
Aplikasi dilengkapi dengan **Dual-Engine D1 SQLite**. Secara default saat dijalankan di komputer lokal:
- Menggunakan engine bawaan Node.js `node:sqlite` yang menyimpan database ke file `data/iot-registry.sqlite`.
- Sudah otomatis di-seed dengan sample mesin industri (`CNC-VF2-01`, `PRESS-50T-02`, `ROBOT-WELD-03`).

Jalankan perintah berikut:
```powershell
npm install
npm run dev
```
Buka browser di [http://localhost:3000](http://localhost:3000).

---

## ☁️ Menghubungkan ke Cloudflare D1 Remote

Untuk menghubungkan ke database Cloudflare D1 sungguhan:

### Langkah 1: Buat Database D1 via Wrangler CLI
```powershell
npx wrangler d1 create iot-device-registry-db
```
Catat output `database_id` yang dihasilkan (contoh: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

### Langkah 2: Jalankan Migrasi Skema ke Cloudflare
```powershell
npx wrangler d1 execute iot-device-registry-db --file=./schema.sql --remote
```

### Langkah 3: Konfigurasi Environment Variable di `.env.local`
Buat atau edit file `.env.local`:
```env
CLOUDFLARE_ACCOUNT_ID=salin_account_id_cloudflare_anda
CLOUDFLARE_D1_DATABASE_ID=salin_database_id_dari_langkah_1
CLOUDFLARE_API_TOKEN=salin_api_token_cloudflare_dengan_izin_d1_edit
```

> **Cara mendapatkan Cloudflare API Token:**
> 1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens).
> 2. Klik **Create Token** -> Gunakan template **Edit Cloudflare Workers** atau custom token dengan izin **D1: Edit**.
> 3. Salin token ke `CLOUDFLARE_API_TOKEN` di `.env.local`.

Setelah kredensial diisi dan server dev di-restart, badge di navbar aplikasi akan berubah menjadi **D1 Remote**.

---

## 📱 Fitur Responsif Smartphone (Mobile Friendly)
- **Bottom Navigation Bar Native:** Menu aksi cepat (Daftar, Pasang, Scan QR, Export CSV, Riwayat) di bagian bawah layar smartphone untuk kemudahan akses satu jempol.
- **Tampilan Card Khusus Layar Kecil:** Tampilan daftar device otomatis beralih dari tabel lebar ke kartu interaktif di viewport 360px - 430px.
- **Elevated Circular Scan Button:** Tombol scan kamera menonjol di tengah bottom dock untuk memudahkan teknisi di lapangan memindai modul IoT.

---

## 📸 Scanner Barcode & QR Code Terintegrasi
- Berbasis pustaka `html5-qrcode`.
- Mendukung kamera depan & belakang smartphone teknisi.
- Deteksi format: QR Code, Code 128, Code 39, Data Matrix, EAN.
- Umpan balik suara beep otomatis menggunakan Web Audio API saat barcode berhasil terbaca.
- Opsi fallback upload foto label barcode dan input manual jika kamera terkendala izin browser.

---

## 📊 Ekspor CSV ke Microsoft Excel
- Mendukung ekspor **Data Mapping Device Aktif** dan **Riwayat Lengkap Audit**.
- Menggunakan encoding **UTF-8 dengan Byte Order Mark (`\uFEFF`)** agar file `.csv` langsung terbaca rapi dengan kolom terpisah tanpa masalah karakter di Microsoft Excel.
