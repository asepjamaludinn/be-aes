<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">Encryptly Backend API</h1>

<p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications, customized for <b>Secure Messaging with End-to-End Encryption (E2EE) & MITM Simulation</b>.</p>

<p align="center">
    <img src="https://img.shields.io/badge/built%20with-NestJS-red" alt="NestJS">
    <img src="https://img.shields.io/badge/ORM-Prisma-blue" alt="Prisma">
    <img src="https://img.shields.io/badge/Realtime-Socket.io-black" alt="Socket.io">
    <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
    <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
</p>

## 📖 Overview

**Encryptly Backend** adalah server relay untuk aplikasi pesan aman yang mengimplementasikan **Hybrid Cryptography (AES-256 + RSA-2048)**. Backend ini dirancang dengan prinsip _Zero-Knowledge Architecture_, di mana server tidak pernah mengetahui isi pesan asli (plaintext) pengguna.

Fitur unggulan proyek ini adalah **Modul Simulasi Man-In-The-Middle (MITM)**, yang memungkinkan demonstrasi serangan keamanan dan intersepsi paket secara realtime untuk tujuan edukasi.

---

## Tech Stack

- **Framework:** [NestJS](https://nestjs.com/) (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL (via [Supabase](https://supabase.com/))
- **ORM:** Prisma
- **Realtime Engine:** Socket.io
- **Authentication:** JWT (JSON Web Tokens) & Bcrypt
- **Validation:** class-validator & class-transformer

---

## Prerequisites

Sebelum menjalankan aplikasi, pastikan Anda telah menginstal:

- Node.js (v18.x atau terbaru)
- npm atau yarn
- Akun Supabase (untuk database PostgreSQL)

---

## Installation & Setup

1.  **Clone Repository**

    ```bash
    git clone [https://github.com/username/be-aes.git](https://github.com/username/be-aes.git)
    cd be-aes
    ```

2.  **Install Dependencies**

    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Duplikat file `.env.example` menjadi `.env`:

    ```bash
    cp .env.example .env
    ```

    Isi variabel berikut di dalam file `.env`:
    - `DATABASE_URL` & `DIRECT_URL`: Dari Dashboard Supabase (Transaction Pooler & Session Mode).
    - `SUPABASE_URL` & `SUPABASE_KEY`: Dari API Settings Supabase (Storage & Auth).
    - `JWT_SECRET`: Generate string acak (contoh: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
    - `FRONTEND_URL`: URL frontend Anda (misal: `http://localhost:3000`).

4.  **Database Migration**
    Sinkronisasi skema Prisma ke Database:

    ```bash
    npx prisma generate
    npx prisma db push
    ```

5.  **Run Seeding (Optional)**
    Membuat user default (Admin & Hacker):

    ```bash
    npx prisma db seed
    ```

6.  **Start Server**

    ```bash
    # Development Mode
    npm run start:dev

    # Production Mode
    npm run build
    npm run start:prod
    ```

    Server akan berjalan di `http://localhost:3001`.

---

## Security Architecture

Backend ini menggunakan skema **Hybrid Encryption**:

1.  **Key Exchange (RSA-2048):**
    - Setiap user memiliki pasangan kunci (Public & Private).
    - **Public Key** dikirim ke Server saat Register/Login.
    - **Private Key** TETAP di sisi Client (Browser/LocalStorage) dan tidak pernah dikirim ke server.

2.  **Message Encryption (AES-256-GCM):**
    - Pesan dienkripsi di sisi Client menggunakan _Symmetric Key_ (AES) yang dibuat random.
    - Kunci AES tersebut kemudian dienkripsi (_wrapped_) menggunakan **Public Key Penerima**.

3.  **Storage:**
    - Server hanya menyimpan: `encryptedContent` (Ciphertext), `iv`, dan `wrappedKey`.

---

## API Documentation (REST)

Base URL: `/api`

### Users (`/api/users`)

| Method   | Endpoint      | Description                           | Auth Required | Role Check |
| :------- | :------------ | :------------------------------------ | :------------ | :--------- |
| `POST`   | `/register`   | Mendaftar user baru (Send Public Key) | No            | -          |
| `POST`   | `/verify-otp` | Verifikasi nomor HP via OTP           | No            | -          |
| `POST`   | `/login`      | Login user & update Public Key        | No            | -          |
| `GET`    | `/search`     | Mencari user by Phone (`?phone=...`)  | Yes           | -          |
| `GET`    | `/:id/key`    | Mengambil Public Key user lain        | Yes           | -          |
| `GET`    | `/`           | Mengambil list semua user (terdaftar) | Yes           | -          |
| `PATCH`  | `/:id`        | Update profile (Avatar/Username)      | Yes           | -          |
| `DELETE` | `/:id`        | Menghapus user secara permanen        | Yes           | ADMIN Only |

### Chat & System Logs (`/api/chat`)

| Method   | Endpoint                 | Description                             | Auth Required |
| :------- | :----------------------- | :-------------------------------------- | :------------ |
| `GET`    | `/conversations/:userId` | List history chat user                  | Yes           |
| `GET`    | `/:roomId`               | Mengambil semua pesan dalam room        | Yes           |
| `GET`    | `/stats/dashboard`       | **Admin:** Statistik pesan & serangan   | Yes           |
| `GET`    | `/logs/system`           | **Admin:** Mengambil log aktivitas/MITM | Yes           |
| `DELETE` | `/logs/system`           | **Admin:** Menghapus semua log sistem   | Yes           |

---

## WebSocket Events (Socket.io)

Digunakan untuk komunikasi realtime, monitoring admin, dan fitur MITM.

### Client Emits (Frontend -> Backend)

#### **General Events**

- `join_room`: `{ roomId: string }`
  - Masuk ke room spesifik untuk mendengarkan pesan.
- `send_message`: `CreateMessageDto`
  - Mengirim pesan terenkripsi. Payload mencakup `encryptedContent`, `iv`, `wrappedKey`.
- `report_tampering_attempt`: `{ roomId, senderId, reason }`
  - **Security:** Melapor ke server jika client mendeteksi pesan telah dimodifikasi (signature mismatch/decryption fail).

#### **Admin & Hacker Events**

- `hacker_join`: `(void)`
  - Masuk ke dashboard monitoring (Hacker Room).
- `admin_join`: `(void)`
  - Masuk ke dashboard monitoring logs (Admin Room).
- `toggle_mitm`: `{ active: boolean }`
  - (Khusus Hacker) Mengaktifkan/mematikan intersepsi pesan.
- `hacker_forward_message`: `CreateMessageDto`
  - (Khusus Hacker) Meneruskan pesan yang ditahan (baik asli maupun yang sudah dimodifikasi) ke penerima.

### Client Listens (Backend -> Frontend)

- `receive_message`: `MessageObject`
  - Menerima pesan baru secara realtime.
- `update_conversation_list`: `MessageObject + senderAvatar`
  - Notifikasi realtime untuk memperbarui list percakapan di sidebar.
- `mitm_status`: `{ active: boolean }`
  - Status apakah mode serangan MITM sedang aktif.
- `intercepted_packet`: `MessageObject`
  - (Khusus Hacker) Menerima paket yang ditahan server saat MITM aktif.
- `metadata_log`: `{ sender, recipient, size, timestamp }`
  - (Khusus Hacker) Log metadata trafik yang lewat.
- `security_alert`: `{ id, details, timestamp }`
  - (Khusus Admin) Peringatan realtime jika ada laporan tampering dari user.
- `traffic_log`: `{ id, room_id, size }`
  - (Khusus Admin) Log aktivitas pesan normal.

---

## Man-In-The-Middle (MITM) Simulation Flow

Fitur ini dibuat untuk simulasi keamanan siber.

1.  **Intercept (Hacker):**
    - Hacker mengaktifkan toggle **"Intercept Traffic"**.
    - Server mengaktifkan flag `IS_MITM_ACTIVE`.
2.  **Hold (Server):**
    - User A mengirim pesan ke User B.
    - Server mendeteksi flag aktif, **menahan** pesan, dan menyimpannya di memori sementara.
    - Pesan di-emit ke Hacker via event `intercepted_packet`.
3.  **Tamper (Hacker):**
    - Hacker melihat pesan terenkripsi di dashboard.
    - Hacker bisa memodifikasi payload (`encryptedContent`) lalu mengirim event `hacker_forward_message`.
4.  **Detect (User B):**
    - User B menerima pesan yang sudah dimodifikasi.
    - Client User B mencoba mendekripsi. Jika integritas rusak (atau HMAC salah), client mengirim `report_tampering_attempt`.
    - Server mencatat laporan ini sebagai `security_alert` di dashboard Admin.

---

## Project Structure

```bash
src/
├── app.module.ts            # Root Module (Config Global)
├── main.ts                  # Entry Point (CORS, Pipes, Port)
├── chat/                    # Chat Module
│   ├── chat.gateway.ts      # WebSocket Logic (MITM & Realtime)
│   ├── chat.controller.ts   # Chat History & Admin Logs/Stats
│   └── dto/
├── users/                   # Users Module
│   ├── users.service.ts     # Business Logic (Auth, OTP, CRUD)
│   ├── users.controller.ts  # REST Endpoints User
│   └── dto/
└── database/                # Prisma Module
```
