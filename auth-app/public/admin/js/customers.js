// Quản lý khách hàng: danh sách, tìm kiếm, lịch sử mua hàng, khóa / mở khóa (xử lý vi phạm),
// gửi email đặt lại mật khẩu.
//
// Khóa tài khoản = tài liệu bans/{uid}: Security Rules chặn đặt hàng và sửa giỏ hàng. Muốn chặn hẳn
// việc đăng nhập phải "Disable account" trong Firebase Console → Authentication (cần Admin SDK).
import {
  doc, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  auth, db, me, load, loadAll, patchCache, audit, esc, money, num, fold, toast, errMsg, busy,
  openDialog, ask, pager, hrefWith, fmtDate, fmtDateTime, toMs, statusBadge, shortId, downloadCsv
} from './core.js';

const PAGE = 30;

export async function render(box, params) {
  if (params.reload) await Promise.all(['users', 'orders', 'bans', 'admins'].map((n) => load(n, true)));
  const [users, orders, bans, admins] = await loadAll('users', 'orders', 'bans', 'admins');
  const banOf = new Map(bans.map((b) => [b.id, b]));
  const adminSet = new Set(admins.map((a) => a.id));
  const stats = new Map();
  for (const o of orders) {
    const s = stats.get(o.userId) || { n: 0, spent: 0, last: 0 };
    s.n++;
    if (o.status === 'done') s.spent += o.total;
    s.last = Math.max(s.last, toMs(o.createdAt));
    stats.set(o.userId, s);
  }
  const words = fold(params.q || '').split(/\s+/).filter(Boolean);
  const list = users.filter((u) => {
    if (params.tt === 'khoa' && !banOf.has(u.id)) return false;
    if (params.tt === 'admin' && !adminSet.has(u.id)) return false;
    if (!words.length) return true;
    const h = fold([u.name, u.email, u.phone, u.address, u.id].join(' '));
    return words.every((w) => h.includes(w));
  }).sort(params.sx === 'chi-tieu'
    ? (a, b) => (stats.get(b.id)?.spent || 0) - (stats.get(a.id)?.spent || 0)
    : (a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const page = Math.max(1, Math.min(Number(params.trang) || 1, Math.ceil(list.length / PAGE) || 1));
  const rows = list.slice((page - 1) * PAGE, page * PAGE);

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Sales</p><h1>Khách hàng</h1></div>
      <div class="head-actions">
        <button type="button" class="btn small" id="btn-csv">Tải CSV</button>
        <a class="btn small" href="${hrefWith('khach-hang', params, { reload: Date.now() })}">Tải lại</a>
      </div>
    </div>
    <div class="chips">
      <a class="chip ${!params.tt ? 'on' : ''}" href="${hrefWith('khach-hang', params, { tt: '' })}">Tất cả <small>${users.length}</small></a>
      <a class="chip ${params.tt === 'khoa' ? 'on' : ''}" href="${hrefWith('khach-hang', params, { tt: 'khoa' })}">Đã khóa <small>${bans.length}</small></a>
      <a class="chip ${params.tt === 'admin' ? 'on' : ''}" href="${hrefWith('khach-hang', params, { tt: 'admin' })}">Quản trị viên <small>${admins.length}</small></a>
    </div>
    <form class="toolbar-row" id="cf">
      <label class="grow"><span class="sr-only">Tìm khách hàng</span>
        <input name="q" type="search" placeholder="Tên, email, số điện thoại…" value="${esc(params.q || '')}"></label>
      <label class="inline">Sắp xếp
        <select name="sx"><option value="">Mới đăng ký</option><option value="chi-tieu" ${params.sx === 'chi-tieu' ? 'selected' : ''}>Chi tiêu nhiều</option></select></label>
      <button class="btn small" type="submit">Tìm</button>
    </form>
    <p class="hint" role="status">${num.format(list.length)} tài khoản</p>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Khách hàng</th><th>Điện thoại</th><th>Ngày đăng ký</th><th class="r">Số đơn</th><th class="r">Đã chi (đơn hoàn tất)</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${rows.map((u) => {
        const s = stats.get(u.id) || { n: 0, spent: 0 };
        const b = banOf.get(u.id);
        return `<tr>
          <td><button type="button" class="link name" data-open="${esc(u.id)}">${esc(u.name || '(chưa đặt tên)')}</button>
            ${adminSet.has(u.id) ? ' <span class="status s-confirmed">Admin</span>' : ''}<div class="sub">${esc(u.email)}</div></td>
          <td>${esc(u.phone || '—')}</td>
          <td>${esc(fmtDate(u.createdAt))}</td>
          <td class="r">${num.format(s.n)}</td>
          <td class="r">${money(s.spent)}</td>
          <td>${b ? `<span class="status s-cancelled" title="${esc(b.reason || '')}">Đã khóa</span>` : '<span class="status s-done">Hoạt động</span>'}</td>
          <td class="acts">
            ${b ? `<button type="button" class="btn small" data-unban="${esc(u.id)}">Mở khóa</button>`
              : adminSet.has(u.id) ? '' : `<button type="button" class="btn small danger" data-ban="${esc(u.id)}">Khóa</button>`}
            <button type="button" class="btn small" data-open="${esc(u.id)}">Xem</button>
          </td></tr>`;
      }).join('')}</tbody>
    </table></div>` : '<div class="empty">Không có khách hàng phù hợp.</div>'}
    ${pager(list.length, page, PAGE, (i) => hrefWith('khach-hang', params, { trang: i }))}`;

  const f = box.querySelector('#cf');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    location.hash = hrefWith('khach-hang', params, { q: f.q.value.trim(), sx: f.sx.value, reload: '' });
  });
  f.sx.addEventListener('change', () => f.requestSubmit());

  box.onclick = (ev) => {
    const op = ev.target.closest('[data-open]');
    if (op) return openCustomer(op.dataset.open, params);
    const bn = ev.target.closest('[data-ban]');
    if (bn) return banUser(bn.dataset.ban, params);
    const ub = ev.target.closest('[data-unban]');
    if (ub) return busy(ub, () => unbanUser(ub.dataset.unban, params));
    if (ev.target.closest('#btn-csv')) {
      downloadCsv('khach-hang.csv', [
        ['UID', 'Họ tên', 'Email', 'Điện thoại', 'Địa chỉ', 'Ngày đăng ký', 'Số đơn', 'Đã chi', 'Trạng thái'],
        ...list.map((u) => [u.id, u.name, u.email, u.phone, u.address, fmtDate(u.createdAt),
          stats.get(u.id)?.n || 0, stats.get(u.id)?.spent || 0, banOf.has(u.id) ? 'Đã khóa' : 'Hoạt động'])
      ]);
    }
  };
}

