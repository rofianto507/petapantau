/** @odoo-module **/

import { fmtTanggal, wibDateStartUtc, wibDateEndUtc } from "./dashboard_helpers";

const TIME_LABELS = ['00:00-02:59', '03:00-05:59', '06:00-08:59', '09:00-11:59',
                     '12:00-14:59', '15:00-17:59', '18:00-20:59', '21:00-23:59'];

// ─── Bar chart: total per kabupaten ──────────────────────────────────────────
function _renderLalinBarChart(ctx, names, values) {
    const el = ctx.chartLalinBarRef?.el;
    if (!el || typeof echarts === 'undefined') return;
    if (ctx._echartsLalinBar) ctx._echartsLalinBar.dispose();
    ctx._echartsLalinBar = echarts.init(el);
    ctx._echartsLalinBar.setOption({
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#fff',
            borderColor: '#E3DDD0',
            borderWidth: 1,
            textStyle: { color: '#26211A', fontSize: 12 },
            formatter: params => {
                const p = params[0];
                return `${p.name}<br/><b>Total Kejadian: ${p.value.toLocaleString('id-ID')}</b>`;
            },
        },
        grid: { left: 10, right: 16, top: 10, bottom: 55, containLabel: true },
        xAxis: {
            type: 'category',
            data: names,
            axisLabel: { rotate: 40, fontSize: 10, color: '#666', interval: 0 },
            axisLine: { lineStyle: { color: '#DDD6CB' } },
            axisTick: { show: false },
        },
        yAxis: {
            type: 'value',
            axisLabel: { fontSize: 10, color: '#888' },
            splitLine: { lineStyle: { color: '#F1EEE6', type: 'dashed' } },
        },
        series: [{
            type: 'bar',
            data: values,
            barMaxWidth: 36,
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#8C6A3A' },
                    { offset: 1, color: '#5C4000' },
                ]),
                borderRadius: [4, 4, 0, 0],
            },
            emphasis: { itemStyle: { color: '#3D2A00' } },
        }],
    });
}

// ─── Donut chart: per kategori ────────────────────────────────────────────────
function _renderLalinDonutChart(ctx, data) {
    const el = ctx.chartLalinDonutRef?.el;
    if (!el || typeof echarts === 'undefined') return;
    if (ctx._echartsLalinDonut) ctx._echartsLalinDonut.dispose();
    ctx._echartsLalinDonut = echarts.init(el);
    const COLORS = ['#B07F10', '#8C6A3A', '#E9C05A', '#3D3022', '#D4A537',
                    '#D4A537', '#8C6A3A', '#8C6A3A', '#B07F10', '#3B2716'];
    ctx._echartsLalinDonut.setOption({
        tooltip: {
            trigger: 'item',
            backgroundColor: '#fff',
            borderColor: '#E3DDD0',
            borderWidth: 1,
            textStyle: { color: '#26211A', fontSize: 12 },
            formatter: '{b}: {c} ({d}%)',
        },
        // Keterangan di bawah grafik agar tidak menimpa label busur
        legend: {
            type: 'plain',
            orient: 'horizontal',
            left: 'center',
            bottom: 4,
            width: '92%',
            textStyle: { fontSize: 11, color: '#6B6256' },
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 14,
            formatter: name => name.length > 22 ? name.slice(0, 22) + '…' : name,
        },
        color: COLORS,
        series: [{
            type: 'pie',
            radius: ['40%', '62%'],
            center: ['50%', '44%'],
            data,
            label: { show: true, formatter: p => (p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name) + '\n' + p.value, fontSize: 10, color: '#555' },
            labelLayout: { hideOverlap: true },
            labelLine: { length: 8, length2: 10 },
            itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
            emphasis: { itemStyle: { shadowBlur: 8, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } },
        }],
    });
}

