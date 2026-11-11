// Giỏ hàng gắn với tài khoản (carts/{uid}) và đặt hàng (orders/{id}).
import {
  doc, getDoc, setDoc, onSnapshot, collection, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db } from './firebase.js';
import { getProduct, thumb } from './catalog.js';
import { shippingFee, FREE_SHIP_FROM, MAX_LINES, MAX_QTY, voucherDiscount, voucherProblem } from './categories.js';
import { getProfile, saveProfile, shortId, statusText, banInfo } from './account.js';
import { $, esc, money, say, clearMsg, busy, errText, normalizePhone, validPhone } from './ui.js';

const cartRef = (uid) => doc(db, 'carts', uid);

let currentUser = null;
let items = {};            // { productId: qty }
let ready = false;         // đã nhận snapshot đầu tiên chưa
let unsub = null;
let onChange = () => {};
let voucher = null;        // mã giảm giá đang áp dụng ở trang thanh toán: { code, ...dữ liệu vouchers/{code} }

export const cartCount = () => Object.values(items).reduce((n, q) => n + q, 0);
export const cartReady = () => ready;

function updateBadge() {
  const n = cartCount();
  const b = $('#cart-count');
  b.textContent = n;
  b.hidden = n === 0;
}

/** Bắt đầu đồng bộ giỏ hàng của user (gọi khi đăng nhập). */
export function startCart(user, changed) {
  stopCart();
  currentUser = user;
  onChange = changed || (() => {});
  unsub = onSnapshot(cartRef(user.uid), (snap) => {
    items = snap.exists() ? { ...(snap.data().items || {}) } : {};
    ready = true;
    updateBadge();
    onChange();
  }, (e) => say(errText(e), 'err'));
}

export function stopCart() {
  if (unsub) unsub();
  unsub = null;
  currentUser = null;
  items = {};
  ready = false;
  updateBadge();
}

async function saveItems(next) {
  await setDoc(cartRef(currentUser.uid), { items: next, updatedAt: serverTimestamp() });
}

/** Thêm sản phẩm. Trả về true nếu thành công. */
export async function addToCart(productId, qty = 1) {
  if (!currentUser) throw new Error('not-signed-in');
  if (banInfo()) { say('Tài khoản đã bị khóa nên không thêm được vào giỏ hàng.', 'err'); return false; }
  const p = await getProduct(productId, true);
  if (!p || !(p.stock > 0)) { say('Sản phẩm đã hết hàng.', 'err'); return false; }
  const next = { ...items };
  if (!next[productId] && Object.keys(next).length >= MAX_LINES) {
    say(`Giỏ hàng tối đa ${MAX_LINES} loại sản phẩm. Hãy đặt đơn này trước.`, 'err');
    return false;
  }
  const limit = Math.min(p.stock, MAX_QTY);
  const want = (next[productId] || 0) + Math.max(1, Math.floor(qty));
  next[productId] = Math.min(want, limit);
  await saveItems(next);
  say(want > limit
    ? `Đã thêm. Mỗi sản phẩm tối đa ${limit} chiếc.`
    : `Đã thêm "${p.name}" vào giỏ.`);
  return true;
}

async function setQty(productId, qty) {
  const next = { ...items };
  if (qty <= 0) delete next[productId];
  else next[productId] = qty;
  await saveItems(next);
}

/** Ghép giỏ với dữ liệu sản phẩm. fresh=true: đọc lại giá/tồn kho mới nhất. */
async function lines(fresh = false) {
  const out = await Promise.all(Object.entries(items).map(async ([id, qty]) => {
    const p = await getProduct(id, fresh);
    return { id, qty, p };
  }));
  return out;
}

function totals(ls, v = null) {
  const subtotal = ls.reduce((s, l) => s + (l.p && l.p.stock > 0 ? l.p.price * l.qty : 0), 0);
  const ship = subtotal > 0 ? shippingFee(subtotal) : 0;
  const discount = v && !voucherProblem(v, subtotal) ? voucherDiscount(v, subtotal) : 0;
  return { subtotal, ship, discount, total: subtotal + ship - discount };
}

