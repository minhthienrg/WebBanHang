// Tổng quan CSKH: việc cần làm (yêu cầu chờ, đơn chờ xác nhận quá lâu, đơn giao thất bại, đánh giá
// chờ duyệt, bảo hành đang xử lý) và mức hài lòng (Bảng 1.2: "Cảnh báo đơn cần xử lý").
import {
  loadAll, load, me, esc, money, num, statusBadge, shortId, fmtDateTime, toMs
} from './core.js';
import { TICKET_CATEGORIES, WARRANTY_STATUS } from '../../js/categories.js';

const DAY = 86400000;

export async function render(box, params) {
  if (params.reload) await Promise.all(['reviews', 'warranties'].map((n) => load(n, true)));
  const [orders, tickets, reviews, warranties] = await loadAll('orders', 'tickets', 'reviews', 'warranties');
  const now = Date.now();
  const mine = (t) => t.dept === 'cskh' || (t.dept === 'admin' && me.role === 'admin');
  const open = tickets.filter((t) => t.status === 'open' && mine(t));
  const unassigned = open.filter((t) => !t.assignee);
  const staleTickets = open.filter((t) => now - toMs(t.lastMessageAt) > DAY);
  const myTickets = tickets.filter((t) => t.assignee === me.uid && t.status !== 'closed');
  const stalePending = orders.filter((o) => o.status === 'pending' && now - toMs(o.createdAt) > DAY);
  const pending = orders.filter((o) => o.status === 'pending');
  const failed = orders.filter((o) => o.status === 'failed');
  const pendingReviews = reviews.filter((r) => r.status === 'pending');
  const activeWarranties = warranties.filter((w) => !['done', 'rejected'].includes(w.status));
  const rated = tickets.filter((t) => t.rating && now - toMs(t.ratedAt) < 30 * DAY);
  const csat = rated.length ? rated.reduce((s, t) => s + t.rating, 0) / rated.length : 0;
  const myRated = rated.filter((t) => t.assignee === me.uid);

  const urgent = [
    ...failed.map((o) => ({ at: toMs(o.updatedAt), html: `<a href="#/don-hang/${esc(o.id)}">Đơn #${esc(shortId(o.id))}</a> giao thất bại — liên hệ lại ${esc(o.shipping?.name || '')} (${esc(o.shipping?.phone || '')})`, tag: statusBadge('failed') })),
    ...stalePending.map((o) => ({ at: toMs(o.createdAt), html: `<a href="#/don-hang/${esc(o.id)}">Đơn #${esc(shortId(o.id))}</a> chờ xác nhận từ ${esc(fmtDateTime(o.createdAt))} · ${money(o.total)}`, tag: '<span class="status s-pending">Quá 24 giờ</span>' })),
    ...staleTickets.map((t) => ({ at: toMs(t.lastMessageAt), html: `<a href="#/ho-tro/${esc(t.id)}">${esc(t.subject)}</a> — ${esc(t.userName || t.userEmail)} chờ phản hồi từ ${esc(fmtDateTime(t.lastMessageAt))}`, tag: '<span class="status s-pending">Yêu cầu chờ lâu</span>' }))
  ].sort((a, b) => a.at - b.at);

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Chăm sóc khách hàng</p><h1>Tổng quan CSKH</h1></div>
      <a class="btn small" href="#/cskh?reload=${now}">Tải lại</a>
    </div>
    <div class="kpis">
      ${kpi('Yêu cầu chờ xử lý', num.format(open.length), `${unassigned.length} chưa ai nhận`, '#/ho-tro')}
      ${kpi('Phiếu của tôi', num.format(myTickets.length), 'Đang mở, do bạn phụ trách', '#/ho-tro?loc=cua-toi')}
      ${kpi('Đơn chờ xác nhận', num.format(pending.length), stalePending.length ? `<span class="warn-text">${stalePending.length} đơn quá 24 giờ</span>` : 'Cần gọi xác nhận', '#/don-hang?tt=pending')}
      ${kpi('Giao thất bại', num.format(failed.length), 'Cần liên hệ lại khách', '#/don-hang?tt=failed')}
      ${kpi('Đánh giá chờ duyệt', num.format(pendingReviews.length), 'Trên trang sản phẩm', '#/danh-gia')}
      ${kpi('Bảo hành đang xử lý', num.format(activeWarranties.length), `${warranties.filter((w) => w.status === 'returned').length} chờ khách nhận lại`, '#/bao-hanh')}
      ${kpi('Mức hài lòng (30 ngày)', rated.length ? `${csat.toFixed(1).replace('.', ',')} / 5` : '—', `${rated.length} lượt đánh giá${myRated.length ? ` · của bạn ${(myRated.reduce((s, t) => s + t.rating, 0) / myRated.length).toFixed(1).replace('.', ',')}` : ''}`)}
    </div>

    <section class="card block-gap">
      <div class="sec-head"><h2>Cần xử lý ngay (${urgent.length})</h2></div>
      ${urgent.length ? `<ul class="todo">${urgent.map((u) => `<li>${u.tag} <span>${u.html}</span></li>`).join('')}</ul>`
        : '<p class="hint">Không có việc tồn đọng. 👍</p>'}
    </section>

    <div class="two-col">
      <section class="card">
        <div class="sec-head"><h2>Yêu cầu mới nhất chưa ai nhận</h2><a class="link" href="#/ho-tro">Tất cả yêu cầu</a></div>
        ${unassigned.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Yêu cầu</th><th>Khách</th><th>Gửi lúc</th></tr></thead>
          <tbody>${unassigned.sort((a, b) => toMs(a.lastMessageAt) - toMs(b.lastMessageAt)).slice(0, 8).map((t) => `<tr>
            <td><a href="#/ho-tro/${esc(t.id)}">${esc(t.subject)}</a><div class="sub">${esc(TICKET_CATEGORIES[t.category] || t.category)}</div></td>
            <td>${esc(t.userName || '')}<div class="sub">${esc(t.userEmail || '')}</div></td>
            <td class="nowrap">${esc(fmtDateTime(t.lastMessageAt))}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="hint">Mọi yêu cầu đều đã có người nhận.</p>'}
      </section>
      <section class="card">
        <div class="sec-head"><h2>Bảo hành đang xử lý</h2><a class="link" href="#/bao-hanh">Tất cả phiếu</a></div>
        ${activeWarranties.length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Sản phẩm</th><th>Khách</th><th>Trạng thái</th></tr></thead>
          <tbody>${activeWarranties.sort((a, b) => toMs(a.updatedAt) - toMs(b.updatedAt)).slice(0, 8).map((w) => `<tr>
            <td><a href="#/bao-hanh/${esc(w.id)}">${esc(w.productName)}</a><div class="sub">${w.serial ? `SN ${esc(w.serial)}` : ''}</div></td>
            <td>${esc(w.customerName || '')}<div class="sub">${esc(w.phone || '')}</div></td>
            <td><span class="status wr-${esc(w.status)}">${esc(WARRANTY_STATUS[w.status])}</span></td></tr>`).join('')}</tbody></table></div>`
          : '<p class="hint">Không có phiếu bảo hành đang xử lý.</p>'}
      </section>
    </div>`;
}

function kpi(label, value, sub, href) {
  const inner = `<p class="kpi-label">${esc(label)}</p><p class="kpi-value">${value}</p><p class="kpi-sub">${sub}</p>`;
  return href ? `<a class="kpi card" href="${href}">${inner}</a>` : `<div class="kpi card">${inner}</div>`;
}