// ─── Pie chart: per jenis jalan ───────────────────────────────────────────────
function _renderLalinJenisJalanChart(ctx, data) {
    const el = ctx.chartLalinJenisJalanRef?.el;
    if (!el || typeof echarts === 'undefined') return;
    if (ctx._echartsLalinJenisJalan) ctx._echartsLalinJenisJalan.dispose();
    ctx._echartsLalinJenisJalan = echarts.init(el);
    const COLORS = ['#D4A537', '#8A6410', '#8C6A3A', '#6E4E0C', '#D4A537',
                    '#B07F10', '#B07F10', '#3D3022', '#8C6A3A', '#BDB49F'];
    ctx._echartsLalinJenisJalan.setOption({
        tooltip: {
            trigger: 'item',
            backgroundColor: '#fff',
            borderColor: '#E3DDD0',
            borderWidth: 1,
            textStyle: { color: '#26211A', fontSize: 12 },
            formatter: '{b}: {c} ({d}%)',
        },
        // Keterangan di bawah grafik agar tidak menimpa label busur
        legend: {
            type: 'plain',
            orient: 'horizontal',
            left: 'center',
            bottom: 4,
            width: '92%',
            textStyle: { fontSize: 11, color: '#6B6256' },
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 14,
            formatter: name => name.length > 22 ? name.slice(0, 22) + '…' : name,
        },
        color: COLORS,
        series: [{
            type: 'pie',
            radius: '60%',
            center: ['50%', '44%'],
            data,
            label: { show: true, formatter: p => (p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name) + '\n' + p.value, fontSize: 10, color: '#555' },
            labelLayout: { hideOverlap: true },
            labelLine: { length: 8, length2: 10 },
            itemStyle: { borderColor: '#fff', borderWidth: 2 },
            emphasis: { itemStyle: { shadowBlur: 8, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } },
        }],
    });
}

// ─── Helper: proses hour groups → array[8] slot 3 jam ────────────────────────
function _processLalinHourGroups(groups) {
    const data = new Array(8).fill(0);
    groups.forEach(g => {
        const rangeFrom = g.__range?.['tanggal_kejadian:hour']?.from
                       || g.__range?.['tanggal_kejadian']?.from;
        if (!rangeFrom) return;
        const dateObj = new Date(rangeFrom.length > 10 ? rangeFrom.replace(' ', 'T') + 'Z' : rangeFrom);
        const slot    = Math.floor(((dateObj.getUTCHours() + 7) % 24) / 3);
        if (slot >= 0 && slot < 8) data[slot] += g.__count || 0;
    });
    return data;
}

// ─── Area line: rentang waktu kejadian (per slot 3 jam) ───────────────────────
function _renderLalinWaktuChart(ctx, labels, values) {
    const el = ctx.chartLalinWaktuRef?.el;
    if (!el || typeof echarts === 'undefined') return;
    if (ctx._echartsLalinWaktu) ctx._echartsLalinWaktu.dispose();
    ctx._echartsLalinWaktu = echarts.init(el);
    ctx._echartsLalinWaktu.setOption({
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#fff',
            borderColor: '#E3DDD0',
            borderWidth: 1,
            textStyle: { color: '#26211A', fontSize: 12 },
            formatter: params => {
                const p = params[0];
                return `${p.name}<br/><b>Total: ${p.value.toLocaleString('id-ID')}</b>`;
            },
        },
        grid: { left: 10, right: 16, top: 20, bottom: 55, containLabel: true },
        xAxis: {
            type: 'category',
            data: labels,
            boundaryGap: false,
            axisLabel: { rotate: 35, fontSize: 9, color: '#666', interval: 0 },
            axisLine: { lineStyle: { color: '#DDD6CB' } },
            axisTick: { show: false },
        },
        yAxis: {
            type: 'value',
            axisLabel: { fontSize: 10, color: '#888' },
            splitLine: { lineStyle: { color: '#F1EEE6', type: 'dashed' } },
        },
        series: [{
            type: 'line',
            data: values,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#8C6A3A', width: 2 },
            itemStyle: { color: '#8A6410' },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(140,106,58,0.34)' },
                    { offset: 1, color: 'rgba(138,100,16,0.03)' },
                ]),
            },
            label: {
                show: true, position: 'top', fontSize: 10, color: '#8A6410', fontWeight: '600',
                formatter: p => p.value > 0 ? p.value.toLocaleString('id-ID') : '',
            },
        }],
    });
}

