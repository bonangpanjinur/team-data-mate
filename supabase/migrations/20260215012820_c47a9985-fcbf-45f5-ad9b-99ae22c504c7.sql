-- Create entry status enum
CREATE TYPE public.entry_status AS ENUM ('belum_lengkap', 'lengkap', 'terverifikasi');

-- Add status column to data_entries
ALTER TABLE public.data_entries 
ADD COLUMN status public.entry_status NOT NULL DEFAULT 'belum_lengkap';
