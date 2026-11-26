<h1 align="center">PetaPantau</h1>
<p align="center"><b>Pemetaan Terpadu Pemantauan Keamanan Wilayah</b><br>Polda Daerah Istimewa Yogyakarta</p>

<p align="center">
  <img src="https://img.shields.io/badge/Odoo-19.0-714B67?logo=odoo&logoColor=white" alt="Odoo 19">
  <img src="https://img.shields.io/badge/versi-19.0.1.0.0-FF8A00" alt="Versi">
  <img src="https://img.shields.io/badge/lisensi-LGPL--3-blue" alt="Lisensi">
  <img src="https://img.shields.io/badge/Leaflet-ECharts-199900?logo=leaflet&logoColor=white" alt="Leaflet & ECharts">
</p>

> Modul Odoo 19 untuk pemetaan dan pemantauan keamanan wilayah: dashboard peta interaktif, data kriminalitas, bencana, lalu lintas, lokasi penting, serta pencatatan patroli lewat backend dan aplikasi mobile.

---

## Fitur

### Dashboard Peta Interaktif
- **6 mode peta**: Peta Umum, Kriminalitas, Bencana, Lalu Lintas, Patroli, dan Lokasi Penting
- **Choropleth wilayah** berbasis GeoJSON dengan drill-down **Kabupaten/Kota → Kecamatan → Desa/Kelurahan**
- KPI cards (dapat diklik), grafik ECharts, dan tabel data per mode
- Filter tahun, polres, kategori, sub kategori, status, dan rentang tanggal
- Overlay lokasi penting di semua mode, marker clustering

### Manajemen Data
| Entitas | Isi |
|---|---|
| Kriminalitas | LP A/B, kategori & sub kategori, jenis TKP, status & sub status perkara, tujuan (subdit), wilayah, koordinat |
| Bencana | Kategori, penyebab, tindak lanjut, status aktif/non aktif |
| Lalu Lintas | Kategori, jenis jalan, lokasi, penanggung jawab, status |
| Lokasi Penting | Kategori ber-ikon, alamat, kontak, koordinat |
| Patroli | Wilayah, personel, titik lokasi bertanggal + foto, status |

- **Import LP**: wizard 2 langkah untuk membaca dokumen `.docx` Laporan Polisi A/B menjadi data Kriminalitas.
- Tampilan List, Form, Pivot, Graph, dan Calendar.

### Patroli
- **Backend Odoo** — pencatatan dan monitoring patroli.
- **Aplikasi mobile PWA** `/petapantau` — Beranda (KPI & aktivitas 7 hari), daftar & input Patroli, Profil.

### Data Wilayah D.I. Yogyakarta
Terpasang otomatis saat instalasi (`data/wilayah_diy.xml`):

| Satuan | Wilayah |
|---|---|
| Polda D.I. Yogyakarta | Satuan tingkat Polda (untuk subdit) |
| Polresta Yogyakarta | Kota Yogyakarta |
| Polresta Sleman | Kabupaten Sleman |
| Polres Bantul | Kabupaten Bantul |
| Polres Kulon Progo | Kabupaten Kulon Progo |
| Polres Gunungkidul | Kabupaten Gunungkidul |

Total **5 kabupaten/kota, 78 kecamatan (masing-masing satu Polsek), 438 desa/kelurahan** beserta batas wilayah GeoJSON.
Sumber batas wilayah: [COD-AB Indonesia](https://data.humdata.org/dataset/cod-ab-idn) — Badan Pusat Statistik (BPS) via OCHA/HDX, lisensi CC BY-IGO. Desa/kelurahan disederhanakan bersama (batas bersama tetap berimpit), lalu digabung menjadi kecamatan dan kabupaten sehingga ketiga level konsisten tanpa celah maupun tumpang tindih. Geometri dapat dibuat ulang dengan `tools/rebuild_geometry_hdx.py` (butuh `shapely` >= 2.1); id, kode, dan nama berasal dari `tools/generate_wilayah_diy.py`.

---

## Akses Berbasis Peran

| Grup | Cakupan |
|---|---|
| Administrator | Akses penuh |
| Subdit | Kriminalitas sesuai subdit |
| Subdit Patroli | Aplikasi mobile tanpa polres (atas nama Polda), data patroli per subdit |
| Polres | Data wilayah polresnya |
| Polsek | Data wilayah polseknya |
| Dashboard Viewer | Hanya baca seluruh data di menu Maps |

---

## Instalasi

1. Salin folder `petapantau` ke direktori addons Odoo 19.
2. Pasang dependensi Python:
   ```bash
   pip install python-docx
   ```
3. Instal modul (tambahkan `--with-demo` untuk data contoh):
   ```bash
   python odoo-bin -c odoo.conf -d <nama_database> -i petapantau
   ```
4. User `admin` otomatis masuk grup Administrator PetaPantau.

### Data demo
Dengan `--with-demo`, tersedia data contoh di wilayah DIY: 60 kriminalitas, 10 bencana, 12 lalu lintas, 17 lokasi penting, dan 20 patroli (tanggal relatif terhadap hari instalasi). Akun demo (password `Demo@12345`):

| Login | Peran |
|---|---|
| `admin.demo` | Administrator |
| `subdit.reskrimum` | Subdit |
| `subdit.samapta` | Subdit Patroli |
| `polresta.yogyakarta`, `polresta.sleman`, `polres.bantul` | Polres |
| `polsek.gondokusuman` | Polsek |
| `viewer.demo` | Dashboard Viewer |

### Catatan deployment
- Aplikasi mobile mengunggah foto dalam base64; jika memakai Nginx + ModSecurity, nonaktifkan ModSecurity untuk path `/petapantau/`.

---

## Struktur Modul

```
petapantau/
├── models/        # wilayah, kriminalitas, bencana, lalu lintas, lokasi penting, patroli
├── controllers/   # mobile_public.py (/petapantau), public_utils.py
├── wizard/        # import LP
├── utils/         # parser LP A / LP B
├── data/          # sequence, wilayah DIY
├── demo/          # referensi, akun, data operasional
├── security/      # grup, record rules, ACL
├── tools/         # generator data wilayah & skrip migrasi
├── views/
└── static/        # dashboard JS, aplikasi mobile, library peta
```

---

## Lisensi

© 2026 [Cv Sel Studio](https://selstudio.id). Licensed under [LGPL-3](https://www.gnu.org/licenses/lgpl-3.0.html).
