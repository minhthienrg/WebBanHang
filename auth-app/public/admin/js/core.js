// Lõi trang quản trị: kiểm tra quyền, điều hướng, bộ nhớ đệm dữ liệu, nhật ký, hộp thoại, tiện ích.
import {
  collection, getDocs, doc, serverTimestamp, query, orderBy, limit, onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { auth, db } from '../../js/firebase.js';
import { $, esc, money } from '../../js/ui.js';
import { fold } from '../../js/catalog.js';

export { auth, db, esc, money, fold };

// ---------- Người đang đăng nhập (đặt bởi main.js) ----------
export const me = { uid: '', email: '' };

// ---------- Trạng thái đơn hàng ----------
export const STATUS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  shipping: 'Đang giao',
  done: 'Hoàn tất',
  cancelled: 'Đã hủy'
};
export const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'shipping', 'done', 'cancelled'];
/** Trạng thái mà hàng đã rời kho (đã trừ tồn kho). */
export const DEDUCTED = new Set(['confirmed', 'preparing', 'shipping', 'done']);
export const statusBadge = (s) => `<span class="status s-${esc(s)}">${esc(STATUS[s] || s)}</span>`;
export const shortId = (id) => id.slice(0, 8).toUpperCase();

export const DEFAULT_MIN_STOCK = 3;
export const minStock = (p) => (Number.isFinite(p.minStock) ? p.minStock : DEFAULT_MIN_STOCK);
export const isLow = (p) => p.active && !p.deleted && p.stock <= minStock(p);

