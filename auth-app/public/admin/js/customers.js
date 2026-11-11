// Khách hàng & thành viên: danh sách, tìm kiếm, lịch sử mua hàng, hạng thành viên / điểm tích lũy,
// ghi chú nội bộ (chỉ nhân viên thấy), ghi chú cuộc gọi / email, gửi ưu đãi cá nhân hóa, gửi email đặt lại
// mật khẩu. Khóa / mở khóa (xử lý vi phạm) chỉ dành cho quản trị viên.
//
// Khóa tài khoản = tài liệu bans/{uid}: Security Rules chặn đặt hàng và sửa giỏ hàng. Muốn chặn hẳn
// việc đăng nhập phải "Disable account" trong Firebase Console → Authentication (cần Admin SDK).
import {
  doc, collection, query, where, getDocs, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  auth, db, me, load, loadAll, patchCache, audit, esc, money, num, fold, toast, errMsg, busy,
  openDialog, ask, pager, hrefWith, fmtDate, fmtDateTime, toMs, statusBadge, shortId, downloadCsv, isAdminRole
} from './core.js';
import { membership, TIERS, TICKET_CATEGORIES, WARRANTY_STATUS } from '../../js/categories.js';

const PAGE = 30;
const NOTE_TYPES = { note: 'Ghi chú nội bộ', call: 'Cuộc gọi', email: 'Email đã gửi', offer: 'Ưu đãi' };

