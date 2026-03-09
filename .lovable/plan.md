

## Rencana: Sistem Owner, Komisi Berlapis, dan Laporan Keuangan

### Konteks Saat Ini
- Role yang ada: `super_admin`, `admin`, `lapangan`, `nib`, `admin_input`, `umkm`
- Komisi saat ini: flat per-entry berdasarkan role, dikelola super_admin
- Belum ada konsep "owner" dan "biaya per sertifikat"

### Konsep Bisnis Baru

```text
SUPER ADMIN (Platform)
  |
  |-- Menetapkan TARIF per sertifikat yang harus dibayar Owner
  |-- Melihat semua laporan keuangan platform
  |
OWNER (Pemilik bisnis sertifikasi)
  |
  |-- Membayar tarif per sertifikat ke platform (tagihan)
  |-- Mengatur komisi per-role untuk tim di bawahnya
  |-- Melihat laporan keuangan: pendapatan vs pengeluaran
  |
TIM (lapangan, nib, admin_input, admin)
  |
  |-- Menerima komisi dari Owner sesuai rate yang Owner tentukan
```

### Rencana Implementasi

#### 1. Database Migration

**a. Tambah role `owner` ke enum `app_role`:**
```sql
ALTER TYPE public.app_role ADD VALUE 'owner';
```

**b. Tabel `certificate_fees` -- Tarif per sertifikat (diatur super_admin):**
- `id`, `amount` (integer, biaya per sertifikat selesai), `updated_by`, `updated_at`
- Satu baris saja (singleton config)

**c. Tabel `owner_invoices` -- Tagihan owner ke platform:**
- `id`, `owner_id` (uuid), `entry_id` (uuid), `group_id` (uuid), `amount` (integer), `status` (pending/paid), `period` (text), `created_at`, `paid_at`
- Otomatis dibuat saat entry mencapai `sertifikat_selesai`

**d. Modifikasi `commission_rates`:**
- Tambah kolom `owner_id` (uuid, nullable) -- null = tarif default super_admin, non-null = tarif custom owner
- Owner bisa set rate untuk role: lapangan, nib, admin_input, admin

**e. Trigger `auto_create_owner_invoice`:**
- Saat `data_entries.status` berubah ke `sertifikat_selesai`, buat invoice di `owner_invoices` untuk owner group tersebut

**f. RLS policies:**
- `certificate_fees`: super_admin manage, authenticated read
- `owner_invoices`: super_admin read all, owner read own
- `commission_rates` update: owner bisa manage rate miliknya (where `owner_id = auth.uid()`)

#### 2. Halaman Baru & Modifikasi

**a. Navigation (`AppLayout.tsx`):**
- Tambah nav untuk `owner`: Dashboard, Group Halal, Share Link, Komisi Tim, Tagihan, Laporan Keuangan

**b. Halaman Tagihan Owner (`src/pages/OwnerInvoices.tsx`):**
- List tagihan per sertifikat selesai
- Summary: total tagihan, sudah bayar, belum bayar
- Super admin bisa mark as paid
- Owner hanya lihat

**c. Halaman Komisi Tim (`src/pages/OwnerCommissionRates.tsx`):**
- Owner set rate komisi per role (lapangan, nib, admin_input, admin)
- Tidak bisa atur rate super_admin/owner

**d. Halaman Laporan Keuangan (`src/pages/FinancialReport.tsx`):**
- **Untuk Owner**: Pendapatan (total sertifikat x fee klien) vs Pengeluaran (komisi tim + tagihan platform), profit
- **Untuk Super Admin**: Total tagihan semua owner, status pembayaran, ringkasan per periode
- Chart pendapatan vs pengeluaran per bulan
- Export CSV

**e. Modifikasi `AppSettings.tsx`:**
- Tab baru "Tarif Sertifikat" (super_admin only) -- set biaya per sertifikat yang ditagihkan ke owner

**f. Modifikasi `Komisi.tsx`:**
- Owner melihat komisi yang dia keluarkan ke tim
- Super admin tetap seperti sekarang + bisa lihat semua owner

**g. Routing (`App.tsx`):**
- Tambah route: `/owner-invoices`, `/owner-rates`, `/financial-report`
- Owner mendapat akses ke halaman-halaman barunya

#### 3. Alur Bisnis Lengkap

```text
1. Super Admin set tarif sertifikat: Rp X per sertifikat selesai
2. Owner set komisi tim: lapangan=Rp A, nib=Rp B, admin_input=Rp C
3. Tim kerja -> status entry berubah -> komisi otomatis tercatat
4. Entry capai "sertifikat_selesai" -> invoice otomatis ke owner
5. Owner bayar tagihan -> super admin konfirmasi
6. Laporan keuangan:
   - Owner: total tagihan platform, total komisi tim, profit
   - Super Admin: total pendapatan dari semua owner
```

#### 4. File yang Diubah/Dibuat

| File | Aksi |
|------|------|
| Migration SQL | Buat: enum owner, certificate_fees, owner_invoices, alter commission_rates |
| `src/components/AppLayout.tsx` | Edit: tambah nav owner |
| `src/App.tsx` | Edit: tambah routes baru |
| `src/pages/OwnerInvoices.tsx` | Buat: halaman tagihan |
| `src/pages/OwnerCommissionRates.tsx` | Buat: owner atur rate tim |
| `src/pages/FinancialReport.tsx` | Buat: laporan keuangan |
| `src/pages/AppSettings.tsx` | Edit: tab tarif sertifikat |
| `src/pages/Komisi.tsx` | Edit: adaptasi untuk owner |

