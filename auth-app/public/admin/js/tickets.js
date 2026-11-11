// Yêu cầu hỗ trợ (Bảng 1.2): hàng đợi, chat realtime với khách, mẫu trả lời nhanh, nhận phiếu,
// chuyển bộ phận / quản trị viên, đóng phiếu (khách nhận khảo sát hài lòng), tạo phiếu hộ khi khách
// gọi hotline hoặc gửi email.
import {
  doc, collection, query, orderBy, onSnapshot, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  db, me, load, loadAll, patchCache, audit, esc, money, num, fold, toast, errMsg, busy, openDialog, closeDialog,
  hrefWith, fmtDateTime, toMs, shortId, statusBadge, fillTemplate, ROLE_NAMES, STATUS as ORDER_STATUS
} from './core.js';
import { TICKET_CATEGORIES, membership } from '../../js/categories.js';

const STATUS = { open: 'Chờ nhân viên', waiting: 'Chờ khách', closed: 'Đã đóng' };
const DEPTS = { cskh: 'Chăm sóc khách hàng', kho: 'Kho / đóng gói', 'ky-thuat': 'Kỹ thuật', admin: 'Quản trị viên' };
const CHANNELS = { web: 'Web / chat', phone: 'Hotline', email: 'Email', chat: 'Chat' };
const FILTERS = [
  ['', 'Chờ xử lý'], ['cua-toi', 'Của tôi'], ['chua-nhan', 'Chưa ai nhận'], ['cho-khach', 'Chờ khách'],
  ['chuyen', 'Đã chuyển bộ phận'], ['dong', 'Đã đóng'], ['tat-ca', 'Tất cả']
];

let unsubs = [];
export function leave() { unsubs.forEach((u) => u()); unsubs = []; }