export async function render(box, params) {
  if (params.reload) await Promise.all(['users', 'bans', 'admins', 'staff', 'members'].map((n) => load(n, true)));
  const [users, orders, bans, admins, staff, members] = await loadAll('users', 'orders', 'bans', 'admins', 'staff', 'members');
  const admin = isAdminRole();
  const banOf = new Map(bans.map((b) => [b.id, b]));
  const adminSet = new Set(admins.map((a) => a.id));
  const staffSet = new Set(staff.map((a) => a.id));
  const memberOf = new Map(members.map((m) => [m.id, m]));
  const byUser = new Map();
  for (const o of orders) { if (!byUser.has(o.userId)) byUser.set(o.userId, []); byUser.get(o.userId).push(o); }
  const info = (u) => {
    const own = byUser.get(u.id) || [];
    return { n: own.length, m: membership(own, memberOf.get(u.id)) };
  };
  const words = fold(params.q || '').split(/\s+/).filter(Boolean);
  const list = users.filter((u) => {
    if (params.tt === 'khoa' && !banOf.has(u.id)) return false;
    if (params.tt === 'nhan-vien' && !adminSet.has(u.id) && !staffSet.has(u.id)) return false;
    if (TIERS.some((t) => t.key === params.tt) && info(u).m.tier.key !== params.tt) return false;
    if (!words.length) return true;
    const h = fold([u.name, u.email, u.phone, u.address, u.id].join(' '));
    return words.every((w) => h.includes(w));
  }).sort(params.sx === 'chi-tieu'
    ? (a, b) => info(b).m.spent - info(a).m.spent
    : (a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const page = Math.max(1, Math.min(Number(params.trang) || 1, Math.ceil(list.length / PAGE) || 1));
  const rows = list.slice((page - 1) * PAGE, page * PAGE);
  const chip = (k, label, n) => `<a class="chip ${(params.tt || '') === k ? 'on' : ''}" href="${hrefWith('khach-hang', params, { tt: k })}">${label} <small>${n}</small></a>`;

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Sales</p><h1>Khách hàng &amp; thành viên</h1></div>
      <div class="head-actions">
        <button type="button" class="btn small" id="btn-csv">Tải CSV</button>
        <a class="btn small" href="${hrefWith('khach-hang', params, { reload: Date.now(), mo: '' })}">Tải lại</a>
      </div>
    </div>
    <div class="chips">
      ${chip('', 'Tất cả', users.length)}
      ${TIERS.map((t) => chip(t.key, t.name, users.filter((u) => info(u).m.tier.key === t.key).length)).join('')}
      ${chip('khoa', 'Đã khóa', bans.length)}
      ${chip('nhan-vien', 'Nhân viên', new Set([...adminSet, ...staffSet]).size)}
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
      <thead><tr><th>Khách hàng</th><th>Điện thoại</th><th>Hạng</th><th class="r">Điểm</th><th class="r">Số đơn</th><th class="r">Đã chi</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${rows.map((u) => {
        const { n, m } = info(u);
        const b = banOf.get(u.id);
        const role = adminSet.has(u.id) ? 'Admin' : staffSet.has(u.id) ? 'CSKH' : '';
        return `<tr>
          <td><button type="button" class="link name" data-open="${esc(u.id)}">${esc(u.name || '(chưa đặt tên)')}</button>
            ${role ? ` <span class="status s-confirmed">${role}</span>` : ''}<div class="sub">${esc(u.email)}</div></td>
          <td>${esc(u.phone || '—')}</td>
          <td><span class="tier tier-${esc(m.tier.key)}">${esc(m.tier.name)}</span></td>
          <td class="r">${num.format(m.points)}</td>
          <td class="r">${num.format(n)}</td>
          <td class="r">${money(m.spent)}</td>
          <td>${b ? `<span class="status s-cancelled" title="${esc(b.reason || '')}">Đã khóa</span>` : '<span class="status s-done">Hoạt động</span>'}</td>
          <td class="acts">
            ${admin ? (b ? `<button type="button" class="btn small" data-unban="${esc(u.id)}">Mở khóa</button>`
              : role ? '' : `<button type="button" class="btn small danger" data-ban="${esc(u.id)}">Khóa</button>`) : ''}
            <button type="button" class="btn small" data-open="${esc(u.id)}">Xem</button>
          </td></tr>`;
      }).join('')}</tbody>
    </table></div>` : '<div class="empty">Không có khách hàng phù hợp.</div>'}
    ${pager(list.length, page, PAGE, (i) => hrefWith('khach-hang', params, { trang: i }))}`;

  const f = box.querySelector('#cf');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    location.hash = hrefWith('khach-hang', params, { q: f.q.value.trim(), sx: f.sx.value, reload: '', mo: '' });
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
        ['UID', 'Họ tên', 'Email', 'Điện thoại', 'Địa chỉ', 'Ngày đăng ký', 'Hạng', 'Điểm', 'Số đơn', 'Đã chi', 'Trạng thái'],
        ...list.map((u) => { const { n, m } = info(u); return [u.id, u.name, u.email, u.phone, u.address, fmtDate(u.createdAt),
          m.tier.name, m.points, n, m.spent, banOf.has(u.id) ? 'Đã khóa' : 'Hoạt động']; })
      ]);
    }
  };
  if (params.mo && users.some((u) => u.id === params.mo)) openCustomer(params.mo, params);
}

const rerender = (params) => render(document.querySelector('#view'), { ...params, reload: '', mo: '' });