function summaryHtml({ subtotal, ship, discount = 0, total }, button) {
  return `
    <aside class="summary card">
      <div class="row"><span>Tạm tính</span><span>${money(subtotal)}</span></div>
      <div class="row"><span>Phí giao hàng</span><span>${ship ? money(ship) : 'Miễn phí'}</span></div>
      ${discount ? `<div class="row"><span>Giảm giá (${esc(voucher?.code || '')})</span><span>−${money(discount)}</span></div>` : ''}
      ${subtotal && subtotal < FREE_SHIP_FROM
        ? `<p class="hint">Mua thêm ${money(FREE_SHIP_FROM - subtotal)} để được miễn phí giao hàng.</p>` : ''}
      <div class="row total"><span>Tổng cộng</span><strong>${money(total)}</strong></div>
      ${button}
    </aside>`;
}

// ---------- Trang giỏ hàng ----------
export async function renderCart() {
  const view = $('#view-cart');
  if (!ready) { view.innerHTML = '<p class="loading">Đang tải giỏ hàng…</p>'; return; }
  const ls = await lines();
  if (!ls.length) {
    view.innerHTML = `
      <h1>Giỏ hàng</h1>
      <div class="empty">Giỏ hàng đang trống. <a href="#/">Tiếp tục mua sắm</a></div>`;
    return;
  }
  const bad = ls.some((l) => !l.p || !(l.p.stock > 0) || l.qty > l.p.stock);
  view.innerHTML = `
    <h1>Giỏ hàng (${cartCount()})</h1>
    <div class="cart-layout">
      <div class="cart-lines card">
        ${ls.map(({ id, qty, p }) => {
          if (!p) {
            return `<div class="line"><div class="line-info"><p>Sản phẩm không còn bán.</p></div>
              <button type="button" class="link danger" data-remove="${esc(id)}">Xóa</button></div>`;
          }
          const out = !(p.stock > 0);
          const max = Math.min(p.stock, MAX_QTY);
          return `
          <div class="line">
            <a href="#/sp/${esc(id)}">${thumb(p, 'mini')}</a>
            <div class="line-info">
              <a href="#/sp/${esc(id)}" class="pname">${esc(p.name)}</a>
              <span class="hint">${money(p.price)}</span>
              ${out ? '<span class="stock out">Hết hàng</span>'
                : qty > p.stock ? `<span class="stock out">Chỉ còn ${p.stock}</span>` : ''}
            </div>
            <div class="stepper" role="group" aria-label="Số lượng ${esc(p.name)}">
              <button type="button" data-step="${esc(id)}" data-d="-1" aria-label="Giảm 1">−</button>
              <span aria-live="polite">${qty}</span>
              <button type="button" data-step="${esc(id)}" data-d="1" aria-label="Tăng 1" ${qty >= max ? 'disabled' : ''}>+</button>
            </div>
            <strong class="line-total">${money(p.price * qty)}</strong>
            <button type="button" class="link danger" data-remove="${esc(id)}" aria-label="Xóa ${esc(p.name)} khỏi giỏ">✕</button>
          </div>`;
        }).join('')}
      </div>
      ${summaryHtml(totals(ls), bad
        ? '<p class="msg err">Có sản phẩm hết hàng hoặc vượt tồn kho. Hãy chỉnh lại giỏ.</p>'
        : '<a class="btn primary" href="#/thanh-toan">Tiến hành đặt hàng</a>')}
    </div>`;
}

