PPDB SMK Negeri 1 Bandung

Website Penerimaan Peserta Didik Baru (PPDB) SMK Negeri 1 Bandung.

Fitur Website

- Halaman utama informasi PPDB.
- Informasi jalur penerimaan siswa.
- Registrasi dan login pengguna.
- Formulir pendaftaran calon siswa.
- Unggah dokumen persyaratan.
- Dashboard siswa untuk memantau status pendaftaran.
- Dashboard admin untuk memeriksa pendaftaran.
- Pengumuman hasil seleksi.

Teknologi yang Digunakan

- HTML
- CSS
- JavaScript
- Vite
- Supabase
- Vercel

Struktur Folder

ppdbsmkn1bandung-byadlyzaidan/
├── index.html
├── package.json
├── .env.example
├── README.md
├── .gitignore
├── src/
│   ├── style.css
│   └── main.js
└── supabase/
    └── schema.sql

Persiapan Proyek

1. Buat proyek baru di Supabase.

2. Buka menu SQL Editor di Supabase.

3. Jalankan kode dari file "supabase/schema.sql" pada proyek Supabase yang baru.

4. Siapkan URL proyek dan publishable key atau anon key Supabase.

5. Masukkan variabel lingkungan berikut di pengaturan proyek Vercel:
   
   - "VITE_SUPABASE_URL"
   - "VITE_SUPABASE_ANON_KEY"

6. Hubungkan repositori GitHub ke Vercel.

7. Gunakan pengaturan build Vite untuk membangun website.

Menjalankan Proyek Secara Lokal

Pastikan Node.js sudah terpasang. Kemudian jalankan perintah berikut di terminal:

npm install
npm run dev

Untuk menguji proses build:

npm run build

Keamanan

- Jangan mengunggah file ".env" yang berisi informasi rahasia ke GitHub.
- Jangan menaruh service role key atau secret key Supabase di kode frontend.
- Atur Row Level Security (RLS) untuk melindungi data pendaftar.
- Uji login, pendaftaran, unggah dokumen, dan akses admin sebelum website digunakan secara resmi.

Status Proyek

Proyek ini masih dalam tahap pengembangan. Seluruh fitur perlu diuji dan diverifikasi sebelum digunakan untuk proses penerimaan peserta didik baru secara resmi.
