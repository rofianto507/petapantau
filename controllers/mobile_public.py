from odoo import http
from odoo.exceptions import UserError, AccessError
from odoo.http import request
from datetime import datetime, timedelta
import json
import base64
import logging
from .public_utils import (
    check_rate_limit, is_valid_image, parse_user_agent,
    RATE_LIMIT_MAX, RATE_LIMIT_WINDOW,
)

_logger = logging.getLogger(__name__)

_WIB_OFFSET = timedelta(hours=7)


def _today_utc_range_wib():
    """Return (start, end) UTC naive datetime strings for 'today' in WIB (UTC+7)."""
    now_wib   = datetime.utcnow() + _WIB_OFFSET
    today_wib = now_wib.date()
    wib_start = datetime(today_wib.year, today_wib.month, today_wib.day, 0, 0, 0)
    wib_end   = datetime(today_wib.year, today_wib.month, today_wib.day, 23, 59, 59)
    utc_start = (wib_start - _WIB_OFFSET).strftime('%Y-%m-%d %H:%M:%S')
    utc_end   = (wib_end   - _WIB_OFFSET).strftime('%Y-%m-%d %H:%M:%S')
    return utc_start, utc_end


def _wib_to_utc(dt_str):
    """Convert naive WIB datetime string to UTC datetime string for Odoo storage."""
    if not dt_str:
        return dt_str
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
        try:
            dt = datetime.strptime(dt_str, fmt)
            return (dt - _WIB_OFFSET).strftime('%Y-%m-%d %H:%M:%S')
        except (ValueError, TypeError):
            continue
    return dt_str


# Batas request per IP (dihitung per proses). NAT kantor bisa dipakai banyak petugas,
# jadi batas aksi tulis lanjutan dibuat longgar; submit patroli baru dibatasi ketat.
WRITE_LIMIT_MAX    = 300         # aksi tulis form publik / jam / IP
LOGIN_LIMIT_MAX    = 30          # percobaan login / 15 menit / IP
LOGIN_LIMIT_WINDOW = 15 * 60


def _safe_redirect(target, default='/petapantau/form'):
    """Hanya izinkan redirect ke path internal (cegah open redirect)."""
    if (isinstance(target, str) and target.startswith('/')
            and not target.startswith('//') and '\\' not in target):
        return target
    return default


