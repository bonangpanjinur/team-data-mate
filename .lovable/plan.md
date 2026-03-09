

## Rencana: Notifikasi Owner + Dashboard Super Admin + Fix Role Owner

### 1. Database Migration

**a. Trigger notifikasi otomatis ke owner saat invoice baru:**
- Modifikasi fungsi `auto_create_owner_invoice()` untuk juga INSERT ke `notifications` saat invoice dibuat

**b. Tambah role `owner` ke RLS policy notifications (jika belum):**
- Owner sudah bisa view/update own notifications via existing policies (user_id = auth.uid())

### 2. Dashboard Super Admin (`Dashboard.tsx`)

Tambahkan section khusus super_admin di atas dashboard existing:
- **Card ringkasan**: Total Pendapatan (sum paid invoices), Total Belum Bayar, Owner Aktif (count distinct owner_id dari groups), Total Sertifikat Selesai
- **Grafik bulanan**: Bar chart pendapatan per bulan (dari owner_invoices yang paid, grouped by period)
- Data diambil dari `owner_invoices` dan `groups`

### 3. Tambah Role Owner di Halaman Relevan

Cek apakah role `owner` sudah ada di semua dropdown/filter yang relevan (UsersManagement, AppSettings, dll).

### File yang Diubah

| File | Aksi |
|------|------|
| Migration SQL | Update trigger `auto_create_owner_invoice` untuk kirim notifikasi |
| `src/pages/Dashboard.tsx` | Tambah section ringkasan keuangan untuk super_admin |