// ---------- Trang thanh toán ----------
export async function renderCheckout() {
  const view = $('#view-checkout');
  if (!ready) { view.innerHTML = '<p class="loading">Đang tải…</p>'; return; }
  const ban = banInfo();
  if (ban) {
    view.innerHTML = `<h1>Thanh toán</h1><p class="msg err">Tài khoản của bạn đã bị khóa nên không đặt hàng được${
      ban.reason ? ` (lý do: ${esc(ban.reason)})` : ''}. Vui lòng liên hệ bộ phận chăm sóc khách hàng.</p>`;
    return;
  }
  const ls = await lines(true);
  if (!ls.length) { location.hash = '#/gio-hang'; return; }
  if (ls.length > MAX_LINES) {
    say(`Mỗi đơn tối đa ${MAX_LINES} loại sản phẩm. Hãy bớt sản phẩm trong giỏ.`, 'err');
    location.hash = '#/gio-hang';
    return;
  }
  if (ls.some((l) => !l.p || !(l.p.stock > 0) || l.qty > l.p.stock)) {
    say('Có sản phẩm hết hàng hoặc vượt tồn kho. Hãy chỉnh lại giỏ.', 'err');
    location.hash = '#/gio-hang';
    return;
  }
  const pr = getProfile() || {};
  if (voucher && voucherProblem(voucher, totals(ls).subtotal)) voucher = null;
  const t = totals(ls, voucher);
  view.innerHTML = `
    <h1>Thanh toán</h1>
    <form id="form-checkout" class="cart-layout" novalidate>
      <div class="card form">
        <h2>1. Người nhận</h2>
        <label>Họ tên <input name="name" required maxlength="100" autocomplete="name" value="${esc(pr.name || '')}"></label>
        <label>Số điện thoại <input name="phone" type="tel" required maxlength="15" autocomplete="tel" inputmode="tel" value="${esc(pr.phone || '')}"></label>
        <label>Địa chỉ giao hàng
          <textarea name="address" rows="2" required maxlength="300" autocomplete="street-address"
            placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành">${esc(pr.address || '')}</textarea>
        </label>
        <label class="check"><input type="checkbox" name="save" ${pr.phone && pr.address ? '' : 'checked'}> Lưu thông tin này vào hồ sơ</label>

        <h2>2. Thanh toán</h2>
        <label class="check"><input type="radio" name="pay" value="cod" checked> Thanh toán khi nhận hàng (COD)</label>
        <label class="check"><input type="radio" name="pay" value="bank"> Chuyển khoản ngân hàng (nhân viên sẽ gửi thông tin sau khi xác nhận đơn)</label>

        <h2>3. Ghi chú</h2>
        <textarea name="note" rows="2" maxlength="300" placeholder="Ví dụ: giao giờ hành chính"></textarea>
      </div>
      <div>
        <div class="card">
          <h2>Đơn hàng (${cartCount()} sản phẩm)</h2>
          <ul class="order-items">
            ${ls.map(({ qty, p }) => `<li><span>${esc(p.name)} × ${qty}</span><span>${money(p.price * qty)}</span></li>`).join('')}
          </ul>
          <div class="voucher-row">
            <label for="voucher-code" class="sr-only">Mã giảm giá</label>
            <input id="voucher-code" name="voucher" maxlength="30" placeholder="Mã giảm giá" autocomplete="off"
              value="${esc(voucher?.code || '')}" style="text-transform: uppercase">
            <button type="button" id="btn-voucher" class="btn small">${voucher ? 'Bỏ mã' : 'Áp dụng'}</button>
          </div>
          <p id="voucher-msg" class="hint" role="status">${voucher ? `Đã áp dụng mã ${esc(voucher.code)}.` : ''}</p>
        </div>
        ${summaryHtml(t, '<button type="submit" class="btn primary">Đặt hàng</button>')}
      </div>
    </form>`;

  $('#form-checkout').addEventListener('submit', (ev) => {
    ev.preventDefault();
    placeOrder(ev.currentTarget);
  });
  $('#voucher-code').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); $('#btn-voucher').click(); }
  });
  $('#btn-voucher').addEventListener('click', (ev) => busy(ev.currentTarget, () => applyVoucher(ls)));
}

async function applyVoucher(ls) {
  const msg = $('#voucher-msg');
  if (voucher) { voucher = null; return renderCheckout(); }
  const code = $('#voucher-code').value.trim().toUpperCase();
  if (!code) { msg.textContent = 'Nhập mã giảm giá.'; return; }
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) { msg.textContent = 'Mã giảm giá không tồn tại hoặc đã ngừng áp dụng.'; return; }
  try {
    const snap = await getDoc(doc(db, 'vouchers', code));
    const v = snap.exists() ? { ...snap.data(), code } : null;
    const problem = voucherProblem(v, totals(ls).subtotal);
    if (problem) { msg.textContent = problem; return; }
    voucher = v;
    await renderCheckout();
    say(`Đã áp dụng mã ${code}: giảm ${money(voucherDiscount(v, totals(ls).subtotal))}.`);
  } catch (e) {
    msg.textContent = errText(e);
  }
}

