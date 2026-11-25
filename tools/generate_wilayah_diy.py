import re, json, glob, sys, os
from xml.sax.saxutils import escape
SRC, OUT = sys.argv[1], sys.argv[2]
rx=re.compile(r"\('([\d.]+)','((?:[^']|'')*)',(-?[\d.]+),(-?[\d.]+),'(\[.*?\])'\)")
rows={}
for f in sorted(glob.glob(os.path.join(SRC,'*.sql'))):
    for m in rx.finditer(open(f,encoding='utf-8').read()):
        k,n,la,ln,p=m.groups(); rows[k]=(n.replace("''","'"),json.loads(p))
def depth(x):
    d=0
    while isinstance(x,list): x=x[0]; d+=1
    return d
def ring(r):
    pts=[[round(p[1],6),round(p[0],6)] for p in r]
    if pts[0]!=pts[-1]: pts.append(pts[0])
    return pts
def geom(P):
    d=depth(P)
    if d==3: polys=[P]
    elif d==4: polys=P
    else: raise ValueError(d)
    return json.dumps({"type":"MultiPolygon","coordinates":[[ring(r) for r in poly] for poly in polys]},separators=(',',':'))
POLRES={'34.71':('polresta_yogyakarta','Polresta Yogyakarta','Jl. Reksobayan No. 1, Kota Yogyakarta'),
        '34.04':('polresta_sleman','Polresta Sleman','Jl. Magelang Km 12, Beran, Tridadi, Sleman'),
        '34.02':('polres_bantul','Polres Bantul','Jl. Jenderal Sudirman No. 1, Bantul'),
        '34.01':('polres_kulon_progo','Polres Kulon Progo','Jl. Sugiman, Wates, Kulon Progo'),
        '34.03':('polres_gunungkidul','Polres Gunungkidul','Jl. MGR Sugiyopranoto No. 15, Wonosari, Gunungkidul')}
def xid(code): return code.replace('.','_')
kab=[k for k in rows if k.count('.')==1]; kec=[k for k in rows if k.count('.')==2]; des=[k for k in rows if k.count('.')==3]
x=['<?xml version="1.0" encoding="utf-8"?>',
 '<!--',
 '    Data Wilayah Polda D.I. Yogyakarta',
 '    Batas wilayah: cahyadsn/wilayah_boundaries (MIT License, berbasis Kepmendagri).',
 '    %d kabupaten/kota, %d kecamatan, %d desa/kelurahan; 1 Polda, 5 Polres, %d Polsek (1 per kecamatan).'%(len(kab),len(kec),len(des),len(kec)),
 '    File ini dihasilkan otomatis oleh tools/generate_wilayah_diy.py',
 '-->','<odoo>','    <data noupdate="1">','',
 '        <!-- POLDA (polres tanpa polsek — dipakai sebagai satuan Subdit) -->',
 '        <record id="polres_polda_diy" model="petapantau.polres">',
 '            <field name="name">Polda D.I. Yogyakarta</field>',
 '            <field name="address">Jl. Padjajaran, Ring Road Utara, Condongcatur, Depok, Sleman</field>',
 '        </record>','','        <!-- POLRES -->']
for k in sorted(POLRES):
    i,n,a=POLRES[k]
    x+=['        <record id="%s" model="petapantau.polres">'%i,'            <field name="name">%s</field>'%n,'            <field name="address">%s</field>'%escape(a),'        </record>']
x+=['','        <!-- POLSEK (1 per kecamatan) -->']
for k in sorted(kec):
    n=rows[k][0]
    x+=['        <record id="polsek_%s" model="petapantau.polsek">'%xid(k),'            <field name="name">Polsek %s</field>'%escape(n),
        '            <field name="polres_id" ref="%s"/>'%POLRES[k[:5]][0],'        </record>']
x+=['','        <!-- KABUPATEN / KOTA -->']
for k in sorted(kab):
    n=rows[k][0]; t='KOTA' if n.startswith('Kota') else 'KABUPATEN'
    nm=re.sub(r'^(Kabupaten|Kota) ','',n) if t=='KABUPATEN' else n
    x+=['        <record id="kab_%s" model="petapantau.kabupaten">'%xid(k),'            <field name="code">%s</field>'%k.replace('.',''),
        '            <field name="name">%s</field>'%escape(nm),'            <field name="type">%s</field>'%t,
        '            <field name="polres_id" ref="%s"/>'%POLRES[k][0],'            <field name="geometry">%s</field>'%escape(geom(rows[k][1])),'        </record>']
x+=['','        <!-- KECAMATAN -->']
for k in sorted(kec):
    x+=['        <record id="kec_%s" model="petapantau.kecamatan">'%xid(k),'            <field name="code">%s</field>'%k.replace('.',''),
        '            <field name="name">%s</field>'%escape(rows[k][0]),'            <field name="kabupaten_id" ref="kab_%s"/>'%xid(k[:5]),
        '            <field name="polsek_id" ref="polsek_%s"/>'%xid(k),'            <field name="geometry">%s</field>'%escape(geom(rows[k][1])),'        </record>']
x+=['','        <!-- DESA / KELURAHAN -->']
for k in sorted(des):
    t='KELURAHAN' if k.split('.')[3].startswith('1') else 'DESA'
    x+=['        <record id="desa_%s" model="petapantau.desa">'%xid(k),'            <field name="code">%s</field>'%k.replace('.',''),
        '            <field name="name">%s</field>'%escape(rows[k][0]),'            <field name="kecamatan_id" ref="kec_%s"/>'%xid(k[:8]),
        '            <field name="type">%s</field>'%t,'            <field name="geometry">%s</field>'%escape(geom(rows[k][1])),'        </record>']
x+=['','    </data>','</odoo>','']
open(OUT,'w',encoding='utf-8').write('\n'.join(x))
print(len(kab),len(kec),len(des),os.path.getsize(OUT))
