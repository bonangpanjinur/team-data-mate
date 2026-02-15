

## Aplikasi Input Data Halal - Group Based

### Ringkasan
Aplikasi input data berbasis grup dengan 4 role (Super Admin, Admin, Lapangan, NIB). Data dikumpulkan secara kolaboratif dalam "Group Halal" yang dibuat Super Admin, dimana setiap role mengisi bagian form sesuai wewenangnya. Form Lapangan bisa dishare ke orang lain tanpa login via link & QR Code.

---

### 1. Autentikasi & Manajemen User
- Login page (email + password)
- Super Admin membuat akun user dan assign role (Admin / Lapangan / NIB)
- Dashboard Super Admin: daftar semua user, buat user baru, edit, hapus
- Tidak ada registrasi publik

### 2. Group Halal (Super Admin)
- Super Admin bisa membuat banyak Group Halal (dinamis)
- Setiap group memiliki nama dan anggota (Admin, Lapangan, NIB yang di-assign)
- Super Admin bisa menambah/menghapus anggota dari group
- Super Admin melihat semua data lengkap per group
- Super Admin juga bisa mengisi semua field form

### 3. Form Input Data (Per Entri dalam Group)
Setiap entri data dalam group memiliki field berikut:
- **Nama** (teks)
- **Foto KTP** (foto langsung dari kamera / upload file)
- **Alamat** (ketik manual atau ambil lokasi otomatis via OpenStreetMap)
- **Nomor HP** (teks)
- **NIB** (upload PDF / foto)
- **Foto Produk** (foto langsung / upload)
- **Foto Verifikasi Lapangan** (foto langsung / upload)

Akses per role:
| Field | Super Admin | Admin | Lapangan | NIB |
|---|---|---|---|---|
| Nama | ✅ | ✅ | ✅ | ❌ |
| Foto KTP | ✅ | ✅ | ✅ | ❌ |
| Alamat | ✅ | ✅ | ✅ | ❌ |
| Nomor HP | ✅ | ✅ | ✅ | ❌ |
| NIB | ✅ | ✅ | ❌ | ✅ |
| Foto Produk | ✅ | ✅ | ❌ | ❌ |
| Foto Verifikasi | ✅ | ✅ | ❌ | ❌ |

Data bersifat kolaboratif: field yang diisi Lapangan akan terlihat oleh Admin saat membuka entri yang sama.

### 4. Share Form (Role Lapangan)
- Lapangan bisa generate **link unik + QR Code** untuk form inputnya
- Orang lain bisa mengisi form (Nama, KTP, Alamat, No HP) **tanpa login**
- Data yang diisi masuk ke akun Lapangan yang membagikan link
- Link bisa dinonaktifkan kapan saja

### 5. Download Data (Super Admin & Admin)
- Download per entri: otomatis jadi **folder** berisi semua file (KTP, NIB PDF, foto produk, foto verifikasi)
- Download banyak sekaligus: pilih beberapa entri → download sebagai **ZIP** berisi folder per nama
- Bisa pilih satu per satu atau pilih semua
- Nama folder = nama dari data entri tersebut

### 6. Dashboard per Role
- **Super Admin**: Kelola group, kelola user, lihat semua data, download
- **Admin**: Lihat group yang di-assign, isi form lengkap, download data
- **Lapangan**: Lihat group yang di-assign, isi field yang diizinkan, share form
- **NIB**: Lihat group yang di-assign, hanya input NIB

### 7. Desain
- Simple & clean, minimalis
- Mobile-friendly (karena Lapangan kemungkinan pakai HP di lapangan)
- Navigasi sidebar untuk desktop, bottom nav untuk mobile

### 8. Backend (Supabase / Lovable Cloud)
- Database untuk users, groups, group members, data entries
- File storage untuk foto KTP, NIB, foto produk, foto verifikasi
- Edge function untuk generate ZIP download
- Role-based access control (RLS)
- Public form endpoint untuk shared forms (tanpa login)

