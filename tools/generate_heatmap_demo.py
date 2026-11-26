"""Membuat data demo heatmap yang mengumpul di beberapa titik:
    demo/03_heatmap_kriminal.xml     kriminalitas
    demo/04_heatmap_operasional.xml  lalu lintas, bencana, dan patroli

Cakupan patroli sengaja tidak merata (sedikit di Seturan-Babarsari yang padat kasus demo),
supaya perbandingan kerawanan dengan patroli punya celah yang bisa diperlihatkan.

Desa/kecamatan/kabupaten tiap titik ditentukan dari batas wilayah di database, sehingga angka
pada peta wilayah cocok dengan posisi titik. Hasilnya tetap sama setiap dijalankan (seed tetap).

Jalankan dari folder `server`:
    ../python/python.exe odoo-bin shell -c odoo.conf -d petapantau --no-http < odoo/addons/petapantau/tools/generate_heatmap_demo.py

Semua record memakai awalan external ID `demo_heat_`. Kriminalitas juga bertanda No. LP
`LP/DEMO-HEAT/`; data lain memuat teks "Data demo heatmap".
"""
import json
import os
import random

from odoo.modules.module import get_module_path

# (nama lokasi, latitude, longitude, jumlah kasus, sebaran dalam derajat ~ 0.001 = 110 m)
HOTSPOTS = [
    ('sekitar Malioboro',        -7.7926, 110.3658, 34, 0.0045),
    ('sekitar Seturan-Babarsari', -7.7745, 110.4110, 28, 0.0055),
    ('sekitar Ringroad Gamping', -7.8000, 110.3220, 18, 0.0060),
    ('sekitar Kota Bantul',      -7.8880, 110.3290, 15, 0.0060),
    ('sekitar Kota Wonosari',    -7.9660, 110.6010, 10, 0.0050),
    ('sekitar Kota Wates',       -7.8580, 110.1580,  8, 0.0050),
]
SCATTERED = 24   # kasus yang menyebar acak, sebagai latar

# kategori -> sub kategori (external ID demo)
KATEGORI = [
    ('curanmor', ['curanmor_motor', 'curanmor_mobil']),
    ('curat',    ['curat_rumah', 'curat_toko']),
    ('jalanan',  ['jalanan_klitih', 'jalanan_jambret']),
    ('narkoba',  ['narkoba_sabu', 'narkoba_ganja']),
    ('aniaya',   ['aniaya_ringan', 'aniaya_berat']),
    ('penipuan', ['penipuan_online', 'penipuan_gelap']),
]
SUBDIT = {'narkoba': 'demo_subdit_resnarkoba'}


def _in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _contains(geometry, x, y):
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for poly in polygons:
        if _in_ring(x, y, poly[0]) and not any(_in_ring(x, y, hole) for hole in poly[1:]):
            return True
    return False


def _xmlid(record):
    full = record.get_external_id().get(record.id) if record else None
    return full.split('.', 1)[1] if full and full.startswith('petapantau.') else None


def _load_desas(env):
    """Semua desa berbatas wilayah beserta fungsi pencari desa dari koordinat."""
    desas = []
    for desa in env['petapantau.desa'].search([('geometry', '!=', False)], order='code'):
        geometry = json.loads(desa.geometry)
        polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        xs = [p[0] for poly in polygons for p in poly[0]]
        ys = [p[1] for poly in polygons for p in poly[0]]
        desas.append((desa, geometry, (min(xs), min(ys), max(xs), max(ys))))

    def find_desa(lon, lat):
        for desa, geometry, (x0, y0, x1, y1) in desas:
            if x0 <= lon <= x1 and y0 <= lat <= y1 and _contains(geometry, lon, lat):
                return desa
        return None

    return desas, find_desa


def _date(name, days, clock):
    expression = "(DateTime.today() - relativedelta(days=%d)).strftime('%%Y-%%m-%%d %s')" % (days, clock)
    return '            <field name="%s" eval="%s"/>' % (name, expression)


def _record(xmlid, model, values=(), refs=(), dates=()):
    lines = ['        <record id="%s" model="%s">' % (xmlid, model)]
    lines += ['            <field name="%s" ref="%s"/>' % (name, ref) for name, ref in refs if ref]
    lines += [_date(name, days, clock) for name, days, clock in dates]
    lines += ['            <field name="%s">%s</field>' % (name, value) for name, value in values]
    return lines + ['        </record>']


