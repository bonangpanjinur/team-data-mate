# Setup Deployment di Vercel

Panduan lengkap untuk men-deploy aplikasi Team Data Mate ke Vercel dengan Supabase.

## Prasyarat

- Akun Vercel (https://vercel.com)
- Akun Supabase (https://supabase.com)
- Git dan Node.js terinstal di komputer lokal

## Langkah-Langkah Deployment

### 1. Siapkan Supabase

1. Buka dashboard Supabase Anda
2. Pilih project Anda
3. Pergi ke **Settings > API**
4. Catat nilai berikut:
   - **Project URL** (VITE_SUPABASE_URL)
   - **Anon Public Key** (VITE_SUPABASE_PUBLISHABLE_KEY)

### 2. Push Kode ke GitHub

```bash
# Di dalam direktori project
git add .
git commit -m "Remove Lovable dependencies and update for Vercel deployment"
git push origin main
```

### 3. Connect Repository ke Vercel

1. Buka https://vercel.com/dashboard
2. Klik **Add New > Project**
3. Pilih repository `bonangpanjinur/team-data-mate`
4. Klik **Import**

### 4. Konfigurasi Environment Variables

Di halaman konfigurasi Vercel, tambahkan environment variables berikut:

| Variable Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | URL dari Supabase project Anda |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon Public Key dari Supabase |

**Penting**: Pastikan variables ini ditambahkan untuk semua environment (Production, Preview, Development).

### 5. Deploy

1. Klik **Deploy**
2. Tunggu proses deployment selesai
3. Vercel akan memberikan URL publik untuk aplikasi Anda

## Verifikasi Deployment

Setelah deployment selesai:

1. Buka URL yang diberikan oleh Vercel
2. Coba login dengan akun Supabase Anda
3. Verifikasi bahwa data dapat dimuat dari Supabase

## Troubleshooting

### Error: "Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')"

**Solusi**: Pastikan environment variables sudah ditambahkan di Vercel dan deployment di-trigger ulang setelah penambahan variables.

### Error: "Supabase connection failed"

**Solusi**: 
- Verifikasi bahwa VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY benar
- Pastikan project Supabase aktif dan bisa diakses dari internet

### Build gagal

**Solusi**: 
- Pastikan semua dependencies terinstal: `pnpm install`
- Cek apakah ada error di console: `pnpm build`

## Monitoring dan Logs

Untuk melihat logs deployment:

1. Buka project di Vercel dashboard
2. Klik **Deployments**
3. Pilih deployment terbaru
4. Klik **Logs** untuk melihat build logs

## Rollback

Jika ada masalah setelah deployment:

1. Buka **Deployments** di Vercel
2. Pilih deployment sebelumnya yang stabil
3. Klik **...** dan pilih **Promote to Production**

## Informasi Lebih Lanjut

- [Dokumentasi Vercel](https://vercel.com/docs)
- [Dokumentasi Supabase](https://supabase.com/docs)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

## Pengaturan Tambahan: Menonaktifkan Konfirmasi Email

Secara default, Supabase mewajibkan user untuk melakukan konfirmasi email setelah mendaftar. Jika Anda ingin user bisa langsung login tanpa konfirmasi:

1.  Buka [Dashboard Supabase](https://supabase.com/dashboard).
2.  Pilih proyek Anda.
3.  Pergi ke **Authentication > Settings**.
4.  Cari bagian **Email Auth**.
5.  Nonaktifkan (OFF) opsi **Confirm email**.
6.  Klik **Save**.

Setelah ini, setiap user yang mendaftar melalui halaman `/register` di aplikasi akan bisa langsung login tanpa perlu membuka email konfirmasi.

## Deployment Edge Functions (Penting untuk Fitur Admin)

Jika Anda mendapatkan error "Failed to send a request to the Edge Function" saat membuat user atau mendownload data, itu berarti Edge Functions belum di-deploy ke Supabase.

### Langkah-langkah Deployment:

1.  **Instal Supabase CLI** di komputer lokal Anda:
    ```bash
    npm install -g supabase
    ```
2.  **Login ke Supabase**:
    ```bash
    supabase login
    ```
3.  **Inisialisasi Link ke Project**:
    Dapatkan Project ID dari URL dashboard Supabase Anda (misal: `mwdecebkfhcqynxczdjx`).
    ```bash
    supabase link --project-ref <PROJECT_ID>
    ```
4.  **Deploy Semua Functions**:
    ```bash
    supabase functions deploy
    ```

### Daftar Functions yang Harus Ada:
- `create-user` (Untuk membuat user baru oleh admin)
- `delete-user` (Untuk menghapus user)
- `update-user-role` (Untuk mengubah role user)
- `download-entries` (Untuk export data)
- `reset-password`
- `setup-admin`

**Catatan**: Edge Functions memerlukan `SUPABASE_SERVICE_ROLE_KEY` untuk beroperasi. Biasanya ini sudah terkonfigurasi otomatis saat di-deploy, namun pastikan di dashboard Supabase bagian **Edge Functions > [Nama Function] > Details** tidak ada error terkait environment variables.
