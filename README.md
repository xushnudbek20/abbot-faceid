# Xpert FaceID — Kirish / Chiqish (liveness check-in)

Xodimlar uchun **FaceID (liveness)** asosida ish kirish/chiqishini qayd etuvchi ilova.
VisionHR (`vision-hr-front`) dagi liveness tizimidan (MediaPipe Face Detection) ko'chirilgan,
mustaqil **Vite + Vue 3 + TypeScript + Tailwind** loyihasi sifatida qayta qurilgan.

## Ishlash tartibi

1. Xodim **login/parol** bilan kiradi (`POST /auth/login`).
2. Profil va ish holati ko'rsatiladi (`GET /auth/me`).
3. **ISHNI BOSHLASH / YAKUNLASH** tugmasi kamerani ochadi.
4. MediaPipe yuzni aniqlaydi → liveness bosqichlari (boshni burish, ramkaga joylashish, barqarorlik).
5. Rasm avtomatik olinadi → xodim tasdiqlaydi → `POST /hr/in-outs` (multipart: `type`, `photo`, `warehouse_id?`, `comment?`).

> `/hr/in-outs` autentifikatsiya qilingan foydalanuvchining xodimi (`auth()->user()->employee`) bo'yicha yozadi — shuning uchun har bir xodim o'z hisobi bilan kiradi.

## Sozlash

```bash
cp .env.example .env   # kerak bo'lsa API manzilini o'zgartiring
pnpm install
pnpm dev               # http://localhost:5180
pnpm build             # dist/
```

`.env`:

| O'zgaruvchi | Tavsif | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API (xpert-api) | `https://api.ezgutech.uz/api/v1` |
| `VITE_STORAGE_URL` | Rasm/storage bazaviy URL | `https://api.ezgutech.uz` |

## Tuzilma

```
src/
  api.ts                     ofetch klienti (baseURL + Bearer token)
  auth.ts                    token/user saqlash (localStorage)
  config/liveness.ts         liveness konfiguratsiyasi
  types/liveness.ts          tiplar
  utils/imageProcessing.ts   kadr olish / siqish / dataURL
  composables/
    useCamera.ts             getUserMedia
    useMediaPipe.ts          @mediapipe/face_detection
    useLivenessDetection.ts  liveness holat-mashinasi
  components/
    FaceOverlay.vue          ramka/masofa ko'rsatkichi
    LivenessInstructions.vue ko'rsatma matni
    LivenessCamera.vue       kamera + liveness + yuborish
  pages/
    Login.vue
    CheckIn.vue
```

## Kamera talablari

- Kamera faqat **HTTPS** yoki `localhost` da ishlaydi (brauzer talabi).
- MediaPipe modeli `cdn.jsdelivr.net` dan yuklanadi (internet kerak).

## Eslatma

- Bu ilova **yuzni taniydi emas** — u *liveness* (tiriklik/anti-spoofing) tekshiradi va rasmni backendga yuboradi. Kimligini backend autentifikatsiya token orqali biladi.
- VisionHR `location_id` yuboradi; xpert-api esa `warehouse_id` (ixtiyoriy) kutadi — shu moslashtirildi.
