/** @odoo-module **/

/**
 * Heatmap dashboard
 *
 * Tampilan alternatif dari peta wilayah (choropleth): pengguna memilih "Wilayah" atau "Heatmap".
 * Heatmap mengikuti filter aktif dan wilayah drill-down. Mode peta yang mendukung heatmap
 * didaftarkan di HEAT_SOURCES.
 *
 * Mode yang terdaftar di COMPARE_SOURCES punya tampilan ketiga ("Rawan vs Patroli"): heatmap
 * kasus kriminal ditimpa titik patroli, disertai angka cakupan.
 */

import { loadJS } from '@web/core/assets';
import { getKriminalHeatSource } from './dashboard_layer_kriminal';
import { getLalinHeatSource } from './dashboard_layer_lalin';
import { getBencanaHeatSource } from './dashboard_layer_bencana';
import { getPatroliHeatSource, getPatroliCompareSource } from './dashboard_layer_patroli';

// Sengaja tidak didaftarkan di bundle aset: modul lain di database yang sama dapat memuat Leaflet
// lagi dan mengganti global `L`, sehingga plugin yang sudah menempel ikut hilang. Dimuat saat peta
// dibuat, plugin menempel pada `L` yang benar-benar dipakai.
const HEAT_LIBRARY = '/petapantau/static/lib/leaflet-heat/leaflet-heat.js';

// mode dashboard -> fungsi yang mengembalikan { model, domain, unit, order, caveat? } sesuai filter aktif
const HEAT_SOURCES = {
    kriminal: getKriminalHeatSource,
    lalin: getLalinHeatSource,
    bencana: getBencanaHeatSource,
    patroli: getPatroliHeatSource,
};

// mode dashboard -> fungsi yang mengembalikan { heat, patrol, periode }
const COMPARE_SOURCES = {
    patroli: getPatroliCompareSource,
};

const COVERAGE_RADIUS_M = 500;   // kasus "dekat patroli" bila ada titik patroli dalam jarak ini
const DOT_COLOR = '#1565C0';     // biru: kontras terhadap gradasi kuning-merah
const DOT_PANE = 'petapantauHeatDotPane';

const HEAT_GRADIENT = { 0.2: '#FFE866', 0.45: '#FFB000', 0.65: '#F26A00', 0.85: '#D7191C', 1.0: '#7F0000' };
const HEAT_RADIUS = 22;      // piksel
const HEAT_BLUR = 18;        // piksel
const HEAT_LIMIT = 20000;    // batas titik yang dikirim ke browser
const HEAT_PANE = 'petapantauHeatPane';

// L.HeatLayer bawaan selalu menempel di overlayPane dan menghalangi klik pada poligon.
// Turunan ini memakai pane sendiri (tanpa pointer events) agar drill-down tetap bisa diklik.
function _createHeatLayer(latlngs, options) {
    const PaneHeatLayer = L.HeatLayer.extend({
        onAdd(map) {
            L.HeatLayer.prototype.onAdd.call(this, map);
            map.getPane(HEAT_PANE).appendChild(this._canvas);
        },
        onRemove(map) {
            if (this._frame) {
                L.Util.cancelAnimFrame(this._frame);
                this._frame = null;
            }
            L.DomUtil.remove(this._canvas);
            map.off('moveend', this._reset, this);
            if (map.options.zoomAnimation) map.off('zoomanim', this._animateZoom, this);
        },
        _redraw() {
            // Canvas berukuran 0 (peta sedang tersembunyi) membuat getImageData gagal
            const size = this._map.getSize();
            if (!size.x || !size.y) {
                this._frame = null;
                return;
            }
            L.HeatLayer.prototype._redraw.call(this);
        },
    });
    return new PaneHeatLayer(latlngs, options);
}