function match(t, loc) {
  switch (loc || '') {
    case '': return t.status === 'open' && (t.dept === 'cskh' || (t.dept === 'admin' && me.role === 'admin'));
    case 'cua-toi': return t.assignee === me.uid && t.status !== 'closed';
    case 'chua-nhan': return !t.assignee && t.status !== 'closed';
    case 'cho-khach': return t.status === 'waiting';
    case 'chuyen': return t.dept !== 'cskh' && t.status !== 'closed';
    case 'dong': return t.status === 'closed';
    default: return true;
  }
}
const waitText = (t) => {
  const h = (Date.now() - toMs(t.lastMessageAt)) / 3600000;
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} phút` : h < 48 ? `${Math.round(h)} giờ` : `${Math.round(h / 24)} ngày`;
};

export async function render(box, params, arg) {
  leave();
  if (arg) return renderThread(box, arg, params);
  const tickets = await load('tickets');
  const words = fold(params.q || '').split(/\s+/).filter(Boolean);
  const list = tickets.filter((t) => match(t, params.loc)
    && (!words.length || words.every((w) => fold(`${t.id} ${t.subject} ${t.userName} ${t.userEmail} ${t.orderId}`).includes(w))))
    .sort((a, b) => (params.loc === 'dong' || params.loc === 'tat-ca')
      ? toMs(b.lastMessageAt) - toMs(a.lastMessageAt) : toMs(a.lastMessageAt) - toMs(b.lastMessageAt));

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Chăm sóc khách hàng</p><h1>Yêu cầu hỗ trợ</h1></div>
      <div class="head-actions">
        <button type="button" class="btn small" id="btn-tpl">Mẫu trả lời nhanh</button>
        <button type="button" class="btn small primary" id="btn-new">+ Tạo phiếu (hotline / email)</button>
      </div>
    </div>
    <div class="chips">${FILTERS.map(([k, v]) => `<a class="chip ${(params.loc || '') === k ? 'on' : ''}" href="${hrefWith('ho-tro', params, { loc: k })}">${v} <small>${tickets.filter((t) => match(t, k)).length}</small></a>`).join('')}</div>
    <form class="toolbar-row" id="tf">
      <label class="grow"><span class="sr-only">Tìm yêu cầu</span>
        <input name="q" type="search" placeholder="Tiêu đề, tên / email khách, mã đơn…" value="${esc(params.q || '')}"></label>
      <button class="btn small" type="submit">Tìm</button>
    </form>
    ${list.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Yêu cầu</th><th>Khách hàng</th><th>Kênh</th><th>Phụ trách</th><th>Trạng thái</th><th>Cập nhật</th></tr></thead>
      <tbody>${list.map((t) => `<tr class="${t.status === 'open' && !t.assignee ? 'row-new' : ''}">
        <td><a class="name" href="#/ho-tro/${esc(t.id)}">${esc(t.subject)}</a>
          <div class="sub">#${esc(shortId(t.id))} · ${esc(TICKET_CATEGORIES[t.category] || t.category)}${t.orderId ? ` · đơn #${esc(shortId(t.orderId))}` : ''}</div></td>
        <td>${esc(t.userName || '')}<div class="sub">${esc(t.userEmail || '')}</div></td>
        <td>${esc(CHANNELS[t.channel] || t.channel)}</td>
        <td>${t.assigneeEmail ? esc(t.assigneeEmail) : '<span class="warn-text">Chưa nhận</span>'}${t.dept !== 'cskh' ? `<div class="sub">→ ${esc(DEPTS[t.dept] || t.dept)}</div>` : ''}</td>
        <td><span class="status tk-${esc(t.status)}">${esc(STATUS[t.status] || t.status)}</span>${t.rating ? `<div class="sub">${'★'.repeat(t.rating)}</div>` : ''}</td>
        <td class="nowrap">${esc(fmtDateTime(t.lastMessageAt))}${t.status === 'open' ? `<div class="sub ${Date.now() - toMs(t.lastMessageAt) > 86400000 ? 'neg' : ''}">chờ ${waitText(t)}</div>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>` : '<div class="empty">Không có yêu cầu nào.</div>'}`;

  const f = box.querySelector('#tf');
  f.addEventListener('submit', (ev) => { ev.preventDefault(); location.hash = hrefWith('ho-tro', params, { q: f.q.value.trim() }); });
  box.querySelector('#btn-new').addEventListener('click', () => newTicket());
  box.querySelector('#btn-tpl').addEventListener('click', () => manageTemplates());
}

// ---------- Hội thoại ----------
async function renderThread(box, id, params) {
  const [users, orders, members] = await loadAll('users', 'orders', 'members');
  box.innerHTML = `
    <nav class="crumbs"><a href="#/ho-tro">Yêu cầu hỗ trợ</a> › <span>#${esc(shortId(id))}</span></nav>
    <div class="thread-layout">
      <section class="card thread-main">
        <div id="th-head"><p class="loading">Đang tải…</p></div>
        <ol class="chat" id="chat" aria-live="polite"></ol>
        <form id="reply" class="form">
          <div class="reply-tools">
            <label class="inline">Mẫu <select name="tpl"><option value="">— Chọn mẫu trả lời —</option></select></label>
          </div>
          <label for="reply-text" class="sr-only">Trả lời khách</label>
          <textarea id="reply-text" name="text" rows="3" maxlength="2000" placeholder="Trả lời khách… (Ctrl+Enter để gửi)"></textarea>
          <div class="dlg-actions">
            <button type="submit" class="btn small primary" name="send" value="waiting">Gửi trả lời</button>
            <button type="submit" class="btn small" name="send" value="close">Gửi &amp; đóng phiếu</button>
          </div>
        </form>
      </section>
      <aside class="card thread-side" id="th-side"></aside>
    </div>`;

  let ticket = null;
  const ref = doc(db, 'tickets', id);
  const f = box.querySelector('#reply');
  const templates = await load('replyTemplates').catch(() => []);
  f.tpl.innerHTML += templates.map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
  f.tpl.addEventListener('change', () => {
    const t = templates.find((x) => x.id === f.tpl.value);
    if (!t || !ticket) return;
    const text = fillTemplate(t.text, { ten: ticket.userName || '', ma_don: ticket.orderId ? `#${shortId(ticket.orderId)}` : '', nhan_vien: me.email });
    f.text.value = f.text.value ? `${f.text.value}\n${text}` : text;
    f.tpl.value = '';
    f.text.focus();
  });
  f.text.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) f.querySelector('[value=waiting]').click(); });
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const close = ev.submitter?.value === 'close';
    const text = f.text.value.trim();
    if (!text && !close) return;
    busy(ev.submitter, async () => {
      try {
        const batch = writeBatch(db);
        if (text) batch.set(doc(collection(ref, 'messages')), { from: 'staff', text, by: me.uid, byName: staffName(), at: serverTimestamp() });
        if (close) batch.set(doc(collection(ref, 'messages')), { from: 'system', text: `Phiếu đã được đóng bởi ${staffName()}.`, by: me.uid, byName: staffName(), at: serverTimestamp() });
        batch.update(ref, {
          status: close ? 'closed' : 'waiting', lastFrom: 'staff', lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp(),
          ...(ticket.assignee ? {} : { assignee: me.uid, assigneeEmail: me.email }),
          ...(close ? { closedAt: serverTimestamp(), closedBy: me.uid } : {})
        });
        if (close) audit(batch, 'ticket.close', id, ticket.subject);
        await batch.commit();
        f.reset();
        if (close) toast('Đã đóng phiếu. Khách sẽ nhận khảo sát mức hài lòng.');
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });

  unsubs.push(onSnapshot(ref, (snap) => {
    if (!snap.exists()) { box.querySelector('#th-head').innerHTML = '<p class="msg err">Không tìm thấy phiếu.</p>'; return; }
    ticket = { id, ...snap.data() };
    patchCache('tickets', id, snap.data());
    drawHead();
    drawSide();
    f.hidden = ticket.status === 'closed';
  }, (e) => toast(errMsg(e), 'err')));

  unsubs.push(onSnapshot(query(collection(ref, 'messages'), orderBy('at')), (snap) => {
    const chat = box.querySelector('#chat');
    if (!chat) return;
    chat.innerHTML = snap.docs.map((d) => {
      const m = d.data();
      if (m.from === 'system') return `<li class="sys">${esc(m.text)} · ${esc(fmtDateTime(m.at))}</li>`;
      const staff = m.from === 'staff';
      return `<li class="${staff ? 'me' : 'them'}"><div class="bubble">${esc(m.text).replace(/\n/g, '<br>')}</div>
        <span class="sub">${esc(m.byName || '')}${staff ? ' (nhân viên)' : ''} · ${esc(fmtDateTime(m.at))}</span></li>`;
    }).join('');
    chat.scrollTop = chat.scrollHeight;
  }));

  function drawHead() {
    box.querySelector('#th-head').innerHTML = `
      <div class="sec-head">
        <h1 class="th-title">${esc(ticket.subject)}</h1>
        <span class="status tk-${esc(ticket.status)}">${esc(STATUS[ticket.status] || ticket.status)}</span>
      </div>
      <p class="sub">#${esc(shortId(id))} · ${esc(TICKET_CATEGORIES[ticket.category] || ticket.category)} · kênh ${esc(CHANNELS[ticket.channel] || ticket.channel)}
        · tạo ${esc(fmtDateTime(ticket.createdAt))} · bộ phận: <strong>${esc(DEPTS[ticket.dept] || ticket.dept)}</strong>
        · phụ trách: ${ticket.assigneeEmail ? esc(ticket.assigneeEmail) : '<span class="warn-text">chưa có</span>'}</p>
      <div class="head-actions">
        ${ticket.assignee !== me.uid && ticket.status !== 'closed' ? '<button type="button" class="btn small primary" data-act="claim">Nhận phiếu này</button>' : ''}
        ${ticket.status !== 'closed' ? `<button type="button" class="btn small" data-act="transfer">Chuyển bộ phận</button>
          <button type="button" class="btn small" data-act="close">Đóng phiếu</button>` : '<button type="button" class="btn small" data-act="reopen">Mở lại</button>'}
      </div>
      ${ticket.rating ? `<p class="note">Khách đánh giá ${'★'.repeat(ticket.rating)}${ticket.ratingComment ? `: “${esc(ticket.ratingComment)}”` : ''}</p>`
        : ticket.status === 'closed' ? '<p class="hint">Đã gửi khảo sát mức hài lòng cho khách.</p>' : ''}`;
  }

  function drawSide() {
    const u = users.find((x) => x.id === ticket.userId);
    const own = orders.filter((o) => o.userId === ticket.userId).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    const m = membership(own, members.find((x) => x.id === ticket.userId));
    const rel = orders.find((o) => o.id === ticket.orderId);
    box.querySelector('#th-side').innerHTML = `
      <h2>Khách hàng</h2>
      <p><strong>${esc(u?.name || ticket.userName || '')}</strong><br>
        <a href="mailto:${esc(ticket.userEmail)}">${esc(ticket.userEmail)}</a><br>
        ${u?.phone ? `<a href="tel:${esc(u.phone)}">${esc(u.phone)}</a>` : '<span class="sub">Chưa có SĐT</span>'}</p>
      <p class="sub">Hạng <strong>${esc(m.tier.name)}</strong> · ${num.format(m.points)} điểm · ${own.length} đơn</p>
      <a class="btn small" href="#/khach-hang?q=${encodeURIComponent(ticket.userEmail || '')}&mo=${encodeURIComponent(ticket.userId)}">Hồ sơ, ghi chú &amp; ưu đãi</a>
      ${rel ? `<h2 class="mt2">Đơn liên quan</h2>
        <p><a href="#/don-hang/${esc(rel.id)}">#${esc(shortId(rel.id))}</a> ${statusBadge(rel.status)}<br>
        <span class="sub">${esc(fmtDateTime(rel.createdAt))} · ${money(rel.total)}</span></p>
        <ul class="plain sub">${rel.items.map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join('')}</ul>
        ${ticket.category === 'bao-hanh' ? `<a class="btn small" href="#/bao-hanh?moi=${encodeURIComponent(rel.id)}">Tạo phiếu bảo hành</a>` : ''}` : ''}
      ${own.length ? `<h2 class="mt2">Đơn gần đây</h2><ul class="plain sub">${own.slice(0, 5).map((o) =>
        `<li><a href="#/don-hang/${esc(o.id)}">#${esc(shortId(o.id))}</a> · ${esc(fmtDateTime(o.createdAt))} · ${money(o.total)} · ${esc(ORDER_STATUS[o.status] || o.status)}</li>`).join('')}</ul>` : ''}`;
  }

  box.onclick = (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || !ticket) return;
    const act = b.dataset.act;
    if (act === 'transfer') return transfer(ticket);
    busy(b, async () => {
      try {
        const batch = writeBatch(db);
        const sys = (text) => batch.set(doc(collection(ref, 'messages')), { from: 'system', text, by: me.uid, byName: staffName(), at: serverTimestamp() });
        if (act === 'claim') {
          batch.update(ref, { assignee: me.uid, assigneeEmail: me.email, updatedAt: serverTimestamp() });
          sys(`${staffName()} đã tiếp nhận yêu cầu.`);
          audit(batch, 'ticket.assign', id, `${ticket.subject} → ${me.email}`);
        } else if (act === 'close') {
          batch.update(ref, { status: 'closed', closedAt: serverTimestamp(), closedBy: me.uid, updatedAt: serverTimestamp(),
            ...(ticket.assignee ? {} : { assignee: me.uid, assigneeEmail: me.email }) });
          sys(`Phiếu đã được đóng bởi ${staffName()}.`);
          audit(batch, 'ticket.close', id, ticket.subject);
        } else if (act === 'reopen') {
          batch.update(ref, { status: 'open', updatedAt: serverTimestamp() });
          sys(`${staffName()} đã mở lại yêu cầu.`);
          audit(batch, 'ticket.reopen', id, ticket.subject);
        }
        await batch.commit();
        if (act === 'close') toast('Đã đóng phiếu. Khách sẽ nhận khảo sát mức hài lòng.');
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  };
}

const staffName = () => `${me.email.split('@')[0]} (${ROLE_NAMES[me.role] || 'NEXORA'})`.slice(0, 100);

function transfer(ticket) {
  const body = openDialog('Chuyển bộ phận', `
    <form class="form" id="trf">
      <p class="hint">Chuyển khi yêu cầu vượt thẩm quyền CSKH (vd: hoàn tiền lớn, lỗi hệ thống) hoặc cần bộ phận khác xử lý.</p>
      <label>Chuyển tới
        <select name="dept">${Object.entries(DEPTS).map(([k, v]) => `<option value="${k}" ${k === ticket.dept ? 'disabled' : k === 'admin' ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label>Lý do / ghi chú <textarea name="note" rows="2" maxlength="300" required></textarea></label>
      <div class="dlg-actions"><button type="button" class="btn small" data-close>Hủy</button>
        <button type="submit" class="btn small primary">Chuyển</button></div>
    </form>`);
  const f = body.querySelector('#trf');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!f.note.value.trim()) return toast('Ghi lý do chuyển.', 'err');
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        const ref = doc(db, 'tickets', ticket.id);
        const batch = writeBatch(db);
        batch.update(ref, { dept: f.dept.value, status: 'open', assignee: '', assigneeEmail: '', updatedAt: serverTimestamp() });
        batch.set(doc(collection(ref, 'messages')), { from: 'system', text: `Yêu cầu được chuyển tới bộ phận ${DEPTS[f.dept.value]}.`, by: me.uid, byName: staffName(), at: serverTimestamp() });
        audit(batch, 'ticket.transfer', ticket.id, `${ticket.subject} → ${DEPTS[f.dept.value]}: ${f.note.value.trim()}`);
        await batch.commit();
        closeDialog();
        toast(`Đã chuyển tới ${DEPTS[f.dept.value]}.`);
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });
}

// ---------- Tạo phiếu hộ khách (hotline / email) ----------
async function newTicket() {
  const users = await load('users');
  const body = openDialog('Tạo phiếu hỗ trợ', `
    <form class="form" id="nt" novalidate>
      <div class="grid2">
        <label>Email khách <input name="email" type="email" required list="dl-cus" placeholder="Gõ để tìm…"></label>
        <label>Kênh <select name="channel"><option value="phone">Hotline</option><option value="email">Email</option><option value="chat">Chat (Zalo / Messenger)</option></select></label>
      </div>
      <datalist id="dl-cus">${users.map((u) => `<option value="${esc(u.email)}">${esc(u.name || '')}</option>`).join('')}</datalist>
      <div class="grid2">
        <label>Loại <select name="category">${Object.entries(TICKET_CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
        <label>Mã đơn <small>(không bắt buộc)</small><input name="order" maxlength="40"></label>
      </div>
      <label>Tiêu đề <input name="subject" required maxlength="150"></label>
      <label>Nội dung khách trao đổi / ghi chú cuộc gọi <textarea name="text" rows="4" maxlength="2000" required></textarea></label>
      <div class="dlg-actions"><button type="button" class="btn small" data-close>Hủy</button>
        <button type="submit" class="btn small primary">Tạo phiếu</button></div>
    </form>`);
  const f = body.querySelector('#nt');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const u = users.find((x) => (x.email || '').toLowerCase() === f.email.value.trim().toLowerCase());
    if (!u) return toast('Không tìm thấy khách với email này.', 'err');
    if (!f.subject.value.trim() || !f.text.value.trim()) return toast('Nhập tiêu đề và nội dung.', 'err');
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        const orders = await load('orders');
        const typed = f.order.value.trim().replace(/^#/, '').toUpperCase();
        const o = typed ? orders.find((x) => x.userId === u.id && (x.id.toUpperCase() === typed || shortId(x.id) === typed)) : null;
        if (typed && !o) return toast('Không tìm thấy đơn này của khách.', 'err');
        const ref = doc(collection(db, 'tickets'));
        const batch = writeBatch(db);
        batch.set(ref, {
          userId: u.id, userEmail: u.email, userName: (u.name || u.email).slice(0, 100), subject: f.subject.value.trim(),
          category: f.category.value, orderId: o?.id || '', productId: '', channel: f.channel.value, status: 'open', dept: 'cskh',
          assignee: me.uid, assigneeEmail: me.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(), lastFrom: 'staff'
        });
        batch.set(doc(collection(ref, 'messages')), {
          from: 'system', text: `[${CHANNELS[f.channel.value]}] ${f.text.value.trim()}`, by: me.uid, byName: staffName(), at: serverTimestamp()
        });
        audit(batch, 'ticket.create', ref.id, `${u.email}: ${f.subject.value.trim()}`);
        await batch.commit();
        closeDialog();
        toast('Đã tạo phiếu.');
        location.hash = `#/ho-tro/${ref.id}`;
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });
}

// ---------- Mẫu trả lời nhanh ----------
async function manageTemplates() {
  const list = await load('replyTemplates', true);
  const body = openDialog('Mẫu trả lời nhanh', `
    <p class="hint">Dùng {ten} (tên khách), {ma_don} (mã đơn), {nhan_vien} (email của bạn) — tự thay khi chèn.</p>
    <ul class="tpl-list">${list.map((t) => `<li><strong>${esc(t.title)}</strong><p class="sub">${esc(t.text)}</p>
      <div class="head-actions"><button type="button" class="btn small" data-tpl-edit="${esc(t.id)}">Sửa</button>
      <button type="button" class="btn small danger" data-tpl-del="${esc(t.id)}">Xóa</button></div></li>`).join('') || '<li class="hint">Chưa có mẫu nào.</li>'}</ul>
    <form class="form" id="tpf">
      <input type="hidden" name="id">
      <h3 id="tpf-h">Thêm mẫu</h3>
      <label>Tên mẫu <input name="title" maxlength="80" required placeholder="vd: Chính sách đổi trả"></label>
      <label>Nội dung <textarea name="text" rows="4" maxlength="2000" required></textarea></label>
      <div class="dlg-actions"><button type="button" class="btn small" data-close>Đóng</button>
        <button type="submit" class="btn small primary">Lưu mẫu</button></div>
    </form>`, { wide: true });
  const f = body.querySelector('#tpf');
  body.onclick = async (ev) => {   // #dlg-body dùng lại giữa các lần mở → gán, không cộng dồn
    const e = ev.target.closest('[data-tpl-edit]');
    if (e) {
      const t = list.find((x) => x.id === e.dataset.tplEdit);
      f.id.value = t.id; f.title.value = t.title; f.text.value = t.text;
      body.querySelector('#tpf-h').textContent = 'Sửa mẫu';
      f.title.focus();
    }
    const d = ev.target.closest('[data-tpl-del]');
    if (d) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'replyTemplates', d.dataset.tplDel));
        await batch.commit();
        patchCache('replyTemplates', d.dataset.tplDel, null);
        manageTemplates();
      } catch (err) { toast(errMsg(err), 'err'); }
    }
  };
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        const ref = f.id.value ? doc(db, 'replyTemplates', f.id.value) : doc(collection(db, 'replyTemplates'));
        const data = { title: f.title.value.trim(), text: f.text.value.trim(), by: me.uid, at: serverTimestamp() };
        const batch = writeBatch(db);
        batch.set(ref, data);
        await batch.commit();
        patchCache('replyTemplates', ref.id, { ...data, at: Timestamp.now() });
        toast('Đã lưu mẫu trả lời.');
        manageTemplates();
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });
}
