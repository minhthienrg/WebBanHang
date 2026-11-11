// Hỗ trợ khách hàng (phía khách): yêu cầu hỗ trợ + chat realtime với nhân viên, khảo sát hài lòng khi
// phiếu đóng; trong trang tài khoản: hạng thành viên & điểm, ưu đãi riêng, phiếu bảo hành.
//   #/ho-tro                    danh sách yêu cầu của tôi
//   #/ho-tro/moi?loai=&don=     tạo yêu cầu (loai = mã TICKET_CATEGORIES, don = mã đơn)
//   #/ho-tro/{id}               hội thoại
import {
  collection, query, where, getDocs, getDoc, doc, onSnapshot, orderBy, writeBatch, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db } from './firebase.js';
import { getProfile, shortId, statusText } from './account.js';
import {
  TICKET_CATEGORIES, TICKET_STATUS, WARRANTY_STATUS, membership, TIERS
} from './categories.js';
import { $, esc, money, say, busy, errText } from './ui.js';

let unsubs = [];
export function stopSupport() { unsubs.forEach((u) => u()); unsubs = []; }

const when = (t) => (t?.toDate ? t.toDate().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '');
const ms = (t) => t?.toMillis?.() || 0;
const myName = (user) => (getProfile()?.name || user.displayName || user.email.split('@')[0]).slice(0, 100);

async function myOrders(user) {
  const snap = await getDocs(query(collection(db, 'orders'), where('userId', '==', user.uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
}

export async function renderSupport(user, params, arg) {
  stopSupport();
  const view = $('#view-support');
  if (arg === 'moi') return renderNew(view, user, params);
  if (arg) return renderThread(view, user, arg);

  view.innerHTML = '<p class="loading">Đang tải…</p>';
  const snap = await getDocs(query(collection(db, 'tickets'), where('userId', '==', user.uid)));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.lastMessageAt) - ms(a.lastMessageAt));
  view.innerHTML = `
    <div class="page-top">
      <div>
        <h1>Hỗ trợ khách hàng</h1>
        <p class="hint">Nhân viên NEXORA trả lời trong giờ hành chính (8:00–21:00). Hotline: <a href="tel:19006868">1900 6868</a></p>
      </div>
      <a class="btn primary auto" href="#/ho-tro/moi">+ Gửi yêu cầu mới</a>
    </div>
    ${list.length ? `<ul class="tk-list">${list.map((t) => `
      <li><a class="tk card" href="#/ho-tro/${esc(t.id)}">
        <div class="tk-top"><strong>${esc(t.subject)}</strong>
          <span class="status tk-${esc(t.status)}">${esc(TICKET_STATUS[t.status] || t.status)}</span></div>
        <p class="hint">#${esc(shortId(t.id))} · ${esc(TICKET_CATEGORIES[t.category] || t.category)}${t.orderId ? ` · đơn #${esc(shortId(t.orderId))}` : ''} · cập nhật ${esc(when(t.lastMessageAt))}
          ${t.status === 'waiting' ? ' · <strong class="warn-text">nhân viên đã trả lời</strong>' : ''}
          ${t.status === 'closed' && !t.rating ? ' · <strong class="warn-text">mời bạn đánh giá</strong>' : ''}</p>
      </a></li>`).join('')}</ul>`
      : '<div class="empty">Bạn chưa gửi yêu cầu hỗ trợ nào.</div>'}`;
}

async function renderNew(view, user, params) {
  const orders = await myOrders(user).catch(() => []);
  const cat = TICKET_CATEGORIES[params.loai] ? params.loai : 'hoi-dap';
  const preset = {
    'huy-don': 'Tôi muốn hủy đơn hàng này vì: ',
    'doi-tra': 'Tôi muốn đổi / trả sản phẩm vì: ',
    'bao-hanh': 'Sản phẩm gặp lỗi: \nSố serial (nếu có): ',
    'giao-hang': 'Vấn đề giao hàng: '
  }[cat] || '';
  view.innerHTML = `
    <nav class="crumbs" aria-label="Đường dẫn"><a href="#/ho-tro">Hỗ trợ</a> › <span>Yêu cầu mới</span></nav>
    <div class="card narrow-card">
      <h1>Gửi yêu cầu hỗ trợ</h1>
      <form id="tk-form" class="form" novalidate>
        <label>Loại yêu cầu
          <select name="category">${Object.entries(TICKET_CATEGORIES).map(([k, v]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <label>Đơn hàng liên quan <small>(không bắt buộc)</small>
          <select name="orderId"><option value="">— Không chọn —</option>
            ${orders.map((o) => `<option value="${esc(o.id)}" ${params.don === o.id ? 'selected' : ''}>#${esc(shortId(o.id))} · ${esc(statusText(o.status))} · ${money(o.total)}</option>`).join('')}
          </select></label>
        <label>Tiêu đề <input name="subject" required maxlength="150" placeholder="Tóm tắt vấn đề"></label>
        <label>Nội dung <textarea name="text" required rows="5" maxlength="2000">${esc(preset)}</textarea></label>
        <button type="submit" class="btn primary">Gửi yêu cầu</button>
      </form>
    </div>`;
  const f = $('#tk-form');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const subject = f.subject.value.trim(), text = f.text.value.trim();
    if (!subject || !text || text === preset.trim()) return say('Vui lòng nhập tiêu đề và nội dung.', 'err');
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        const ref = doc(collection(db, 'tickets'));
        const name = myName(user);
        const batch = writeBatch(db);
        batch.set(ref, {
          userId: user.uid, userEmail: user.email, userName: name, subject, category: f.category.value,
          orderId: f.orderId.value, productId: '', channel: 'web', status: 'open', dept: 'cskh',
          assignee: '', assigneeEmail: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(), lastFrom: 'customer'
        });
        batch.set(doc(collection(ref, 'messages')), { from: 'customer', text, by: user.uid, byName: name, at: serverTimestamp() });
        await batch.commit();
        say('Đã gửi yêu cầu. Nhân viên sẽ phản hồi sớm nhất.');
        location.hash = `#/ho-tro/${ref.id}`;
      } catch (e) { say(errText(e), 'err'); }
    });
  });
}

