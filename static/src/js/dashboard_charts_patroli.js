/** @odoo-module **/

import { fmtTanggalJam, wibDateStartUtc, wibDateEndUtc } from "./dashboard_helpers";

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function _renderBarChart(ctx, names, values) {
    const el = ctx.chartPatroliBarRef?.el;
    if (!el || typeof echarts === 'undefined') return;
    if (ctx._echartsPatroliBar) ctx._echartsPatroliBar.dispose();
    ctx._echartsPatroliBar = echarts.init(el);
    ctx._echartsPatroliBar.setOption({
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#fff',
            borderColor: '#E3DDD0',
            borderWidth: 1,
            textStyle: { color: '#26211A', fontSize: 12 },
            formatter: params => {
                const p = params[0];
                return `${p.name}<br/><b>Total Patroli: ${p.value.toLocaleString('id-ID')}</b>`;
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
                    { offset: 0, color: '#1D1A15' },
                    { offset: 1, color: '#1D1A15' },
                ]),
                borderRadius: [2, 2, 0, 0],
            },
            emphasis: { itemStyle: { color: '#3D3022' } },
        }],
    });
}

function _renderTrendChart(ctx, months, patroliData, lokasiData) {
    const el = ctx.chartPatroliTrendRef?.el;
    if (!el || typeof echarts === 'undefined') return;
    if (ctx._echartsPatroliTrend) ctx._echartsPatroliTrend.dispose();
    ctx._echartsPatroliTrend = echarts.init(el);
    ctx._echartsPatroliTrend.setOption({
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#fff',
            borderColor: '#E3DDD0',
            borderWidth: 1,
            textStyle: { color: '#26211A', fontSize: 12 },
            formatter: params => {
                const pat = params.find(p => p.seriesName === 'Patroli');
                const lok = params.find(p => p.seriesName === 'Titik Lokasi');
                return `<b>${params[0]?.name}</b><br/>`
                    + `<span style="color:#1D1A15">&#9632;</span> Patroli: <b>${(pat?.value || 0).toLocaleString('id-ID')}</b><br/>`
                    + `<span style="color:#8C6A3A">&#9632;</span> Titik Lokasi: <b>${(lok?.value || 0).toLocaleString('id-ID')}</b>`;
            },
        },
        legend: {
            bottom: 0,   // di bawah agar tidak berhimpitan dengan label di atas batang
            textStyle: { fontSize: 11, color: '#6B6256' },
            icon: 'roundRect',
            itemWidth: 12,
            itemHeight: 8,
        },
        grid: { left: 12, right: 48, top: 26, bottom: 40, containLabel: true },
        xAxis: {
            type: 'category',
            data: months,
            axisLabel: { fontSize: 10, color: '#666' },
            axisLine: { lineStyle: { color: '#DDD6CB' } },
            axisTick: { show: false },
        },
        yAxis: [
            {
                type: 'value',
                minInterval: 1,
                axisLabel: { fontSize: 10, color: '#1D1A15', margin: 4 },
                splitLine: { lineStyle: { color: '#F1EEE6', type: 'dashed' } },
            },
            {
                type: 'value',
                minInterval: 1,
                axisLabel: { fontSize: 10, color: '#8C6A3A', margin: 4 },
                splitLine: { show: false },
            },
        ],
        series: [
            {
                name: 'Patroli',
                type: 'line',
                yAxisIndex: 0,
                data: patroliData,
                smooth: false,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { color: '#1D1A15', width: 2 },
                itemStyle: { color: '#1D1A15', borderColor: '#fff', borderWidth: 2 },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(29,26,21,0.20)' },
                        { offset: 1, color: 'rgba(29,26,21,0.02)' },
                    ]),
                },
                label: { show: false },
            },
            {
                name: 'Titik Lokasi',
                type: 'bar',
                yAxisIndex: 1,
                data: lokasiData,
                barMaxWidth: 28,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#8C6A3A' },
                        { offset: 1, color: '#8C6A3A' },
                    ]),
                    borderRadius: [2, 2, 0, 0],
                },
                label: {
                    show: true,
                    position: 'top',
                    fontSize: 10,
                    color: '#8C6A3A',
                    fontWeight: '600',
                    formatter: p => p.value > 0 ? p.value.toLocaleString('id-ID') : '',
                },
            },
        ],
    });
}

