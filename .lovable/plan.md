## Rencana: Sistem Multi-Tenant Owner dengan Isolasi Data

### Pemahaman Bisnis

```text
SUPER ADMIN (Anda - Pemilik Platform)
  ├── Membuat Owner (pelanggan yang menyewa)
  ├── Set harga dinamis (per sertifikat / per group / custom per owner)
  ├── Melihat semua laporan & tagihan dari semua owner
  └── Pengaturan global platform

OWNER (Pelanggan yang Menyewa)
  ├── Punya proyek sendiri (groups) - TERISOLASI dari owner lain
 - bisa buat group banyak, tergantung kuota dari super admin
  ├── Kelola tim sendiri (admin, admin_input, nib, lapangan)
  ├── Atur akses field per role di timnya
  ├── Atur komisi tim sendiri
  ├── Bayar tagihan ke platform
  └── Lihat laporan keuangan sendiri

TIM OWNER (admin, admin_input, nib, lapangan)
  ├── Hanya akses data owner mereka
  └── Dapat komisi dari owner mereka
```

&nbsp;

### Perubahan Database

**1. Tabel `owner_teams` (baru) - Hubungan tim ke owner:**

```sql
CREATE TABLE owner_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(owner_id, user_id)
);
```

**2. Tabel `owner_field_access` (baru) - Field access per owner:**

```sql
CREATE TABLE owner_field_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  role app_role NOT NULL,
  field_name text NOT NULL,
  can_view boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  UNIQUE(owner_id, role, field_name)
);
```

**3. Tabel `owner_pricing` (baru) - Harga dinamis per owner:**

```sql
CREATE TABLE owner_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid, -- NULL = default global
  pricing_type text NOT NULL, -- 'per_certificate', 'per_group', 'monthly', 'custom'
  amount integer NOT NULL DEFAULT 0,
  description text,
  updated_at timestamptz DEFAULT now()
);
```

**4. RLS untuk isolasi data:**

- Tim hanya akses data groups yang `owner_id` = owner mereka
- Owner hanya lihat tim, entries, dan groups miliknya
- Super admin akses semua

### Perubahan UI

**1. Owner Bisa Buat Group:**

- `Groups.tsx`: Owner bisa create/edit group (saat ini hanya super_admin)
- Group otomatis di-assign ke owner yang membuat

**2. Halaman Kelola Tim Owner (`/owner-team`):**

- Owner buat user dengan role admin/admin_input/nib/lapangan
- User otomatis terhubung ke owner tersebut
- Tim tidak bisa akses owner lain

**3. Halaman Akses Field Owner (`/owner-field-access`):**

- Mirip tab Akses di AppSettings, tapi khusus untuk owner
- Owner atur view/edit per field per role untuk timnya

**4. Halaman Pricing (Super Admin):**

- Tab baru di AppSettings: "Harga Owner"
- Set harga default dan per-owner
- Pilihan: per sertifikat, per group, bulanan, custom

**5. Dashboard Terisolasi:**

- Owner + tim hanya lihat data owner mereka
- Query difilter berdasarkan owner context

### File yang Diubah/Dibuat


| File                             | Aksi                                                               |
| -------------------------------- | ------------------------------------------------------------------ |
| Migration SQL                    | Buat: owner_teams, owner_field_access, owner_pricing, RLS policies |
| `src/contexts/AuthContext.tsx`   | Edit: tambah `ownerId` untuk tim (nullable)                        |
| `src/hooks/useFieldAccess.ts`    | Edit: ambil field access dari owner jika user adalah tim           |
| `src/pages/Groups.tsx`           | Edit: owner bisa buat group                                        |
| `src/pages/Dashboard.tsx`        | Edit: filter data berdasarkan owner context                        |
| `src/pages/OwnerTeam.tsx`        | Buat: owner kelola tim                                             |
| `src/pages/OwnerFieldAccess.tsx` | Buat: owner atur akses field tim                                   |
| `src/pages/AppSettings.tsx`      | Edit: tambah tab Harga Owner (super_admin)                         |
| `src/components/AppLayout.tsx`   | Edit: tambah nav untuk owner (Kelola Tim, Akses Field)             |
| `src/App.tsx`                    | Edit: tambah route baru                                            |


### Alur Kerja

```text
1. Super Admin buat Owner baru di Kelola User
2. Super Admin set harga untuk owner tersebut (atau pakai default)
3. Owner login -> buat tim (admin, admin_input, nib, lapangan)
4. Owner atur akses field untuk setiap role
5. Owner buat Group Halal
6. Tim kerja -> data terisolasi per owner
7. Sertifikat selesai -> invoice ke owner
8. Owner bayar -> super admin konfirmasi
```

### Prioritas Implementasi

1. **Database**: owner_teams, owner_field_access, owner_pricing + RLS
2. **Context**: Tambah ownerId ke AuthContext
3. **Owner Team Management**: Halaman kelola tim
4. **Owner Field Access**: Halaman atur akses
5. **Group Creation**: Owner bisa buat group
6. **Dashboard Isolation**: Filter data per owner
7. **Dynamic Pricing**: Super admin set harga per owner