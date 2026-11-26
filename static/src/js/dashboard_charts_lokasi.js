/** @odoo-module **/

// lokasi_penting tidak punya tanggal_kejadian / sumber_dokumen_id,
// jadi domain hanya pakai kabupaten_id, kategori_id, state.

// ─── Bar chart: total per kabupaten ──────────────────────────────────────────
function _renderLokasiBarChart(ctx, names, values) {
    const el = ctx.chartLokasiBarRef?.el;
    if (!el || typeof echarts === 'undefined') return;
    if (ctx._echartsLokasiBar) ctx._echartsLokasiBar.dispose();
    ctx._echartsLokasiBar = echarts.init(el);
    ctx._echartsLokasiBar.setOption({
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#fff',
            borderColor: '#E3DDD0',
            borderWidth: 1,
            textStyle: { color: '#26211A', fontSize: 12 },
            formatter: params => {
                const p = params[0];
                return `${p.name}<br/><b>Total Lokasi: ${p.value.toLocaleString('id-ID')}</b>`;
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
                    { offset: 0, color: '#C99A2E' },
                    { offset: 1, color: '#2B1F0A' },
                ]),
                borderRadius: [2, 2, 0, 0],
            },
            emphasis: { itemStyle: { color: '#2B1F0A' } },
        }],
    });
}

// ─── Donut chart: per kategori ────────────────────────────────────────────────
function _renderLokasiDonutChart(ctx, data) {
    const el = ctx.chartLokasiDonutRef?.el;
    if (!el || typeof echarts === 'undefined') return;
    if (ctx._echartsLokasiDonut) ctx._echartsLokasiDonut.dispose();
    ctx._echartsLokasiDonut = echarts.init(el);
    const COLORS = ['#8A6410', '#C99A2E', '#E3CF9D', '#3D3022', '#D4A537',
                    '#B07F10', '#D4A537', '#8C6A3A', '#8C6A3A', '#3B2716'];
    ctx._echartsLokasiDonut.setOption({
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
            itemStyle: { borderRadius: 2, borderColor: '#fff', borderWidth: 2 },
            emphasis: { itemStyle: { shadowBlur: 8, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' } },
        }],
    });
}

// ─── Exported ─────────────────────────────────────────────────────────────────

export function disposeLokasiCharts(ctx) {
    if (ctx._echartsLokasiBar)   { ctx._echartsLokasiBar.dispose();   ctx._echartsLokasiBar   = null; }
    if (ctx._echartsLokasiDonut) { ctx._echartsLokasiDonut.dispose(); ctx._echartsLokasiDonut = null; }
}