// ─── Exported ─────────────────────────────────────────────────────────────────

export function disposeLalinCharts(ctx) {
    if (ctx._echartsLalinBar)        { ctx._echartsLalinBar.dispose();        ctx._echartsLalinBar        = null; }
    if (ctx._echartsLalinDonut)      { ctx._echartsLalinDonut.dispose();      ctx._echartsLalinDonut      = null; }
    if (ctx._echartsLalinJenisJalan) { ctx._echartsLalinJenisJalan.dispose(); ctx._echartsLalinJenisJalan = null; }
    if (ctx._echartsLalinWaktu)      { ctx._echartsLalinWaktu.dispose();      ctx._echartsLalinWaktu      = null; }
}

export async function updateLalinCharts(ctx, mode) {
    const ver  = ctx._modeVersion;
    const row  = ctx.chartLalinRowRef?.el;
    const row2 = ctx.chartLalinRow2Ref?.el;
    if (!row) return;

    if (mode !== 'lalin') {
        if (ctx.currentMode !== 'lalin') { row.style.display = 'none'; if (row2) row2.style.display = 'none'; disposeLalinCharts(ctx); }
        return;
    }
    row.style.display  = 'flex';
    if (row2) row2.style.display = 'flex';

    const tahun       = ctx.filterTahun?.el?.value      || '';
    const dateFrom    = ctx.activeDateFrom               || '';
    const dateTo      = ctx.activeDateTo                 || '';
    const kategoriId  = parseInt(ctx.filterKategori?.el?.value)  || null;
    const kabupatenId = parseInt(ctx.filterKabupaten?.el?.value) || null;
    const stateValue  = ctx.filterState?.el?.value       || '';

    const drillDomain = ctx.drillKecamatanId
        ? [['kecamatan_id', '=', ctx.drillKecamatanId]]
        : ctx.drillKabupatenId
            ? [['kabupaten_id', '=', ctx.drillKabupatenId]]
            : [];

    const baseDomain = [
        ...drillDomain,
        ...(kabupatenId ? [['kabupaten_id',            '=',  kabupatenId]]               : []),
        ...(stateValue  ? [['state',                   '=',  stateValue]]                : []),
        ...(tahun       ? [['tahun', '=',  tahun]]                     : []),
        ...(dateFrom    ? [['tanggal_kejadian',         '>=', wibDateStartUtc(dateFrom)]]   : []),
        ...(dateTo      ? [['tanggal_kejadian',         '<=', wibDateEndUtc(dateTo)]]   : []),
        ...(kategoriId  ? [['kategori_id',              '=',  kategoriId]]               : []),
    ];

    try {
        const [kabGroups, katGroups, allKabupaten, jenisJalanGroups, waktuGroups] = await Promise.all([
            ctx.orm.call('petapantau.lalu_lintas', 'read_group',
                [baseDomain, ['kabupaten_id'],   ['kabupaten_id']],   { lazy: false }),
            ctx.orm.call('petapantau.lalu_lintas', 'read_group',
                [baseDomain, ['kategori_id'],    ['kategori_id']],    { lazy: false }),
            ctx.orm.searchRead('petapantau.kabupaten', [], ['id', 'name'], { order: 'name asc' }),
            ctx.orm.call('petapantau.lalu_lintas', 'read_group',
                [baseDomain, ['jenis_jalan_id'], ['jenis_jalan_id']], { lazy: false }),
            ctx.orm.call('petapantau.lalu_lintas', 'read_group',
                [baseDomain, ['id'],             ['tanggal_kejadian:hour']], { lazy: false }),
        ]);

        // Bar — semua kabupaten termasuk yang 0, sort desc
        const kabCountMap = {};
        kabGroups.forEach(g => {
            if (!g.kabupaten_id) return;
            kabCountMap[g.kabupaten_id[0]] = g.__count || 0;
        });
        const kabList = allKabupaten.map(k => ({ name: k.name, val: kabCountMap[k.id] || 0 }));
        kabList.sort((a, b) => b.val - a.val);
        if (ctx._modeVersion !== ver) return;
        _renderLalinBarChart(ctx, kabList.map(k => k.name), kabList.map(k => k.val));

        // Donut — per kategori
        const donutData = katGroups
            .filter(g => g.kategori_id)
            .map(g => ({ name: g.kategori_id[1], value: g.__count || 0 }))
            .sort((a, b) => b.value - a.value);

        const titleEl = ctx.chartLalinDonutTitleRef?.el;
        if (titleEl) {
            const loc = ctx.drillKecamatanId
                ? 'Wilayah Kecamatan Terpilih'
                : ctx.drillKabupatenId || kabupatenId
                    ? 'Kabupaten Terpilih'
                    : 'Semua Wilayah';
            titleEl.innerHTML = `<i class="fa fa-pie-chart"></i> Lalu Lintas Berdasarkan Kategori (${loc})`;
        }
        _renderLalinDonutChart(ctx, donutData);

        // Pie — per jenis jalan
        const jenisJalanData = jenisJalanGroups
            .filter(g => g.jenis_jalan_id)
            .map(g => ({ name: g.jenis_jalan_id[1], value: g.__count || 0 }))
            .sort((a, b) => b.value - a.value);
        _renderLalinJenisJalanChart(ctx, jenisJalanData);

        // Area line — rentang waktu kejadian (slot 3 jam)
        const waktuData = _processLalinHourGroups(waktuGroups);
        _renderLalinWaktuChart(ctx, TIME_LABELS, waktuData);

    } catch (e) {
        console.error('Gagal memuat grafik lalu lintas:', e);
    }
}

