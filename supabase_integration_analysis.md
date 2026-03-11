# Analisis Kebutuhan Integrasi Supabase Eksternal untuk `team-data-mate`

Berdasarkan analisis repositori `bonangpanjinur/team-data-mate`, berikut adalah identifikasi kebutuhan dan penyesuaian file yang diperlukan untuk menghubungkan aplikasi dengan instansi Supabase eksternal.

## 1. Konfigurasi Klien Supabase

File `src/integrations/supabase/client.ts` bertanggung jawab untuk menginisialisasi klien Supabase. Konfigurasi ini mengambil variabel lingkungan untuk URL dan kunci Supabase.

```typescript
// src/integrations/supabase/client.ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

**Penyesuaian yang Diperlukan:**

*   Pastikan variabel lingkungan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` diatur dengan benar di lingkungan deployment Anda (misalnya, Vercel, seperti yang sudah Anda lakukan) dan juga di lingkungan pengembangan lokal Anda (file `.env`).

## 2. Variabel Lingkungan

File `.env.example` menunjukkan variabel lingkungan yang diharapkan oleh aplikasi.

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

**Penyesuaian yang Diperlukan:**

*   Buat file `.env` di root proyek Anda (jika belum ada) dan isi dengan nilai-nilai dari instansi Supabase eksternal Anda. Contoh:

    ```
    VITE_SUPABASE_URL=https://[your-external-supabase-project-id].supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=[your-external-supabase-anon-key]
    ```

*   Variabel `VITE_SUPABASE_PROJECT_ID` yang Anda sebutkan di Vercel tidak secara langsung digunakan dalam `client.ts` untuk inisialisasi klien Supabase, tetapi mungkin digunakan di tempat lain atau untuk tujuan internal Vercel. Pastikan `VITE_SUPABASE_URL` yang Anda gunakan di Vercel sesuai dengan URL proyek Supabase eksternal Anda.

## 3. Skema Database (Tipe)

File `src/integrations/supabase/types.ts` berisi definisi tipe TypeScript untuk skema database Supabase Anda. File ini kemungkinan besar dihasilkan secara otomatis oleh Supabase CLI.

**Penyesuaian yang Diperlukan:**

*   Setelah menghubungkan proyek lokal Anda ke Supabase eksternal, Anda perlu meregenerasi file `types.ts` ini agar sesuai dengan skema database Supabase eksternal Anda. Ini penting untuk menjaga konsistensi tipe data di seluruh aplikasi. Anda biasanya dapat melakukannya dengan perintah Supabase CLI seperti `supabase gen types typescript --project-id 
[your-project-id] > src/integrations/supabase/types.ts` atau yang serupa, tergantung pada setup Anda.

## 4. Supabase Edge Functions

Direktori `supabase/functions` berisi Supabase Edge Functions (berbasis Deno) yang digunakan untuk logika backend tertentu, seperti `create-user`, `delete-user`, `download-entries`, `reset-password`, `setup-admin`, dan `update-user-role`.

Contoh dari `supabase/functions/create-user/index.ts` menunjukkan bahwa fungsi-fungsi ini menggunakan variabel lingkungan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` untuk menginisialisasi klien Supabase dengan hak akses admin.

```typescript
// supabase/functions/create-user/index.ts
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
```

**Penyesuaian yang Diperlukan:**

*   Pastikan bahwa `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` diatur sebagai variabel lingkungan di lingkungan deployment Edge Functions Anda (misalnya, di dashboard Supabase atau Vercel jika Anda mendeploy fungsi-fungsi ini di sana). `SUPABASE_SERVICE_ROLE_KEY` adalah kunci yang sangat sensitif dan harus dijaga kerahasiaannya.
*   Jika Anda mendeploy Edge Functions ini secara terpisah (misalnya, di Vercel Functions atau platform serverless lainnya), Anda perlu memastikan bahwa variabel lingkungan ini tersedia di sana.

## 5. Migrasi Database

Direktori `supabase/migrations` berisi file-file SQL yang mendefinisikan skema database Anda. File-file ini digunakan oleh Supabase CLI untuk menerapkan perubahan skema ke database Anda.

**Penyesuaian yang Diperlukan:**

*   Saat menghubungkan ke Supabase eksternal, Anda perlu memastikan bahwa skema database di instansi Supabase eksternal Anda cocok dengan migrasi yang ada di repositori ini. Anda dapat menggunakan Supabase CLI untuk menerapkan migrasi ini ke database eksternal Anda. Perintah umumnya adalah `supabase migration up` setelah mengkonfigurasi proyek lokal Anda untuk menunjuk ke instansi Supabase eksternal.
*   Penting untuk berhati-hati saat menerapkan migrasi ke database yang sudah ada untuk menghindari kehilangan data atau konflik skema.

## Ringkasan Penyesuaian yang Harus Dilakukan

Untuk berhasil menghubungkan aplikasi `team-data-mate` dengan Supabase eksternal, Anda perlu melakukan langkah-langkah berikut:

1.  **Konfigurasi Variabel Lingkungan Lokal:** Buat file `.env` di root proyek dengan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` yang menunjuk ke instansi Supabase eksternal Anda.
2.  **Regenerasi Tipe Database:** Setelah mengkonfigurasi proyek lokal Anda ke Supabase eksternal, regenerasi file `src/integrations/supabase/types.ts` menggunakan Supabase CLI untuk mencerminkan skema database eksternal Anda.
3.  **Konfigurasi Variabel Lingkungan Edge Functions:** Pastikan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` diatur dengan benar di lingkungan deployment Edge Functions Anda (baik di Supabase atau platform serverless lainnya).
4.  **Terapkan Migrasi Database:** Gunakan Supabase CLI untuk menerapkan migrasi SQL yang ada di `supabase/migrations` ke instansi Supabase eksternal Anda. Lakukan ini dengan hati-hati, terutama jika database sudah memiliki data.

Dengan mengikuti langkah-langkah ini, aplikasi Anda seharusnya dapat terhubung dan berinteraksi dengan instansi Supabase eksternal Anda dengan benar.

---
