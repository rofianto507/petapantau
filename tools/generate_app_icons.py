"""
Hasilkan ikon aplikasi PetaPantau (PNG) dari geometri logo.

Geometri HARUS sama dengan SVG master di static/img/logo/ (ruang desain 128 x 128):
  - perisai emas dengan garis tepi coklat tua,
  - dua cincin berkait (anyaman: kiri di atas pada persilangan atas, kanan di atas
    pada persilangan bawah) = "bersama",
  - titik di tengah = lokasi (peta).

Keluaran:
  static/description/icon.png        128x128  ikon menu Odoo (web_icon)
  static/img/icons/icon-<n>.png      ikon PWA aplikasi mobile (72..512), full-bleed
                                     + zona aman maskable (tanda 80% dari kanvas)
  static/src/img/logo.png            512x512  tanda tanpa latar (transparan)
  static/img/logo/petapantau-mark.png 512x512 tanda tanpa latar (transparan)

Pemakaian (dari folder modul):
    pip install pillow shapely
    python tools/generate_app_icons.py
"""
import os

from PIL import Image, ImageChops, ImageDraw, ImageOps
from shapely.geometry import Polygon

BROWN = (29, 26, 21)            # #1D1A15
GOLD_TOP = (233, 192, 90)       # #E9C05A
GOLD_BOT = (181, 130, 26)       # #B5821A
GLOW = (43, 37, 28)             # #2B251C  pusat latar ikon
EDGE = (20, 17, 13)             # #14110D  tepi latar ikon

SHIELD_STROKE = 4.0             # tebal garis tepi perisai (ke dalam)
RING_R, RING_W, RING_Y = 20.0, 6.5, 60.0
RING_A_X, RING_B_X = 52.0, 76.0
GAP = 2.6                       # celah anyaman di tiap sisi cincin yang di atas
DOT_R = 3.7


def bezier(p0, p1, p2, p3, n=60):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
                    u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]))
    return pts


def shield_points():
    pts = [(64, 8), (108, 24), (108, 60)]
    pts += bezier((108, 60), (108, 87), (90, 108), (64, 120))[1:]
    pts += bezier((64, 120), (38, 108), (20, 87), (20, 60))[1:]
    pts += [(20, 24)]
    return pts


def render(size=1024, tile=True, ss=3):
    S = size * ss
    k = S / 128.0
    sc = 0.8 if tile else 1.0          # tanda 80% di ikon agar aman untuk maskable

    def T(x, y):
        return ((64 + (x - 64) * sc) * k, (64 + (y - 64) * sc) * k)

    def L(v):
        return v * sc * k

    def blank():
        return Image.new('L', (S, S), 0)

    # --- latar ---
    if tile:
        glow = Image.radial_gradient('L').resize((S, S), Image.BILINEAR)
        canvas = ImageOps.colorize(glow, black=GLOW, white=EDGE).convert('RGBA')
    else:
        canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))

    # --- perisai ---
    pts = [T(x, y) for x, y in shield_points()]
    m_shield = blank()
    ImageDraw.Draw(m_shield).polygon(pts, fill=255)
    # garis tepi = selisih perisai dan perisai yang diperkecil (offset poligon presisi, tanpa guratan)
    inner = Polygon(shield_points()).buffer(-SHIELD_STROKE, join_style=1, quad_segs=32)
    m_inner = blank()
    ImageDraw.Draw(m_inner).polygon([T(x, y) for x, y in inner.exterior.coords], fill=255)

    y0, y1 = T(0, 8)[1], T(0, 120)[1]
    grad = blank()
    grad.paste(Image.linear_gradient('L').resize((S, max(1, round(y1 - y0))), Image.BILINEAR), (0, round(y0)))
    ImageDraw.Draw(grad).rectangle([0, round(y1), S, S], fill=255)
    gold = ImageOps.colorize(grad, black=GOLD_TOP, white=GOLD_BOT)

    canvas.paste(BROWN, (0, 0), m_shield)
    canvas.paste(gold, (0, 0), m_inner)

    # --- cincin berkait ---
    cy = T(0, RING_Y)[1]

    def ring(cx, width):
        x, y = T(cx, RING_Y)
        r_out = L(RING_R) + L(width) / 2
        m = blank()
        ImageDraw.Draw(m).ellipse([x - r_out, y - r_out, x + r_out, y + r_out], outline=255, width=max(1, round(L(width))))
        return m

    top, bot = blank(), blank()
    ImageDraw.Draw(top).rectangle([0, 0, S, cy], fill=255)
    ImageDraw.Draw(bot).rectangle([0, cy, S, S], fill=255)

    ring_a, ring_b = ring(RING_A_X, RING_W), ring(RING_B_X, RING_W)
    a_top = ImageChops.darker(ring_a, top)
    b_bot = ImageChops.darker(ring_b, bot)
    a_top_dil = ImageChops.darker(ring(RING_A_X, RING_W + 2 * GAP), top)
    b_bot_dil = ImageChops.darker(ring(RING_B_X, RING_W + 2 * GAP), bot)
    gap_top = ImageChops.subtract(ImageChops.darker(a_top_dil, ring_b), a_top)
    gap_bot = ImageChops.subtract(ImageChops.darker(b_bot_dil, ring_a), b_bot)
    rings = ImageChops.subtract(ImageChops.subtract(ImageChops.lighter(ring_a, ring_b), gap_top), gap_bot)
    canvas.paste(BROWN, (0, 0), rings)

    # --- titik lokasi ---
    dx, dy = T(64, RING_Y)
    dr = L(DOT_R)
    m_dot = blank()
    ImageDraw.Draw(m_dot).ellipse([dx - dr, dy - dr, dx + dr, dy + dr], fill=255)
    canvas.paste(BROWN, (0, 0), m_dot)

    return canvas.resize((size, size), Image.LANCZOS)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = lambda *p: os.path.join(root, *p)
    os.makedirs(out('static', 'img', 'logo'), exist_ok=True)

    tile = render(1024, tile=True).convert('RGB')
    for n in (72, 96, 128, 144, 152, 192, 384, 512):
        tile.resize((n, n), Image.LANCZOS).save(out('static', 'img', 'icons', 'icon-%d.png' % n), optimize=True)
    tile.resize((128, 128), Image.LANCZOS).save(out('static', 'description', 'icon.png'), optimize=True)

    mark = render(1024, tile=False)
    mark.resize((512, 512), Image.LANCZOS).save(out('static', 'img', 'logo', 'petapantau-mark.png'), optimize=True)
    mark.resize((512, 512), Image.LANCZOS).save(out('static', 'src', 'img', 'logo.png'), optimize=True)
    print('ikon dan logo dibuat di', root)


if __name__ == '__main__':
    main()