async function openCustomer(uid, params) {
  const [users, orders, bans, members, tickets, warranties] = await loadAll('users', 'orders', 'bans', 'members', 'tickets', 'warranties');
  const u = users.find((x) => x.id === uid);
  if (!u) return;
  const admin = isAdminRole();
  const b = bans.find((x) => x.id === uid);
  const member = members.find((x) => x.id === uid) || null;
  const mine = orders.filter((o) => o.userId === uid).sort((a, b2) => toMs(b2.createdAt) - toMs(a.createdAt));
  const m = membership(mine, member);
  const tks = tickets.filter((t) => t.userId === uid).sort((a, b2) => toMs(b2.lastMessageAt) - toMs(a.lastMessageAt));
  const wrs = warranties.filter((w) => w.userId === uid);
  const body = openDialog(u.name || u.email, `
    <div class="grid2">
      <div>
        <h3>Hồ sơ</h3>
        <p><a href="mailto:${esc(u.email)}">${esc(u.email)}</a><br>${u.phone ? `<a href="tel:${esc(u.phone)}">${esc(u.phone)}</a>` : 'Chưa có SĐT'}<br>${esc(u.address || 'Chưa có địa chỉ')}</p>
        <p class="sub">Đăng ký: ${esc(fmtDateTime(u.createdAt))} · UID: <code>${esc(u.id)}</code></p>
        ${b ? `<p class="msg err">Đã khóa ${esc(fmtDateTime(b.at))}${b.reason ? `: ${esc(b.reason)}` : ''}</p>` : ''}
        <div class="head-actions">
          <button type="button" class="btn small" id="btn-reset">Gửi email đặt lại mật khẩu</button>
          ${admin ? (b ? '<button type="button" class="btn small" id="btn-unban">Mở khóa</button>'
            : '<button type="button" class="btn small danger" id="btn-ban">Khóa tài khoản</button>') : ''}
        </div>
      </div>
      <div>
        <h3>Thành viên</h3>
        <p><span class="tier tier-${esc(m.tier.key)}">${esc(m.tier.name)}</span>${m.manual ? ' <span class="sub">(đặt tay)</span>' : ''}
          · <strong>${num.format(m.points)}</strong> điểm · đã chi ${money(m.spent)}</p>
        ${m.next && !m.manual ? `<p class="sub">Còn ${money(m.toNext)} để lên ${esc(m.next.name)}.</p>` : ''}
        ${member?.note ? `<p class="sub">Ghi chú hạng: ${esc(member.note)}</p>` : ''}
        <details class="ph"><summary>Điều chỉnh điểm / hạng</summary>
          <form class="form" id="mf">
            <div class="grid2">
              <label>Điểm cộng thêm <small>(âm để trừ)</small><input name="bonus" type="number" step="1" value="${member?.bonusPoints || 0}"></label>
              <label>Hạng <select name="tier"><option value="">Tự động theo chi tiêu (${esc(m.autoTier.name)})</option>
                ${TIERS.map((t) => `<option value="${t.key}" ${member?.tier === t.key ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
            </div>
            <label>Lý do <input name="note" maxlength="300" value="${esc(member?.note || '')}" placeholder="vd: Bù điểm do giao trễ"></label>
            <div class="dlg-actions"><button type="submit" class="btn small primary">Lưu</button></div>
          </form>
        </details>
        <details class="ph"><summary>Gửi ưu đãi riêng</summary>
          <form class="form" id="of">
            <p class="hint">${admin ? 'Quản trị viên: không giới hạn mức.' : 'Nhân viên: tối đa 15% (giảm tối đa 500.000₫) hoặc 300.000₫, hiệu lực tối đa 31 ngày.'}
              Khách thấy ưu đãi ở trang tài khoản; chỉ khách này dùng được.</p>
            <div class="grid3">
              <label>Loại <select name="type"><option value="percent">Giảm %</option><option value="fixed">Giảm tiền</option></select></label>
              <label>Giá trị <input name="value" type="number" min="1" step="1" required value="10"></label>
              <label>Giảm tối đa (₫) <input name="max" type="number" min="0" step="1000" value="200000"></label>
            </div>
            <div class="grid2">
              <label>Đơn tối thiểu (₫) <input name="min" type="number" min="0" step="1000" value="0"></label>
              <label>Hiệu lực (ngày) <input name="days" type="number" min="1" max="${admin ? 365 : 31}" step="1" value="14"></label>
            </div>
            <label>Lời nhắn / lý do <input name="note" maxlength="200" placeholder="vd: Xin lỗi vì giao hàng trễ"></label>
            <div class="dlg-actions"><button type="submit" class="btn small primary">Tạo ưu đãi</button></div>
          </form>
        </details>
      </div>
    </div>

    <h3>Ghi chú nội bộ, cuộc gọi, email <span class="sub">(chỉ nhân viên thấy)</span></h3>
    <form class="form" id="nf">
      <div class="note-row">
        <select name="type" aria-label="Loại ghi chú">${Object.entries(NOTE_TYPES).filter(([k]) => k !== 'offer').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <input name="text" maxlength="2000" required placeholder="vd: Khách gọi hỏi tiến độ bảo hành, đã hẹn gọi lại thứ 2" aria-label="Nội dung ghi chú">
        <button type="submit" class="btn small primary">Lưu</button>
      </div>
      <p class="hint" id="nf-mail" hidden>Chọn “Email đã gửi” sẽ mở ứng dụng email để soạn thư cho khách, đồng thời lưu nội dung vào hồ sơ.</p>
    </form>
    <ul class="timeline" id="notes"><li class="hint">Đang tải…</li></ul>

    <div class="grid2">
      <div><h3>Yêu cầu hỗ trợ (${tks.length})</h3>
        ${tks.length ? `<ul class="plain">${tks.slice(0, 8).map((t) => `<li><a href="#/ho-tro/${esc(t.id)}">${esc(t.subject)}</a>
          <span class="sub">· ${esc(TICKET_CATEGORIES[t.category] || '')} · ${esc(fmtDate(t.lastMessageAt))}${t.rating ? ` · ${'★'.repeat(t.rating)}` : ''}</span></li>`).join('')}</ul>` : '<p class="hint">Chưa có.</p>'}</div>
      <div><h3>Bảo hành (${wrs.length})</h3>
        ${wrs.length ? `<ul class="plain">${wrs.map((w) => `<li><a href="#/bao-hanh/${esc(w.id)}">${esc(w.productName)}</a>
          <span class="sub">· ${esc(WARRANTY_STATUS[w.status])}</span></li>`).join('')}</ul>` : '<p class="hint">Chưa có.</p>'}</div>
    </div>

    <h3>Lịch sử mua hàng (${mine.length})</h3>
    ${mine.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Mã</th><th>Ngày</th><th>Sản phẩm</th><th class="r">Tổng</th><th>Trạng thái</th></tr></thead>
      <tbody>${mine.map((o) => `<tr>
        <td><a href="#/don-hang/${esc(o.id)}">#${esc(shortId(o.id))}</a></td>
        <td>${esc(fmtDateTime(o.createdAt))}</td>
        <td class="sub">${esc(o.items.map((i) => `${i.name} ×${i.qty}`).join('; '))}</td>
        <td class="r">${money(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="hint">Chưa có đơn hàng.</p>'}`, { wide: true });

  // Ghi chú
  const notesBox = body.querySelector('#notes');
  const loadNotes = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'customerNotes'), where('userId', '==', uid)));
      const notes = snap.docs.map((d) => d.data()).sort((a, c) => toMs(c.at) - toMs(a.at));
      notesBox.innerHTML = notes.length ? notes.map((n) => `<li><span class="sub">${esc(fmtDateTime(n.at))} · ${esc(n.byEmail)} · ${esc(NOTE_TYPES[n.type] || n.type)}</span><br>${esc(n.text)}</li>`).join('')
        : '<li class="hint">Chưa có ghi chú.</li>';
    } catch (e) { notesBox.innerHTML = `<li class="hint">${esc(errMsg(e))}</li>`; }
  };
  loadNotes();
  const addNote = (batch, type, text) => batch.set(doc(collection(db, 'customerNotes')), {
    userId: uid, type, text, by: me.uid, byEmail: me.email, at: serverTimestamp()
  });
  const nf = body.querySelector('#nf');
  nf.type.addEventListener('change', () => { body.querySelector('#nf-mail').hidden = nf.type.value !== 'email'; });
  nf.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = nf.text.value.trim();
    if (!text) return;
    busy(nf.querySelector('[type=submit]'), async () => {
      try {
        if (nf.type.value === 'email') {
          window.open(`mailto:${encodeURIComponent(u.email)}?subject=${encodeURIComponent('NEXORA - Hỗ trợ khách hàng')}&body=${encodeURIComponent(`Chào ${u.name || 'bạn'},\n\n${text}\n\nNEXORA`)}`, '_blank');
        }
        const batch = writeBatch(db);
        addNote(batch, nf.type.value, text);
        audit(batch, 'customer.note', uid, `${u.email} · ${NOTE_TYPES[nf.type.value]}`);
        await batch.commit();
        nf.text.value = '';
        toast('Đã lưu vào hồ sơ khách.');
        loadNotes();
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });

  // Thành viên
  const mf = body.querySelector('#mf');
  mf.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const bonus = Number(mf.bonus.value || 0);
    if (!Number.isInteger(bonus)) return toast('Điểm phải là số nguyên.', 'err');
    busy(mf.querySelector('[type=submit]'), async () => {
      try {
        const data = { bonusPoints: bonus, tier: mf.tier.value, note: mf.note.value.trim(), by: me.uid, at: serverTimestamp() };
        const batch = writeBatch(db);
        batch.set(doc(db, 'members', uid), data);
        audit(batch, 'member.update', uid, `${u.email}: điểm cộng ${bonus}, hạng ${mf.tier.value || 'tự động'}${data.note ? ` · ${data.note}` : ''}`);
        await batch.commit();
        patchCache('members', uid, { ...data, at: Timestamp.now() });
        toast('Đã cập nhật thành viên.');
        openCustomer(uid, params);
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });

  // Ưu đãi riêng
  const of = body.querySelector('#of');
  of.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const type = of.type.value, value = Number(of.value.value), max = Number(of.max.value || 0);
    const minOrder = Number(of.min.value || 0), days = Number(of.days.value);
    if (![value, max, minOrder, days].every(Number.isInteger) || value < 1 || days < 1) return toast('Nhập số nguyên hợp lệ.', 'err');
    if (type === 'percent' && value > 100) return toast('Giảm % tối đa 100.', 'err');
    if (!admin) {
      if (type === 'percent' && (value > 15 || max < 1 || max > 500000)) return toast('Nhân viên: tối đa 15% và phải đặt mức giảm tối đa ≤ 500.000₫.', 'err');
      if (type === 'fixed' && value > 300000) return toast('Nhân viên: giảm tiền tối đa 300.000₫.', 'err');
      if (days > 31) return toast('Nhân viên: hiệu lực tối đa 31 ngày.', 'err');
    }
    busy(of.querySelector('[type=submit]'), async () => {
      try {
        const code = `UD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const start = Date.now();
        const data = {
          code, type, value, minOrder, maxDiscount: type === 'percent' ? max : 0, active: true,
          startAt: Timestamp.fromMillis(start), endAt: Timestamp.fromMillis(start + days * 86400000),
          userId: uid, createdBy: me.uid, description: `Ưu đãi riêng cho ${u.email}${of.note.value.trim() ? `: ${of.note.value.trim()}` : ''}`.slice(0, 200),
          updatedAt: serverTimestamp()
        };
        const desc = type === 'percent' ? `giảm ${value}% (tối đa ${money(max)})` : `giảm ${money(value)}`;
        const batch = writeBatch(db);
        batch.set(doc(db, 'vouchers', code), data);
        addNote(batch, 'offer', `Gửi mã ${code}: ${desc}, hạn ${days} ngày${of.note.value.trim() ? ` — ${of.note.value.trim()}` : ''}`);
        audit(batch, 'member.offer', uid, `${u.email}: ${code} ${desc}`);
        await batch.commit();
        patchCache('vouchers', code, data);
        toast(`Đã tạo mã ${code}. Khách thấy ở trang tài khoản.`);
        loadNotes();
        of.reset();
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });

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
  const reason = await ask('Khóa tài khoản', `Khóa ${u?.email}? Khách vẫn đăng nhập, xem đơn cũ và gửi yêu cầu hỗ trợ được, nhưng không thêm giỏ và đặt hàng mới được.`,
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