// ---------- Bộ nhớ đệm: tải toàn bộ 1 lần (cửa hàng nhỏ), bấm "Tải lại" để đọc lại ----------
const cache = {};
const LOADERS = {
  products: () => getDocs(collection(db, 'products')),
  orders: () => getDocs(collection(db, 'orders')),
  users: () => getDocs(collection(db, 'users')),
  bans: () => getDocs(collection(db, 'bans')),
  admins: () => getDocs(collection(db, 'admins')),
  vouchers: () => getDocs(collection(db, 'vouchers'))
};
// Đơn hàng và khách hàng theo dõi realtime: đơn / tài khoản mới hiện ngay, không cần tải lại trang.
const LIVE = new Set(['orders', 'users']);
const live = {};
function startLive(name) {
  if (!live[name]) {
    live[name] = new Promise((resolve, reject) => {
      let first = true;
      onSnapshot(collection(db, name), (snap) => {
        cache[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (first) { first = false; resolve(cache[name]); return; }
        window.dispatchEvent(new CustomEvent('admin:data', { detail: { name, added: snap.docChanges().filter((c) => c.type === 'added').length } }));
      }, (e) => { delete live[name]; if (first) reject(e); });
    });
  }
  return live[name];
}

export async function load(name, force = false) {
  if (LIVE.has(name)) return startLive(name).then(() => cache[name]);
  if (!force && cache[name]) return cache[name];
  if (force || !cache[`${name}:p`]) {
    cache[`${name}:p`] = LOADERS[name]()
      .then((snap) => {
        cache[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return cache[name];
      })
      .finally(() => { delete cache[`${name}:p`]; });
  }
  return cache[`${name}:p`] || cache[name];
}
export const loadAll = (...names) => Promise.all(names.map((n) => load(n)));
export function invalidate(...names) { for (const n of names) delete cache[n]; }
/** Cập nhật 1 phần tử trong bộ nhớ đệm sau khi ghi (khỏi phải đọc lại cả collection). */
export function patchCache(name, id, data) {
  const list = cache[name];
  if (!list) return;
  const i = list.findIndex((x) => x.id === id);
  if (data === null) { if (i >= 0) list.splice(i, 1); return; }
  if (i >= 0) list[i] = { ...list[i], ...data }; else list.push({ id, ...data });
}

/** Đọc N bản ghi mới nhất của collection có trường `at`. */
export async function latest(name, n = 200) {
  const snap = await getDocs(query(collection(db, name), orderBy('at', 'desc'), limit(n)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- Nhật ký hoạt động: ghi cùng batch/transaction với thao tác ----------
export function audit(writer, action, target, detail) {
  writer.set(doc(collection(db, 'auditLogs')), {
    action, target: String(target || ''), detail: String(detail || '').slice(0, 1000),
    by: me.uid, byEmail: me.email, at: serverTimestamp()
  });
}
export const ACTIONS = {
  'product.create': 'Thêm sản phẩm',
  'product.update': 'Sửa sản phẩm',
  'product.hide': 'Ẩn sản phẩm',
  'product.show': 'Hiện sản phẩm',
  'product.delete': 'Xóa sản phẩm',
  'product.restore': 'Khôi phục sản phẩm',
  'price.bulk': 'Đổi giá hàng loạt',
  'stock.in': 'Nhập kho',
  'stock.out': 'Xuất kho',
  'stock.damaged': 'Hủy hàng lỗi',
  'order.status': 'Đổi trạng thái đơn',
  'order.note': 'Ghi chú đơn',
  'customer.ban': 'Khóa tài khoản',
  'customer.unban': 'Mở khóa tài khoản',
  'customer.reset': 'Gửi email đặt lại mật khẩu',
  'voucher.create': 'Tạo mã giảm giá',
  'voucher.update': 'Sửa mã giảm giá',
  'voucher.delete': 'Xóa mã giảm giá',
  'admin.add': 'Cấp quyền quản trị',
  'admin.remove': 'Gỡ quyền quản trị'
};

// ---------- Định dạng ----------
const toMs = (t) => (t?.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : Number(t) || 0);
export { toMs };
export function fmtDate(t) {
  const ms = toMs(t);
  return ms ? new Date(ms).toLocaleDateString('vi-VN') : '—';
}
export function fmtDateTime(t) {
  const ms = toMs(t);
  return ms ? new Date(ms).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}
export const num = new Intl.NumberFormat('vi-VN');
export function shortMoney(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} tr`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}
/** Ngày theo giờ máy, dạng YYYY-MM-DD (dùng làm khóa gom nhóm). */
export function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function monthKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
/** Thời điểm tính doanh thu của đơn: lúc hoàn tất (nếu có), không thì lúc đặt. */
export const revenueTime = (o) => toMs(o.doneAt) || toMs(o.createdAt);

/** Đơn có giảm giá: các đơn cũ không có trường này. */
export const orderDiscount = (o) => o.discount || 0;

// ---------- Thông báo ----------
let toastTimer;
export function toast(text, type = 'ok') {
  const box = $('#msg');
  box.textContent = text;
  box.className = `msg ${type}`;
  box.hidden = false;
  clearTimeout(toastTimer);
  if (type === 'ok') toastTimer = setTimeout(() => { box.hidden = true; }, 4000);
}
const ERR = {
  'permission-denied': 'Không có quyền thực hiện thao tác này.',
  'unavailable': 'Không kết nối được máy chủ. Vui lòng thử lại.',
  'failed-precondition': 'Thao tác bị từ chối (dữ liệu vừa thay đổi). Hãy tải lại và thử lại.',
  'auth/invalid-credential': 'Mật khẩu hiện tại không đúng.',
  'auth/wrong-password': 'Mật khẩu hiện tại không đúng.',
  'auth/weak-password': 'Mật khẩu mới phải có ít nhất 6 ký tự.',
  'auth/too-many-requests': 'Thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
  'auth/requires-recent-login': 'Hãy đăng xuất rồi đăng nhập lại trước khi đổi mật khẩu.'
};
export function errMsg(e) {
  if (e?.userMessage) return e.userMessage;   // lỗi nghiệp vụ dự kiến (không đủ hàng…): không ghi console
  console.error(e);
  return ERR[e?.code] || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}
/** Lỗi có thông điệp hiển thị cho người dùng (dùng trong transaction). */
export function userError(message) {
  const e = new Error(message);
  e.userMessage = message;
  return e;
}

export async function busy(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } finally { if (btn) btn.disabled = false; }
}

// ---------- Hộp thoại ----------
const dlg = () => $('#dlg');
/** Mở hộp thoại với nội dung HTML. Trả về phần tử thân hộp thoại. */
export function openDialog(title, html, { wide = false } = {}) {
  const d = dlg();
  d.classList.toggle('wide', wide);
  $('#dlg-title').textContent = title;
  $('#dlg-body').innerHTML = html;
  if (!d.open) d.showModal();
  const first = $('#dlg-body').querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
  if (first) first.focus();
  return $('#dlg-body');
}
export function closeDialog() { if (dlg().open) dlg().close(); }

/** Hộp thoại hỏi lại (thay confirm/prompt của trình duyệt). Trả về null nếu hủy. */
export function ask(title, message, { input = false, placeholder = '', okText = 'Đồng ý', danger = false } = {}) {
  return new Promise((resolve) => {
    const body = openDialog(title, `
      <form class="form" id="ask-form">
        <p>${esc(message)}</p>
        ${input ? `<label>Lý do / ghi chú<textarea name="v" rows="2" maxlength="300" placeholder="${esc(placeholder)}"></textarea></label>` : ''}
        <div class="dlg-actions">
          <button type="button" class="btn small" data-close>Hủy</button>
          <button type="submit" class="btn small ${danger ? 'danger' : 'primary'}">${esc(okText)}</button>
        </div>
      </form>`);
    let done = false;
    const finish = (v) => { if (done) return; done = true; dlg().removeEventListener('close', onClose); resolve(v); };
    const onClose = () => finish(null);
    dlg().addEventListener('close', onClose);
    body.querySelector('#ask-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = input ? ev.currentTarget.v.value.trim() : true;
      finish(v);
      closeDialog();
    });
  });
}

// ---------- Bảng: phân trang đơn giản ----------
export function pager(total, page, size, hrefFor) {
  const pages = Math.ceil(total / size);
  if (pages <= 1) return '';
  const out = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 2) {
      out.push(`<a href="${hrefFor(i)}" class="${i === page ? 'on' : ''}" ${i === page ? 'aria-current="page"' : ''}>${i}</a>`);
    } else if (out[out.length - 1] !== '…') out.push('…');
  }
  return `<nav class="pager" aria-label="Phân trang">${out.map((x) => (x === '…' ? '<span>…</span>' : x)).join('')}</nav>`;
}

/** Tạo href cho trang hiện tại với tham số mới. */
export function hrefWith(view, params, patch = {}) {
  const next = { ...params, ...patch };
  if (!('trang' in patch)) delete next.trang;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v !== '' && v != null) qs.set(k, v);
  const s = qs.toString();
  return `#/${view}${s ? `?${s}` : ''}`;
}

// ---------- Biểu đồ cột (SVG, 1 chuỗi số liệu) ----------
// rows: [{ label, value, tip }]. Cột bo 4px ở đầu, khoảng cách 2px, lưới mờ, tooltip khi rê chuột/chạm,
// kèm bảng số liệu (cho trình đọc màn hình và để xem chính xác).
export function barChart(rows, { title, height = 220, tickEvery = 1, valueFmt = money } = {}) {
  const W = 720, H = height, padL = 52, padR = 8, padT = 12, padB = 28;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const nice = niceMax(max);
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const slot = innerW / Math.max(1, rows.length);
  const bw = Math.max(2, slot - 2);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = padT + innerH * (1 - f);
    return `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" class="grid"/>
      <text x="${padL - 6}" y="${y + 4}" text-anchor="end" class="axis">${esc(shortMoney(nice * f))}</text>`;
  }).join('');
  const bars = rows.map((r, i) => {
    const x = padL + i * slot + 1;
    const h = r.value > 0 ? Math.max(2, (r.value / nice) * innerH) : 0;
    const y = padT + innerH - h;
    const rad = Math.min(4, bw / 2, h);
    const path = h > 0
      ? `M${x},${y + h} V${y + rad} Q${x},${y} ${x + rad},${y} H${x + bw - rad} Q${x + bw},${y} ${x + bw},${y + rad} V${y + h} Z`
      : '';
    const tip = `${r.tip || r.label}: ${valueFmt(r.value)}`;
    return `<g class="bar" data-tip="${esc(tip)}">
        <rect x="${padL + i * slot}" y="${padT}" width="${slot}" height="${innerH}" class="hit"/>
        ${path ? `<path d="${path}"/>` : ''}
      </g>
      ${i % tickEvery === 0 ? `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="axis">${esc(r.label)}</text>` : ''}`;
  }).join('');
  return `
    <figure class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title || 'Biểu đồ')}" preserveAspectRatio="none">
        ${grid}${bars}
      </svg>
      <div class="chart-tip" hidden></div>
      <details class="chart-table">
        <summary>Xem dạng bảng</summary>
        <table class="tbl"><thead><tr><th>Thời gian</th><th class="r">Giá trị</th></tr></thead>
          <tbody>${rows.map((r) => `<tr><td>${esc(r.tip || r.label)}</td><td class="r">${esc(valueFmt(r.value))}</td></tr>`).join('')}</tbody>
        </table>
      </details>
    </figure>`;
}
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
// Tooltip dùng chung cho mọi biểu đồ.
document.addEventListener('pointerover', (ev) => {
  const g = ev.target.closest?.('.chart .bar');
  const fig = ev.target.closest?.('.chart');
  if (!fig) return;
  const tip = fig.querySelector('.chart-tip');
  fig.querySelectorAll('.bar.on').forEach((b) => b.classList.remove('on'));
  if (!g) { tip.hidden = true; return; }
  g.classList.add('on');
  tip.textContent = g.dataset.tip;
  tip.hidden = false;
  const fr = fig.getBoundingClientRect();
  const br = g.getBoundingClientRect();
  const x = Math.min(Math.max(br.left - fr.left + br.width / 2, 70), fr.width - 70);
  tip.style.left = `${x}px`;
});
document.addEventListener('pointerout', (ev) => {
  const fig = ev.target.closest?.('.chart');
  if (fig && !fig.contains(ev.relatedTarget)) {
    fig.querySelector('.chart-tip').hidden = true;
    fig.querySelectorAll('.bar.on').forEach((b) => b.classList.remove('on'));
  }
});

/** Tải file CSV (mở được bằng Excel, có BOM để giữ tiếng Việt). */
export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Số đơn chờ xác nhận và số sản phẩm sắp hết hàng trên menu. */
export async function refreshBadges() {
  try {
    const [orders, products] = await Promise.all([load('orders'), load('products')]);
    const pending = orders.filter((o) => o.status === 'pending').length;
    const low = products.filter(isLow).length;
    const pb = $('#pending-badge'), lb = $('#low-badge');
    pb.textContent = pending; pb.hidden = !pending; pb.title = `${pending} đơn chờ xác nhận`;
    lb.textContent = low; lb.hidden = !low; lb.title = `${low} sản phẩm sắp hết hàng`;
  } catch { /* bỏ qua */ }
}

