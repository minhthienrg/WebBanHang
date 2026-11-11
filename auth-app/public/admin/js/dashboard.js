// Dashboard: chỉ số chính, doanh thu 30 ngày, đơn cần xử lý, sản phẩm sắp hết hàng.
import {
  loadAll, load, esc, money, num, statusBadge, shortId, fmtDateTime, toMs, isLow, minStock,
  barChart, dayKey, monthKey, revenueTime, DEDUCTED
} from './core.js';

const DAY = 86400000;
const PENDING_TOO_LONG = DAY;   // đơn chờ xác nhận quá 24 giờ thì cảnh báo

export async function render(box, params) {
  if (params.reload) {
    await Promise.all(['orders', 'products', 'users'].map((n) => load(n, true)));
  }
  const [orders, products, users] = await loadAll('orders', 'products', 'users');
  const now = Date.now();
  const today = dayKey(now), month = monthKey(now);
  const done = orders.filter((o) => o.status === 'done');
  const revToday = done.filter((o) => dayKey(revenueTime(o)) === today).reduce((s, o) => s + o.total, 0);
  const revMonth = done.filter((o) => monthKey(revenueTime(o)) === month).reduce((s, o) => s + o.total, 0);
  const inProgress = orders.filter((o) => DEDUCTED.has(o.status) && o.status !== 'done');
  const pending = orders.filter((o) => o.status === 'pending');
  const stale = pending.filter((o) => now - toMs(o.createdAt) > PENDING_TOO_LONG);
  const low = products.filter(isLow).sort((a, b) => a.stock - b.stock);
  const newUsers = users.filter((u) => monthKey(toMs(u.createdAt)) === month).length;

  // Doanh thu 30 ngày gần nhất (đơn hoàn tất)
  const byDay = new Map();
  for (const o of done) {
    const k = dayKey(revenueTime(o));
    byDay.set(k, (byDay.get(k) || 0) + o.total);
  }
  const rows = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const k = dayKey(d.getTime());
    rows.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, tip: d.toLocaleDateString('vi-VN'), value: byDay.get(k) || 0 });
  }

  const recent = [...orders].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)).slice(0, 8);

  box.innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">Tổng quan</p>
        <h1>Dashboard</h1>
      </div>
      <a class="btn small" href="#/?reload=${now}">Tải lại số liệu</a>
    </div>

    <div class="kpis">
      ${kpi('Doanh thu hôm nay', money(revToday), 'Đơn hoàn tất trong ngày')}
      ${kpi('Doanh thu tháng này', money(revMonth), `${num.format(done.filter((o) => monthKey(revenueTime(o)) === month).length)} đơn hoàn tất`)}
      ${kpi('Chờ xác nhận', num.format(pending.length), stale.length ? `<span class="warn-text">${stale.length} đơn chờ quá 24 giờ</span>` : 'Đơn mới cần xác nhận', '#/don-hang?tt=pending')}
      ${kpi('Đang xử lý', num.format(inProgress.length), money(inProgress.reduce((s, o) => s + o.total, 0)), '#/don-hang?tt=dang-xu-ly')}
      ${kpi('Sắp hết hàng', num.format(low.length), 'Tồn kho ≤ mức tối thiểu', '#/kho')}
      ${kpi('Khách hàng', num.format(users.length), `${num.format(newUsers)} khách mới tháng này`, '#/khach-hang')}
    </div>

    <section class="card block-gap">
      <div class="sec-head">
        <h2>Doanh thu 30 ngày gần nhất</h2>
        <a href="#/bao-cao" class="link">Xem báo cáo chi tiết</a>
      </div>
      <p class="hint">Tính theo đơn ở trạng thái “Hoàn tất”, theo ngày hoàn tất.</p>
      ${barChart(rows, { title: 'Doanh thu 30 ngày gần nhất', tickEvery: 5 })}
    </section>

    <div class="two-col">
      <section class="card">
        <div class="sec-head"><h2>Đơn hàng mới nhất</h2><a href="#/don-hang" class="link">Tất cả đơn</a></div>
        ${recent.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Mã</th><th>Khách</th><th class="r">Tổng</th><th>Trạng thái</th></tr></thead>
          <tbody>${recent.map((o) => `
            <tr>
              <td><a href="#/don-hang/${esc(o.id)}">#${esc(shortId(o.id))}</a><div class="sub">${esc(fmtDateTime(o.createdAt))}</div></td>
              <td>${esc(o.shipping?.name || '')}<div class="sub">${esc(o.shipping?.phone || '')}</div></td>
              <td class="r">${money(o.total)}</td>
              <td>${statusBadge(o.status)}</td>
            </tr>`).join('')}</tbody></table></div>` : '<p class="hint">Chưa có đơn hàng.</p>'}
      </section>

      <section class="card">
        <div class="sec-head"><h2>Sắp hết hàng</h2><a href="#/kho" class="link">Nhập kho</a></div>
        ${low.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Sản phẩm</th><th class="r">Tồn</th><th class="r">Tối thiểu</th></tr></thead>
          <tbody>${low.slice(0, 10).map((p) => `
            <tr>
              <td><a href="#/kho?sp=${encodeURIComponent(p.id)}">${esc(p.name)}</a></td>
              <td class="r ${p.stock === 0 ? 'neg' : 'warn-text'}">${num.format(p.stock)}</td>
              <td class="r">${num.format(minStock(p))}</td>
            </tr>`).join('')}</tbody></table></div>
          ${low.length > 10 ? `<p class="hint">và ${low.length - 10} sản phẩm khác.</p>` : ''}` : '<p class="hint">Không có sản phẩm nào dưới mức tồn tối thiểu.</p>'}
      </section>
    </div>`;
}

function kpi(label, value, sub, href) {
  const inner = `<p class="kpi-label">${esc(label)}</p><p class="kpi-value">${value}</p><p class="kpi-sub">${sub}</p>`;
  return href ? `<a class="kpi card" href="${href}">${inner}</a>` : `<div class="kpi card">${inner}</div>`;
}
