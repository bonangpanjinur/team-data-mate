# Team Data Mate

Aplikasi input data halal berbasis grup.

## Teknologi

- Vite
- React
- TypeScript
- Tailwind CSS
- Supabase
- Vercel

## Cara Menjalankan Secara Lokal

1. Clone repositori ini.
2. Instal dependensi:
   ```bash
   pnpm install
   ```
3. Buat file `.env` di root direktori dan tambahkan variabel berikut:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   ```
4. Jalankan aplikasi:
   ```bash
   pnpm dev
   ```

## Deployment di Vercel

Aplikasi ini siap di-deploy ke Vercel. Pastikan Anda telah mengatur Environment Variables berikut di dashboard Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