// ─── Data Table ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export async function updateLalinTable(ctx, mode, page) {
    const ver    = ctx._modeVersion;
    const rowEl  = ctx.tableLalinRowRef?.el;
    const bodyEl = ctx.tableLalinBodyRef?.el;
    if (!rowEl) return;

    if (mode !== 'lalin') { if (ctx.currentMode !== 'lalin') rowEl.style.display = 'none'; return; }
    rowEl.style.display = 'flex';

    ctx._lalinTablePage = (page !== undefined) ? page : 1;
    const offset = (ctx._lalinTablePage - 1) * PAGE_SIZE;

    const tahun       = ctx.filterTahun?.el?.value       || '';
    const dateFrom    = ctx.activeDateFrom                || '';
    const dateTo      = ctx.activeDateTo                  || '';
    const kategoriId  = parseInt(ctx.filterKategori?.el?.value)  || null;
    const kabupatenId = parseInt(ctx.filterKabupaten?.el?.value) || null;
    const stateValue  = ctx.filterState?.el?.value        || '';

    const drillDomain = ctx.drillKecamatanId
        ? [['kecamatan_id', '=', ctx.drillKecamatanId]]
        : ctx.drillKabupatenId ? [['kabupaten_id', '=', ctx.drillKabupatenId]] : [];

    const domain = [
        ...drillDomain,
        ...(kabupatenId ? [['kabupaten_id',            '=',  kabupatenId]]            : []),
        ...(stateValue  ? [['state',                   '=',  stateValue]]             : []),
        ...(tahun       ? [['tahun', '=',  tahun]]                  : []),
        ...(dateFrom    ? [['tanggal_kejadian',        '>=', wibDateStartUtc(dateFrom)]] : []),
        ...(dateTo      ? [['tanggal_kejadian',        '<=', wibDateEndUtc(dateTo)]] : []),
        ...(kategoriId  ? [['kategori_id',             '=',  kategoriId]]             : []),
    ];

    bodyEl.innerHTML = `<div style="text-align:center;padding:24px;color:#bbb;font-size:13px;">Memuat data...</div>`;

    try {
        const [records, total] = await Promise.all([
            ctx.orm.searchRead('petapantau.lalu_lintas', domain,
                ['id', 'code', 'nama_lokasi', 'tanggal_kejadian',
                 'kabupaten_id', 'kecamatan_id', 'kategori_id', 'jenis_jalan_id', 'state'],
                { order: 'tanggal_kejadian desc', limit: PAGE_SIZE, offset }),
            ctx.orm.searchCount('petapantau.lalu_lintas', domain),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const curPage    = ctx._lalinTablePage;
        const fromRow    = total > 0 ? offset + 1 : 0;
        const toRow      = Math.min(offset + PAGE_SIZE, total);

        const rows = records.map((r, i) => {
            const kab   = Array.isArray(r.kabupaten_id)  ? r.kabupaten_id[1]  : '-';
            const kec   = Array.isArray(r.kecamatan_id)  ? r.kecamatan_id[1]  : '-';
            const kat   = Array.isArray(r.kategori_id)   ? r.kategori_id[1]   : '-';
            const jalan = Array.isArray(r.jenis_jalan_id) ? r.jenis_jalan_id[1] : '-';
            const cls   = r.state === 'SELESAI' ? '--green' : '--red';
            return `
                <tr class="petapantau-table-row" data-id="${r.id}" style="cursor:pointer;">
                    <td class="petapantau-td">${offset + i + 1}</td>
                    <td class="petapantau-td petapantau-td--mono">${r.code || '-'}</td>
                    <td class="petapantau-td">${r.nama_lokasi || '-'}</td>
                    <td class="petapantau-td" style="white-space:nowrap;">${fmtTanggal(r.tanggal_kejadian)}</td>
                    <td class="petapantau-td">${kab}</td>
                    <td class="petapantau-td">${kec}</td>
                    <td class="petapantau-td">${kat}</td>
                    <td class="petapantau-td">${jalan}</td>
                    <td class="petapantau-td"><span class="petapantau-badge petapantau-badge${cls}">${r.state || '-'}</span></td>
                </tr>`;
        }).join('');

        if (ctx._modeVersion !== ver) return;
        bodyEl.innerHTML = `
            <div class="petapantau-table-toolbar">
                <span class="petapantau-table-info">
                    ${total > 0
                        ? `Menampilkan&nbsp;<b>${fromRow}–${toRow}</b>&nbsp;dari&nbsp;<b>${total.toLocaleString('id-ID')}</b>&nbsp;data`
                        : 'Tidak ada data'}
                </span>
                <div class="petapantau-table-pagination">
                    <button class="petapantau-page-btn" data-action="prev" ${curPage <= 1 ? 'disabled' : ''}><i class="fa fa-chevron-left"></i></button>
                    <span class="petapantau-page-info">Hal. ${curPage} / ${totalPages}</span>
                    <button class="petapantau-page-btn" data-action="next" ${curPage >= totalPages ? 'disabled' : ''}><i class="fa fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="petapantau-table-wrapper">
                <table class="petapantau-table">
                    <thead><tr>
                        <th class="petapantau-th">#</th>
                        <th class="petapantau-th">Kode</th>
                        <th class="petapantau-th">Nama Lokasi</th>
                        <th class="petapantau-th">Tgl Kejadian</th>
                        <th class="petapantau-th">Kabupaten</th>
                        <th class="petapantau-th">Kecamatan</th>
                        <th class="petapantau-th">Kategori</th>
                        <th class="petapantau-th">Jenis Jalan</th>
                        <th class="petapantau-th">Status</th>
                    </tr></thead>
                    <tbody>
                        ${rows || `<tr><td colspan="9" style="text-align:center;padding:24px;color:#bbb;font-size:13px;">Tidak ada data</td></tr>`}
                    </tbody>
                </table>
            </div>`;

        bodyEl.querySelectorAll('.petapantau-table-row').forEach(tr => {
            tr.addEventListener('click', () => {
                const id = parseInt(tr.dataset.id);
                if (!id) return;
                ctx.action.doAction({ type: 'ir.actions.act_window', res_model: 'petapantau.lalu_lintas',
                    res_id: id, views: [[false, 'form']], target: 'current' });
            });
        });
        bodyEl.querySelector('[data-action="prev"]')?.addEventListener('click', () => updateLalinTable(ctx, mode, curPage - 1));
        bodyEl.querySelector('[data-action="next"]')?.addEventListener('click', () => updateLalinTable(ctx, mode, curPage + 1));

    } catch (e) {
        console.error('Lalin table load error:', e);
        bodyEl.innerHTML = `<div style="text-align:center;padding:24px;color:#B07F10;font-size:13px;">Gagal memuat data</div>`;
    }
}