def _write(filename, title, body):
    lines = [
        "<?xml version='1.0' encoding='utf-8'?>",
        '<!--',
        '    %s - data rekaan, bukan kejadian nyata.' % title,
        '    Dibuat oleh tools/generate_heatmap_demo.py (jangan diedit manual).',
        '    Penanda: external ID berawalan demo_heat_.',
        '-->',
        '<odoo>',
        '    <data noupdate="1">',
    ] + body + ['    </data>', '</odoo>', '']
    path = os.path.join(get_module_path('petapantau'), 'demo', filename)
    with open(path, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write('\n'.join(lines))
    return path


def _region_refs(desa):
    kecamatan = desa.kecamatan_id
    refs = [('kabupaten_id', _xmlid(kecamatan.kabupaten_id)),
            ('kecamatan_id', _xmlid(kecamatan)),
            ('desa_id', _xmlid(desa))]
    assert all(ref for _, ref in refs), desa.name
    return refs


# Lalu lintas: (nama lokasi, latitude, longitude, jumlah, sebaran)
LALIN_HOTSPOTS = [
    ('Simpang Janti',          -7.7835, 110.4137, 18, 0.0035),
    ('Simpang Jombor',         -7.7480, 110.3613, 14, 0.0035),
    ('Simpang Pelem Gurih',    -7.8000, 110.3200, 11, 0.0040),
    ('Jalan Solo - Prambanan', -7.7640, 110.4750,  8, 0.0045),
]
LALIN_SCATTERED = 12

# Bencana: (nama lokasi, latitude, longitude, jumlah, sebaran, kategori, nama bencana)
BENCANA_HOTSPOTS = [
    ('Perbukitan Menoreh',  -7.6800, 110.1750, 13, 0.0120, 'longsor', 'Tanah longsor'),
    ('Pesisir Kretek',      -7.9700, 110.3150, 11, 0.0080, 'banjir',  'Banjir genangan'),
    ('Perbukitan Imogiri',  -7.9380, 110.4200,  7, 0.0100, 'longsor', 'Tanah longsor'),
    ('Lereng Merapi',       -7.6250, 110.4450,  6, 0.0090, 'merapi',  'Awan panas guguran Merapi'),
]
BENCANA_SCATTERED = 10
BENCANA_LAIN = [('kebakaran', 'Kebakaran permukiman'), ('angin', 'Angin kencang'), ('gempa', 'Gempa bumi terasa')]

# Patroli: (nama area, latitude, longitude, jumlah kegiatan, sebaran titik)
PATROLI_AREAS = [
    ('sekitar Malioboro',         -7.7926, 110.3658, 12, 0.0040),
    ('sekitar Kota Bantul',       -7.8880, 110.3290,  7, 0.0060),
    ('sekitar Ringroad Gamping',  -7.8000, 110.3220,  5, 0.0060),
    ('sekitar Kota Wates',        -7.8580, 110.1580,  4, 0.0060),
    ('sekitar Kota Wonosari',     -7.9660, 110.6010,  4, 0.0060),
    ('sekitar Seturan-Babarsari', -7.7745, 110.4110,  1, 0.0050),   # sengaja minim
]


def build_operational(env, desas, find_desa):
    rng = random.Random(20261128)

    def near(lat, lon, spread, kecamatan=None):
        while True:
            y, x = rng.gauss(lat, spread), rng.gauss(lon, spread)
            desa = find_desa(x, y)
            if desa and (not kecamatan or desa.kecamatan_id == kecamatan):
                return y, x, desa

    def anywhere():
        desa, geometry, (x0, y0, x1, y1) = rng.choice(desas)
        while True:
            x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
            if _contains(geometry, x, y):
                return y, x, desa

    def clock():
        return '%02d:%02d:00' % (rng.randint(0, 23), rng.randint(0, 59))

    body, counts = [], {}

    # -- lalu lintas ----------------------------------------------------------
    points = [(label,) + near(lat, lon, spread)
              for label, lat, lon, total, spread in LALIN_HOTSPOTS for _ in range(total)]
    points += [('lokasi tersebar',) + anywhere() for _ in range(LALIN_SCATTERED)]
    rng.shuffle(points)
    body.append('        <!-- LALU LINTAS -->')
    for number, (label, lat, lon, desa) in enumerate(points, 1):
        body += _record(
            'demo_heat_lalin_%03d' % number, 'petapantau.lalu_lintas',
            refs=_region_refs(desa) + [
                ('kategori_id', 'demo_kat_lalin_%s' % rng.choice(['laka', 'laka', 'macet', 'rawan'])),
                ('jenis_jalan_id', 'demo_jenis_jalan_%s' % rng.choice(['nasional', 'provinsi', 'kabupaten'])),
                ('sumber_dokumen_id', 'demo_sdok_lalin_2026'),
            ],
            dates=[('tanggal_kejadian', rng.randint(2, 300), clock())],
            values=[('nama_lokasi', 'Data demo - %s' % label),
                    ('latitude', '%.6f' % lat), ('longitude', '%.6f' % lon),
                    ('state', rng.choice(['PROSES', 'SELESAI', 'SELESAI'])),
                    ('keterangan', 'Data demo heatmap (rekaan).')])
    counts['lalu lintas'] = len(points)

    # -- bencana --------------------------------------------------------------
    points = [(label, kategori, nama) + near(lat, lon, spread)
              for label, lat, lon, total, spread, kategori, nama in BENCANA_HOTSPOTS for _ in range(total)]
    for _ in range(BENCANA_SCATTERED):
        points.append(('lokasi tersebar',) + rng.choice(BENCANA_LAIN) + anywhere())
    rng.shuffle(points)
    body.append('        <!-- BENCANA -->')
    for number, (label, kategori, nama, lat, lon, desa) in enumerate(points, 1):
        days = rng.randint(2, 300)
        body += _record(
            'demo_heat_bcn_%03d' % number, 'petapantau.bencana',
            refs=_region_refs(desa) + [
                ('kategori_id', 'demo_kat_bcn_%s' % kategori),
                ('sumber_dokumen_id', 'demo_sdok_bcn_2026'),
            ],
            dates=[('tanggal_kejadian', days, clock())],
            values=[('nama_bencana', '%s (data demo) - %s' % (nama, label)),
                    ('latitude', '%.6f' % lat), ('longitude', '%.6f' % lon),
                    ('state', 'AKTIF' if days <= 30 else 'NON AKTIF'),
                    ('keterangan', 'Data demo heatmap (rekaan).')])
    counts['bencana'] = len(points)

    # -- patroli: kegiatan, personel, titik lokasi -----------------------------
    activities = [area for area in PATROLI_AREAS for _ in range(area[3])]
    rng.shuffle(activities)
    body.append('        <!-- PATROLI -->')
    point_number = 0
    for number, (label, lat, lon, _total, spread) in enumerate(activities, 1):
        base = find_desa(lon, lat)
        kecamatan = base.kecamatan_id
        patrol = 'demo_heat_patroli_%03d' % number
        days = rng.randint(1, 28)          # masuk rentang bawaan peta patroli (30 hari)
        hour = rng.randint(1, 15)
        body += _record(
            patrol, 'petapantau.patroli',
            refs=_region_refs(base) + [
                ('polres_id', _xmlid(kecamatan.kabupaten_id.polres_id)),
                ('polsek_id', _xmlid(kecamatan.polsek_id)),
                ('subdit_id', 'demo_subdit_samapta'),
            ],
            dates=[('tanggal_mulai', days, '%02d:00:00' % hour),
                   ('tanggal_selesai', days, '%02d:00:00' % (hour + 3))],
            values=[('state', 'SELESAI'), ('keterangan', 'Data demo heatmap (rekaan) - patroli %s' % label)])
        for member in (1, 2):
            body += _record(
                '%s_personel_%d' % (patrol, member), 'petapantau.personel_patroli',
                refs=[('patroli_id', patrol)],
                values=[('nama', 'PERSONEL DEMO %03d-%d' % (number, member)), ('pangkat', 'BRIPDA')])
        for stop in range(rng.randint(3, 5)):
            y, x, _desa = near(lat, lon, spread, kecamatan)
            point_number += 1
            body += _record(
                'demo_heat_titik_%03d' % point_number, 'petapantau.lokasi_patroli',
                refs=[('patroli_id', patrol)],
                dates=[('tanggal', days, '%02d:%02d:00' % (hour + stop // 2, (stop % 2) * 30 + rng.randint(0, 25)))],
                values=[('latitude', '%.6f' % y), ('longitude', '%.6f' % x),
                        ('catatan', 'Data demo heatmap (rekaan).')])
    counts['kegiatan patroli'] = len(activities)
    counts['titik patroli'] = point_number

    path = _write('04_heatmap_operasional.xml', 'DATA DEMO HEATMAP LALU LINTAS, BENCANA, PATROLI', body)
    print('HASIL', counts, 'ditulis ke', path)


def build_kriminal(env, desas, find_desa):
    rng = random.Random(20261127)

    points = []
    for label, lat, lon, total, spread in HOTSPOTS:
        added = 0
        while added < total:
            y, x = rng.gauss(lat, spread), rng.gauss(lon, spread)
            desa = find_desa(x, y)
            if desa:
                points.append((label, y, x, desa))
                added += 1
    for _ in range(SCATTERED):
        desa, geometry, (x0, y0, x1, y1) = rng.choice(desas)
        while True:
            x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
            if _contains(geometry, x, y):
                break
        points.append(('tersebar', y, x, desa))
    rng.shuffle(points)

    lines = [
        "<?xml version='1.0' encoding='utf-8'?>",
        '<!--',
        '    DATA DEMO HEATMAP KRIMINALITAS - data rekaan, bukan kejadian nyata.',
        '    Dibuat oleh tools/generate_heatmap_demo.py (jangan diedit manual).',
        '    Penanda: external ID berawalan demo_heat_ dan No. LP berawalan LP/DEMO-HEAT/.',
        '-->',
        '<odoo>',
        '    <data noupdate="1">',
    ]
    for number, (label, lat, lon, desa) in enumerate(points, 1):
        kecamatan = desa.kecamatan_id
        kabupaten = kecamatan.kabupaten_id
        refs = {
            'kabupaten_id': _xmlid(kabupaten),
            'kecamatan_id': _xmlid(kecamatan),
            'desa_id': _xmlid(desa),
            'polres_id': _xmlid(kabupaten.polres_id),
            'polsek_id': _xmlid(kecamatan.polsek_id),
        }
        missing = [k for k in ('kabupaten_id', 'kecamatan_id', 'desa_id') if not refs[k]]
        assert not missing, (desa.name, missing)

        kategori, subs = rng.choice(KATEGORI)
        selesai = rng.random() < 0.35
        status = rng.choice(['p21', 'rj'] if selesai else ['lidik', 'sidik'])
        days = rng.randint(2, 300)
        clock = '%02d:%02d:00' % (rng.randint(0, 23), rng.randint(0, 59))
        refs.update({
            'kategori_id': 'demo_kat_krim_%s' % kategori,
            'sub_kategori_id': 'demo_sub_kat_%s' % rng.choice(subs),
            'subdit_id': SUBDIT.get(kategori, 'demo_subdit_reskrimum'),
            'sumber_dokumen_id': 'demo_sdok_krim_2026',
            'sub_status_perkara_id': 'demo_sub_status_%s' % status,
        })

        lines.append('        <record id="demo_heat_krim_%03d" model="petapantau.kriminalitas">' % number)
        lines.append('            <field name="jenis_lp">%s</field>' % rng.choice(['LP A', 'LP B', 'LP B', 'LP B']))
        lines.append('            <field name="no_lp">LP/DEMO-HEAT/%03d/2026/POLDA DIY</field>' % number)
        for name in ('tanggal_kejadian', 'tanggal_laporan'):
            offset = days if name == 'tanggal_kejadian' else days - 1
            lines.append('            <field name="%s" eval="(DateTime.today() - relativedelta(days=%d)).strftime(\'%%Y-%%m-%%d %s\')"/>'
                         % (name, offset, clock))
        lines.append('            <field name="tempat_kejadian">Data demo - %s</field>' % label)
        lines.append('            <field name="latitude">%.6f</field>' % lat)
        lines.append('            <field name="longitude">%.6f</field>' % lon)
        for name, ref in refs.items():
            if ref:
                lines.append('            <field name="%s" ref="%s"/>' % (name, ref))
        lines.append('            <field name="status_perkara">%s</field>' % ('SELESAI' if selesai else 'PROSES'))
        lines.append('            <field name="uraian_singkat">Data demo heatmap (rekaan).</field>')
        lines.append('        </record>')
    lines += ['    </data>', '</odoo>', '']

    path = os.path.join(get_module_path('petapantau'), 'demo', '03_heatmap_kriminal.xml')
    with open(path, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write('\n'.join(lines))
    print('HASIL', len(points), 'record ditulis ke', path)


def main(env):
    desas, find_desa = _load_desas(env)
    build_kriminal(env, desas, find_desa)
    build_operational(env, desas, find_desa)


main(env)