class PetaPantauMobileController(http.Controller):

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _client_ip(self):
        """IP klien. Di belakang Nginx aktifkan `proxy_mode = True` di odoo.conf
        agar remote_addr berisi IP asli (header X-Forwarded-For dari klien tidak
        dipercaya begitu saja karena bisa dipalsukan)."""
        return request.httprequest.remote_addr or ''

    def _error(self, exc, context=''):
        """Pesan error aman untuk klien; detail teknis hanya masuk log server."""
        if isinstance(exc, AccessError):
            _logger.warning('%s: akses ditolak: %s', context or 'api', exc)
            return {'error': 'unauthorized'}
        if isinstance(exc, UserError):  # termasuk ValidationError: pesannya memang untuk user
            return {'error': exc.args[0] if exc.args else 'Data tidak valid'}
        _logger.error('%s error: %s', context or 'api', exc, exc_info=True)
        return {'error': 'Terjadi kesalahan pada server. Silakan coba lagi.'}

    def _pub_write_allowed(self):
        return check_rate_limit(self._client_ip(), 'patroli_write', limit=WRITE_LIMIT_MAX)

    def _auth_check(self):
        user = request.env.user
        if user._is_public():
            return None
        if not user.polres_id and not user.has_group('petapantau.group_subdit_patroli'):
            return None
        return user

    def _build_user_ctx(self, user):
        is_polsek    = bool(user.polsek_id)
        is_subdit_sp = user.has_group('petapantau.group_subdit_patroli')
        polres       = user.polres_id
        polsek       = user.polsek_id

        ctx = {
            'user_id':      user.id,
            'user_name':    user.name,
            'user_login':   user.login,
            'is_polsek':    is_polsek,
            'is_subdit_sp': is_subdit_sp,
            'polres_id':    polres.id   if polres else None,
            'polres_name':  polres.name if polres else None,
            'polsek_id':    polsek.id   if polsek else None,
            'polsek_name':  polsek.name if polsek else None,
        }

        if is_subdit_sp:
            kabupaten_list = request.env['petapantau.kabupaten'].sudo().search_read(
                [], ['id', 'name'], order='name asc',
            )
            # Subdit Patroli selalu atas nama Polda (polres tanpa polsek) — auto-assign
            polda = self._get_polda_polres()
            ctx['polres_id']      = polda.id   if polda else None
            ctx['polres_name']    = polda.name if polda else None
            ctx['kabupaten_list'] = kabupaten_list
            ctx['polres_list']    = []
            ctx['polsek_list']    = []
            ctx['kecamatan_list'] = []
        else:
            kabupaten_list = request.env['petapantau.kabupaten'].sudo().search_read(
                [('polres_id', '=', polres.id)], ['id', 'name'], order='name asc',
            )
            ctx['kabupaten_list'] = kabupaten_list
            ctx['polres_list']    = []

            if not is_polsek:
                polsek_list = request.env['petapantau.polsek'].sudo().search_read(
                    [('polres_id', '=', polres.id)], ['id', 'name'], order='name asc',
                )
                ctx['polsek_list'] = polsek_list
            else:
                ctx['polsek_list'] = []

            if is_polsek:
                kecamatan_list = request.env['petapantau.kecamatan'].sudo().search_read(
                    [('polsek_id', '=', polsek.id)], ['id', 'name', 'kabupaten_id'], order='name asc',
                )
                ctx['kecamatan_list'] = kecamatan_list
            else:
                ctx['kecamatan_list'] = []

        return ctx


    # ── Routes ───────────────────────────────────────────────────────────────

    # ── PWA: Manifest & Service Worker ───────────────────────────────────────

    @http.route('/petapantau/manifest.json', type='http', auth='public', csrf=False, website=False)
    def pwa_manifest(self, **kwargs):
        manifest = {
            "name": "PetaPantau Mobile",
            "short_name": "PetaPantau",
            "description": "Sistem Pemetaan Digital - Polri",
            "start_url": "/petapantau/form",
            "scope": "/petapantau/",
            "display": "standalone",
            "orientation": "portrait-primary",
            "background_color": "#71639e",
            "theme_color": "#71639e",
            "lang": "id",
            "icons": [
                {"src": "/petapantau/static/img/icons/icon-72.png",  "sizes": "72x72",   "type": "image/png", "purpose": "any"},
                {"src": "/petapantau/static/img/icons/icon-96.png",  "sizes": "96x96",   "type": "image/png", "purpose": "any"},
                {"src": "/petapantau/static/img/icons/icon-128.png", "sizes": "128x128", "type": "image/png", "purpose": "any"},
                {"src": "/petapantau/static/img/icons/icon-144.png", "sizes": "144x144", "type": "image/png", "purpose": "any"},
                {"src": "/petapantau/static/img/icons/icon-152.png", "sizes": "152x152", "type": "image/png", "purpose": "any"},
                {"src": "/petapantau/static/img/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                {"src": "/petapantau/static/img/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
                {"src": "/petapantau/static/img/icons/icon-384.png", "sizes": "384x384", "type": "image/png", "purpose": "any"},
                {"src": "/petapantau/static/img/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                {"src": "/petapantau/static/img/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
            ],
        }
        return request.make_response(
            json.dumps(manifest),
            headers=[
                ('Content-Type', 'application/manifest+json'),
                ('Cache-Control', 'no-cache, no-store, must-revalidate'),
            ],
        )

    @http.route('/petapantau/sw.js', type='http', auth='public', csrf=False, website=False)
    def pwa_service_worker(self, **kwargs):
        sw = """
const CACHE = 'petapantau-v2';
const SHELL = [
  '/petapantau/static/lib/fontawesome/css/font-awesome.css',
  '/petapantau/static/lib/leaflet/leaflet.css',
  '/petapantau/static/lib/leaflet/leaflet.js',
  '/petapantau/static/lib/echart/echarts.min.js',
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Cache-first for static assets; network-first for API / HTML
  if (SHELL.some(s => url.pathname === s)) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  }
  // everything else: network only (Odoo session / API must stay fresh)
});
"""
        return request.make_response(
            sw,
            headers=[
                ('Content-Type', 'application/javascript'),
                ('Service-Worker-Allowed', '/petapantau/'),
                ('Cache-Control', 'no-cache'),
            ],
        )

    @http.route('/petapantau', type='http', auth='public', csrf=False, website=False)
    def strong_index(self, **kwargs):
        if self._auth_check():
            return request.redirect('/petapantau/form')
        return request.redirect('/petapantau/login')

    @http.route('/petapantau/login', type='http', auth='public', csrf=False, website=False, methods=['GET'])
    def strong_login_get(self, error=None, redirect=None, **kwargs):
        redirect = _safe_redirect(redirect)
        if self._auth_check():
            return request.redirect(redirect)
        return request.render('petapantau.template_strong_login', {
            'error': error,
            'redirect': redirect,
        })

    @http.route('/petapantau/login', type='http', auth='public', website=False, methods=['POST'])
    def strong_login_post(self, login='', password='', redirect=None, **kwargs):
        redirect = _safe_redirect(redirect)
        if not check_rate_limit(self._client_ip(), 'login', limit=LOGIN_LIMIT_MAX, window=LOGIN_LIMIT_WINDOW):
            _logger.warning('PetaPantau Mobile login: rate limit (ip=%s)', self._client_ip())
            return request.redirect('/petapantau/login?error=invalid')
        try:
            credential = {'type': 'password', 'login': login.strip(), 'password': password}
            request.session.authenticate(request.env, credential)
            uid = request.session.uid
            _logger.info('PetaPantau Mobile login: user="%s" uid=%s', login, uid)
            if uid:
                user = request.env['res.users'].sudo().browse(uid)
                is_sp = user.has_group('petapantau.group_subdit_patroli')
                if not user.polres_id and not is_sp:
                    request.session.logout(keep_db=True)
                    return request.redirect('/petapantau/login?error=unauthorized')
                return request.redirect(redirect)
        except Exception as e:
            _logger.warning('PetaPantau Mobile login gagal untuk "%s": %s', login, e)
        return request.redirect('/petapantau/login?error=invalid')

    @http.route('/petapantau/logout', type='http', auth='public', csrf=False, website=False)
    def strong_logout(self, **kwargs):
        request.session.logout(keep_db=True)
        return request.redirect('/petapantau/login')

    @http.route('/petapantau/form', type='http', auth='public', csrf=False, website=False)
    def strong_form_get(self, **kwargs):
        user = self._auth_check()
        if not user:
            return request.redirect('/petapantau/login?redirect=/petapantau/form')
        user_ctx  = self._build_user_ctx(user)
        init_data = json.dumps(user_ctx)
        return request.render('petapantau.template_strong_form', {
            'init_data': init_data,
            'user_ctx':  user_ctx,
        })

    # ── API: KPI ─────────────────────────────────────────────────────────────

    @http.route('/petapantau/api/kpi', type='jsonrpc', auth='public', csrf=False)
    def api_kpi(self, **kwargs):
        user = self._auth_check()
        if not user:
            return {'error': 'unauthorized'}
        is_subdit_sp = user.has_group('petapantau.group_subdit_patroli')
        utc_start, utc_end = _today_utc_range_wib()

        P      = request.env['petapantau.patroli'].sudo()
        base_p = ([('subdit_id', '=', user.subdit_id.id)] if is_subdit_sp
                  else [('polsek_id', '=', user.polsek_id.id)] if user.polsek_id
                  else [('polres_id', '=', user.polres_id.id)])
        today_domain = base_p + [('tanggal_mulai', '>=', utc_start),
                                 ('tanggal_mulai', '<=', utc_end)]
        total_p = P.search_count(base_p)
        today_p = P.search_count(today_domain)
        proses_p = P.search_count(base_p + [('state', '=', 'PROSES')])
        titik_total = sum(r['lokasi_count'] for r in P.search_read(base_p, ['lokasi_count']))
        titik_today = sum(r['lokasi_count'] for r in P.search_read(today_domain, ['lokasi_count']))
        personel_total = sum(r['personel_count'] for r in P.search_read(base_p, ['personel_count']))

        def _fmt(dt):
            return dt.strftime('%Y-%m-%d %H:%M:%S') if dt else ''

        pt_rec = P.search_read(base_p, ['id', 'code', 'state', 'tanggal_mulai', 'kecamatan_id'],
                               order='tanggal_mulai desc', limit=5)
        activities = [{
            'type': 'patroli', 'id': r['id'], 'code': r['code'], 'state': r['state'],
            'tanggal': _fmt(r['tanggal_mulai']),
            'lokasi': r['kecamatan_id'][1] if r.get('kecamatan_id') else '',
        } for r in pt_rec]

        return {
            'patroli': {
                'total': total_p, 'today': today_p, 'proses': proses_p,
                'titik_total': titik_total, 'titik_today': titik_today,
                'personel': personel_total,
            },
            'recent': activities,
        }

    # ── API: Weekly chart data ────────────────────────────────────────────────

    @http.route('/petapantau/api/weekly', type='jsonrpc', auth='public', csrf=False)
    def api_weekly(self, **kwargs):
        user = self._auth_check()
        if not user:
            return {'error': 'unauthorized'}
        is_subdit_sp = user.has_group('petapantau.group_subdit_patroli')
        SP   = request.env['petapantau.patroli'].sudo()
        base = ([('subdit_id', '=', user.subdit_id.id)] if is_subdit_sp
                else [('polsek_id', '=', user.polsek_id.id)] if user.polsek_id
                else [('polres_id', '=', user.polres_id.id)])

        now_wib    = datetime.utcnow() + _WIB_OFFSET
        today_wib  = now_wib.date()
        day_names  = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
        days = []
        for i in range(6, -1, -1):
            d        = today_wib - timedelta(days=i)
            wib_s    = datetime(d.year, d.month, d.day, 0, 0, 0)
            wib_e    = datetime(d.year, d.month, d.day, 23, 59, 59)
            utc_s    = (wib_s - _WIB_OFFSET).strftime('%Y-%m-%d %H:%M:%S')
            utc_e    = (wib_e - _WIB_OFFSET).strftime('%Y-%m-%d %H:%M:%S')
            dom      = base + [('tanggal_mulai', '>=', utc_s),
                                ('tanggal_mulai', '<=', utc_e)]
            count    = SP.search_count(dom)
            days.append({'label': day_names[d.weekday()], 'date': str(d), 'count': count})
        return {'days': days}

    # ── API: Lokasi & Wilayah ─────────────────────────────────────────────────


    @http.route('/petapantau/api/kecamatan', type='jsonrpc', auth='public', csrf=False)
    def api_kecamatan(self, kabupaten_id=None, **kwargs):
        user = self._auth_check()
        if not user or not kabupaten_id:
            return []
        domain = [('kabupaten_id', '=', int(kabupaten_id))]
        if user.polsek_id:
            domain.append(('polsek_id', '=', user.polsek_id.id))
        return request.env['petapantau.kecamatan'].sudo().search_read(
            domain, ['id', 'name'], order='name asc'
        )

    @http.route('/petapantau/api/desa', type='jsonrpc', auth='public', csrf=False)
    def api_desa(self, kecamatan_id=None, **kwargs):
        user = self._auth_check()
        if not user or not kecamatan_id:
            return []
        return request.env['petapantau.desa'].sudo().search_read(
            [('kecamatan_id', '=', int(kecamatan_id))], ['id', 'name'], order='name asc'
        )

    # ── API: List records ────────────────────────────────────────────────────


    # ── API: Submit (create) ──────────────────────────────────────────────────


    # ── API: Record detail ────────────────────────────────────────────────────


    # ── API: Personel ─────────────────────────────────────────────────────────


    # ── API: Update foto profil ───────────────────────────────────────────────

    @http.route('/petapantau/api/update_photo', type='jsonrpc', auth='public', csrf=False)
    def api_update_photo(self, foto_data=None, **kwargs):
        user = self._auth_check()
        if not user or not foto_data:
            return {'error': 'unauthorized'}
        try:
            if ',' in foto_data:
                foto_data = foto_data.split(',', 1)[1]
            request.env['res.users'].sudo().browse(user.id).write({'image_1920': foto_data})
            return {'success': True}
        except Exception as e:
            _logger.error('update_photo error: %s', e, exc_info=True)
            return self._error(e)

    # ── API: Foto ─────────────────────────────────────────────────────────────


    # ── API: Set Selesai ──────────────────────────────────────────────────────


    def _check_patroli_access(self, user, record_id):
        rec = request.env['petapantau.patroli'].sudo().browse(int(record_id))
        if not rec.exists():
            return None
        if user.has_group('petapantau.group_subdit_patroli'):
            if rec.subdit_id:
                return rec if rec.subdit_id.id == user.subdit_id.id else None
            # fallback data lama sebelum migrasi
            return rec if rec.create_uid.id == user.id else None
        if rec.polres_id.id != user.polres_id.id:
            return None
        if user.polsek_id and rec.polsek_id and rec.polsek_id.id != user.polsek_id.id:
            return None
        return rec

    def _lokasi_patroli_authorized(self, user, lokasi):
        if not lokasi.exists():
            return False
        if user.has_group('petapantau.group_subdit_patroli'):
            p = lokasi.patroli_id
            if p.subdit_id:
                return p.subdit_id.id == user.subdit_id.id
            return p.create_uid.id == user.id
        return lokasi.patroli_id.polres_id.id == user.polres_id.id

    def _get_polda_polres(self):
        """Polres level Polda (tanpa polsek) — auto-assign untuk Subdit Patroli."""
        return request.env['petapantau.polres'].sudo().search([('polsek_count', '=', 0)], limit=1)

    @http.route('/petapantau/api/patroli/list', type='jsonrpc', auth='public', csrf=False)
    def api_patroli_list(self, offset=0, limit=20, filter=None, kabupaten_id=None, state=None, **kwargs):
        user = self._auth_check()
        if not user:
            return []
        is_subdit_sp = user.has_group('petapantau.group_subdit_patroli')
        P    = request.env['petapantau.patroli'].sudo()
        base = ([('subdit_id', '=', user.subdit_id.id)] if is_subdit_sp
                else [('polsek_id', '=', user.polsek_id.id)] if user.polsek_id
                else [('polres_id', '=', user.polres_id.id)])
        if filter == 'today':
            utc_start, utc_end = _today_utc_range_wib()
            base = base + [('tanggal_mulai', '>=', utc_start),
                           ('tanggal_mulai', '<=', utc_end)]
        elif filter == 'aktif':
            base = base + [('state', '=', 'PROSES')]
        if kabupaten_id:
            base = base + [('kabupaten_id', '=', int(kabupaten_id))]
        if state:
            base = base + [('state', '=', state)]
        records = P.search_read(
            base,
            ['id', 'code', 'state', 'tanggal_mulai', 'personel_count', 'lokasi_count', 'polres_id', 'kabupaten_id'],
            order='tanggal_mulai desc',
            offset=int(offset),
            limit=int(limit),
        )
        for r in records:
            if r.get('tanggal_mulai'):
                r['tanggal_mulai'] = r['tanggal_mulai'].strftime('%Y-%m-%d %H:%M:%S')
        return records

    @http.route('/petapantau/api/patroli/record', type='jsonrpc', auth='public', csrf=False)
    def api_patroli_record(self, record_id=None, **kwargs):
        user = self._auth_check()
        if not user or not record_id:
            return {'error': 'unauthorized'}
        rec = self._check_patroli_access(user, record_id)
        if not rec:
            return {'error': 'not found'}

        def _fmt(dt):
            return dt.strftime('%Y-%m-%d %H:%M:%S') if dt else ''

        return {
            'id':              rec.id,
            'code':            rec.code,
            'state':           rec.state,
            'polres_nama':     rec.polres_id.name    if rec.polres_id    else '',
            'polsek_nama':     rec.polsek_id.name    if rec.polsek_id    else '',
            'kabupaten_nama':  rec.kabupaten_id.name if rec.kabupaten_id else '',
            'kecamatan_nama':  rec.kecamatan_id.name if rec.kecamatan_id else '',
            'desa_nama':       rec.desa_id.name      if rec.desa_id      else '',
            'tanggal_mulai':   _fmt(rec.tanggal_mulai),
            'tanggal_selesai': _fmt(rec.tanggal_selesai),
            'personel_count':  rec.personel_count,
            'lokasi_count':    rec.lokasi_count,
            'keterangan':      rec.keterangan or '',
            'personel': [
                {'id': p.id, 'nama_lengkap': p.nama_lengkap, 'pangkat': p.pangkat or ''}
                for p in rec.personel_ids
            ],
            'lokasi': [
                {
                    'id':        l.id,
                    'tanggal':   _fmt(l.tanggal),
                    'latitude':  l.latitude,
                    'longitude': l.longitude,
                    'catatan':   l.catatan or '',
                    'has_foto':  bool(l.foto),
                }
                for l in rec.lokasi_ids.sorted('tanggal')
            ],
        }

    @http.route('/petapantau/api/patroli/create', type='jsonrpc', auth='public', csrf=False)
    def api_patroli_create(self, **kwargs):
        user = self._auth_check()
        if not user:
            return {'error': 'Sesi habis. Silakan login kembali.'}
        is_subdit_sp = user.has_group('petapantau.group_subdit_patroli')
        try:
            if is_subdit_sp:
                resolved_polsek = False
                polda = self._get_polda_polres()
                if not polda:
                    return {'error': 'Data Polda tidak ditemukan'}
                resolved_polres = polda.id
            else:
                if user.polsek_id:
                    resolved_polsek = user.polsek_id.id
                elif kwargs.get('polsek_id'):
                    ps = request.env['petapantau.polsek'].sudo().browse(int(kwargs['polsek_id']))
                    if not ps.exists() or ps.polres_id.id != user.polres_id.id:
                        return {'error': 'unauthorized'}
                    resolved_polsek = ps.id
                else:
                    resolved_polsek = False
                resolved_polres = user.polres_id.id
            client_ip = self._client_ip()
            client_ua = parse_user_agent(request.httprequest.environ.get('HTTP_USER_AGENT', ''))
            vals = {
                'polres_id':     resolved_polres,
                'polsek_id':     resolved_polsek,
                'subdit_id':     user.subdit_id.id if is_subdit_sp and user.subdit_id else False,
                'kabupaten_id':  int(kwargs['kabupaten_id']) if kwargs.get('kabupaten_id') else False,
                'kecamatan_id':  int(kwargs['kecamatan_id']) if kwargs.get('kecamatan_id') else False,
                'desa_id':       int(kwargs['desa_id'])      if kwargs.get('desa_id')      else False,
                'tanggal_mulai': _wib_to_utc(kwargs.get('tanggal_mulai')) or False,
                'keterangan':    kwargs.get('keterangan') or '',
                'state':         'PROSES',
                'submitter_ip':  client_ip,
                'submitter_ua':  client_ua,
            }
            record = request.env['petapantau.patroli'].with_user(user.id).create(vals)
            return {'success': True, 'code': record.code, 'record_id': record.id}
        except Exception as e:
            _logger.error('Patroli create error: %s', e, exc_info=True)
            return self._error(e)

    @http.route('/petapantau/api/patroli/set_selesai', type='jsonrpc', auth='public', csrf=False)
    def api_patroli_set_selesai(self, record_id=None, tanggal_selesai=None, **kwargs):
        user = self._auth_check()
        if not user or not record_id:
            return {'error': 'unauthorized'}
        if not tanggal_selesai:
            return {'error': 'Tanggal selesai harus diisi'}
        rec = self._check_patroli_access(user, record_id)
        if not rec:
            return {'error': 'unauthorized'}
        try:
            rec.with_user(user.id).write({
                'state':           'SELESAI',
                'tanggal_selesai': _wib_to_utc(tanggal_selesai),
            })
            return {'success': True}
        except Exception as e:
            return self._error(e)

    @http.route('/petapantau/api/patroli/personel_add', type='jsonrpc', auth='public', csrf=False)
    def api_patroli_personel_add(self, record_id=None, nama=None, pangkat=None, **kwargs):
        user = self._auth_check()
        if not user or not record_id or not nama:
            return {'error': 'Data tidak lengkap'}
        rec = self._check_patroli_access(user, record_id)
        if not rec:
            return {'error': 'unauthorized'}
        try:
            p = request.env['petapantau.personel_patroli'].with_user(user.id).create({
                'patroli_id': rec.id,
                'nama':       nama.strip(),
                'pangkat':    (pangkat or '').strip(),
            })
            return {'success': True, 'id': p.id, 'nama_lengkap': p.nama_lengkap}
        except Exception as e:
            return self._error(e)

    @http.route('/petapantau/api/patroli/personel_remove', type='jsonrpc', auth='public', csrf=False)
    def api_patroli_personel_remove(self, personel_id=None, **kwargs):
        user = self._auth_check()
        if not user or not personel_id:
            return {'error': 'unauthorized'}
        try:
            p = request.env['petapantau.personel_patroli'].sudo().browse(int(personel_id))
            if not p.exists():
                return {'error': 'unauthorized'}
            if user.has_group('petapantau.group_subdit_patroli'):
                pt = p.patroli_id
                if pt.subdit_id and pt.subdit_id.id != user.subdit_id.id:
                    return {'error': 'unauthorized'}
                elif not pt.subdit_id and pt.create_uid.id != user.id:
                    return {'error': 'unauthorized'}
            elif p.patroli_id.polres_id.id != user.polres_id.id:
                return {'error': 'unauthorized'}
            p.with_user(user.id).unlink()
            return {'success': True}
        except Exception as e:
            return self._error(e)

    @http.route('/petapantau/api/patroli/lokasi_add', type='jsonrpc', auth='public', csrf=False)
    def api_patroli_lokasi_add(self, record_id=None, latitude=None, longitude=None,
                                catatan=None, tanggal=None, **kwargs):
        user = self._auth_check()
        if not user or not record_id:
            return {'error': 'unauthorized'}
        rec = self._check_patroli_access(user, record_id)
        if not rec:
            return {'error': 'unauthorized'}
        try:
            tgl_utc = (_wib_to_utc(tanggal) if tanggal
                       else datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'))
            l = request.env['petapantau.lokasi_patroli'].with_user(user.id).create({
                'patroli_id': rec.id,
                'tanggal':    tgl_utc,
                'latitude':   float(latitude)  if latitude  else 0.0,
                'longitude':  float(longitude) if longitude else 0.0,
                'catatan':    catatan or '',
            })
            return {'success': True, 'id': l.id}
        except Exception as e:
            _logger.error('Patroli lokasi_add error: %s', e, exc_info=True)
            return self._error(e)

    @http.route('/petapantau/api/patroli/lokasi_foto', type='jsonrpc', auth='public', csrf=False)
    def api_patroli_lokasi_foto(self, lokasi_id=None, foto_data=None, foto_filename=None, **kwargs):
        user = self._auth_check()
        if not user or not lokasi_id or not foto_data:
            return {'error': 'Data tidak lengkap'}
        try:
            l = request.env['petapantau.lokasi_patroli'].sudo().browse(int(lokasi_id))
            if not self._lokasi_patroli_authorized(user, l):
                return {'error': 'unauthorized'}
            if ',' in foto_data:
                foto_data = foto_data.split(',', 1)[1]
            l.with_user(user.id).write({'foto': foto_data})
            return {'success': True}
        except Exception as e:
            _logger.error('Patroli lokasi_foto error: %s', e, exc_info=True)
            return self._error(e)

    # ── PUBLIC PATROLI FORM ───────────────────────────────────────────────────

    def _patroli_pub_valid(self, token):
        if not token or not isinstance(token, str) or len(token) > 200:
            return False
        return request.env['petapantau.patroli.form_config'].sudo().search(
            [('public_token', '=', token), ('is_aktif', '=', True)], limit=1
        )

    def _patroli_pub_record(self, config, record_id):
        """Patroli yang boleh diakses form publik ini: harus dibuat oleh form_config yang sama."""
        try:
            rid = int(record_id)
        except (TypeError, ValueError):
            return request.env['petapantau.patroli']
        rec = request.env['petapantau.patroli'].sudo().browse(rid)
        if not rec.exists() or rec.form_config_id != config:
            return request.env['petapantau.patroli']
        return rec

    @http.route('/patroli/<string:token>', type='http', auth='public', csrf=False, website=False)
    def patroli_public_form(self, token, **kwargs):
        config = self._patroli_pub_valid(token)
        if not config:
            return request.not_found()
        is_subdit_form = bool(config.subdit_id)
        auto_polres_id = None
        if is_subdit_form:
            polda = self._get_polda_polres()
            auto_polres_id = polda.id if polda else None
        polres_list = [] if is_subdit_form else request.env['petapantau.polres'].sudo().search_read(
            [], ['id', 'name'], order='name asc'
        )
        init_data = json.dumps({
            'token':          token,
            'config_name':    config.name,
            'polres_list':    polres_list,
            'is_subdit_form': is_subdit_form,
            'auto_polres_id': auto_polres_id,
        })
        return request.render('petapantau.template_patroli_public_form', {
            'config':    config,
            'init_data': init_data,
        })

    @http.route('/patroli/api/polsek', type='jsonrpc', auth='public', csrf=False)
    def patroli_pub_polsek(self, polres_id, token=None, **kwargs):
        if not token or not self._patroli_pub_valid(token):
            return []
        try:
            return request.env['petapantau.polsek'].sudo().search_read(
                [('polres_id', '=', int(polres_id))], ['id', 'name'], order='name asc'
            )
        except Exception:
            return []

    @http.route('/patroli/api/kabupaten', type='jsonrpc', auth='public', csrf=False)
    def patroli_pub_kabupaten(self, polres_id, token=None, **kwargs):
        if not token or not self._patroli_pub_valid(token):
            return []
        try:
            polres = request.env['petapantau.polres'].sudo().browse(int(polres_id))
            if not polres.exists():
                return []
            domain = [] if polres.polsek_count == 0 else [('polres_id', '=', polres.id)]
            return request.env['petapantau.kabupaten'].sudo().search_read(
                domain, ['id', 'name'], order='name asc'
            )
        except Exception:
            return []

    @http.route('/patroli/api/kecamatan', type='jsonrpc', auth='public', csrf=False)
    def patroli_pub_kecamatan(self, kabupaten_id, token=None, **kwargs):
        if not token or not self._patroli_pub_valid(token):
            return []
        try:
            return request.env['petapantau.kecamatan'].sudo().search_read(
                [('kabupaten_id', '=', int(kabupaten_id))], ['id', 'name'], order='name asc'
            )
        except Exception:
            return []

    @http.route('/patroli/api/desa', type='jsonrpc', auth='public', csrf=False)
    def patroli_pub_desa(self, kecamatan_id, token=None, **kwargs):
        if not token or not self._patroli_pub_valid(token):
            return []
        try:
            return request.env['petapantau.desa'].sudo().search_read(
                [('kecamatan_id', '=', int(kecamatan_id))], ['id', 'name'], order='name asc'
            )
        except Exception:
            return []

    @http.route('/patroli/api/submit', type='jsonrpc', auth='public', csrf=False)
    def patroli_pub_submit(self, token, data, **kwargs):
        # ── Rate limiting ─────────────────────────────────────────────────────
        client_ip = self._client_ip()
        if not check_rate_limit(client_ip, 'patroli'):
            _logger.warning('patroli_pub_submit: rate limit exceeded (ip=%s)', client_ip)
            return {'error': 'Terlalu banyak pengiriman. Silakan coba lagi dalam 1 jam.'}

        # ── Sanitasi token & data ─────────────────────────────────────────────
        if not isinstance(token, str) or len(token) > 200:
            return {'error': 'Token tidak valid'}
        if not isinstance(data, dict):
            return {'error': 'Data tidak valid'}

        config = self._patroli_pub_valid(token)
        if not config:
            return {'error': 'unauthorized'}

        # Batas berbasis DB (berlaku lintas worker): patroli baru dari IP ini dalam 1 jam terakhir
        if client_ip and request.env['petapantau.patroli'].sudo().search_count([
            ('submitter_ip', '=', client_ip),
            ('create_date', '>=', datetime.utcnow() - timedelta(seconds=RATE_LIMIT_WINDOW)),
        ]) >= RATE_LIMIT_MAX:
            return {'error': 'Terlalu banyak pengiriman. Silakan coba lagi dalam 1 jam.'}

        # ── Validasi wilayah ──────────────────────────────────────────────────
        try:
            kabupaten_id = int(data.get('kabupaten_id') or 0)
        except (ValueError, TypeError):
            kabupaten_id = 0
        if not kabupaten_id:
            return {'error': 'Kabupaten/Kota wajib dipilih'}

        try:
            kecamatan_id = int(data.get('kecamatan_id') or 0)
        except (ValueError, TypeError):
            kecamatan_id = 0
        if not kecamatan_id:
            return {'error': 'Kecamatan wajib dipilih'}
        if not request.env['petapantau.kecamatan'].sudo().search_count([
            ('id', '=', kecamatan_id), ('kabupaten_id', '=', kabupaten_id),
        ]):
            return {'error': 'Kecamatan tidak valid untuk kabupaten yang dipilih'}

        try:
            desa_id = int(data.get('desa_id') or 0)
        except (ValueError, TypeError):
            desa_id = 0
        if not desa_id:
            return {'error': 'Desa/Kelurahan wajib dipilih'}
        if not request.env['petapantau.desa'].sudo().search_count([
            ('id', '=', desa_id), ('kecamatan_id', '=', kecamatan_id),
        ]):
            return {'error': 'Desa/Kelurahan tidak valid untuk kecamatan yang dipilih'}

        # ── Validasi tanggal mulai ────────────────────────────────────────────
        tgl_mulai_raw = (data.get('tanggal_mulai') or '').replace('T', ' ').strip()
        if tgl_mulai_raw:
            parsed_ok = False
            for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
                try:
                    datetime.strptime(tgl_mulai_raw, fmt)
                    parsed_ok = True
                    break
                except ValueError:
                    continue
            if not parsed_ok:
                return {'error': 'Format tanggal mulai tidak valid'}

        # ── Validasi keterangan ───────────────────────────────────────────────
        keterangan = (data.get('keterangan') or '').strip()
        if len(keterangan) > 5000:
            return {'error': 'Keterangan terlalu panjang (maks 5000 karakter)'}

        try:
            if config.subdit_id:
                polda = self._get_polda_polres()
                if not polda:
                    return {'error': 'Konfigurasi Polda tidak ditemukan'}
                polres_id = polda.id
                polsek_id = False
            else:
                try:
                    polres_id = int(data.get('polres_id') or 0)
                except (ValueError, TypeError):
                    polres_id = 0
                if not polres_id:
                    return {'error': 'Polres wajib dipilih'}
                if not request.env['petapantau.polres'].sudo().search_count(
                        [('id', '=', polres_id)]):
                    return {'error': 'Polres tidak valid'}
                try:
                    polsek_id = int(data.get('polsek_id') or 0) or False
                except (ValueError, TypeError):
                    polsek_id = False
                if polsek_id and not request.env['petapantau.polsek'].sudo().search_count([
                    ('id', '=', polsek_id), ('polres_id', '=', polres_id),
                ]):
                    return {'error': 'Polsek tidak valid untuk Polres yang dipilih'}

            vals = {
                'polres_id':     polres_id,
                'polsek_id':     polsek_id,
                'subdit_id':     config.subdit_id.id if config.subdit_id else False,
                'form_config_id': config.id,
                'kabupaten_id':  kabupaten_id,
                'kecamatan_id':  kecamatan_id,
                'desa_id':       desa_id,
                'keterangan':    keterangan,
                'tanggal_mulai': _wib_to_utc(tgl_mulai_raw) if tgl_mulai_raw else False,
                'state':         'PROSES',
                'submitter_ip':  client_ip,
                'submitter_ua':  parse_user_agent(
                    request.httprequest.environ.get('HTTP_USER_AGENT', '')
                ),
            }
            result = request.env['petapantau.patroli'].sudo().create(vals)
            return {'success': True, 'code': result.code, 'record_id': result.id}
        except Exception as e:
            _logger.error('patroli_pub_submit error: %s', e, exc_info=True)
            return self._error(e)

    @http.route('/patroli/api/personel_add', type='jsonrpc', auth='public', csrf=False)
    def patroli_pub_personel_add(self, token, record_id, nama, pangkat=None, **kwargs):
        config = self._patroli_pub_valid(token) if token else False
        if not config:
            return {'error': 'unauthorized'}
        if not self._pub_write_allowed():
            return {'error': 'Terlalu banyak permintaan. Silakan coba lagi nanti.'}
        nama = (nama or '').strip()
        if not nama:
            return {'error': 'Nama personel wajib diisi'}
        if len(nama) > 200:
            return {'error': 'Nama personel terlalu panjang (maks 200 karakter)'}
        pangkat = (pangkat or '').strip()
        if len(pangkat) > 100:
            return {'error': 'Pangkat terlalu panjang (maks 100 karakter)'}
        try:
            rec = self._patroli_pub_record(config, record_id)
            if not rec:
                return {'error': 'Data tidak ditemukan'}
            if rec.state != 'PROSES':
                return {'error': 'Tidak dapat menambah personel pada patroli yang sudah selesai'}
            p = request.env['petapantau.personel_patroli'].sudo().create({
                'patroli_id': rec.id,
                'nama':       nama,
                'pangkat':    pangkat,
            })
            return {'success': True, 'id': p.id, 'nama_lengkap': p.nama_lengkap}
        except Exception as e:
            _logger.error('patroli_pub_personel_add error: %s', e, exc_info=True)
            return self._error(e)

    @http.route('/patroli/api/personel_remove', type='jsonrpc', auth='public', csrf=False)
    def patroli_pub_personel_remove(self, token, personel_id, **kwargs):
        config = self._patroli_pub_valid(token) if token else False
        if not config:
            return {'error': 'unauthorized'}
        if not self._pub_write_allowed():
            return {'error': 'Terlalu banyak permintaan. Silakan coba lagi nanti.'}
        try:
            p = request.env['petapantau.personel_patroli'].sudo().browse(int(personel_id))
            if not p.exists() or p.patroli_id.form_config_id != config:
                return {'error': 'not found'}
            if p.patroli_id.state != 'PROSES':
                return {'error': 'Tidak dapat menghapus personel dari patroli yang sudah selesai'}
            p.sudo().unlink()
            return {'success': True}
        except Exception as e:
            _logger.error('patroli_pub_personel_remove error: %s', e, exc_info=True)
            return self._error(e)

    @http.route('/patroli/api/lokasi_add', type='jsonrpc', auth='public', csrf=False)
    def patroli_pub_lokasi_add(self, token, record_id, latitude, longitude,
                                tanggal=None, catatan=None, foto=None, **kwargs):
        config = self._patroli_pub_valid(token) if token else False
        if not config:
            return {'error': 'unauthorized'}
        if not self._pub_write_allowed():
            return {'error': 'Terlalu banyak permintaan. Silakan coba lagi nanti.'}

        # ── Validasi wajib ────────────────────────────────────────────────────
        if not tanggal:
            return {'error': 'Tanggal dan jam wajib diisi'}
        try:
            lat_f = float(latitude)
            lng_f = float(longitude)
        except (TypeError, ValueError):
            return {'error': 'Koordinat GPS tidak valid'}
        if lat_f == 0.0 and lng_f == 0.0:
            return {'error': 'Koordinat GPS wajib diambil sebelum menyimpan titik'}
        if not (-90 <= lat_f <= 90):
            return {'error': 'Nilai latitude tidak valid'}
        if not (-180 <= lng_f <= 180):
            return {'error': 'Nilai longitude tidak valid'}
        if not foto:
            return {'error': 'Foto dokumentasi wajib diisi'}
        foto_b64 = (
            foto.split(',', 1)[1]
            if isinstance(foto, str) and ',' in foto
            else foto
        )
        if len(foto_b64) > 700_000:
            return {'error': 'Ukuran foto terlalu besar. Pilih foto lain.'}
        if not is_valid_image(foto_b64):
            return {'error': 'Foto harus berupa file gambar (JPEG, PNG, atau WebP)'}
        catatan = (catatan or '').strip()
        if len(catatan) > 2000:
            return {'error': 'Catatan terlalu panjang (maks 2000 karakter)'}

        rec = self._patroli_pub_record(config, record_id)
        if not rec:
            return {'error': 'Data tidak ditemukan'}
        if rec.state != 'PROSES':
            return {'error': 'Tidak dapat menambah titik lokasi pada patroli yang sudah selesai'}
        try:
            tgl_str = (tanggal or '').replace('T', ' ')
            tgl_utc = _wib_to_utc(tgl_str) if tgl_str else datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            tanggal_display = tgl_str[11:16] if len(tgl_str) >= 16 else (datetime.utcnow() + timedelta(hours=7)).strftime('%H:%M')
            vals = {
                'patroli_id':    rec.id,
                'tanggal':       tgl_utc,
                'latitude':      lat_f,
                'longitude':     lng_f,
                'catatan':       catatan,
                'foto':          foto_b64,
                'foto_filename': 'patroli_lokasi.jpg',
            }
            l = request.env['petapantau.lokasi_patroli'].sudo().create(vals)
            return {'success': True, 'id': l.id, 'tanggal_display': tanggal_display}
        except Exception as e:
            _logger.error('patroli_pub_lokasi_add error: %s', e, exc_info=True)
            return self._error(e)

    @http.route('/patroli/api/lokasi_remove', type='jsonrpc', auth='public', csrf=False)
    def patroli_pub_lokasi_remove(self, token, lokasi_id, **kwargs):
        config = self._patroli_pub_valid(token) if token else False
        if not config:
            return {'error': 'unauthorized'}
        if not self._pub_write_allowed():
            return {'error': 'Terlalu banyak permintaan. Silakan coba lagi nanti.'}
        try:
            l = request.env['petapantau.lokasi_patroli'].sudo().browse(int(lokasi_id))
            if not l.exists() or l.patroli_id.form_config_id != config:
                return {'error': 'not found'}
            if l.patroli_id.state != 'PROSES':
                return {'error': 'Tidak dapat menghapus titik lokasi dari patroli yang sudah selesai'}
            l.sudo().unlink()
            return {'success': True}
        except Exception as e:
            _logger.error('patroli_pub_lokasi_remove error: %s', e, exc_info=True)
            return self._error(e)

    @http.route('/patroli/api/set_selesai', type='jsonrpc', auth='public', csrf=False)
    def patroli_pub_set_selesai(self, token, record_id, tanggal_selesai, **kwargs):
        config = self._patroli_pub_valid(token) if token else False
        if not config:
            return {'error': 'unauthorized'}
        if not self._pub_write_allowed():
            return {'error': 'Terlalu banyak permintaan. Silakan coba lagi nanti.'}
        if not tanggal_selesai:
            return {'error': 'Tanggal selesai harus diisi'}
        tgl_str = tanggal_selesai.replace('T', ' ').strip()
        parsed_ok = False
        for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
            try:
                datetime.strptime(tgl_str, fmt)
                parsed_ok = True
                break
            except ValueError:
                continue
        if not parsed_ok:
            return {'error': 'Format tanggal selesai tidak valid'}
        try:
            rec = self._patroli_pub_record(config, record_id)
            if not rec:
                return {'error': 'Data tidak ditemukan'}
            if rec.state == 'SELESAI':
                return {'success': True}
            if rec.personel_count == 0:
                return {'error': 'Minimal 1 personel wajib ditambahkan sebelum menyelesaikan patroli'}
            if rec.lokasi_count == 0:
                return {'error': 'Minimal 1 titik lokasi wajib ditambahkan sebelum menyelesaikan patroli'}
            rec.sudo().write({
                'state':           'SELESAI',
                'tanggal_selesai': _wib_to_utc(tgl_str),
            })
            return {'success': True}
        except Exception as e:
            _logger.error('patroli_pub_set_selesai error: %s', e, exc_info=True)
            return self._error(e)

    @http.route('/petapantau/api/patroli/lokasi_remove', type='jsonrpc', auth='public', csrf=False)
    def api_patroli_lokasi_remove(self, lokasi_id=None, **kwargs):
        user = self._auth_check()
        if not user or not lokasi_id:
            return {'error': 'unauthorized'}
        try:
            l = request.env['petapantau.lokasi_patroli'].sudo().browse(int(lokasi_id))
            if not self._lokasi_patroli_authorized(user, l):
                return {'error': 'unauthorized'}
            l.with_user(user.id).unlink()
            return {'success': True}
        except Exception as e:
            _logger.error('Patroli lokasi_remove error: %s', e, exc_info=True)
            return self._error(e)
