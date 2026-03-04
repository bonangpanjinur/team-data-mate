

## Plan: Filter Data per User & Perbaikan Komisi

### Ringkasan
1. Dashboard & GroupDetail: role non-super_admin hanya melihat data yang mereka input (`created_by = user.id`)
2. Komisi: tambah kolom "Tanggal Cair" dan keterangan transfer yang lebih jelas

---

### 1. Dashboard — Filter data milik sendiri
**File: `src/pages/Dashboard.tsx`**

- `fetchStats`: untuk non-super_admin, query `data_entries` count ditambah `.eq("created_by", user.id)`
- `fetchChartData`: kedua query `data_entries` (status & group) ditambah filter `.eq("created_by", user.id)` untuk non-super_admin
- `fetchRecentEntries`: ditambah filter `.eq("created_by", user.id)` untuk non-super_admin
- super_admin tetap melihat semua data

### 2. GroupDetail — Filter entri milik sendiri
**File: `src/pages/GroupDetail.tsx`**

- `fetchEntries` (line ~109-128): untuk role selain `super_admin`, tambah `.eq("created_by", user.id)` pada query
- Realtime subscription (line ~364-395): pada INSERT event, cek `payload.new.created_by === user.id` sebelum menambah ke state (untuk non-super_admin)
- Ini memastikan lapangan/nib/admin_input hanya melihat data inputan sendiri dalam group

### 3. Komisi — Perbaikan UI
**File: `src/pages/Komisi.tsx`**

- Tambah kolom "Tanggal Cair" di tabel riwayat, menampilkan `paid_at` yang diformat saat status = `paid`
- Tambah info tanggal transfer terakhir pada card "Sudah Cair" (ambil `paid_at` terbaru dari komisi yang sudah paid)
- Export CSV: tambah kolom "Tanggal Cair"

### Tidak ada perubahan database
Semua kolom yang dibutuhkan sudah ada. Hanya perubahan frontend.