const WAKTU_LABELS = ['00:00-02:59', '03:00-05:59', '06:00-08:59', '09:00-11:59',
                      '12:00-14:59', '15:00-17:59', '18:00-20:59', '21:00-23:59'];

function _renderWaktuChart(ctx, patroliSlots, krimSlots) {
    const el = ctx.chartPatroliWaktuRef?.el;
    if (!el || typeof echarts === 'undefined') return;
    if (ctx._echartsPatroliWaktu) ctx._echartsPatroliWaktu.dispose();
    ctx._echartsPatroliWaktu = echarts.init(el);
    ctx._echartsPatroliWaktu.setOption({
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#fff',
            borderColor: '#E3DDD0',
            borderWidth: 1,
            textStyle: { color: '#26211A', fontSize: 12 },
            formatter: params => {
                const pat  = params.find(p => p.seriesName === 'Patroli');
                const krim = params.find(p => p.seriesName === 'Kriminalitas');
                return `<b>${params[0]?.name}</b><br/>`
                    + `<span style="color:#1D1A15">&#9632;</span> Patroli: <b>${(pat?.value || 0).toLocaleString('id-ID')}</b><br/>`
                    + `<span style="color:#B07F10">&#9632;</span> Kriminalitas: <b>${(krim?.value || 0).toLocaleString('id-ID')}</b>`;
            },
        },
        legend: {
            bottom: 0,
            textStyle: { fontSize: 11, color: '#555' },
            icon: 'roundRect',
            itemWidth: 12, itemHeight: 8,
        },
        grid: { left: 12, right: 24, top: 26, bottom: 48, containLabel: true },
        xAxis: {
            type: 'category',
            data: WAKTU_LABELS,
            axisLabel: { fontSize: 10, color: '#666', rotate: 30, interval: 0 },
            axisLine: { lineStyle: { color: '#E3DDD0' } },
            axisTick: { show: false },
        },
        yAxis: {
            type: 'value',
            minInterval: 1,
            axisLabel: { fontSize: 10, color: '#999' },
            splitLine: { lineStyle: { color: '#F1EEE6' } },
        },
        series: [
            {
                name: 'Patroli',
                type: 'line',
                smooth: false,
                data: patroliSlots,
                lineStyle: { color: '#1D1A15', width: 2 },
                itemStyle: { color: '#1D1A15' },
                symbol: 'circle',
                symbolSize: 6,
                areaStyle: {
                    color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{ offset: 0, color: 'rgba(29,26,21,0.18)' }, { offset: 1, color: 'rgba(29,26,21,0)' }] },
                },
                label: {
                    show: true,
                    position: 'top',
                    fontSize: 10,
                    color: '#1D1A15',
                    fontWeight: '600',
                    formatter: p => p.value > 0 ? p.value.toLocaleString('id-ID') : '',
                },
            },
            {
                name: 'Kriminalitas',
                type: 'line',
                smooth: false,
                data: krimSlots,
                lineStyle: { color: '#B07F10', width: 2 },
                itemStyle: { color: '#B07F10' },
                symbol: 'circle',
                symbolSize: 6,
                areaStyle: {
                    color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{ offset: 0, color: 'rgba(176,127,16,0.14)' }, { offset: 1, color: 'rgba(176,127,16,0)' }] },
                },
                label: {
                    show: true,
                    position: 'bottom',   // label kriminalitas di bawah titik, patroli di atas: tidak saling menimpa
                    fontSize: 10,
                    color: '#B07F10',
                    fontWeight: '600',
                    formatter: p => p.value > 0 ? p.value.toLocaleString('id-ID') : '',
                },
            },
        ],
    });
}

export function disposePatroliCharts(ctx) {
    if (ctx._echartsPatroliBar)   { ctx._echartsPatroliBar.dispose();   ctx._echartsPatroliBar   = null; }
    if (ctx._echartsPatroliTrend) { ctx._echartsPatroliTrend.dispose(); ctx._echartsPatroliTrend = null; }
    if (ctx._echartsPatroliWaktu) { ctx._echartsPatroliWaktu.dispose(); ctx._echartsPatroliWaktu = null; }
}