export async function updateLokasiCharts(ctx, mode) {
    const ver = ctx._modeVersion;
    const row = ctx.chartLokasiRowRef?.el;
    if (!row) return;

    if (mode !== 'lokasi') {
        if (ctx.currentMode !== 'lokasi') { row.style.display = 'none'; disposeLokasiCharts(ctx); }
        return;
    }
    row.style.display = 'flex';

    const kategoriId  = parseInt(ctx.filterKategori?.el?.value)  || null;
    const kabupatenId = parseInt(ctx.filterKabupaten?.el?.value) || null;
    const stateValue  = ctx.filterState?.el?.value               || '';

    const drillDomain = ctx.drillKecamatanId
        ? [['kecamatan_id', '=', ctx.drillKecamatanId]]
        : ctx.drillKabupatenId
            ? [['kabupaten_id', '=', ctx.drillKabupatenId]]
            : [];

    const baseDomain = [
        ...drillDomain,
        ...(kabupatenId ? [['kabupaten_id', '=', kabupatenId]] : []),
        ...(stateValue  ? [['state',        '=', stateValue]]  : []),
        ...(kategoriId  ? [['kategori_id',  '=', kategoriId]]  : []),
    ];

    try {
        const [kabGroups, katGroups, allKabupaten] = await Promise.all([
            ctx.orm.call('petapantau.lokasi_penting', 'read_group',
                [baseDomain, ['kabupaten_id'], ['kabupaten_id']], { lazy: false }),
            ctx.orm.call('petapantau.lokasi_penting', 'read_group',
                [baseDomain, ['kategori_id'],  ['kategori_id']],  { lazy: false }),
            ctx.orm.searchRead('petapantau.kabupaten', [], ['id', 'name'], { order: 'name asc' }),
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
        _renderLokasiBarChart(ctx, kabList.map(k => k.name), kabList.map(k => k.val));

        // Donut — per kategori
        const donutData = katGroups
            .filter(g => g.kategori_id)
            .map(g => ({ name: g.kategori_id[1], value: g.__count || 0 }))
            .sort((a, b) => b.value - a.value);

        const titleEl = ctx.chartLokasiDonutTitleRef?.el;
        if (titleEl) {
            const loc = ctx.drillKecamatanId
                ? 'Wilayah Kecamatan Terpilih'
                : ctx.drillKabupatenId || kabupatenId
                    ? 'Kabupaten Terpilih'
                    : 'Semua Wilayah';
            titleEl.innerHTML = `<i class="fa fa-pie-chart"></i> Lokasi Penting Berdasarkan Kategori (${loc})`;
        }
        _renderLokasiDonutChart(ctx, donutData);

    } catch (e) {
        console.error('Gagal memuat grafik lokasi penting:', e);
    }
}

// ─── Data Table ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export async function updateLokasiTable(ctx, mode, page) {
    const ver    = ctx._modeVersion;
    const rowEl  = ctx.tableLokasiRowRef?.el;
    const bodyEl = ctx.tableLokasiBodyRef?.el;
    if (!rowEl || !bodyEl) return;

    if (mode !== 'lokasi') { if (ctx.currentMode !== 'lokasi') rowEl.style.display = 'none'; return; }
    rowEl.style.display = 'flex';

    ctx._lokasiTablePage = (page !== undefined) ? page : 1;
    const offset = (ctx._lokasiTablePage - 1) * PAGE_SIZE;

    // lokasi_penting tidak punya sumber_dokumen_id / tanggal_kejadian
    const kategoriId  = parseInt(ctx.filterKategori?.el?.value)  || null;
    const kabupatenId = parseInt(ctx.filterKabupaten?.el?.value) || null;
    const stateValue  = ctx.filterState?.el?.value        || '';

    const drillDomain = ctx.drillKecamatanId
        ? [['kecamatan_id', '=', ctx.drillKecamatanId]]
        : ctx.drillKabupatenId ? [['kabupaten_id', '=', ctx.drillKabupatenId]] : [];

    const domain = [
        ...drillDomain,
        ...(kabupatenId ? [['kabupaten_id', '=', kabupatenId]] : []),
        ...(stateValue  ? [['state',        '=', stateValue]]  : []),
        ...(kategoriId  ? [['kategori_id',  '=', kategoriId]]  : []),
    ];

    bodyEl.innerHTML = `<div style="text-align:center;padding:24px;color:#bbb;font-size:13px;">Memuat data...</div>`;

    try {
        const [records, total] = await Promise.all([
            ctx.orm.searchRead('petapantau.lokasi_penting', domain,
                ['id', 'code', 'nama_lokasi', 'alamat_lengkap',
                 'kabupaten_id', 'kecamatan_id', 'kategori_id', 'state'],
                { order: 'nama_lokasi asc', limit: PAGE_SIZE, offset }),
            ctx.orm.searchCount('petapantau.lokasi_penting', domain),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const curPage    = ctx._lokasiTablePage;
        const fromRow    = total > 0 ? offset + 1 : 0;
        const toRow      = Math.min(offset + PAGE_SIZE, total);

        const rows = records.map((r, i) => {
            const kab    = Array.isArray(r.kabupaten_id) ? r.kabupaten_id[1] : '-';
            const kec    = Array.isArray(r.kecamatan_id) ? r.kecamatan_id[1] : '-';
            const kat    = Array.isArray(r.kategori_id)  ? r.kategori_id[1]  : '-';
            const alamat = r.alamat_lengkap
                ? (r.alamat_lengkap.length > 50 ? r.alamat_lengkap.slice(0, 50) + '…' : r.alamat_lengkap)
                : '-';
            const cls = r.state === 'AKTIF' ? '--green' : '--gray';
            return `
                <tr class="petapantau-table-row" data-id="${r.id}" style="cursor:pointer;">
                    <td class="petapantau-td">${offset + i + 1}</td>
                    <td class="petapantau-td petapantau-td--mono">${r.code || '-'}</td>
                    <td class="petapantau-td">${r.nama_lokasi || '-'}</td>
                    <td class="petapantau-td petapantau-td--wrap" title="${(r.alamat_lengkap || '').replace(/"/g, '&quot;')}">${alamat}</td>
                    <td class="petapantau-td">${kab}</td>
                    <td class="petapantau-td">${kec}</td>
                    <td class="petapantau-td">${kat}</td>
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
                        <th class="petapantau-th">Alamat</th>
                        <th class="petapantau-th">Kabupaten</th>
                        <th class="petapantau-th">Kecamatan</th>
                        <th class="petapantau-th">Kategori</th>
                        <th class="petapantau-th">Status</th>
                    </tr></thead>
                    <tbody>
                        ${rows || `<tr><td colspan="8" style="text-align:center;padding:24px;color:#bbb;font-size:13px;">Tidak ada data</td></tr>`}
                    </tbody>
                </table>
            </div>`;

        bodyEl.querySelectorAll('.petapantau-table-row').forEach(tr => {
            tr.addEventListener('click', () => {
                const id = parseInt(tr.dataset.id);
                if (!id) return;
                ctx.action.doAction({ type: 'ir.actions.act_window', res_model: 'petapantau.lokasi_penting',
                    res_id: id, views: [[false, 'form']], target: 'current' });
            });
        });
        bodyEl.querySelector('[data-action="prev"]')?.addEventListener('click', () => updateLokasiTable(ctx, mode, curPage - 1));
        bodyEl.querySelector('[data-action="next"]')?.addEventListener('click', () => updateLokasiTable(ctx, mode, curPage + 1));

    } catch (e) {
        console.error('Lokasi table load error:', e);
        bodyEl.innerHTML = `<div style="text-align:center;padding:24px;color:#B07F10;font-size:13px;">Gagal memuat data</div>`;
    }
}