async function placeOrder(f) {
  clearMsg();
  const name = f.name.value.trim();
  const phone = normalizePhone(f.phone.value.trim());
  const address = f.address.value.trim();
  const note = f.note.value.trim();
  if (!name || !address) return say('Vui lòng nhập đủ họ tên và địa chỉ.', 'err');
  if (!validPhone(phone)) return say('Số điện thoại không hợp lệ (VD: 0912345678).', 'err');

  await busy(f.querySelector('[type=submit]'), async () => {
    try {
      // Đọc lại giá & tồn kho mới nhất ngay trước khi đặt. Security Rules cũng kiểm tra lại.
      const ls = await lines(true);
      if (!ls.length) { location.hash = '#/gio-hang'; return; }
      const bad = ls.find((l) => !l.p || !(l.p.stock > 0) || l.qty > l.p.stock);
      if (bad) {
        say('Có sản phẩm vừa hết hàng. Vui lòng kiểm tra lại giỏ.', 'err');
        location.hash = '#/gio-hang';
        return;
      }
      const orderItems = ls.map(({ id, qty, p }) => ({ productId: id, name: p.name, price: p.price, qty }));
      if (voucher && voucherProblem(voucher, totals(ls).subtotal)) {
        voucher = null;
        say('Mã giảm giá không còn áp dụng được cho đơn này. Hãy kiểm tra lại tổng tiền.', 'err');
        await renderCheckout();
        return;
      }
      const { subtotal, ship, discount, total } = totals(ls, voucher);

      const orderRef = doc(collection(db, 'orders'));
      const batch = writeBatch(db);
      batch.set(orderRef, {
        userId: currentUser.uid,
        items: orderItems,
        subtotal,
        shippingFee: ship,
        total,
        shipping: { name, phone, address },
        paymentMethod: f.pay.value,
        note,
        voucher: discount ? voucher.code : '',
        discount,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      batch.set(cartRef(currentUser.uid), { items: {}, updatedAt: serverTimestamp() });
      await batch.commit();
      voucher = null;

      if (f.save.checked) {
        saveProfile(currentUser, { name, phone, address }).catch(console.error);
      }
      location.hash = `#/dat-hang-thanh-cong/${orderRef.id}`;
    } catch (e) {
      say(errText(e), 'err');
    }
  });
}

// ---------- Đặt hàng thành công ----------
export async function renderDone(orderId) {
  const view = $('#view-done');
  try {
    const snap = await getDoc(doc(db, 'orders', orderId));
    if (!snap.exists()) throw new Error('not-found');
    const o = snap.data();
    view.innerHTML = `
      <div class="card narrow-card">
        <h1>Đặt hàng thành công 🎉</h1>
        <p>Mã đơn: <strong>#${esc(shortId(orderId))}</strong> · Trạng thái: <strong>${esc(statusText(o.status))}</strong></p>
        <p class="hint">Chúng tôi sẽ gọi số <strong>${esc(o.shipping.phone)}</strong> để xác nhận đơn.</p>
        <ul class="order-items">
          ${o.items.map((i) => `<li><span>${esc(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></li>`).join('')}
        </ul>
        ${o.discount ? `<div class="row"><span>Giảm giá (${esc(o.voucher)})</span><span>−${money(o.discount)}</span></div>` : ''}
        <div class="row total"><span>Tổng cộng (${o.paymentMethod === 'cod' ? 'COD' : 'chuyển khoản'})</span><strong>${money(o.total)}</strong></div>
        <div class="actions">
          <a class="btn" href="#/tai-khoan">Xem đơn hàng</a>
          <a class="btn primary" href="#/">Tiếp tục mua sắm</a>
        </div>
      </div>`;
  } catch (e) {
    view.innerHTML = `<div class="empty">Không xem được đơn hàng. <a href="#/tai-khoan">Đơn hàng của tôi</a></div>`;
  }
}

// ---------- Sự kiện trong trang giỏ ----------
export function initCart() {
  $('#view-cart').addEventListener('click', (ev) => {
    const step = ev.target.closest('[data-step]');
    const rm = ev.target.closest('[data-remove]');
    if (step) {
      const id = step.dataset.step;
      busy(step, () => setQty(id, (items[id] || 0) + Number(step.dataset.d)).catch((e) => say(errText(e), 'err')));
    } else if (rm) {
      busy(rm, () => setQty(rm.dataset.remove, 0).catch((e) => say(errText(e), 'err')));
    }
  });
}