export async function updatePatroliCharts(ctx, mode) {
    const ver      = ctx._modeVersion;
    const row      = ctx.chartPatroliRowRef?.el;
    const waktuRow = ctx.chartPatroliWaktuRowRef?.el;
    if (!row) return;

    if (mode !== 'patroli') {
        if (ctx.currentMode !== 'patroli') {
            row.style.display = 'none';
            if (waktuRow) waktuRow.style.display = 'none';
            disposePatroliCharts(ctx);
        }
        return;
    }
    row.style.display = 'flex';
    if (waktuRow) waktuRow.style.display = 'flex';

    const kabupatenId = parseInt(ctx.filterKabupaten?.el?.value) || null;
    const stateValue  = ctx.filterState?.el?.value || '';
    const dateFrom    = ctx.activeDateFrom || '';
    const dateTo      = ctx.activeDateTo   || '';
    const polresId    = ctx._polresFilterId;

    const drillDomain = ctx.drillKecamatanId
        ? [['kecamatan_id', '=', ctx.drillKecamatanId]]
        : ctx.drillKabupatenId
            ? [['kabupaten_id', '=', ctx.drillKabupatenId]]
            : [];

    const baseDomain = [
        ...drillDomain,
        ...(polresId    ? [['polres_id',    '=',  polresId]]                   : []),
        ...(kabupatenId ? [['kabupaten_id', '=',  kabupatenId]]               : []),
        ...(stateValue  ? [['state',        '=',  stateValue]]                : []),
        ...(dateFrom    ? [['tanggal_mulai', '>=', wibDateStartUtc(dateFrom)]]   : []),
        ...(dateTo      ? [['tanggal_mulai', '<=', wibDateEndUtc(dateTo)]]   : []),
    ];

    const lokasiBaseDomain = [
        ...drillDomain.map(([f, op, v]) => [`patroli_id.${f}`, op, v]),
        ...(polresId    ? [['patroli_id.polres_id',    '=',  polresId]]                      : []),
        ...(kabupatenId ? [['patroli_id.kabupaten_id', '=',  kabupatenId]]                   : []),
        ...(stateValue  ? [['patroli_id.state',        '=',  stateValue]]                    : []),
        ...(dateFrom    ? [['patroli_id.tanggal_mulai', '>=', wibDateStartUtc(dateFrom)]]       : []),
        ...(dateTo      ? [['patroli_id.tanggal_mulai', '<=', wibDateEndUtc(dateTo)]]       : []),
    ];

    const krimDomain = [
        ...(polresId    ? [['polres_id',       '=',  polresId]]                      : []),
        ...(kabupatenId ? [['kabupaten_id',     '=',  kabupatenId]]                  : []),
        ...(dateFrom    ? [['tanggal_kejadian', '>=', wibDateStartUtc(dateFrom)]]    : []),
        ...(dateTo      ? [['tanggal_kejadian', '<=', wibDateEndUtc(dateTo)]]        : []),
    ];

    try {
        const [polresGroups, trendGroups, lokasiTrendGroups, patroliHourGroups, krimHourGroups] = await Promise.all([
            ctx.orm.call('petapantau.patroli', 'read_group',
                [baseDomain, ['polres_id'], ['polres_id']], { lazy: false }),
            ctx.orm.call('petapantau.patroli', 'read_group',
                [baseDomain, [], ['tanggal_mulai:month']], { lazy: false }),
            ctx.orm.call('petapantau.lokasi_patroli', 'read_group',
                [lokasiBaseDomain, [], ['tanggal:month']], { lazy: false }),
            ctx.orm.call('petapantau.patroli', 'read_group',
                [baseDomain, [], ['tanggal_mulai:hour']], { lazy: false }),
            ctx.orm.call('petapantau.kriminalitas', 'read_group',
                [krimDomain, [], ['tanggal_kejadian:hour']], { lazy: false }),
        ]);

        if (ctx._modeVersion !== ver) return;

        const barData = polresGroups
            .filter(g => Array.isArray(g.polres_id) && (g.__count || 0) > 0)
            .map(g => ({ name: g.polres_id[1], count: g.__count }))
            .sort((a, b) => b.count - a.count);
        const barNames  = barData.map(p => p.name);
        const barValues = barData.map(p => p.count);

        const patroliData = new Array(12).fill(0);
        trendGroups.forEach(g => {
            const from = g.__range?.['tanggal_mulai:month']?.from
                      || g.__range?.['tanggal_mulai']?.from;
            if (!from) return;
            const month = new Date(new Date(from.replace(' ', 'T') + 'Z').getTime() + 7 * 3600 * 1000).getUTCMonth();
            if (month < 0 || month > 11) return;
            patroliData[month] += g.__count || 0;
        });

        const lokasiData = new Array(12).fill(0);
        lokasiTrendGroups.forEach(g => {
            const from = g.__range?.['tanggal:month']?.from
                      || g.__range?.['tanggal']?.from;
            if (!from) return;
            const month = new Date(new Date(from.replace(' ', 'T') + 'Z').getTime() + 7 * 3600 * 1000).getUTCMonth();
            if (month < 0 || month > 11) return;
            lokasiData[month] += g.__count || 0;
        });

        const patroliSlots = new Array(8).fill(0);
        patroliHourGroups.forEach(g => {
            const rf = g.__range?.['tanggal_mulai:hour']?.from || g.__range?.['tanggal_mulai']?.from;
            if (!rf) return;
            const d    = new Date(rf.replace(' ', 'T') + 'Z');
            const slot = Math.floor(((d.getUTCHours() + 7) % 24) / 3);
            if (slot >= 0 && slot < 8) patroliSlots[slot] += g.__count || 0;
        });

        const krimSlots = new Array(8).fill(0);
        krimHourGroups.forEach(g => {
            const rf = g.__range?.['tanggal_kejadian:hour']?.from || g.__range?.['tanggal_kejadian']?.from;
            if (!rf) return;
            const d    = new Date(rf.replace(' ', 'T') + 'Z');
            const slot = Math.floor(((d.getUTCHours() + 7) % 24) / 3);
            if (slot >= 0 && slot < 8) krimSlots[slot] += g.__count || 0;
        });

        _renderBarChart(ctx, barNames, barValues);
        _renderTrendChart(ctx, MONTHS_ID, patroliData, lokasiData);
        _renderWaktuChart(ctx, patroliSlots, krimSlots);
    } catch (e) {
        console.error('Patroli chart load error:', e);
    }
}

