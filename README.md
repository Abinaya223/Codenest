# CodeNest — Coding Learning Platform

CodeNest adalah platform belajar coding sederhana dengan tampilan pixel-art. Project ini menggunakan HTML, CSS, JavaScript, Node.js, Express, dan MySQL (Aiven).

## Fitur

- Landing page dan katalog course.
- Filter kategori dan pencarian course.
- Detail course dan daftar lesson.
- Materi pembelajaran + contoh kode.
- Quiz pilihan ganda dengan feedback jawaban.
- Register dan login menggunakan JWT + bcrypt.
- Progress lesson tersimpan per user di MySQL.
- Dashboard progress belajar.
- Responsive layout untuk desktop dan mobile.

## Teknologi

- Frontend: HTML, CSS, Vanilla JavaScript.
- Backend: Node.js + Express.
- Database: MySQL di Aiven.
- Authentication: JSON Web Token + bcryptjs.

## Persiapan

Pastikan sudah menginstal Node.js (disarankan versi LTS) dan npm.

1. Extract ZIP.
2. Buka folder project di VS Code.
3. Jalankan `npm install`.
4. Duplikat `.env.example`, lalu ubah namanya menjadi `.env`.
5. Isi konfigurasi Aiven MySQL di `.env`.
6. Import `database/schema.sql` ke service MySQL Aiven.
7. Jalankan `npm run dev`.
8. Buka `http://localhost:3000`.

## Konfigurasi Aiven MySQL

Di Aiven Console:
1. Buka service MySQL.
2. Masuk ke bagian Connection information.
3. Salin Host, Port, User, Password, dan Database name ke `.env`.
4. Aktifkan SSL. Jika Aiven menyediakan CA certificate, unduh CA certificate dan sesuaikan konfigurasi SSL pada `server.js` untuk verifikasi sertifikat sesuai petunjuk Aiven.

Contoh `.env`:

```env
PORT=3000
JWT_SECRET=buat_secret_random_panjang
FRONTEND_ORIGIN=http://localhost:3000
DB_HOST=your-aiven-host.aivencloud.com
DB_PORT=12345
DB_USER=avnadmin
DB_PASSWORD=your-password
DB_NAME=defaultdb
DB_SSL=true
```

Jangan commit file `.env` ke GitHub dan jangan membagikan password database.

## Import database

Cara paling mudah menggunakan MySQL Workbench:
1. Buat koneksi baru menggunakan detail Aiven.
2. Atur SSL sesuai detail koneksi Aiven.
3. Buka `database/schema.sql`.
4. Jalankan seluruh query.

Jika database `codenest` sudah dibuat, aplikasi tetap bisa menggunakan database itu. Jika ingin menggunakan database bawaan Aiven `defaultdb`, hapus dua baris `CREATE DATABASE ...` dan `USE codenest;` dari bagian awal SQL, lalu pastikan `.env` menggunakan `DB_NAME=defaultdb`.

## Endpoint API

| Method | Endpoint | Keterangan | Auth |
|---|---|---|---|
| GET | `/api/health` | Cek koneksi database | Tidak |
| POST | `/api/auth/register` | Daftar akun | Tidak |
| POST | `/api/auth/login` | Login | Tidak |
| GET | `/api/auth/me` | Data user aktif | Ya |
| GET | `/api/courses` | Semua course | Tidak |
| GET | `/api/courses/:slug` | Detail course + lesson | Tidak |
| GET | `/api/lessons/:id` | Materi lesson + quiz | Tidak |
| POST | `/api/lessons/:id/complete` | Simpan lesson selesai | Ya |
| GET | `/api/progress` | Progress user | Ya |
| POST | `/api/quizzes/:id/answer` | Cek jawaban quiz | Ya |

Untuk endpoint ber-auth, kirim header:
`Authorization: Bearer <token>`

## Struktur folder

```text
codenest/
├── database/
│   └── schema.sql
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

## Catatan

- Materi course adalah materi pengantar sederhana dan dapat dikembangkan.
- Website memerlukan koneksi database Aiven yang valid untuk register/login dan penyimpanan progress.
- API publik tidak dibutuhkan; semua konten pembelajaran dibaca dari database.
- Quiz pada versi awal menggunakan pilihan ganda.
- Project ini merupakan starter project pembelajaran, belum mencakup fitur admin/CMS untuk mengelola materi dari dashboard.