const rerender = (params) => render(document.querySelector('#view'), { ...params, reload: '' });

async function openCustomer(uid, params) {
  const [users, orders, bans] = await loadAll('users', 'orders', 'bans');
  const u = users.find((x) => x.id === uid);
  if (!u) return;
  const b = bans.find((x) => x.id === uid);
  const mine = orders.filter((o) => o.userId === uid).sort((a, b2) => toMs(b2.createdAt) - toMs(a.createdAt));
  const spent = mine.filter((o) => o.status === 'done').reduce((s, o) => s + o.total, 0);
  const body = openDialog(u.name || u.email, `
    <div class="grid2">
      <div>
        <h3>Hồ sơ</h3>
        <p>${esc(u.email)}<br>${esc(u.phone || 'Chưa có SĐT')}<br>${esc(u.address || 'Chưa có địa chỉ')}</p>
        <p class="sub">Đăng ký: ${esc(fmtDateTime(u.createdAt))} · cập nhật: ${esc(fmtDateTime(u.updatedAt))}<br>UID: <code>${esc(u.id)}</code></p>
      </div>
      <div>
        <h3>Mua hàng</h3>
        <p>${num.format(mine.length)} đơn · đã chi ${money(spent)} (đơn hoàn tất)</p>
        ${b ? `<p class="msg err">Đã khóa ${esc(fmtDateTime(b.at))}${b.reason ? `: ${esc(b.reason)}` : ''}</p>` : ''}
        <div class="head-actions">
          <button type="button" class="btn small" id="btn-reset">Gửi email đặt lại mật khẩu</button>
          ${b ? `<button type="button" class="btn small" id="btn-unban">Mở khóa</button>`
            : `<button type="button" class="btn small danger" id="btn-ban">Khóa tài khoản</button>`}
        </div>
      </div>
    </div>
    <h3>Lịch sử đơn hàng</h3>
    ${mine.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Mã</th><th>Ngày</th><th>Sản phẩm</th><th class="r">Tổng</th><th>Trạng thái</th></tr></thead>
      <tbody>${mine.map((o) => `<tr>
        <td><a href="#/don-hang/${esc(o.id)}">#${esc(shortId(o.id))}</a></td>
        <td>${esc(fmtDateTime(o.createdAt))}</td>
        <td class="sub">${esc(o.items.map((i) => `${i.name} ×${i.qty}`).join('; '))}</td>
        <td class="r">${money(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="hint">Chưa có đơn hàng.</p>'}`, { wide: true });

  body.querySelector('#btn-reset').addEventListener('click', (ev) => busy(ev.currentTarget, async () => {
    try {
      await sendPasswordResetEmail(auth, u.email);
      const batch = writeBatch(db);
      audit(batch, 'customer.reset', uid, u.email);
      await batch.commit();
      toast(`Đã gửi email đặt lại mật khẩu tới ${u.email}.`);
    } catch (e) { toast(errMsg(e), 'err'); }
  }));
  body.querySelector('#btn-ban')?.addEventListener('click', () => banUser(uid, params));
  body.querySelector('#btn-unban')?.addEventListener('click', (ev) => busy(ev.currentTarget, () => unbanUser(uid, params)));
}

async function banUser(uid, params) {
  const users = await load('users');
  const u = users.find((x) => x.id === uid);
  const reason = await ask('Khóa tài khoản', `Khóa ${u?.email}? Khách vẫn đăng nhập và xem đơn cũ được, nhưng không thêm giỏ và đặt hàng mới được.`,
    { input: true, placeholder: 'vd: đặt đơn ảo nhiều lần, bom hàng…', okText: 'Khóa', danger: true });
  if (reason === null) return;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'bans', uid), { reason, by: me.uid, at: serverTimestamp() });
    audit(batch, 'customer.ban', uid, `${u?.email}${reason ? `: ${reason}` : ''}`);
    await batch.commit();
    patchCache('bans', uid, { reason, by: me.uid, at: Timestamp.now() });
    toast(`Đã khóa ${u?.email}.`);
    await rerender(params);
  } catch (e) { toast(errMsg(e), 'err'); }
}

async function unbanUser(uid, params) {
  const users = await load('users');
  const u = users.find((x) => x.id === uid);
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'bans', uid));
    audit(batch, 'customer.unban', uid, u?.email || uid);
    await batch.commit();
    patchCache('bans', uid, null);
    toast(`Đã mở khóa ${u?.email}.`);
    await rerender(params);
  } catch (e) { toast(errMsg(e), 'err'); }
}