// ─── Data Table ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export async function updatePatroliTable(ctx, mode, page) {
    const ver    = ctx._modeVersion;
    const rowEl  = ctx.tablePatroliRowRef?.el;
    const bodyEl = ctx.tablePatroliBodyRef?.el;
    if (!rowEl) return;

    if (mode !== 'patroli') {
        if (ctx.currentMode !== 'patroli') rowEl.style.display = 'none';
        return;
    }
    rowEl.style.display = 'flex';

    ctx._patroliTablePage = (page !== undefined) ? page : 1;
    const offset = (ctx._patroliTablePage - 1) * PAGE_SIZE;

    const kabupatenId = parseInt(ctx.filterKabupaten?.el?.value) || null;
    const stateValue  = ctx.filterState?.el?.value || '';
    const dateFrom    = ctx.activeDateFrom || '';
    const dateTo      = ctx.activeDateTo   || '';
    const polresId    = ctx._polresFilterId;

    const drillDomain = ctx.drillKecamatanId
        ? [['kecamatan_id', '=', ctx.drillKecamatanId]]
        : ctx.drillKabupatenId
            ? [['kabupaten_id', '=', ctx.drillKabupatenId]]
            : [];

    const domain = [
        ...drillDomain,
        ...(polresId    ? [['polres_id',    '=',  polresId]]                   : []),
        ...(kabupatenId ? [['kabupaten_id', '=',  kabupatenId]]               : []),
        ...(stateValue  ? [['state',        '=',  stateValue]]                : []),
        ...(dateFrom    ? [['tanggal_mulai', '>=', wibDateStartUtc(dateFrom)]]   : []),
        ...(dateTo      ? [['tanggal_mulai', '<=', wibDateEndUtc(dateTo)]]   : []),
    ];

    bodyEl.innerHTML = `<div style="text-align:center;padding:24px;color:#bbb;font-size:13px;">Memuat data...</div>`;

    try {
        const [records, total] = await Promise.all([
            ctx.orm.searchRead(
                'petapantau.patroli',
                domain,
                ['id', 'code', 'tanggal_mulai', 'tanggal_selesai',
                 'polres_id', 'polsek_id', 'kabupaten_id', 'kecamatan_id', 'desa_id',
                 'personel_count', 'lokasi_count', 'state'],
                { order: 'tanggal_mulai desc', limit: PAGE_SIZE, offset }
            ),
            ctx.orm.searchCount('petapantau.patroli', domain),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const curPage    = ctx._patroliTablePage;
        const fromRow    = total > 0 ? offset + 1 : 0;
        const toRow      = Math.min(offset + PAGE_SIZE, total);

        const rows = records.map((r, i) => {
            const polres = Array.isArray(r.polres_id)    ? r.polres_id[1]    : '-';
            const polsek = Array.isArray(r.polsek_id)    ? r.polsek_id[1]    : '-';
            const kab    = Array.isArray(r.kabupaten_id) ? r.kabupaten_id[1] : '-';
            const kec    = Array.isArray(r.kecamatan_id) ? r.kecamatan_id[1] : '-';
            const desa   = Array.isArray(r.desa_id)      ? r.desa_id[1]      : '-';
            const statusClass = r.state === 'SELESAI'
                ? 'petapantau-badge petapantau-badge--green'
                : 'petapantau-badge petapantau-badge--red';

            return `
                <tr class="petapantau-table-row" data-id="${r.id}" style="cursor:pointer;">
                    <td class="petapantau-td">${offset + i + 1}</td>
                    <td class="petapantau-td petapantau-td--mono">${r.code || '-'}</td>
                    <td class="petapantau-td" style="white-space:nowrap;">${fmtTanggalJam(r.tanggal_mulai)}</td>
                    <td class="petapantau-td" style="white-space:nowrap;">${fmtTanggalJam(r.tanggal_selesai)}</td>
                    <td class="petapantau-td">${polres}</td>
                    <td class="petapantau-td">${polsek}</td>
                    <td class="petapantau-td">${kab}</td>
                    <td class="petapantau-td">${kec}</td>
                    <td class="petapantau-td">${desa}</td>
                    <td class="petapantau-td" style="text-align:center;">${r.personel_count || 0}</td>
                    <td class="petapantau-td" style="text-align:center;">${r.lokasi_count || 0}</td>
                    <td class="petapantau-td"><span class="${statusClass}">${r.state || '-'}</span></td>
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
                    <button class="petapantau-page-btn" data-action="prev" ${curPage <= 1 ? 'disabled' : ''}>
                        <i class="fa fa-chevron-left"></i>
                    </button>
                    <span class="petapantau-page-info">Hal. ${curPage} / ${totalPages}</span>
                    <button class="petapantau-page-btn" data-action="next" ${curPage >= totalPages ? 'disabled' : ''}>
                        <i class="fa fa-chevron-right"></i>
                    </button>
                </div>
            </div>
            <div class="petapantau-table-wrapper">
                <table class="petapantau-table">
                    <thead>
                        <tr>
                            <th class="petapantau-th">#</th>
                            <th class="petapantau-th">Kode</th>
                            <th class="petapantau-th">Tgl Mulai</th>
                            <th class="petapantau-th">Tgl Selesai</th>
                            <th class="petapantau-th">Polres</th>
                            <th class="petapantau-th">Polsek</th>
                            <th class="petapantau-th">Kabupaten</th>
                            <th class="petapantau-th">Kecamatan</th>
                            <th class="petapantau-th">Desa</th>
                            <th class="petapantau-th">Personel</th>
                            <th class="petapantau-th">Titik Lokasi</th>
                            <th class="petapantau-th">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || `<tr><td colspan="12" style="text-align:center;padding:24px;color:#bbb;font-size:13px;">Tidak ada data</td></tr>`}
                    </tbody>
                </table>
            </div>`;

        bodyEl.querySelectorAll('.petapantau-table-row').forEach(tr => {
            tr.addEventListener('click', () => {
                const id = parseInt(tr.dataset.id);
                if (!id) return;
                ctx.action.doAction({
                    type: 'ir.actions.act_window',
                    res_model: 'petapantau.patroli',
                    res_id: id,
                    views: [[false, 'form']],
                    target: 'current',
                });
            });
        });

        bodyEl.querySelector('[data-action="prev"]')
            ?.addEventListener('click', () => updatePatroliTable(ctx, mode, curPage - 1));
        bodyEl.querySelector('[data-action="next"]')
            ?.addEventListener('click', () => updatePatroliTable(ctx, mode, curPage + 1));

    } catch (e) {
        console.error('Patroli table load error:', e);
        bodyEl.innerHTML = `<div style="text-align:center;padding:24px;color:#B07F10;font-size:13px;">Gagal memuat data</div>`;
    }
}
