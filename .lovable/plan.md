

## Analisis Bug

### Bug 1: Delete user gagal (400 error)
**Penyebab**: `data_entries` memiliki kolom `created_by`, `pic_user_id`, dan `umkm_user_id` yang mereferensikan user. Edge function `delete-user` tidak membersihkan referensi ini sebelum menghapus user dari `auth.users`, sehingga terjadi FK constraint error.

Dari network request: user `b9e5d426-e264-4a35-b350-9954b0defadd` (Siti Admin Input) memiliki `data_entries` dengan `created_by` mengarah ke dia.

**Fix**: Update `delete-user/index.ts` untuk nullify/delete referensi di `data_entries` (`created_by`, `pic_user_id`, `umkm_user_id`) dan `audit_logs` (`changed_by`) sebelum menghapus user.

### Bug 2: User baru tidak muncul di list
**Penyebab**: `fetchUsers()` dipanggil langsung setelah `create-user` berhasil, tapi profile dibuat oleh trigger `handle_new_user` yang mungkin belum selesai. Juga, `supabase.functions.invoke` tidak throw error pada non-2xx - perlu cek `data.error` juga. Selain itu, perlu delay kecil sebelum fetch.

**Fix**: Tambah delay kecil (500ms) sebelum `fetchUsers()` setelah create, agar trigger database punya waktu membuat profile.

### Rencana Implementasi

**File 1: `supabase/functions/delete-user/index.ts`**
- Tambah nullify `data_entries.created_by`, `data_entries.pic_user_id`, `data_entries.umkm_user_id` sebelum delete
- Tambah nullify `audit_logs.changed_by`
- Tambah delete `entry_photos` terkait entries user
- Tambah error logging yang lebih detail

**File 2: `src/pages/UsersManagement.tsx`**
- Tambah delay sebelum `fetchUsers()` setelah create user berhasil
- Fix error handling pada `handleDelete` (cek `data?.error` juga)
- Tambah `DialogDescription` untuk fix warning

