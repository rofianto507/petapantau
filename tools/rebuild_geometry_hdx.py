"""
Bangun ulang geometri batas wilayah D.I. Yogyakarta di data/wilayah_diy.xml
dari dataset resmi COD-AB Indonesia (sumber: BPS via OCHA/HDX, lisensi CC BY-IGO).

    https://data.humdata.org/dataset/cod-ab-idn   (idn_admin_boundaries.geojson.zip)

Hanya field <geometry> yang diganti; id record, kode, nama, relasi dan Polsek
tidak berubah. Alurnya:
  1. Baca idn_admin4.geojson (desa/kelurahan, seluruh Indonesia) secara streaming,
     ambil provinsi ID34 (DIY).
  2. Cocokkan ke record XML lewat (kabupaten, kecamatan, nama desa).
  3. Sederhanakan SELURUH desa sekaligus dengan shapely.coverage_simplify
     (batas bersama dua desa tetap berimpit, tidak muncul celah/tumpang tindih).
  4. Kecamatan = gabungan desa-desanya, Kabupaten = gabungan kecamatannya,
     sehingga tiga level selalu konsisten.

Pemakaian:
    pip install shapely            # >= 2.1 (butuh coverage_simplify)
    python tools/rebuild_geometry_hdx.py <idn_admin4.geojson> data/wilayah_diy.xml [--tolerance 0.00003] [--dry-run]

Tolerance dalam derajat (0.00003 ~ 3 m). 0 = tanpa penyederhanaan.
"""
import argparse
import collections
import difflib
import html
import json
import re
import sys

import shapely
from shapely import make_valid, unary_union
from shapely.geometry import MultiPolygon, Polygon, mapping, shape

PROV = '"adm1_pcode":"ID34"'
ATTRIBUSI = ('Batas wilayah: Badan Pusat Statistik (BPS) via OCHA/HDX COD-AB '
             'Indonesia, CC BY-IGO (https://data.humdata.org/dataset/cod-ab-idn).')


def norm(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())


def load_desa(path):
    feats = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            if PROV in line[:4000] and line.lstrip().startswith('{"type":"Feature"'):
                feats.append(json.loads(line.strip().rstrip(',')))
    return feats


def read_records(xml):
    recs = {'kecamatan': [], 'desa': []}
    for rid, model, body in re.findall(
            r'<record id="(\w+)" model="petapantau\.(kecamatan|desa)">(.*?)</record>', xml, re.S):
        name = html.unescape(re.search(r'name="name">(.*?)<', body).group(1))
        parent = re.search(r'ref="(kec_\w+|kab_\w+)"', body).group(1)
        recs[model].append((rid, name, parent))
    return recs


def kab_of(pcode):          # ID3404170003 -> 34_04
    return pcode[2:4] + '_' + pcode[4:6]


def match(recs, feats):
    """Kembalikan {rid_desa: feature}, {rid_kec: pcode_kecamatan_hdx}."""
    by_kec = collections.defaultdict(list)
    for f in feats:
        by_kec[f['properties']['adm3_pcode']].append(f)
    kec_name = {}
    for f in feats:
        p = f['properties']
        kec_name[p['adm3_pcode']] = p['adm3_name']
    by_kabname = {(kab_of(pc), norm(n)): pc for pc, n in kec_name.items()}

    kecmap = {}
    for rid, name, _ in recs['kecamatan']:
        pc = by_kabname.get(('_'.join(rid.split('_')[1:3]), norm(name)))
        if not pc:
            sys.exit('Kecamatan tidak cocok: %s %s' % (rid, name))
        kecmap[rid] = pc

    desamap, left_old = {}, collections.defaultdict(list)
    for rid, name, par in recs['desa']:
        pc = kecmap[par]
        c = [f for f in by_kec[pc] if norm(f['properties']['adm4_name']) == norm(name)]
        if len(c) == 1:
            desamap[rid] = c[0]
        else:
            left_old[par].append((rid, name))
    used = {id(f) for f in desamap.values()}
    # sisa: pasangkan per kecamatan dengan kemiripan nama (beda ejaan)
    for par, olds in left_old.items():
        cands = [f for f in by_kec[kecmap[par]] if id(f) not in used]
        for rid, name in olds:
            if not cands:
                sys.exit('Desa tidak cocok: %s %s' % (rid, name))
            best = max(cands, key=lambda f: difflib.SequenceMatcher(
                None, norm(name), norm(f['properties']['adm4_name'])).ratio())
            print('  pasang manual: %-22s <- %s' % (name, best['properties']['adm4_name']))
            desamap[rid] = best
            cands.remove(best)
            used.add(id(best))
    if len(desamap) != len(recs['desa']) or len(used) != len(feats):
        sys.exit('Jumlah tidak sama: record %d, cocok %d, fitur HDX %d, terpakai %d'
                 % (len(recs['desa']), len(desamap), len(feats), len(used)))
    return desamap


