{
    'name': 'PetaPantau',
    'version': '19.0.1.0.0',
    'summary': 'PetaPantau — Pemetaan Terpadu Pemantauan Keamanan Wilayah (Polda DIY): dashboard peta, kriminalitas, bencana, lalu lintas, patroli, dan lokasi penting.',
    'description': """
PetaPantau — Pemetaan Terpadu Pemantauan Keamanan Wilayah

Modul Odoo 19 untuk pemetaan dan pemantauan keamanan wilayah Polda D.I. Yogyakarta.

FITUR:
1. Dashboard peta interaktif (Leaflet + GeoJSON + ECharts): Peta Umum, Kriminalitas,
   Bencana, Lalu Lintas, Patroli, dan Lokasi Penting; choropleth & drill-down
   Kabupaten -> Kecamatan -> Desa/Kelurahan.
2. Data Kriminalitas (LP A/B) + wizard Import LP dari dokumen .docx.
3. Data Bencana, Lalu Lintas, dan Lokasi Penting.
4. Patroli: backend dan aplikasi mobile PWA (/petapantau).
5. Data wilayah D.I. Yogyakarta: 5 kabupaten/kota, 78 kecamatan, desa/kelurahan beserta batas GeoJSON.

Akses berbasis peran: Admin, Subdit, Subdit Patroli, Polres, Polsek, User, Dashboard Viewer.
""",
    'category': 'Tools',
    'author': 'Cv Sel Studio',
    'website': 'https://selstudio.id',
    'depends': ['base', 'web','mail'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/sequence_data.xml',
        'data/wilayah_diy.xml',
        'views/polres_views.xml',
        'views/polsek_views.xml',
        'views/kabupaten_views.xml',
        'views/kecamatan_views.xml',
        'views/desa_views.xml',
        'views/sumber_dokumen_views.xml',
        'views/kategori_kriminal_views.xml',
        'views/sub_kategori_kriminal_views.xml',
        'views/kategori_bencana_views.xml',
        'views/kategori_lalu_lintas_views.xml',
        'views/kategori_lokasi_views.xml',
        'views/jenis_jalan_views.xml',
        'views/modus_operandi_views.xml',
        'views/jenis_tkp_views.xml',
        'views/dashboard_views.xml',
        'views/subdit_views.xml',
        'wizard/import_lp_wizard_views.xml',
        'views/kriminalitas_views.xml',
        'views/bencana_views.xml',
        'views/lalu_lintas_views.xml',
        'views/patroli_views.xml',
        'views/lokasi_penting_views.xml',
        'views/sub_status_perkara_views.xml',
        'views/mobile_app_templates.xml',
        'views/res_users_views.xml',
        'views/menu.xml',
        'views/menu_restrictions.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'petapantau/static/src/css/login.css',
        ],
        'web.assets_backend': [
            'petapantau/static/lib/leaflet/leaflet.css',
            'petapantau/static/src/css/map_widget.css',
            'petapantau/static/lib/leaflet/leaflet.js',
            'petapantau/static/lib/leaflet-markercluster/MarkerCluster.css',
            'petapantau/static/lib/leaflet-markercluster/MarkerCluster.Default.css',
            'petapantau/static/lib/leaflet-markercluster/leaflet.markercluster.js',
            'petapantau/static/lib/flatpickr/flatpickr.min.css',
            'petapantau/static/lib/flatpickr/flatpickr.min.js',
            'petapantau/static/lib/echart/echarts.min.js',
            'petapantau/static/src/css/dashboard_map.css',
            'petapantau/static/src/css/dashboard_theme.css',
            'petapantau/static/src/xml/dashboard_map.xml',
            'petapantau/static/lib/leaflet/leaflet.editable.js',
            'petapantau/static/src/js/kabupaten_map_widget.js',
            'petapantau/static/src/xml/geojson_map_widget.xml',
            'petapantau/static/src/css/backend.css',
            'petapantau/static/src/css/kabupaten_map_widget.css',
            'petapantau/static/src/js/latlon_leaflet_widget.js',
            'petapantau/static/src/xml/latlon_leaflet_widget.xml',
            'petapantau/static/src/css/latlon_leaflet_widget.css',
            'petapantau/static/src/xml/image_popup_widget.xml',
            'petapantau/static/src/js/image_popup_widget.js',
            # Dashboard modular
            'petapantau/static/src/js/dashboard_helpers.js',
            'petapantau/static/src/js/dashboard_layer_umum.js',
            'petapantau/static/src/js/dashboard_layer_kriminal.js',
            'petapantau/static/src/js/dashboard_layer_lalin.js',
            'petapantau/static/src/js/dashboard_layer_bencana.js',
            'petapantau/static/src/js/dashboard_layer_lokasi.js',
            'petapantau/static/src/js/dashboard_overlay_lokasi.js',
            'petapantau/static/src/js/dashboard_heatmap.js',
            'petapantau/static/src/js/dashboard_charts_kriminal.js',
            'petapantau/static/src/js/dashboard_charts_bencana.js',
            'petapantau/static/src/js/dashboard_charts_lalin.js',
            'petapantau/static/src/js/dashboard_charts_lokasi.js',
            'petapantau/static/src/js/dashboard_layer_patroli.js',
            'petapantau/static/src/js/dashboard_charts_patroli.js',
            'petapantau/static/src/js/dashboard_map.js',
        ],
    },
    'demo': [
        'demo/00_referensi.xml',
        'demo/01_users.xml',
        'demo/02_operasional.xml',
        'demo/03_heatmap_kriminal.xml',
        'demo/04_heatmap_operasional.xml',
    ],
    'installable': True,
    'application': True,
    'sequence': 1,
    'license': 'LGPL-3',
}