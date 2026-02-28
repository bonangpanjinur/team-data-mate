

## Analisis Bug & Rencana Perbaikan

### BUG 1 (KRITIS): Trigger `on_auth_user_created` MASIH belum terpasang di `auth.users`
Trigger di `data_entries` dan `profiles` sudah terpasang, tapi trigger untuk auto-create profile saat user baru dibuat **tidak ada** di `auth.users`. Ini berarti:
- `profiles` kosong (0 baris) -- user management dan add member tidak bisa jalan
- `user_roles` juga kosong (0 baris) -- tidak ada super_admin terdaftar

### BUG 2: Tidak ada user sama sekali
Tabel `profiles` dan `user_roles` kosong. Perlu dibuat akun super_admin `bpanjinur63@gmail.com` via edge function `setup-admin`.

### BUG 3: `app_settings` kosong
Tidak ada data setting (app_name, primary_color, logo_url). Upsert akan gagal jika row belum ada karena policy RESTRICTIVE pada INSERT memerlukan `has_role` check -- tapi karena `user_roles` kosong, ini juga gagal.

### BUG 4: PWA icon bawaan / placeholder
File `pwa-192x192.png` dan `pwa-512x512.png` kemungkinan masih placeholder. Favicon juga generic. PWA manifest sudah dikonfigurasi di `vite.config.ts` dengan benar termasuk `navigateFallbackDenylist`.

### BUG 5: Console warning - forwardRef
`PublicStats` component tidak di-wrap dengan `forwardRef`, menyebabkan React warning.

---

### Rencana Implementasi

#### 1. Database Migration - Pasang trigger auth.users + seed app_settings
- Attach `handle_new_user()` trigger ke `auth.users` (ON INSERT AFTER)
- Seed default `app_settings` rows (app_name, primary_color, logo_url) agar upsert tidak gagal

#### 2. Daftarkan Super Admin
- Invoke edge function `setup-admin` dengan email `bpanjinur63@gmail.com` dan password `@Bonang123`

#### 3. Backfill profiles dari auth.users yang sudah ada
- Migration SQL: INSERT INTO profiles dari auth.users ON CONFLICT DO NOTHING

#### 4. Fix minor bugs
- Perbaiki PublicStats agar tidak trigger forwardRef warning (sudah minor, tidak blocking)

### File yang diubah
- **Database migration** baru (trigger auth.users + seed app_settings + backfill profiles)
- Invoke `setup-admin` edge function untuk buat super admin