def to_multi(g):
    if isinstance(g, Polygon):
        return MultiPolygon([g])
    if isinstance(g, MultiPolygon):
        return g
    polys = [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon)]
    return MultiPolygon(polys)


def geojson(g):
    g = to_multi(g)
    coords = [[[[round(x, 6), round(y, 6)] for x, y in ring]
               for ring in [list(p.exterior.coords)] + [list(i.coords) for i in p.interiors]]
              for p in g.geoms]
    return json.dumps({'type': 'MultiPolygon', 'coordinates': coords}, separators=(',', ':'))


def nverts(g):
    return sum(len(p.exterior.coords) + sum(len(i.coords) for i in p.interiors)
               for p in to_multi(g).geoms)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('admin4')
    ap.add_argument('xml')
    ap.add_argument('--tolerance', type=float, default=0.00003)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    xml = open(a.xml, encoding='utf-8', newline='').read().replace('\r\n', '\n')
    recs = read_records(xml)
    feats = load_desa(a.admin4)
    print('desa HDX (ID34): %d | record XML: %d kecamatan, %d desa'
          % (len(feats), len(recs['kecamatan']), len(recs['desa'])))
    desamap = match(recs, feats)

    rids = [r for r, _, _ in recs['desa']]
    geoms = []
    for rid in rids:
        g = shape(desamap[rid]['geometry'])
        geoms.append(g if g.is_valid else make_valid(g))
    if not shapely.coverage_is_valid(geoms):
        sys.exit('Coverage desa tidak valid (ada tumpang tindih); hentikan.')
    before = sum(nverts(g) for g in geoms)
    if a.tolerance > 0:
        geoms = list(shapely.coverage_simplify(geoms, a.tolerance))
    geoms = [shapely.set_precision(g, 1e-6) for g in geoms]          # grid 6 desimal
    if not shapely.coverage_is_valid(geoms):
        sys.exit('Coverage tidak valid setelah pembulatan.')
    after = sum(nverts(g) for g in geoms)
    print('titik desa: %d -> %d (tolerance %g)' % (before, after, a.tolerance))

    new = dict(zip(rids, geoms))
    kec_parts, kab_parts = collections.defaultdict(list), collections.defaultdict(list)
    for rid, name, par in recs['desa']:
        kec_parts[par].append(new[rid])
    kec_geo = {k: unary_union(v) for k, v in kec_parts.items()}
    for rid, name, par in recs['kecamatan']:
        kab_parts[par].append(kec_geo[rid])
    kab_geo = {k: unary_union(v) for k, v in kab_parts.items()}
    new.update({k: v for k, v in kec_geo.items()})
    new.update({k: v for k, v in kab_geo.items()})
    K = 110.3 * 110.57
    print('luas DIY: %.1f km2 | kab %d, kec %d, desa %d | titik kec %d, kab %d' % (
        unary_union(list(kab_geo.values())).area * K, len(kab_geo), len(kec_geo), len(rids),
        sum(nverts(g) for g in kec_geo.values()), sum(nverts(g) for g in kab_geo.values())))
    if a.dry_run:
        return

    n = 0

    def repl(m):
        nonlocal n
        rid = m.group(1)
        if rid not in new:
            return m.group(0)
        n += 1
        return re.sub(r'(<field name="geometry">).*?(</field>)',
                      lambda mm: mm.group(1) + geojson(new[rid]).replace('&', '&amp;') + mm.group(2),
                      m.group(0), count=1, flags=re.S)

    xml = re.sub(r'<record id="((?:kab|kec|desa)_\w+)" model="petapantau\.\w+">.*?</record>',
                 repl, xml, flags=re.S)
    xml = re.sub(r'    Batas wilayah:.*\n', '    ' + ATTRIBUSI + '\n', xml, count=1)
    xml = re.sub(r'    File ini dihasilkan otomatis oleh .*\n',
                 '    Geometri dibangun oleh tools/rebuild_geometry_hdx.py (id/kode/nama dari generate_wilayah_diy.py).\n',
                 xml, count=1)
    open(a.xml, 'w', encoding='utf-8', newline='').write(xml)
    print('geometri diganti di %d record' % n)


if __name__ == '__main__':
    main()