// Intensitas dinormalkan terhadap titik terpadat pada zoom saat ini. Tanpa ini, pengaturan bawaan
// library membuat warna sangat pudar saat peta dilihat dari jauh.
function _intensityOptions(map, latlngs) {
    const zoom = map.getZoom();
    const cell = (HEAT_RADIUS + HEAT_BLUR) / 2;   // sama dengan ukuran grid di dalam L.HeatLayer
    const cells = new Map();
    let densest = 0;
    for (const latlng of latlngs) {
        const point = map.project(latlng, zoom);
        const key = `${Math.floor(point.x / cell)}:${Math.floor(point.y / cell)}`;
        const count = (cells.get(key) || 0) + 1;
        cells.set(key, count);
        if (count > densest) densest = count;
    }
    // maxZoom = zoom saat ini: bobot tiap titik tetap 1 di semua tingkat zoom.
    // Batas bawah 3: satu titik yang berdiri sendiri tidak tampil sebagai area "panas".
    return { maxZoom: zoom, max: Math.max(3, densest * 0.7) };
}

// Jumlah kasus yang punya minimal satu titik patroli dalam radius cakupan.
// Titik patroli dikelompokkan dalam petak seukuran radius agar tidak membandingkan semua pasangan.
function _countCovered(cases, patrols) {
    const METER_PER_DEGREE = 111320;
    const lngScale = Math.cos((-7.8 * Math.PI) / 180);   // lintang DIY
    const toMeter = ([lat, lng]) => [lng * METER_PER_DEGREE * lngScale, lat * METER_PER_DEGREE];

    const grid = new Map();
    for (const patrol of patrols) {
        const [x, y] = toMeter(patrol);
        const key = `${Math.floor(x / COVERAGE_RADIUS_M)}:${Math.floor(y / COVERAGE_RADIUS_M)}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push([x, y]);
    }

    return cases.filter((item) => {
        const [x, y] = toMeter(item);
        const col = Math.floor(x / COVERAGE_RADIUS_M);
        const row = Math.floor(y / COVERAGE_RADIUS_M);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const near = grid.get(`${col + dx}:${row + dy}`) || [];
                if (near.some(([px, py]) => Math.hypot(px - x, py - y) <= COVERAGE_RADIUS_M)) return true;
            }
        }
        return false;
    }).length;
}

// ── Inisialisasi: pane, tombol tampilan ──────────────────────────────────────
export async function initHeatmap(ctx) {
    ctx.heatView = ctx.heatView || 'wilayah';
    ctx._heatLayer = null;
    ctx._heatPoints = [];
    ctx._heatDots = null;
    ctx._heatLegend = null;
    ctx._heatSeq = 0;

    try {
        if (typeof L.heatLayer !== 'function') await loadJS(HEAT_LIBRARY);
    } catch (error) {
        console.error('Library Leaflet.heat gagal dimuat; fitur heatmap dinonaktifkan.', error);
        return;
    }

    const pane = ctx.map.createPane(HEAT_PANE);
    pane.style.zIndex = 450;               // di atas poligon (400), di bawah label & marker (600)
    pane.style.pointerEvents = 'none';

    const dotPane = ctx.map.createPane(DOT_PANE);
    dotPane.style.zIndex = 460;            // di atas heatmap
    dotPane.style.pointerEvents = 'none';
    ctx._heatDotRenderer = L.canvas({ pane: DOT_PANE });

    const ViewToggle = L.Control.extend({
        options: { position: 'topright' },
        onAdd: () => {
            const box = L.DomUtil.create('div', 'petapantau-heat-toggle');
            box.setAttribute('role', 'group');
            box.setAttribute('aria-label', 'Tampilan peta');
            box.style.display = 'none';
            const views = [
                ['wilayah', 'fa-map-o', 'Wilayah'],
                ['heatmap', 'fa-fire', 'Heatmap'],
                ['banding', 'fa-binoculars', 'Rawan vs Patroli'],
            ];
            for (const [view, icon, label] of views) {
                const button = L.DomUtil.create('button', '', box);
                button.type = 'button';
                button.dataset.view = view;
                button.innerHTML = `<i class="fa ${icon}"></i> ${label}`;
                L.DomEvent.on(button, 'click', (ev) => {
                    L.DomEvent.stop(ev);
                    if (button.classList.contains('active')) return;
                    ctx.heatView = view;
                    ctx.map.closePopup();
                    refreshHeatmap(ctx);
                });
            }
            L.DomEvent.disableClickPropagation(box);
            return box;
        },
    });
    const toggle = new ViewToggle();
    toggle.addTo(ctx.map);
    ctx._heatToggleEl = toggle.getContainer();

    ctx.map.on('zoomend', () => {
        if (ctx._heatLayer) {
            ctx._heatLayer.setOptions(_intensityOptions(ctx.map, ctx._heatPoints));
        }
    });
}

// Sembunyikan / kembalikan unsur tampilan wilayah (arsiran, angka ringkasan, titik, legenda)
function _setHeatViewActive(ctx, active) {
    ctx.map.getContainer().classList.toggle('petapantau-heat-on', active);
    for (const group of [ctx.summaryMarkerGroup, ctx.markerLayerGroup]) {
        if (!group) continue;
        if (active && ctx.map.hasLayer(group)) ctx.map.removeLayer(group);
        else if (!active && !ctx.map.hasLayer(group)) ctx.map.addLayer(group);
    }
}

function _removeHeatLayer(ctx) {
    if (ctx._heatLayer) {
        ctx._heatLayer.remove();
        ctx._heatLayer = null;
    }
    if (ctx._heatDots) {
        ctx._heatDots.remove();
        ctx._heatDots = null;
    }
    if (ctx._heatLegend) {
        ctx._heatLegend.remove();
        ctx._heatLegend = null;
    }
    ctx._heatPoints = [];
}

function _addHeatLegend(ctx, { title = 'Kepadatan Titik', notes = [], highlight = '', dotLabel = '' }) {
    const HeatLegend = L.Control.extend({
        onAdd() {
            const div = L.DomUtil.create('div', 'petapantau-legend petapantau-legend--heat');
            const stops = Object.values(HEAT_GRADIENT).join(', ');
            div.innerHTML = `
                <div class="petapantau-legend-title"><i class="fa fa-fire"></i> <span></span></div>
                <div class="petapantau-heat-bar" style="background:linear-gradient(90deg, ${stops});"></div>
                <div class="petapantau-heat-scale"><span>Rendah</span><span>Tinggi</span></div>
            `;
            div.querySelector('.petapantau-legend-title span').textContent = title;
            if (dotLabel) {
                const row = L.DomUtil.create('div', 'petapantau-heat-dot', div);
                L.DomUtil.create('i', '', row).style.background = DOT_COLOR;
                L.DomUtil.create('span', '', row).textContent = dotLabel;
            }
            if (highlight) {
                L.DomUtil.create('div', 'petapantau-heat-coverage', div).textContent = highlight;
            }
            for (const note of notes.filter(Boolean)) {
                L.DomUtil.create('div', 'petapantau-heat-note', div).textContent = note;
            }
            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            return div;
        },
    });
    ctx._heatLegend = new HeatLegend({ position: 'bottomright' });
    ctx._heatLegend.addTo(ctx.map);
}

function _heatNote(total, shown, withCoords, unit) {
    const fmt = (n) => n.toLocaleString('id-ID');
    if (!total) return `Tidak ada ${unit} pada filter ini`;
    let note = `${fmt(withCoords)} dari ${fmt(total)} ${unit} punya koordinat`;
    if (shown < withCoords) note += ` · digambar ${fmt(shown)} terbaru`;
    return note;
}

function _compareLegend(casePoints, patrolPoints, periode, caseNote) {
    const fmt = (n) => n.toLocaleString('id-ID');
    const truncated = patrolPoints.length >= HEAT_LIMIT;
    let highlight = '';
    // Bila titik patroli terpotong batas, persentase akan lebih kecil dari sebenarnya: jangan ditampilkan
    if (casePoints.length && !truncated) {
        const covered = _countCovered(casePoints, patrolPoints);
        const percent = Math.round((covered / casePoints.length) * 100);
        highlight = `${fmt(covered)} dari ${fmt(casePoints.length)} kasus (${percent}%) berjarak `
            + `\u2264 ${COVERAGE_RADIUS_M} m dari titik patroli`;
    }
    return {
        title: 'Kepadatan Kasus Kriminal',
        dotLabel: `Titik patroli (${fmt(patrolPoints.length)})`,
        highlight,
        notes: [
            truncated ? 'Titik patroli terlalu banyak, persempit rentang tanggal untuk melihat cakupan' : '',
            caseNote,
            periode,
            'Hanya kedekatan lokasi; urutan waktu tidak diperhitungkan',
        ],
    };
}

/**
 * Selaraskan heatmap dengan mode, filter, dan wilayah drill-down saat ini.
 * Dipanggil setiap kali cakupan dashboard berubah dan saat tombol tampilan diklik.
 */
export async function refreshHeatmap(ctx) {
    if (!ctx.map || !ctx._heatToggleEl) return;

    const mode = ctx.currentMode;
    const getSource = HEAT_SOURCES[mode];
    const getCompare = COMPARE_SOURCES[mode];
    // Pilihan "banding" di mode tanpa perbandingan ditampilkan sebagai heatmap biasa
    const view = ctx.heatView === 'banding' && !getCompare ? 'heatmap' : ctx.heatView;
    const active = !!getSource && view !== 'wilayah';
    const seq = ++ctx._heatSeq;

    ctx._heatToggleEl.style.display = getSource ? '' : 'none';
    for (const button of ctx._heatToggleEl.querySelectorAll('button')) {
        if (button.dataset.view === 'banding') button.style.display = getCompare ? '' : 'none';
        const selected = button.dataset.view === view;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
    }
    _setHeatViewActive(ctx, active);
    if (!active) {
        _removeHeatLayer(ctx);
        return;
    }

    try {
        const compare = view === 'banding' ? getCompare(ctx) : null;
        const { model, domain, unit, order, caveat } = compare ? compare.heat : getSource(ctx);
        const coordDomain = [...domain, ['latitude', '!=', 0], ['longitude', '!=', 0]];
        const fields = ['latitude', 'longitude'];
        const [total, withCoords, records, patrolRecords] = await Promise.all([
            ctx.orm.searchCount(model, domain),
            ctx.orm.searchCount(model, coordDomain),
            ctx.orm.searchRead(model, coordDomain, fields, { limit: HEAT_LIMIT, order }),
            compare
                ? ctx.orm.searchRead(compare.patrol.model, compare.patrol.domain, fields,
                    { limit: HEAT_LIMIT, order: compare.patrol.order })
                : [],
        ]);
        // Hasil usang: filter, mode, atau tampilan sudah berubah selagi data dimuat
        if (seq !== ctx._heatSeq) return;

        _removeHeatLayer(ctx);
        ctx._heatPoints = records.map((r) => [r.latitude, r.longitude]);
        ctx._heatLayer = _createHeatLayer(ctx._heatPoints, {
            radius: HEAT_RADIUS,
            blur: HEAT_BLUR,
            minOpacity: 0.3,
            gradient: HEAT_GRADIENT,
            ..._intensityOptions(ctx.map, ctx._heatPoints),
        });
        ctx._heatLayer.addTo(ctx.map);

        const note = _heatNote(total, records.length, withCoords, unit);
        if (compare) {
            const patrolPoints = patrolRecords.map((r) => [r.latitude, r.longitude]);
            ctx._heatDots = L.layerGroup(patrolPoints.map((point) => L.circleMarker(point, {
                renderer: ctx._heatDotRenderer,
                radius: 4,
                color: '#fff',
                weight: 1.5,
                fillColor: DOT_COLOR,
                fillOpacity: 1,
                interactive: false,
            }))).addTo(ctx.map);
            _addHeatLegend(ctx, _compareLegend(ctx._heatPoints, patrolPoints, compare.periode, note));
        } else {
            _addHeatLegend(ctx, { notes: [note, caveat] });
        }
    } catch (error) {
        console.error('Gagal memuat data heatmap:', error);
        if (seq !== ctx._heatSeq) return;
        _removeHeatLayer(ctx);
        _addHeatLegend(ctx, { notes: ['Data heatmap gagal dimuat'] });
    }
}
