// Báo cáo doanh thu theo ngày (trong 1 tháng) và theo tháng (trong 1 năm), sản phẩm bán chạy, theo danh mục.
import {
  loadAll, esc, money, num, barChart, revenueTime, orderDiscount, hrefWith, downloadCsv, STATUS, STATUS_ORDER, toMs
} from './core.js';
import { CATEGORIES, catName } from '../../js/categories.js';

export async function render(box, params) {
  const [orders, products] = await loadAll('orders', 'products');
  const now = new Date();
  const mode = params.kieu === 'nam' ? 'nam' : 'thang';
  const year = Number(params.nam) || now.getFullYear();
  const month = Number(params.thang) || now.getMonth() + 1;   // 1–12

  const inPeriod = (ms) => {
    const d = new Date(ms);
    return d.getFullYear() === year && (mode === 'nam' || d.getMonth() + 1 === month);
  };
  const done = orders.filter((o) => o.status === 'done' && inPeriod(revenueTime(o)));
  const placed = orders.filter((o) => inPeriod(toMs(o.createdAt)));

  // Cột theo ngày hoặc theo tháng
  let rows;
  if (mode === 'nam') {
    rows = Array.from({ length: 12 }, (_, i) => ({ label: `T${i + 1}`, tip: `Tháng ${i + 1}/${year}`, value: 0, n: 0 }));
    for (const o of done) { const r = rows[new Date(revenueTime(o)).getMonth()]; r.value += o.total; r.n++; }
  } else {
    const days = new Date(year, month, 0).getDate();
    rows = Array.from({ length: days }, (_, i) => ({ label: String(i + 1), tip: `${i + 1}/${month}/${year}`, value: 0, n: 0 }));
    for (const o of done) { const r = rows[new Date(revenueTime(o)).getDate() - 1]; r.value += o.total; r.n++; }
  }

  const revenue = done.reduce((s, o) => s + o.total, 0);
  const goods = done.reduce((s, o) => s + o.subtotal, 0);
  const discount = done.reduce((s, o) => s + orderDiscount(o), 0);
  const ship = done.reduce((s, o) => s + (o.shippingFee || 0), 0);
  const avg = done.length ? Math.round(revenue / done.length) : 0;

  // Sản phẩm bán chạy & doanh thu theo danh mục (tiền hàng, trước giảm giá)
  const pIndex = new Map(products.map((p) => [p.id, p]));
  const top = new Map();
  const byCat = new Map();
  for (const o of done) {
    for (const it of o.items) {
      const t = top.get(it.productId) || { name: it.name, qty: 0, value: 0 };
      t.qty += it.qty; t.value += it.price * it.qty;
      top.set(it.productId, t);
      const cat = pIndex.get(it.productId)?.category || 'khac';
      byCat.set(cat, (byCat.get(cat) || 0) + it.price * it.qty);
    }
  }
  const topList = [...top.entries()].sort((a, b) => b[1].qty - a[1].qty || b[1].value - a[1].value).slice(0, 10);
  const catRows = [...CATEGORIES.map((c) => c.key), 'khac']
    .filter((k) => byCat.get(k))
    .map((k) => ({ label: k === 'khac' ? 'Khác' : catName(k), value: byCat.get(k) }))
    .sort((a, b) => b.value - a.value);
  const catMax = Math.max(1, ...catRows.map((r) => r.value));

  const statusCount = STATUS_ORDER.map((s) => [s, placed.filter((o) => o.status === s).length]);
  const periodText = mode === 'nam' ? `năm ${year}` : `tháng ${month}/${year}`;
  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) years.push(y);

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Tổng quan</p><h1>Báo cáo doanh thu</h1></div>
      <button type="button" class="btn small" id="btn-csv">Tải CSV</button>
    </div>

    <form class="toolbar-row" id="rp-form">
      <div class="seg" role="group" aria-label="Kiểu báo cáo">
        <a href="${hrefWith('bao-cao', params, { kieu: '' })}" class="${mode === 'thang' ? 'on' : ''}">Theo ngày</a>
        <a href="${hrefWith('bao-cao', params, { kieu: 'nam' })}" class="${mode === 'nam' ? 'on' : ''}">Theo tháng</a>
      </div>
      ${mode === 'thang' ? `<label class="inline">Tháng
        <select name="thang">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
      </label>` : ''}
      <label class="inline">Năm
        <select name="nam">${years.map((y) => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select>
      </label>
    </form>

    <div class="kpis">
      <div class="kpi card"><p class="kpi-label">Doanh thu ${esc(periodText)}</p><p class="kpi-value">${money(revenue)}</p><p class="kpi-sub">${num.format(done.length)} đơn hoàn tất</p></div>
      <div class="kpi card"><p class="kpi-label">Giá trị trung bình / đơn</p><p class="kpi-value">${money(avg)}</p><p class="kpi-sub">&nbsp;</p></div>
      <div class="kpi card"><p class="kpi-label">Tiền hàng</p><p class="kpi-value">${money(goods)}</p><p class="kpi-sub">+ phí giao ${money(ship)} − giảm giá ${money(discount)}</p></div>
      <div class="kpi card"><p class="kpi-label">Đơn đặt trong kỳ</p><p class="kpi-value">${num.format(placed.length)}</p>
        <p class="kpi-sub">${num.format(placed.filter((o) => o.status === 'cancelled').length)} đơn đã hủy</p></div>
    </div>

    <section class="card block-gap">
      <h2>Doanh thu ${mode === 'nam' ? 'theo tháng' : 'theo ngày'} — ${esc(periodText)}</h2>
      <p class="hint">Đơn “Hoàn tất”, tính theo ngày hoàn tất.</p>
      ${barChart(rows, { title: `Doanh thu ${periodText}`, tickEvery: mode === 'nam' ? 1 : 3 })}
    </section>

    <div class="two-col">
      <section class="card">
        <h2>Sản phẩm bán chạy</h2>
        ${topList.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>#</th><th>Sản phẩm</th><th class="r">Số lượng</th><th class="r">Tiền hàng</th></tr></thead>
          <tbody>${topList.map(([id, t], i) => `<tr><td>${i + 1}</td>
            <td><a href="#/san-pham?q=${encodeURIComponent(id)}">${esc(t.name)}</a></td>
            <td class="r">${num.format(t.qty)}</td><td class="r">${money(t.value)}</td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="hint">Chưa có đơn hoàn tất trong kỳ.</p>'}
      </section>
      <section class="card">
        <h2>Tiền hàng theo danh mục</h2>
        ${catRows.length ? `<ul class="hbars">${catRows.map((r) => `
          <li><span class="hb-label">${esc(r.label)}</span>
            <span class="hb-track"><span class="hb-fill" style="width:${(r.value / catMax) * 100}%"></span></span>
            <span class="hb-val">${money(r.value)}</span></li>`).join('')}</ul>` : '<p class="hint">Chưa có dữ liệu.</p>'}
        <h2 class="mt2">Đơn đặt trong kỳ theo trạng thái</h2>
        <ul class="status-count">${statusCount.map(([s, n]) => `<li><span class="status s-${s}">${esc(STATUS[s])}</span> <strong>${num.format(n)}</strong></li>`).join('')}</ul>
      </section>
    </div>`;

  box.querySelector('#rp-form').addEventListener('change', (ev) => {
    const f = ev.currentTarget;
    location.hash = hrefWith('bao-cao', params, { nam: f.nam.value, thang: f.thang ? f.thang.value : params.thang });
  });
  box.querySelector('#btn-csv').addEventListener('click', () => {
    downloadCsv(`doanh-thu-${mode === 'nam' ? year : `${year}-${String(month).padStart(2, '0')}`}.csv`, [
      [mode === 'nam' ? 'Tháng' : 'Ngày', 'Số đơn hoàn tất', 'Doanh thu (đồng)'],
      ...rows.map((r) => [r.tip, r.n, r.value]),
      ['Tổng', done.length, revenue]
    ]);
  });
}