function renderThread(view, user, id) {
  view.innerHTML = `
    <nav class="crumbs" aria-label="Đường dẫn"><a href="#/ho-tro">Hỗ trợ</a> › <span>#${esc(shortId(id))}</span></nav>
    <div class="card chat-card">
      <div id="tk-head"><p class="loading">Đang tải…</p></div>
      <ol class="chat" id="chat" aria-live="polite"></ol>
      <div id="tk-foot"></div>
    </div>`;
  let ticket = null;
  const ref = doc(db, 'tickets', id);
  unsubs.push(onSnapshot(ref, (snap) => {
    if (!snap.exists()) { $('#tk-head').innerHTML = '<p class="msg err">Không tìm thấy yêu cầu.</p>'; return; }
    const first = !ticket;
    const prevStatus = ticket?.status, prevRating = ticket?.rating;
    ticket = { id, ...snap.data() };
    $('#tk-head').innerHTML = `
      <div class="tk-top"><h1>${esc(ticket.subject)}</h1>
        <span class="status tk-${esc(ticket.status)}">${esc(TICKET_STATUS[ticket.status] || ticket.status)}</span></div>
      <p class="hint">#${esc(shortId(id))} · ${esc(TICKET_CATEGORIES[ticket.category] || ticket.category)}
        ${ticket.orderId ? ` · đơn <a href="#/tai-khoan">#${esc(shortId(ticket.orderId))}</a>` : ''}
        ${ticket.assigneeEmail ? ' · đã có nhân viên tiếp nhận' : ''}</p>`;
    if (first || prevStatus !== ticket.status || prevRating !== ticket.rating) renderFoot();
  }, (e) => { $('#tk-head').innerHTML = `<p class="msg err">${esc(errText(e))}</p>`; }));

  unsubs.push(onSnapshot(query(collection(ref, 'messages'), orderBy('at')), (snap) => {
    const box = $('#chat');
    if (!box) return;
    box.innerHTML = snap.docs.map((d) => {
      const m = d.data();
      if (m.from === 'system') return `<li class="sys">${esc(m.text)} <span class="hint">${esc(when(m.at))}</span></li>`;
      const me = m.from === 'customer';
      return `<li class="${me ? 'me' : 'them'}"><div class="bubble">${esc(m.text).replace(/\n/g, '<br>')}</div>
        <span class="hint">${me ? 'Bạn' : `${esc(m.byName || 'Nhân viên')} · NEXORA`} · ${esc(when(m.at))}</span></li>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }));

  function renderFoot() {
    const foot = $('#tk-foot');
    if (!foot) return;
    if (ticket.status !== 'closed') {
      foot.innerHTML = `<form id="reply" class="reply-row">
          <label for="reply-text" class="sr-only">Tin nhắn</label>
          <textarea id="reply-text" name="text" rows="2" maxlength="2000" placeholder="Nhập tin nhắn…" required></textarea>
          <button type="submit" class="btn primary auto">Gửi</button>
        </form>`;
      const f = $('#reply');
      f.text.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) f.requestSubmit(); });
      f.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const text = f.text.value.trim();
        if (!text) return;
        busy(f.querySelector('[type=submit]'), async () => {
          try {
            const batch = writeBatch(db);
            batch.set(doc(collection(ref, 'messages')), { from: 'customer', text, by: user.uid, byName: myName(user), at: serverTimestamp() });
            batch.update(ref, { status: 'open', lastFrom: 'customer', lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() });
            await batch.commit();
            f.reset();
            f.text.focus();
          } catch (e) { say(errText(e), 'err'); }
        });
      });
    } else if (!ticket.rating) {
      // Khảo sát mức hài lòng — hiện tự động khi phiếu đóng.
      foot.innerHTML = `<form id="rate" class="form survey">
          <h2>Bạn hài lòng với hỗ trợ lần này chứ?</h2>
          <fieldset class="rate-row"><legend class="sr-only">Mức hài lòng</legend>
            ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rating" value="${n}" ${n === 5 ? 'checked' : ''}><span>${n}★</span></label>`).join('')}
          </fieldset>
          <label>Góp ý thêm <small>(không bắt buộc)</small><textarea name="c" rows="2" maxlength="500"></textarea></label>
          <button type="submit" class="btn primary">Gửi đánh giá</button>
          <p class="hint">Cần hỗ trợ thêm? <a href="#/ho-tro/moi">Gửi yêu cầu mới</a></p>
        </form>`;
      const f = $('#rate');
      f.addEventListener('submit', (ev) => {
        ev.preventDefault();
        busy(f.querySelector('[type=submit]'), async () => {
          try {
            await updateDoc(ref, { rating: Number(f.rating.value), ratingComment: f.c.value.trim(), ratedAt: serverTimestamp() });
            say('Cảm ơn bạn đã đánh giá!');
          } catch (e) { say(errText(e), 'err'); }
        });
      });
    } else {
      foot.innerHTML = `<p class="hint">Yêu cầu đã đóng · bạn đánh giá ${'★'.repeat(ticket.rating)}${ticket.ratingComment ? `: “${esc(ticket.ratingComment)}”` : ''}.
        <a href="#/ho-tro/moi">Gửi yêu cầu mới</a></p>`;
    }
  }
}

// ---------- Trang tài khoản: hạng thành viên, ưu đãi riêng, bảo hành ----------
export async function renderAccountExtras(user, orders) {
  const [member, offers, warranties] = await Promise.all([
    getDoc(doc(db, 'members', user.uid)).then((s) => (s.exists() ? s.data() : null)).catch(() => null),
    getDocs(query(collection(db, 'vouchers'), where('userId', '==', user.uid))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
    getDocs(query(collection(db, 'warranties'), where('userId', '==', user.uid))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => [])
  ]);
  const m = membership(orders, member);
  const box = $('#member-box');
  if (box) {
    const pct = m.next ? Math.min(100, (m.spent / m.next.min) * 100) : 100;
    box.innerHTML = `
      <div class="member tier-${esc(m.tier.key)}">
        <p class="eyebrow">Hạng thành viên</p>
        <p class="member-tier">${esc(m.tier.name)}</p>
        <p><strong>${new Intl.NumberFormat('vi-VN').format(m.points)}</strong> điểm · đã mua ${money(m.spent)}</p>
        ${m.next && !m.manual ? `<div class="member-bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ lên hạng ${esc(m.next.name)}"><span style="width:${pct}%"></span></div>
          <p class="hint">Mua thêm ${money(m.toNext)} để lên ${esc(m.next.name)}.</p>` : ''}
        <p class="hint">${esc(m.tier.perk)}. 1 điểm cho mỗi 10.000₫ của đơn hoàn tất. Các hạng: ${TIERS.map((t) => esc(t.name)).join(' · ')}.</p>
      </div>`;
  }
  const now = Date.now();
  const live = offers.filter((v) => v.active && ms(v.endAt) > now).sort((a, b) => ms(a.endAt) - ms(b.endAt));
  const ob = $('#offers-box');
  if (ob) {
    ob.hidden = !live.length;
    ob.innerHTML = live.length ? `<h2>Ưu đãi dành riêng cho bạn</h2><ul class="offers">${live.map((v) => `
      <li><code class="code">${esc(v.id)}</code>
        <span>${v.type === 'percent' ? `Giảm ${v.value}%${v.maxDiscount ? ` (tối đa ${money(v.maxDiscount)})` : ''}` : `Giảm ${money(v.value)}`}${v.minOrder ? ` cho đơn từ ${money(v.minOrder)}` : ''}</span>
        <span class="hint">HSD ${esc(when(v.endAt))}${ms(v.startAt) > now ? ` · áp dụng từ ${esc(when(v.startAt))}` : ''}</span></li>`).join('')}</ul>
      <p class="hint">Nhập mã ở bước thanh toán.</p>` : '';
  }
  const wb = $('#warranty-box');
  if (wb) {
    warranties.sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    wb.hidden = !warranties.length;
    wb.innerHTML = warranties.length ? `<h2>Phiếu bảo hành</h2>${warranties.map((w) => `
      <article class="order">
        <div class="order-head"><strong>${esc(w.productName)}</strong><span class="status wr-${esc(w.status)}">${esc(WARRANTY_STATUS[w.status] || w.status)}</span></div>
        <p class="hint">Phiếu #${esc(shortId(w.id))}${w.serial ? ` · serial ${esc(w.serial)}` : ''} · tiếp nhận ${esc(when(w.createdAt))}${w.center ? ` · ${esc(w.center)}` : ''}</p>
        ${(w.history || []).length ? `<details><summary class="hint">Tiến độ (${w.history.length})</summary><ul class="order-items">${w.history.map((h) =>
          `<li>${esc(when(h.at))} — ${esc(WARRANTY_STATUS[h.status] || h.status)}${h.note ? `: ${esc(h.note)}` : ''}</li>`).join('')}</ul></details>` : ''}
      </article>`).join('')}` : '';
  }
  return m;
}
