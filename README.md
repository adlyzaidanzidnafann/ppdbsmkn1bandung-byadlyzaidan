PPDB SMK Negeri 1 Bandung

Website Penerimaan Peserta Didik Baru (PPDB) SMK Negeri 1 Bandung.

Fitur

- Halaman utama informasi PPDB.
- Informasi jalur penerimaan.
- Registrasi dan login pengguna.
- Formulir pendaftaran calon siswa.
- Unggah dokumen persyaratan.
- Dashboard siswa untuk memantau status pendaftaran.
- Dashboard admin untuk memeriksa pendaftaran.
- Pengumuman hasil seleksi.

Teknologi

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

Persiapan

1. Buat proyek Supabase.
2. Jalankan isi "supabase/schema.sql" melalui SQL Editor Supabase pada proyek baru.
3. Siapkan URL proyek dan publishable key atau anon key Supabase.
4. Atur variabel lingkungan di Vercel:
   - "VITE_SUPABASE_URL"
   - "VITE_SUPABASE_ANON_KEY"
5. Hubungkan repositori GitHub ke Vercel.
6. Gunakan perintah "npm run build" untuk menguji proses build.

Menjalankan Secara Lokal

Instal Node.js terlebih dahulu, lalu jalankan:

npm install
npm run dev

Catatan Keamanan

- Jangan mengunggah file ".env" yang berisi rahasia ke GitHub.
- Jangan menaruh service role key atau secret key Supabase di kode frontend.
- Uji autentikasi, hak akses, unggahan dokumen, dan alur seleksi sebelum digunakan secara resmi.

Status Proyek

Proyek masih dalam tahap pengembangan dan memerlukan pengujian sebelum digunakan untuk penerimaan siswa secara resmi.
