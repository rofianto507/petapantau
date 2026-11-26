/** @odoo-module **/

import { Component, onMounted, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { user } from "@web/core/user";

import { initFilters, wibDateStartUtc, wibDateEndUtc } from "./dashboard_helpers";
import { loadKabupatenLayer } from "./dashboard_layer_umum";
import { loadModeKriminal, removeKriminalLegend } from "./dashboard_layer_kriminal";
import { loadModeLalin, removeLalinLegend } from "./dashboard_layer_lalin";
import { loadModeBencana, removeBencanaLegend } from "./dashboard_layer_bencana";
import { loadModeLokasi, removeLokasiLegend } from "./dashboard_layer_lokasi";
import { loadModePatroli, removePatroliLegend } from "./dashboard_layer_patroli";
import { removeLokasiOverlay } from "./dashboard_overlay_lokasi";
import { updateKriminalCharts, disposeKriminalCharts, updateKriminalTable } from "./dashboard_charts_kriminal";
import { updateBencanaCharts, disposeBencanaCharts, updateBencanaTable } from "./dashboard_charts_bencana";
import { updateLalinCharts, disposeLalinCharts, updateLalinTable } from "./dashboard_charts_lalin";
import { updateLokasiCharts, disposeLokasiCharts, updateLokasiTable } from "./dashboard_charts_lokasi";
import { updatePatroliCharts, disposePatroliCharts, updatePatroliTable } from "./dashboard_charts_patroli";

export class DashboardMap extends Component {
    static template = "petapantau.DashboardMap";
    static props = ["*"];

    setup() {
        this.mapRef          = useRef("mapContainer");
        this.sidebarRef      = useRef("sidebar");
        this.breadcrumbRef   = useRef("breadcrumb");
        this.collapseIcon    = useRef("collapseIcon");
        this.collapseText    = useRef("collapseText");
        this.filterJenisLP          = useRef("filterJenisLP");
        this.filterKategori         = useRef("filterKategori");
        this.filterSubKategori      = useRef("filterSubKategori");
        this.filterTahun            = useRef("filterTahun");
        this.filterPolres           = useRef("filterPolres");
        this.filterState            = useRef("filterState");
        this.filterDateRange        = useRef("filterDateRange");
        this.filterDateClear        = useRef("filterDateClear");
        this.filterDateRangeWrapper = useRef("filterDateRangeWrapper");
        this.filterSummaryRef       = useRef("filterSummary");
        this.sumberInfoRef          = useRef("sumberInfo");
        this.kpiRowRef              = useRef("kpiRow");
        this.mapWrapperRef          = useRef("mapWrapper");
        this.chartRowRef            = useRef("chartRow");
        this.chartBarRef            = useRef("chartBar");
        this.chartDonutRef          = useRef("chartDonut");
        this.chartDonutTitleRef     = useRef("chartDonutTitle");
        this.chartRow2Ref           = useRef("chartRow2");
        this.chartTkpRef            = useRef("chartTkp");
        this.chartSubKatRef         = useRef("chartSubKat");
        this.chartRow3Ref           = useRef("chartRow3");
        this.chartTrendRef          = useRef("chartTrend");
        this.chartWaktuRef          = useRef("chartWaktu");
        this.chartRow4Ref           = useRef("chartRow4");
        this.chartCuratRef          = useRef("chartCurat");
        this.chartCurasRef          = useRef("chartCuras");
        this.chartCuranmorRef       = useRef("chartCuranmor");
        this.chartRow5Ref           = useRef("chartRow5");
        this.chartTahunanRef        = useRef("chartTahunan");
        this.chartBencanaRowRef        = useRef("chartBencanaRow");
        this.chartBencanaBarRef        = useRef("chartBencanaBar");
        this.chartBencanaDonutRef      = useRef("chartBencanaDonut");
        this.chartBencanaDonutTitleRef = useRef("chartBencanaDonutTitle");
        this.chartLalinRowRef          = useRef("chartLalinRow");
        this.chartLalinBarRef          = useRef("chartLalinBar");
        this.chartLalinDonutRef        = useRef("chartLalinDonut");
        this.chartLalinDonutTitleRef   = useRef("chartLalinDonutTitle");
        this.chartLalinRow2Ref         = useRef("chartLalinRow2");
        this.chartLalinJenisJalanRef   = useRef("chartLalinJenisJalan");
        this.chartLalinWaktuRef        = useRef("chartLalinWaktu");
        this.chartLokasiRowRef         = useRef("chartLokasiRow");
        this.chartLokasiBarRef         = useRef("chartLokasiBar");
        this.chartLokasiDonutRef       = useRef("chartLokasiDonut");
        this.chartLokasiDonutTitleRef  = useRef("chartLokasiDonutTitle");
        this.chartPatroliRowRef        = useRef("chartPatroliRow");
        this.chartPatroliBarRef        = useRef("chartPatroliBar");
        this.chartPatroliTrendRef      = useRef("chartPatroliTrend");
        this.chartPatroliWaktuRowRef   = useRef("chartPatroliWaktuRow");
        this.chartPatroliWaktuRef      = useRef("chartPatroliWaktu");
        this.tablePatroliRowRef        = useRef("tablePatroliRow");
        this.tablePatroliBodyRef       = useRef("tablePatroliBody");
        this.tableKriminalRowRef       = useRef("tableKriminalRow");
        this.tableKriminalBodyRef      = useRef("tableKriminalBody");
        this.tableBencanaRowRef        = useRef("tableBencanaRow");
        this.tableBencanaBodyRef       = useRef("tableBencanaBody");
        this.tableLalinRowRef          = useRef("tableLalinRow");
        this.tableLalinBodyRef         = useRef("tableLalinBody");
        this.tableLokasiRowRef         = useRef("tableLokasiRow");
        this.tableLokasiBodyRef        = useRef("tableLokasiBody");

        this.orm    = useService("orm");
        this.action = useService("action");

        this._userPolresId   = null;
        this._userPolresName = null;
        this._isPolsekUser   = false;
        this._isPolresUser   = false;
        this._isSubditUser   = false;
        this._isSubditSP     = false;

        // Reactive state untuk nav security — harus useState agar OWL tidak reset saat re-render
        this.navSecurity = useState({ cls: '' });

        // Status sidebar diingat per browser; tanpa preferensi tersimpan, layar sempit mulai dalam keadaan diminimalkan
        let sidebarPref = null;
        try { sidebarPref = localStorage.getItem('petapantau.sidebar'); } catch (_) { /* mode privat */ }
        this.sidebarOpen    = sidebarPref ? sidebarPref === 'open' : window.innerWidth >= 1100;
        this.currentMode    = 'umum';
        this.currentLevel   = 'kabupaten';
        this.backButton     = null;
        this.comingSoonControl = null;
        this.activeDateFrom = '';
        this.activeDateTo   = '';
        this._filterMode    = null;
        this._echartsBar    = null;
        this._echartsDonut  = null;
        this._echartsTkp    = null;
        this._echartsSubKat = null;
        this._echartsTrend  = null;
        this._echartsWaktu  = null;
        this._echartsCurat    = null;
        this._echartsCuras    = null;
        this._echartsCuranmor = null;
        this._echartsTahunan  = null;
        this._echartsBencanaBar   = null;
        this._echartsBencanaDonut = null;
        this._echartsLalinBar        = null;
        this._echartsLalinDonut      = null;
        this._echartsLalinJenisJalan = null;
        this._echartsLalinWaktu      = null;
        this._echartsLokasiBar       = null;
        this._echartsLokasiDonut     = null;
        this._echartsPatroliBar      = null;
        this._echartsPatroliTrend    = null;

        // Drill-down context — set oleh layer file saat user klik polygon
        this.drillKabupatenId = null;
        this.drillKecamatanId = null;
        this._kriminalTablePage = 1;
        this._bencanaTablePage  = 1;
        this._lalinTablePage    = 1;
        this._lokasiTablePage   = 1;
        this._patroliTablePage  = 1;

        // Overlay lokasi penting (multi-mode)
        this.lokasiOverlaySelected = new Set();
        this.lokasiOverlayControl  = null;

        this._KATEGORI_MODEL = {
            kriminal: 'petapantau.kategori_kriminal',
            bencana:  'petapantau.kategori_bencana',
            lalin:    'petapantau.kategori_lalu_lintas',
            lokasi:   'petapantau.kategori_lokasi',
        };

        onMounted(async () => {
            this._applySidebarState(false);   // terapkan status sidebar tersimpan sebelum peta dibuat
            // Role-based polres filter: cek group dan ambil polres_id via ORM
            try {
                const [isPolsek, isPolresBase, isAdmin, isSubdit, isSubditSP] = await Promise.all([
                    user.hasGroup('petapantau.group_polsek'),
                    user.hasGroup('petapantau.group_polres'),
                    user.hasGroup('petapantau.group_admin'),
                    user.hasGroup('petapantau.group_subdit'),
                    user.hasGroup('petapantau.group_subdit_patroli'),
                ]);
                this._isPolsekUser = !!isPolsek;
                this._isPolresUser = !!isPolresBase && !isAdmin && !isSubdit;
                this._isSubditSP   = !!isSubditSP;
                this._isSubditUser = !!isSubdit && !isSubditSP;
                if (this._isPolsekUser || this._isPolresUser) {
                    const uid = user.userId;
                    if (uid) {
                        const ud = await this.orm.read('res.users', [uid], ['polres_id']);
                        this._userPolresId   = ud[0]?.polres_id?.[0] || null;
                        this._userPolresName = ud[0]?.polres_id?.[1] || null;
                    }
                }
            } catch (_) {}

            // Selalu terapkan nav security (dipanggil di luar try agar tetap jalan walau group check error)
            this._applyNavSecurity();
            await initFilters(this);
            this._initFlatpickr();
            await this._updateFilterVisibility('umum');
            await this._initMap();
            // User may have clicked a different menu while map/KPI was loading.
            // If so, _switchMode already handled the new mode — skip umum init.
            if (this.currentMode !== 'umum') return;
            await this._updateKpiCards('umum');
            if (this.currentMode !== 'umum') return;
            this._updateFilterSummary('umum');
            this._updateSumberDokumenInfo('umum');
            this._updateCharts('umum');
        });
    }

    // Getter: ID polres yang aktif sebagai filter (handle semua role)
    get _polresFilterId() {
        if (this._isPolsekUser) return this._userPolresId || null;
        const v = this.filterPolres?.el?.value;
        return v ? parseInt(v) : null;
    }

    // ─────────────────────────────────────────────
    // FLATPICKR DATE RANGE
    // ─────────────────────────────────────────────
    _initFlatpickr() {
        const el = this.filterDateRange.el;
        if (!el || typeof flatpickr === 'undefined') return;

        this._suppressDateChange = false;
        this._fp = flatpickr(el, {
            mode: 'range',
            dateFormat: 'Y-m-d',
            allowInput: false,
            disableMobile: true,
            onChange: (selectedDates) => {
                if (this._suppressDateChange) return;
                const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                this.activeDateFrom = selectedDates[0] ? fmt(selectedDates[0]) : '';
                this.activeDateTo   = selectedDates[1] ? fmt(selectedDates[1]) : '';
                if (selectedDates.length === 0 || selectedDates.length === 2) {
                    this.onFilterChange();
                }
            },
        });
    }

    onClearDate() {
        this._suppressDateChange = true;
        if (this._fp) this._fp.clear();
        this._suppressDateChange = false;
        this.activeDateFrom = '';
        this.activeDateTo   = '';
        this.onFilterChange();
    }

    // ─────────────────────────────────────────────
    // SIDEBAR TOGGLE
    // ─────────────────────────────────────────────
    onToggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        try { localStorage.setItem('petapantau.sidebar', this.sidebarOpen ? 'open' : 'closed'); } catch (_) { /* mode privat */ }
        this._applySidebarState(true);
    }

    // Terapkan status sidebar (terbuka / diminimalkan) ke DOM.
    _applySidebarState(resizeAfter) {
        const sidebar = this.sidebarRef.el;
        if (!sidebar) return;
        sidebar.classList.toggle('collapsed', !this.sidebarOpen);
        const btn = sidebar.querySelector('.petapantau-collapse-btn');
        if (btn) {
            btn.setAttribute('aria-expanded', String(this.sidebarOpen));
            btn.title = this.sidebarOpen ? 'Minimalkan menu' : 'Perluas menu';
        }
        // lebar area dashboard berubah setelah transisi CSS (0,3 dtk): peta dan grafik perlu menyesuaikan
        if (resizeAfter) setTimeout(() => this._resizeAfterLayout(), 340);
    }

    _resizeAfterLayout() {
        if (this.map) this.map.invalidateSize();
        document.querySelectorAll('.petapantau-chart-body').forEach((el) => {
            const chart = window.echarts?.getInstanceByDom(el);
            if (chart) chart.resize();
        });
    }

    // ─────────────────────────────────────────────
    // NAV & FILTER
    // ─────────────────────────────────────────────
    onNavClick(ev) {
        const item = ev.currentTarget;
        const mode = item.dataset.mode;
        if (!mode || mode === this.currentMode) return;

        this.sidebarRef.el.querySelectorAll('.petapantau-nav-item').forEach(el => {
            el.classList.remove('active');
        });
        item.classList.add('active');

        this.currentMode = mode;
        this._switchMode(mode);
    }

    _applyNavSecurity() {
        // Set reactive class — OWL akan menjaga class ini tetap ada melalui setiap re-render
        // via t-att-class="navSecurity.cls" di template sidebar
        if (this._isSubditSP) {
            this.navSecurity.cls = 'nav-role-subdit-sp';
        } else if (this._isSubditUser) {
            this.navSecurity.cls = 'nav-role-subdit';
        } else {
            this.navSecurity.cls = '';
            return;
        }

        // Tentukan mode yang tersembunyi untuk role ini
        const hideModes = this._isSubditSP
            ? ['bencana', 'lalin', 'lokasi']
            : ['bencana', 'lalin', 'patroli', 'lokasi'];

        // Jika mode aktif saat ini tersembunyi, pindah ke Peta Kriminalitas
        if (hideModes.includes(this.currentMode)) {
            this.currentMode = 'kriminal';
            const kriminalItem = this.sidebarRef.el?.querySelector('.petapantau-nav-item[data-mode="kriminal"]');
            if (kriminalItem) {
                this.sidebarRef.el.querySelectorAll('.petapantau-nav-item').forEach(el => el.classList.remove('active'));
                kriminalItem.classList.add('active');
                this._switchMode('kriminal');
            }
        }
    }

    async onKategoriChange() {
        if (this.currentMode === 'kriminal') {
            await this._populateSubKategori();
        }
        this.onFilterChange();
    }

    onFilterChange() {
        this._switchMode(this.currentMode);
    }

    // ─────────────────────────────────────────────
    // MODE ROUTER
    // ─────────────────────────────────────────────
    _switchMode(mode) {
        // Setiap mode switch increment versi — async loads yang sedang berjalan cek ini
        // sebelum commit hasil ke DOM/map agar tidak terjadi race condition.
        this._modeVersion = (this._modeVersion || 0) + 1;

        this._clearAllLayers();
        if (this.backButton) { this.backButton.remove(); this.backButton = null; }
        this.currentLevel = 'kabupaten';
        // Reset drill context setiap ganti mode atau re-filter
        this.drillKabupatenId = null;
        this.drillKecamatanId = null;

        const modeLabels = {
            umum:    { icon: 'fa-map',                  label: 'Peta Umum' },
            kriminal:{ icon: 'fa-exclamation-triangle', label: 'Peta Kriminalitas' },
            lalin:   { icon: 'fa-car',                  label: 'Peta Lalu Lintas' },
            bencana: { icon: 'fa-bolt',                 label: 'Peta Bencana' },
            lokasi:  { icon: 'fa-map-marker',           label: 'Lokasi Penting' },
            patroli: { icon: 'fa-car',                  label: 'Peta Patroli' },
        };
        const meta = modeLabels[mode] || modeLabels['umum'];
        this._updateBreadcrumb(`<i class="fa ${meta.icon}"></i> ${meta.label}`);

        // Peta umum: map mengisi sisa ruang. Mode lain: tinggi tetap agar konten di bawah bisa muncul
        const mapWrapper = this.mapWrapperRef?.el;
        if (mapWrapper) {
            // Reset expanded setiap mode change
            mapWrapper.classList.remove('petapantau-map-wrapper--expanded');
            if (this._expandControl) {
                this._expandControl.btn.title = 'Perbesar Peta';
                this._expandControl.btn.innerHTML = '<i class="fa fa-expand"></i>';
            }
            if (mode === 'umum') {
                mapWrapper.classList.remove('petapantau-map-wrapper--fixed');
            } else {
                mapWrapper.classList.add('petapantau-map-wrapper--fixed');
                this.map?.invalidateSize();
            }
        }

        // Reset date saat keluar dari mode patroli
        if (['patroli'].includes(this._filterMode) && !['patroli'].includes(mode)) {
            this.activeDateFrom = '';
            this.activeDateTo   = '';
            this._suppressDateChange = true;
            if (this._fp) this._fp.clear();
            this._suppressDateChange = false;
        }

        // Default 30 hari saat mode berganti ke patroli (sinkron, sebelum summary)
        if (['patroli'].includes(mode) && mode !== this._filterMode) {
            const today = new Date();
            const d30 = new Date(today);
            d30.setDate(d30.getDate() - 30);
            const _fmtD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            this.activeDateFrom = _fmtD(d30);
            this.activeDateTo   = _fmtD(today);
            this._suppressDateChange = true;
            if (this._fp) this._fp.setDate([d30, today], true);
            this._suppressDateChange = false;
        }

        this._updateFilterVisibility(mode);
        this._updateKpiCards(mode);
        this._updateFilterSummary(mode);
        this._updateSumberDokumenInfo(mode);
        this._updateCharts(mode);

        switch (mode) {
            case 'umum':     loadKabupatenLayer(this); break;
            case 'kriminal': loadModeKriminal(this); break;
            case 'lalin':    loadModeLalin(this); break;
            case 'bencana':  loadModeBencana(this); break;
            case 'lokasi':   loadModeLokasi(this); break;
            case 'patroli':  loadModePatroli(this); break;
            default:         loadKabupatenLayer(this); break;
        }
    }

    // ─────────────────────────────────────────────
    // BREADCRUMB
    // ─────────────────────────────────────────────
    _updateBreadcrumb(html) {
        if (this.breadcrumbRef.el) {
            this.breadcrumbRef.el.innerHTML = html;
        }
    }

    _appendBreadcrumb(html) {
        if (this.breadcrumbRef.el) {
            this.breadcrumbRef.el.innerHTML +=
                `<i class="fa fa-chevron-right petapantau-breadcrumb-sep" style="margin:0 6px;font-size:9px;opacity:.6;"></i><span class="petapantau-breadcrumb-item">${html}</span>`;
        }
    }

    // ─────────────────────────────────────────────
    // FILTER VISIBILITY per mode
    // ─────────────────────────────────────────────
    async _updateFilterVisibility(mode) {
        const showJenisLP       = mode === 'kriminal';
        const showKategori      = !['umum', 'patroli'].includes(mode);
        const showSubKategori   = mode === 'kriminal';
        const showTahun         = !['umum', 'lokasi', 'patroli'].includes(mode);
        const showDateRange     = !['umum', 'lokasi'].includes(mode);
        const showState         = mode !== 'umum';

        const jenisLpEl          = this.filterJenisLP?.el;
        const tahunEl            = this.filterTahun?.el;
        const dateWrap           = this.filterDateRangeWrapper?.el;
        const kategoriEl         = this.filterKategori?.el;
        const subKategoriEl      = this.filterSubKategori?.el;
        const stateEl            = this.filterState?.el;

        const showPolres = ['kriminal', 'patroli'].includes(mode) && !this._isPolsekUser;
        const polresEl   = this.filterPolres?.el;
        if (jenisLpEl)       jenisLpEl.style.display          = showJenisLP       ? '' : 'none';
        if (tahunEl)         tahunEl.style.display             = showTahun         ? '' : 'none';
        if (dateWrap)        dateWrap.style.display            = showDateRange     ? '' : 'none';
        if (kategoriEl)      kategoriEl.style.display          = showKategori      ? '' : 'none';
        if (subKategoriEl)   subKategoriEl.style.display       = showSubKategori   ? '' : 'none';
        if (stateEl)         stateEl.style.display             = showState         ? '' : 'none';
        if (polresEl)        polresEl.style.display            = showPolres        ? '' : 'none';

        const modeChanged = mode !== this._filterMode;
        this._filterMode = mode;

        if (modeChanged) {
            // Reset & repopulate hanya saat mode berganti
            if (jenisLpEl)       { jenisLpEl.value = ''; }
            if (kategoriEl)      { kategoriEl.value = ''; }
            if (subKategoriEl) {
                subKategoriEl.innerHTML = '<option value="">Semua Sub Kategori</option>';
                subKategoriEl.value = '';
            }
            if (stateEl) { stateEl.value = ''; }
            if (showKategori)      await this._populateKategori(mode);
            if (showState)         await this._populateState(mode);
        }
    }

    async _populateState(mode) {
        const el = this.filterState?.el;
        if (!el) return;
        el.innerHTML = '<option value="">Semua Status</option>';
        const OPTIONS = {
            kriminal: [{ value: 'PROSES', label: 'Proses' }, { value: 'SELESAI', label: 'Selesai' }],
            bencana:  [{ value: 'AKTIF', label: 'Aktif' }, { value: 'NON AKTIF', label: 'Non Aktif' }],
            lalin:    [{ value: 'PROSES', label: 'Proses' }, { value: 'SELESAI', label: 'Selesai' }],
            lokasi:   [{ value: 'AKTIF', label: 'Aktif' }, { value: 'NON AKTIF', label: 'Non Aktif' }],
            patroli:  [{ value: 'PROSES', label: 'Proses' }, { value: 'SELESAI', label: 'Selesai' }],
        };
        (OPTIONS[mode] || []).forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            el.appendChild(opt);
        });
    }

    async _populateKategori(mode) {
        const el = this.filterKategori?.el;
        if (!el) return;
        const model = this._KATEGORI_MODEL[mode];
        el.innerHTML = '<option value="">Semua Kategori</option>';
        if (!model) return;
        try {
            const records = await this.orm.searchRead(model, [], ['id', 'name'], { order: 'name asc' });
            records.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.name;
                el.appendChild(opt);
            });
        } catch (_) {}
    }

    async _populateSubKategori() {
        const el = this.filterSubKategori?.el;
        if (!el) return;
        const kategoriId = parseInt(this.filterKategori?.el?.value) || null;
        el.innerHTML = '<option value="">Semua Sub Kategori</option>';
        if (!kategoriId) return;
        try {
            const records = await this.orm.searchRead(
                'petapantau.sub_kategori_kriminal',
                [['kategori_kriminal_id', '=', kategoriId]],
                ['id', 'name'],
                { order: 'name asc' }
            );
            records.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.name;
                el.appendChild(opt);
            });
        } catch (_) {}
    }

    // ─────────────────────────────────────────────
    // FILTER SUMMARY
    // ─────────────────────────────────────────────
    _updateFilterSummary(mode) {
        const el = this.filterSummaryRef.el;
        if (!el) return;

        const hasTahunFilter  = !['umum', 'lokasi', 'patroli'].includes(mode);
        const hasDateFilter   = !['umum', 'lokasi'].includes(mode);

        const chip = (icon, text) =>
            `<span class="petapantau-filter-summary-chip"><i class="fa ${icon}"></i>${text}</span>`;
        const sep  = () => `<span class="petapantau-filter-summary-sep">•</span>`;
        const fmt  = d => { const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; };

        const chips = [];

        // Tahun
        if (hasTahunFilter) {
            const tahun = this.filterTahun?.el?.value || '';
            chips.push(chip('fa-file-text-o', tahun ? `Sumber dokumen tahun ${tahun}` : 'Semua tahun'));
        }

        // Polres — tampil di mode kriminal, patroli
        if (['kriminal', 'patroli'].includes(mode)) {
            if (!this._isPolsekUser) {
                const polresEl   = this.filterPolres?.el;
                const polresName = (polresEl && polresEl.value)
                    ? polresEl.options[polresEl.selectedIndex]?.text || 'Semua Polres'
                    : 'Semua Polres';
                chips.push(chip('fa-shield', polresName));
            } else if (this._userPolresId) {
                chips.push(chip('fa-shield', this._userPolresName || 'Polres'));
            }
        }

        // Kategori
        if (mode !== 'umum') {
            const katEl = this.filterKategori?.el;
            if (katEl && katEl.value) {
                chips.push(chip('fa-tag', katEl.options[katEl.selectedIndex]?.text || ''));
            }
            if (mode === 'kriminal') {
                const subEl = this.filterSubKategori?.el;
                if (subEl && subEl.value) {
                    chips.push(chip('fa-sitemap', subEl.options[subEl.selectedIndex]?.text || ''));
                }
            }
        }

        // Status
        if (mode !== 'umum') {
            const stEl = this.filterState?.el;
            if (stEl && stEl.value) {
                chips.push(chip('fa-circle', stEl.options[stEl.selectedIndex]?.text || stEl.value));
            }
        }

        // Tanggal kejadian / tanggal mulai
        if (hasDateFilter) {
            const df = this.activeDateFrom || '';
            const dt = this.activeDateTo   || '';
            if (df || dt) {
                let label;
                if (mode === 'patroli') {
                    label = df && dt
                        ? `Data Patroli dan Kriminalitas tanggal ${fmt(df)} s/d ${fmt(dt)}`
                        : df ? `Data Patroli dan Kriminalitas mulai ${fmt(df)}`
                             : `Data Patroli dan Kriminalitas s/d ${fmt(dt)}`;
                } else {
                    label = df && dt
                        ? `Tgl Kejadian: ${fmt(df)} s/d ${fmt(dt)}`
                        : df ? `Tgl Kejadian: mulai ${fmt(df)}` : `Tgl Kejadian: s/d ${fmt(dt)}`;
                }
                chips.push(chip('fa-calendar', label));
            }
        }

        el.innerHTML = chips.join(sep());
    }

    // ─────────────────────────────────────────────
    // SUMBER DOKUMEN INFO (kanan filter summary)
    // ─────────────────────────────────────────────
    async _updateSumberDokumenInfo(mode) {
        const el = this.sumberInfoRef?.el;
        if (!el) return;

        const tahun = this.filterTahun?.el?.value || '';

        // lokasi_penting tidak punya sumber_dokumen_id; umum tidak relevan
        const MODEL_MAP = {
            kriminal: 'petapantau.kriminalitas',
            bencana:  'petapantau.bencana',
            lalin:    'petapantau.lalu_lintas',
        };
        const model = MODEL_MAP[mode];
        if (!model || !tahun) { el.innerHTML = ''; return; }

        try {
            const groups = await this.orm.call(
                model,
                'read_group',
                [
                    [['tahun', '=', tahun]],
                    ['sumber_dokumen_id'],
                    ['sumber_dokumen_id'],
                ],
                { lazy: false }
            );

            const names = groups
                .filter(g => g.sumber_dokumen_id)
                .map(g => Array.isArray(g.sumber_dokumen_id) ? g.sumber_dokumen_id[1] : String(g.sumber_dokumen_id))
                .sort();

            if (!names.length) { el.innerHTML = ''; return; }

            const joined    = names.join(' / ');
            const CHAR_LIMIT = 48;
            const first     = names[0];
            const firstTrunc = first.length > CHAR_LIMIT ? first.slice(0, CHAR_LIMIT) + '…' : first;
            const hasMore   = names.length > 1 || first.length > CHAR_LIMIT;
            const shortTxt  = names.length > 1
                ? `${firstTrunc}${names.length > 1 ? ` (+${names.length - 1})` : ''}`
                : firstTrunc;
            const uid       = 'sd-' + Math.random().toString(36).slice(2, 7);

            el.innerHTML = `
                <i class="fa fa-file-text-o"></i>
                <span class="petapantau-sumber-label">Sumber:</span>
                <span class="petapantau-sumber-text" id="${uid}-text">${shortTxt}</span>
                ${hasMore ? `<button class="petapantau-sumber-toggle" id="${uid}-btn" title="${joined}"><i class="fa fa-chevron-down"></i></button>` : ''}
            `;

            if (hasMore) {
                let expanded = false;
                const btn    = el.querySelector(`#${uid}-btn`);
                const textEl = el.querySelector(`#${uid}-text`);
                btn.addEventListener('click', () => {
                    expanded = !expanded;
                    textEl.textContent = expanded ? joined : shortTxt;
                    textEl.classList.toggle('expanded', expanded);
                    btn.innerHTML = expanded
                        ? '<i class="fa fa-chevron-up"></i>'
                        : '<i class="fa fa-chevron-down"></i>';
                });
            }
        } catch (_) {
            el.innerHTML = '';
        }
    }

    // ─────────────────────────────────────────────
    // KPI CARDS — dinamis per mode
    // ─────────────────────────────────────────────
    async _updateKpiCards(mode) {
        const myVersion = this._modeVersion;
        const row = this.kpiRowRef.el;
        if (!row) return;
        row.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#bbb;font-size:12px;padding:8px 0;">Memuat data...</div>`;

        const tahun         = this.filterTahun?.el?.value         || '';
        const dateFrom      = this.activeDateFrom                   || '';
        const dateTo        = this.activeDateTo                     || '';
        const polresId      = this._polresFilterId;
        const kategoriId    = parseInt(this.filterKategori?.el?.value)     || null;
        const subKategoriId = parseInt(this.filterSubKategori?.el?.value)  || null;
        const stateValue    = this.filterState?.el?.value          || '';

        const tf  = tahun        ? [['tahun', '=', tahun]]        : [];
        const df  = [
            ...(dateFrom ? [['tanggal_kejadian', '>=', wibDateStartUtc(dateFrom)]] : []),
            ...(dateTo   ? [['tanggal_kejadian', '<=', wibDateEndUtc(dateTo)]] : []),
        ];
        const jenisLpValue  = this.filterJenisLP?.el?.value          || '';
        const polresf = polresId ? [['polres_id', '=', polresId]] : [];
        const kf  = kategoriId    ? [['kategori_id',    '=', kategoriId]]    : [];
        const sf  = subKategoriId ? [['sub_kategori_id','=', subKategoriId]] : [];
        const jlpf = jenisLpValue  ? [['jenis_lp',       '=', jenisLpValue]]  : [];
        // state field berbeda: kriminal pakai status_perkara, lainnya pakai state
        const stk = stateValue ? [['status_perkara', '=', stateValue]] : [];
        const sts = stateValue ? [['state',          '=', stateValue]] : [];
        // Drill-down context (set oleh layer saat user klik polygon)
        const drillDomain = this.drillKecamatanId
            ? [['kecamatan_id', '=', this.drillKecamatanId]]
            : this.drillKabupatenId
                ? [['kabupaten_id', '=', this.drillKabupatenId]]
                : [];

        try {
            let cards = [];

            if (mode === 'kriminal') {
                const d = [...tf, ...df, ...polresf, ...jlpf, ...kf, ...sf, ...stk, ...drillDomain];
                const [total, proses, selesai] = await Promise.all([
                    this.orm.searchCount('petapantau.kriminalitas', d),
                    this.orm.searchCount('petapantau.kriminalitas', [...d, ['status_perkara','=','PROSES']]),
                    this.orm.searchCount('petapantau.kriminalitas', [...d, ['status_perkara','=','SELESAI']]),
                ]);
                const persen = total > 0 ? Math.round(selesai / total * 100) : 0;
                cards = [
                    { icon: 'fa-database',    color: '#8A6410', value: total,        label: 'Total Data (JTP)',    action: { model: 'petapantau.kriminalitas', domain: d } },
                    { icon: 'fa-spinner',     color: '#8A6410', value: proses,       label: 'Total Proses',        action: { model: 'petapantau.kriminalitas', domain: [...d, ['status_perkara','=','PROSES']] } },
                    { icon: 'fa-check-circle',color: '#1D1A15', value: selesai,      label: 'Total Selesai (PTP)', action: { model: 'petapantau.kriminalitas', domain: [...d, ['status_perkara','=','SELESAI']] } },
                    { icon: 'fa-percent',     color: '#B07F10', value: persen + '%', label: 'Persentase Selesai',  action: { model: 'petapantau.kriminalitas', domain: [...d, ['status_perkara','=','SELESAI']] } },
                ];
            } else if (mode === 'umum') {
                // Peta umum = data geografis, filter tahun & tanggal tidak relevan
                const [kab, kec, desa, polres] = await Promise.all([
                    this.orm.searchCount('petapantau.kabupaten', []),
                    this.orm.searchCount('petapantau.kecamatan', []),
                    this.orm.searchCount('petapantau.desa', []),
                    this.orm.searchCount('petapantau.polres', []),
                ]);
                cards = [
                    { icon: 'fa-building', color: '#8A6410', value: kab,    label: 'Total Kabupaten/Kota', action: { model: 'petapantau.kabupaten',  domain: [] } },
                    { icon: 'fa-map',      color: '#B07F10', value: kec,    label: 'Total Kecamatan',      action: { model: 'petapantau.kecamatan',  domain: [] } },
                    { icon: 'fa-home',     color: '#1D1A15', value: desa,   label: 'Total Desa/Kelurahan', action: { model: 'petapantau.desa',        domain: [] } },
                    { icon: 'fa-shield',   color: '#8A6410', value: polres, label: 'Total Polres',         action: { model: 'petapantau.polres',      domain: [] } },
                ];
            } else if (mode === 'bencana') {
                const d = [...tf, ...df, ...kf, ...sts, ...drillDomain];
                const [total, aktif, nonAktif] = await Promise.all([
                    this.orm.searchCount('petapantau.bencana', d),
                    this.orm.searchCount('petapantau.bencana', [...d, ['state','=','AKTIF']]),
                    this.orm.searchCount('petapantau.bencana', [...d, ['state','=','NON AKTIF']]),
                ]);
                const persen = total > 0 ? Math.round(nonAktif / total * 100) : 0;
                cards = [
                    { icon: 'fa-database',    color: '#8A6410', value: total,        label: 'Total Data',             action: { model: 'petapantau.bencana', domain: d } },
                    { icon: 'fa-bolt',        color: '#8A6410', value: aktif,        label: 'Masih Aktif',            action: { model: 'petapantau.bencana', domain: [...d, ['state','=','AKTIF']] } },
                    { icon: 'fa-check-circle',color: '#1D1A15', value: nonAktif,     label: 'Non Aktif',              action: { model: 'petapantau.bencana', domain: [...d, ['state','=','NON AKTIF']] } },
                    { icon: 'fa-percent',     color: '#B07F10', value: persen + '%', label: 'Persentase Tertangani',  action: { model: 'petapantau.bencana', domain: [...d, ['state','=','NON AKTIF']] } },
                ];
            } else if (mode === 'lalin') {
                const d = [...tf, ...df, ...kf, ...sts, ...drillDomain];
                const [total, proses, selesai] = await Promise.all([
                    this.orm.searchCount('petapantau.lalu_lintas', d),
                    this.orm.searchCount('petapantau.lalu_lintas', [...d, ['state','=','PROSES']]),
                    this.orm.searchCount('petapantau.lalu_lintas', [...d, ['state','=','SELESAI']]),
                ]);
                const persen = total > 0 ? Math.round(selesai / total * 100) : 0;
                cards = [
                    { icon: 'fa-database',    color: '#8A6410', value: total,        label: 'Total Data',       action: { model: 'petapantau.lalu_lintas', domain: d } },
                    { icon: 'fa-spinner',     color: '#8A6410', value: proses,       label: 'Total Proses',     action: { model: 'petapantau.lalu_lintas', domain: [...d, ['state','=','PROSES']] } },
                    { icon: 'fa-check-circle',color: '#1D1A15', value: selesai,      label: 'Total Selesai',    action: { model: 'petapantau.lalu_lintas', domain: [...d, ['state','=','SELESAI']] } },
                    { icon: 'fa-percent',     color: '#8A6410', value: persen + '%', label: 'Persentase Selesai', action: { model: 'petapantau.lalu_lintas', domain: [...d, ['state','=','SELESAI']] } },
                ];
            } else if (mode === 'lokasi') {
                // lokasi_penting tidak punya sumber_dokumen_id & tanggal_kejadian
                const [total, aktif] = await Promise.all([
                    this.orm.searchCount('petapantau.lokasi_penting', [...kf, ...sts]),
                    this.orm.searchCount('petapantau.lokasi_penting', [...kf, ...sts, ['state','=','AKTIF']]),
                ]);
                cards = [
                    { icon: 'fa-database',    color: '#1D1A15', value: total,       label: 'Total Lokasi',    action: { model: 'petapantau.lokasi_penting', domain: [...kf, ...sts] } },
                    { icon: 'fa-check-circle',color: '#8A6410', value: aktif,       label: 'Lokasi Aktif',    action: { model: 'petapantau.lokasi_penting', domain: [...kf, ...sts, ['state','=','AKTIF']] } },
                    { icon: 'fa-times-circle',color: '#8A6410', value: total-aktif, label: 'Non Aktif',       action: { model: 'petapantau.lokasi_penting', domain: [...kf, ...sts, ['state','!=','AKTIF']] } },
                    { icon: 'fa-map-marker',  color: '#B07F10', value: total,       label: 'Total Terdaftar', action: { model: 'petapantau.lokasi_penting', domain: [...kf, ...sts] } },
                ];
            } else if (mode === 'patroli') {
                const df_p = [
                    ...(dateFrom ? [['tanggal_mulai', '>=', wibDateStartUtc(dateFrom)]] : []),
                    ...(dateTo   ? [['tanggal_mulai', '<=', wibDateEndUtc(dateTo)]] : []),
                ];
                const polresf_p   = polresId ? [['polres_id',            '=', polresId]] : [];
                const polresf_lok = polresId ? [['patroli_id.polres_id', '=', polresId]] : [];
                const d = [...df_p, ...polresf_p, ...sts, ...drillDomain];
                const dLokasi = [
                    ...(dateFrom ? [['patroli_id.tanggal_mulai', '>=', wibDateStartUtc(dateFrom)]] : []),
                    ...(dateTo   ? [['patroli_id.tanggal_mulai', '<=', wibDateEndUtc(dateTo)]] : []),
                    ...drillDomain.map(([f, op, v]) => [`patroli_id.${f}`, op, v]),
                    ...polresf_lok,
                ];
                const [total, proses, totalLokasi, personelGroups] = await Promise.all([
                    this.orm.searchCount('petapantau.patroli', d),
                    this.orm.searchCount('petapantau.patroli', [...d, ['state', '=', 'PROSES']]),
                    this.orm.searchCount('petapantau.lokasi_patroli', dLokasi),
                    this.orm.call('petapantau.patroli', 'read_group',
                        [d, ['personel_count:sum'], []], { lazy: false }),
                ]);
                const totalPersonel = personelGroups[0]?.personel_count || 0;
                cards = [
                    { icon: 'fa-car',        color: '#1D1A15', value: total,         label: 'Total Patroli',      action: { model: 'petapantau.patroli',         domain: d } },
                    { icon: 'fa-spinner',    color: '#8A6410', value: proses,        label: 'Patroli Proses',     action: { model: 'petapantau.patroli',         domain: [...d, ['state','=','PROSES']] } },
                    { icon: 'fa-map-marker', color: '#8C6A3A', value: totalLokasi,   label: 'Total Titik Lokasi', action: { model: 'petapantau.lokasi_patroli',  domain: dLokasi } },
                    { icon: 'fa-users',      color: '#B07F10', value: totalPersonel, label: 'Total Personel',     action: null },
                ];
            }

            if (this._modeVersion !== myVersion) return;
            row.setAttribute('data-cols', cards.length);
            row.innerHTML = cards.map((c, i) => `
                <div class="petapantau-kpi-card${c.action ? ' petapantau-kpi-card--clickable' : ''}" data-idx="${i}">
                    <div class="petapantau-kpi-icon" style="color:${c.color};">
                        <i class="fa ${c.icon}"></i>
                    </div>
                    <div class="petapantau-kpi-body">
                        <div class="petapantau-kpi-value">${c.value.toLocaleString ? c.value.toLocaleString('id-ID') : c.value}</div>
                        <div class="petapantau-kpi-label">${c.label}</div>
                    </div>
                </div>
            `).join('');
            row.querySelectorAll('.petapantau-kpi-card--clickable').forEach(el => {
                el.addEventListener('click', () => this._openCardAction(cards[parseInt(el.dataset.idx)]));
            });

        } catch (e) {
            if (this._modeVersion !== myVersion) return;
            row.innerHTML = '';
            console.error('KPI load error:', e);
        }
    }

    // Buka daftar data di balik sebuah kartu KPI
    _openCardAction(card) {
        if (!card?.action) return;
        this.action.doAction({
            type: 'ir.actions.act_window',
            name: card.label,
            res_model: card.action.model,
            view_mode: 'list,form',
            views: [[false, 'list'], [false, 'form']],
            domain: card.action.domain,
            target: 'current',
        });
    }

    // ─────────────────────────────────────────────
    // ECHARTS — lihat dashboard_charts_kriminal.js
    // ─────────────────────────────────────────────
    async _updateCharts(mode) {
        await Promise.all([
            updateKriminalCharts(this, mode),
            updateBencanaCharts(this, mode),
            updateLalinCharts(this, mode),
            updateLokasiCharts(this, mode),
            updatePatroliCharts(this, mode),
            updateKriminalTable(this, mode),
            updateBencanaTable(this, mode),
            updateLalinTable(this, mode),
            updateLokasiTable(this, mode),
            updatePatroliTable(this, mode),
        ]);
    }
    _disposeCharts() {
        disposeKriminalCharts(this);
        disposeBencanaCharts(this);
        disposeLalinCharts(this);
        disposeLokasiCharts(this);
        disposePatroliCharts(this);
    }

    // ─────────────────────────────────────────────
    // MAP INIT & LAYER GROUPS
    // ─────────────────────────────────────────────
    async _initMap() {
        const el = this.mapRef.el;
        if (!el) return;

        this.map = L.map(el).setView([-7.8754, 110.4262], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);

        this.kabupatenLayerGroup = L.layerGroup().addTo(this.map);
        this.kabupatenLabelGroup = L.layerGroup().addTo(this.map);
        this.kecamatanLayerGroup = L.layerGroup().addTo(this.map);
        this.kecamatanLabelGroup = L.layerGroup().addTo(this.map);
        this.desaLayerGroup      = L.layerGroup().addTo(this.map);
        this.desaLabelGroup      = L.layerGroup().addTo(this.map);
        this.markerLayerGroup    = L.markerClusterGroup({
            chunkedLoading:          true,
            chunkInterval:           150,
            chunkSize:               50,
            maxClusterRadius:        80,
            showCoverageOnHover:     false,
            spiderfyOnMaxZoom:       true,
            disableClusteringAtZoom: 14,
            iconCreateFunction: (cluster) => {
                const children = cluster.getAllChildMarkers();
                const hasCustomCount = children.length > 0 && children.every(m => m._markerCount !== undefined);
                const count = hasCustomCount
                    ? children.reduce((sum, m) => sum + (m._markerCount || 0), 0)
                    : cluster.getChildCount();
                let size, cls;
                if      (count < 10)   { size = 34; cls = 'sm'; }
                else if (count < 100)  { size = 42; cls = 'md'; }
                else if (count < 1000) { size = 50; cls = 'lg'; }
                else                   { size = 58; cls = 'xl'; }
                const label = count >= 1000
                    ? (count >= 10000 ? Math.floor(count / 1000) + 'K+' : (count / 1000).toFixed(1) + 'K')
                    : count;
                return L.divIcon({
                    html: `<div class="petapantau-cluster-icon petapantau-cluster-icon--${cls}" style="width:${size}px;height:${size}px;">${label}</div>`,
                    className: '',
                    iconSize:   L.point(size, size),
                    iconAnchor: L.point(size / 2, size / 2),
                });
            },
        }).addTo(this.map);

        // Layer non-cluster untuk summary count bubble per kabupaten/kecamatan/desa
        this.summaryMarkerGroup = L.layerGroup().addTo(this.map);

        // Layer terpisah untuk overlay lokasi penting (tidak ikut cluster)
        this.lokasiOverlayLayerGroup = L.layerGroup().addTo(this.map);

        // Tombol expand/restore tinggi map (500px ↔ 700px)
        const ExpandControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control petapantau-map-expand-btn');
                const a = L.DomUtil.create('a', '', container);
                a.href = '#';
                a.title = 'Perbesar Peta';
                a.setAttribute('role', 'button');
                a.innerHTML = '<i class="fa fa-expand"></i>';
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.on(a, 'click', (e) => {
                    L.DomEvent.preventDefault(e);
                    const wrapper = this.mapWrapperRef?.el;
                    if (!wrapper) return;
                    const expanded = wrapper.classList.toggle('petapantau-map-wrapper--expanded');
                    a.title = expanded ? 'Kembalikan Ukuran' : 'Perbesar Peta';
                    a.innerHTML = expanded ? '<i class="fa fa-compress"></i>' : '<i class="fa fa-expand"></i>';
                    setTimeout(() => {
                        this.map.invalidateSize();
                        if (expanded) this.map.zoomIn(1);
                        else this.map.zoomOut(1);
                    }, 50);
                });
                this._expandControl = { el: container, btn: a };
                return container;
            },
        });
        new ExpandControl().addTo(this.map);

        // Label visibility: update setiap zoom berubah atau label baru ditambahkan
        this.map.on('zoomend', () => this._updateLabelVisibility());
        this.kabupatenLabelGroup.on('layeradd', () => {
            clearTimeout(this._labelVisTimer);
            this._labelVisTimer = setTimeout(() => this._updateLabelVisibility(), 60);
        });

        await loadKabupatenLayer(this);
    }

    _clearAllLayers() {
        if (this.kabupatenLayerGroup) this.kabupatenLayerGroup.clearLayers();
        if (this.kabupatenLabelGroup) this.kabupatenLabelGroup.clearLayers();
        if (this.kecamatanLayerGroup) this.kecamatanLayerGroup.clearLayers();
        if (this.kecamatanLabelGroup) this.kecamatanLabelGroup.clearLayers();
        if (this.desaLayerGroup)      this.desaLayerGroup.clearLayers();
        if (this.desaLabelGroup)      this.desaLabelGroup.clearLayers();
        if (this.markerLayerGroup)    this.markerLayerGroup.clearLayers();
        if (this.summaryMarkerGroup)  this.summaryMarkerGroup.clearLayers();
        if (this.comingSoonControl)   { this.comingSoonControl.remove(); this.comingSoonControl = null; }
        removeKriminalLegend(this);
        removeBencanaLegend(this);
        removeLalinLegend(this);
        removeLokasiLegend(this);
        removePatroliLegend(this);
        removeLokasiOverlay(this);
    }

    // Zoom in satu tingkat setelah fitBounds — dipakai di level kabupaten & kecamatan.
    // animate: false wajib agar getZoom() membaca zoom HASIL fitBounds, bukan zoom sebelum animasi.
    _fitBoundsZoomedIn(bounds, options = {}) {
        this.map.fitBounds(bounds, { ...options, animate: false });
        this.map.setZoom(this.map.getZoom() + 1);
    }

    // ─────────────────────────────────────────────
    // LABEL VISIBILITY (all-or-nothing per group)
    // ─────────────────────────────────────────────
    _updateLabelVisibility() {
        const map = this.map;
        if (!map) return;

        // Cek ukuran polygon TERKECIL dalam grup.
        // Jika terkecil sudah memenuhi threshold → tampilkan SEMUA.
        // Jika tidak → sembunyikan SEMUA (tidak ada label setengah-setengah).
        const applyGroup = (group, minPx) => {
            if (!group) return;
            const layers = group.getLayers();
            if (!layers.length) return;

            let smallest = Infinity;
            for (const marker of layers) {
                const bounds = marker._polygonBounds;
                if (!bounds) continue;
                const sw   = map.latLngToContainerPoint(bounds.getSouthWest());
                const ne   = map.latLngToContainerPoint(bounds.getNorthEast());
                const size = Math.max(Math.abs(ne.x - sw.x), Math.abs(ne.y - sw.y));
                if (size < smallest) smallest = size;
            }

            const show = smallest === Infinity || smallest >= minPx;
            layers.forEach(marker => {
                const el = marker.getElement();
                if (el) el.style.visibility = show ? 'visible' : 'hidden';
            });
        };

        // Threshold rendah: label tersembunyi hanya ketika polygon sudah sangat kecil (map di-zoom out jauh).
        // Tumpukan label di zoom normal = OK, yang dilarang adalah sebagian tampil sebagian tidak.
        applyGroup(this.kabupatenLabelGroup, 15);
        applyGroup(this.kecamatanLabelGroup, 8);
        applyGroup(this.desaLabelGroup, 5);
    }
}

registry.category("actions").add("petapantau_dashboard_map", DashboardMap);
