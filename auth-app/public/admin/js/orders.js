// Quản lý đơn hàng: xem toàn bộ đơn, lọc theo trạng thái, tìm theo mã đơn / SĐT / email / tên,
// cập nhật trạng thái. Chuyển sang "Đã xác nhận" (hoặc sau đó) thì trừ tồn kho; hủy / trả về "Chờ xác nhận"
// thì hoàn kho. Trường stockDeducted trên đơn bảo đảm không trừ / hoàn 2 lần.
// Nhân viên CSKH chỉ đổi trạng thái theo luồng NEXT (core.js) và hoàn tiền trong hạn mức được cấp.
import {
  doc, collection, runTransaction, serverTimestamp, Timestamp, arrayUnion,
  getDoc, getDocs, query, where, writeBatch
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  db, me, load, loadAll, patchCache, audit, esc, money, num, fold, toast, errMsg, userError, busy,
  openDialog, closeDialog, ask, pager, hrefWith, fmtDateTime, toMs, STATUS, STATUS_ORDER, DEDUCTED,
  statusBadge, shortId, refreshBadges, downloadCsv, orderDiscount, NEXT, isAdminRole
} from './core.js';

const PAGE = 30;
const TABS = [
  ['', 'Tất cả'], ['pending', STATUS.pending], ['dang-xu-ly', 'Đang xử lý'],
  ['confirmed', STATUS.confirmed], ['preparing', STATUS.preparing], ['shipping', STATUS.shipping],
  ['failed', STATUS.failed], ['done', STATUS.done], ['cancelled', STATUS.cancelled]
];
const REFUND_METHODS = { bank: 'Chuyển khoản', cash: 'Tiền mặt', voucher: 'Mã giảm giá / điểm' };
const PAY = { cod: 'COD (tiền mặt khi nhận)', bank: 'Chuyển khoản' };

function matchTab(o, tt) {
  if (!tt) return true;
  if (tt === 'dang-xu-ly') return ['confirmed', 'preparing', 'shipping', 'failed'].includes(o.status);
  return o.status === tt;
}

export async function render(box, params, arg) {
  if (params.reload) await Promise.all([load('orders', true), load('users', true)]);
  const [orders, users] = await loadAll('orders', 'users');
  const emailOf = new Map(users.map((u) => [u.id, u.email]));
  const words = fold(params.q || '').replace(/^#/, '').split(/\s+/).filter(Boolean);
  const from = params.tu ? new Date(`${params.tu}T00:00:00`).getTime() : 0;
  const to = params.den ? new Date(`${params.den}T23:59:59`).getTime() : Infinity;
  const list = orders.filter((o) => {
    if (!matchTab(o, params.tt)) return false;
    const t = toMs(o.createdAt);
    if (t < from || t > to) return false;
    if (!words.length) return true;
    const h = fold([o.id, o.shipping?.name, o.shipping?.phone, o.shipping?.address, emailOf.get(o.userId), o.voucher].join(' '));
    return words.every((w) => h.includes(w));
  }).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const page = Math.max(1, Math.min(Number(params.trang) || 1, Math.ceil(list.length / PAGE) || 1));
  const rows = list.slice((page - 1) * PAGE, page * PAGE);
  const count = (tt) => orders.filter((o) => matchTab(o, tt)).length;
  const stale = orders.filter((o) => o.status === 'pending' && Date.now() - toMs(o.createdAt) > 86400000);

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Sales</p><h1>Đơn hàng</h1></div>
      <div class="head-actions">
        <button type="button" class="btn small" id="btn-csv">Tải CSV</button>
        <a class="btn small" href="${hrefWith('don-hang', params, { reload: Date.now() })}">Tải lại</a>
      </div>
    </div>
    ${stale.length ? `<p class="note">⚠ ${stale.length} đơn chờ xác nhận quá 24 giờ. <a href="${hrefWith('don-hang', {}, { tt: 'pending' })}">Xem ngay</a></p>` : ''}
    <div class="chips" aria-label="Trạng thái">
      ${TABS.map(([k, v]) => `<a class="chip ${(params.tt || '') === k ? 'on' : ''}" href="${hrefWith('don-hang', params, { tt: k })}">${esc(v)} <small>${count(k)}</small></a>`).join('')}
    </div>
    <form class="toolbar-row" id="of">
      <label class="grow"><span class="sr-only">Tìm đơn</span>
        <input name="q" type="search" placeholder="Mã đơn, số điện thoại, email, tên khách…" value="${esc(params.q || '')}"></label>
      <label class="inline">Từ <input name="tu" type="date" value="${esc(params.tu || '')}"></label>
      <label class="inline">Đến <input name="den" type="date" value="${esc(params.den || '')}"></label>
      <button class="btn small" type="submit">Tìm</button>
    </form>
    <p class="hint" role="status">${num.format(list.length)} đơn · tổng ${money(list.reduce((s, o) => s + o.total, 0))}</p>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Mã đơn</th><th>Ngày đặt</th><th>Khách hàng</th><th class="r">SP</th><th class="r">Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${rows.map((o) => `<tr>
        <td><button type="button" class="link name" data-open="${esc(o.id)}">#${esc(shortId(o.id))}</button></td>
        <td>${esc(fmtDateTime(o.createdAt))}</td>
        <td>${esc(o.shipping?.name || '')}<div class="sub">${esc(o.shipping?.phone || '')} · ${esc(emailOf.get(o.userId) || '')}</div></td>
        <td class="r">${num.format(o.items.reduce((n, i) => n + i.qty, 0))}</td>
        <td class="r">${money(o.total)}${orderDiscount(o) ? `<div class="sub">giảm ${money(o.discount)}</div>` : ''}</td>
        <td>${o.paymentMethod === 'bank' ? 'Chuyển khoản' : 'COD'}</td>
        <td>${statusBadge(o.status)}</td>
        <td class="acts">${NEXT[o.status]?.[0] ? `<button type="button" class="btn small primary" data-quick="${esc(o.id)}" data-to="${NEXT[o.status][0]}">→ ${esc(STATUS[NEXT[o.status][0]])}</button>` : ''}
          <button type="button" class="btn small" data-open="${esc(o.id)}">Xem</button></td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty">Không có đơn hàng phù hợp.</div>'}
    ${pager(list.length, page, PAGE, (i) => hrefWith('don-hang', params, { trang: i }))}`;

  const f = box.querySelector('#of');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    location.hash = hrefWith('don-hang', params, { q: f.q.value.trim(), tu: f.tu.value, den: f.den.value, reload: '' });
  });
  box.onclick = (ev) => {
    const op = ev.target.closest('[data-open]');
    if (op) return openOrder(op.dataset.open, params);
    const q = ev.target.closest('[data-quick]');
    if (q) return busy(q, () => changeStatus(q.dataset.quick, q.dataset.to, '', params));
    if (ev.target.closest('#btn-csv')) {
      downloadCsv('don-hang.csv', [
        ['Mã đơn', 'Ngày đặt', 'Trạng thái', 'Khách', 'SĐT', 'Email', 'Địa chỉ', 'Sản phẩm', 'Tạm tính', 'Phí giao', 'Mã giảm', 'Giảm', 'Tổng', 'Thanh toán', 'Ghi chú'],
        ...list.map((o) => [o.id, fmtDateTime(o.createdAt), STATUS[o.status] || o.status, o.shipping?.name, o.shipping?.phone,
          emailOf.get(o.userId) || '', o.shipping?.address, o.items.map((i) => `${i.name} x${i.qty}`).join('; '),
          o.subtotal, o.shippingFee, o.voucher || '', orderDiscount(o), o.total, PAY[o.paymentMethod] || o.paymentMethod, o.note])
      ]);
    }
  };
  if (arg) openOrder(arg, params);
}

async function openOrder(id, params) {
  const [orders, users] = await loadAll('orders', 'users');
  const o = orders.find((x) => x.id === id);
  if (!o) { toast('Không tìm thấy đơn hàng.', 'err'); return; }
  const u = users.find((x) => x.id === o.userId);
  const hist = (o.statusHistory || []).slice().sort((a, b) => toMs(a.at) - toMs(b.at));
  const body = openDialog(`Đơn #${shortId(o.id)}`, `
    <div class="order-detail">
      <div class="grid2">
        <div>
          <h3>Người nhận</h3>
          <p>${esc(o.shipping?.name)}<br>${esc(o.shipping?.phone)}<br>${esc(o.shipping?.address)}</p>
          <p class="sub">Tài khoản: ${u ? `<a href="#/khach-hang?q=${encodeURIComponent(u.email)}&mo=${encodeURIComponent(u.id)}">${esc(u.email)}</a>` : esc(o.userId)}
            · <a href="tel:${esc(o.shipping?.phone)}">Gọi khách</a></p>
        </div>
        <div>
          <h3>Thông tin đơn</h3>
          <p>Mã: <code>${esc(o.id)}</code><br>Đặt lúc: ${esc(fmtDateTime(o.createdAt))}<br>
            Thanh toán: ${esc(PAY[o.paymentMethod] || o.paymentMethod)}<br>
            Trạng thái: ${statusBadge(o.status)} ${o.stockDeducted ? '<span class="sub">(đã trừ kho)</span>' : ''}</p>
          ${o.note ? `<p class="note">Ghi chú của khách: ${esc(o.note)}</p>` : ''}
        </div>
      </div>
      <table class="tbl">
        <thead><tr><th>Sản phẩm</th><th class="r">Đơn giá</th><th class="r">SL</th><th class="r">Thành tiền</th></tr></thead>
        <tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}<div class="sub">${esc(i.productId)}</div></td>
          <td class="r">${money(i.price)}</td><td class="r">${i.qty}</td><td class="r">${money(i.price * i.qty)}</td></tr>`).join('')}</tbody>
        <tfoot>
          <tr><td colspan="3">Tạm tính</td><td class="r">${money(o.subtotal)}</td></tr>
          <tr><td colspan="3">Phí giao hàng</td><td class="r">${o.shippingFee ? money(o.shippingFee) : 'Miễn phí'}</td></tr>
          ${orderDiscount(o) ? `<tr><td colspan="3">Giảm giá (${esc(o.voucher)})</td><td class="r">−${money(o.discount)}</td></tr>` : ''}
          <tr class="total"><td colspan="3">Tổng cộng</td><td class="r">${money(o.total)}</td></tr>
        </tfoot>
      </table>

      <section id="rf-box" class="rf-box"><p class="hint">Đang tải hoàn tiền…</p></section>

      ${!isAdminRole() && !NEXT[o.status]?.length ? '<p class="hint">Đơn đã kết thúc — nhân viên CSKH không đổi được trạng thái. Cần thay đổi thì chuyển yêu cầu cho quản trị viên.</p>' : `
      <form class="form" id="sf">
        <h3>Cập nhật trạng thái</h3>
        <div class="grid2">
          <label>Trạng thái mới
            <select name="status">${(isAdminRole() ? STATUS_ORDER.filter((s) => s !== o.status) : NEXT[o.status]).map((s) => `<option value="${s}" ${NEXT[o.status]?.[0] === s ? 'selected' : ''}>${esc(STATUS[s])}${NEXT[o.status]?.includes(s) ? '' : ' (bất thường)'}</option>`).join('')}</select></label>
          <label>Ghi chú nội bộ <input name="note" maxlength="300" placeholder="vd: đã gọi xác nhận, mã vận đơn…"></label>
        </div>
        <p class="hint" id="sf-hint"></p>
        <div class="dlg-actions">
          <button type="button" class="btn small" data-close>Đóng</button>
          <button type="submit" class="btn small primary">Cập nhật</button>
        </div>
      </form>`}

      ${hist.length ? `<h3>Lịch sử xử lý</h3><ul class="timeline">${hist.map((h) => `<li>
        <span class="sub">${esc(fmtDateTime(h.at))}</span> ${statusBadge(h.status)} <span class="sub">${esc(h.byEmail || '')}</span>
        ${h.note ? `<div>${esc(h.note)}</div>` : ''}</li>`).join('')}</ul>` : ''}
    </div>`, { wide: true });

  loadRefunds(o, body.querySelector('#rf-box'), params);
  const f = body.querySelector('#sf');
  if (!f) return;
  const hint = () => {
    const s = f.status.value;
    const deduct = DEDUCTED.has(s) && !o.stockDeducted;
    const back = !DEDUCTED.has(s) && o.stockDeducted;
    body.querySelector('#sf-hint').textContent = deduct ? 'Sẽ trừ tồn kho các sản phẩm trong đơn.'
      : back ? 'Sẽ hoàn lại tồn kho các sản phẩm trong đơn.' : '';
  };
  hint();
  f.status.addEventListener('change', hint);
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const s = f.status.value;
    if (!NEXT[o.status]?.includes(s)) {
      const ok = await ask('Xác nhận', `Chuyển đơn từ "${STATUS[o.status]}" sang "${STATUS[s]}" là bước bất thường. Tiếp tục?`, { okText: 'Tiếp tục' });
      if (!ok) return openOrder(id, params);
    }
    busy(f.querySelector('[type=submit]'), () => changeStatus(id, s, f.note.value.trim(), params));
  });
}

async function changeStatus(id, next, note, params) {
  try {
    const result = await runTransaction(db, async (tx) => {
      const ref = doc(db, 'orders', id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw userError('Đơn hàng không còn tồn tại.');
      const o = snap.data();
      if (o.status === next) throw userError('Đơn đã ở trạng thái này (có thể người khác vừa cập nhật).');
      const deduct = DEDUCTED.has(next) && !o.stockDeducted;
      const restore = !DEDUCTED.has(next) && !!o.stockDeducted;
      const stockAfter = {};
      if (deduct || restore) {
        const refs = o.items.map((i) => doc(db, 'products', i.productId));
        const snaps = await Promise.all(refs.map((r) => tx.get(r)));
        o.items.forEach((it, k) => {
          const ps = snaps[k];
          if (!ps.exists()) { if (deduct) throw userError(`Sản phẩm "${it.name}" không còn tồn tại.`); return; }
          const p = ps.data();
          const stock = p.stock || 0;
          if (deduct && stock < it.qty) throw userError(`Không đủ hàng: "${it.name}" còn ${stock}, đơn cần ${it.qty}. Nhập thêm kho trước.`);
          const sign = deduct ? -1 : 1;
          const ns = stock + sign * it.qty;
          stockAfter[it.productId] = ns;
          tx.update(refs[k], { stock: ns, sold: Math.max(0, (p.sold || 0) - sign * it.qty), updatedAt: serverTimestamp() });
          tx.set(doc(collection(db, 'stockMoves')), {
            productId: it.productId, name: it.name, type: deduct ? 'order' : 'order-return', qty: sign * it.qty,
            unitCost: 0, supplier: '', note: deduct ? 'Trừ kho khi xác nhận đơn' : `Hoàn kho khi chuyển đơn sang "${STATUS[next]}"`,
            stockAfter: ns, orderId: id, by: me.uid, byEmail: me.email, at: serverTimestamp()
          });
        });
      }
      const patch = {
        status: next,
        updatedAt: serverTimestamp(),
        stockDeducted: deduct ? true : restore ? false : !!o.stockDeducted,
        statusHistory: arrayUnion({ status: next, at: Timestamp.now(), by: me.uid, byEmail: me.email, note })
      };
      if (next === 'done') patch.doneAt = serverTimestamp();
      tx.update(ref, patch);
      audit(tx, 'order.status', id, `#${shortId(id)}: ${STATUS[o.status]} → ${STATUS[next]}`
        + (deduct ? ' · trừ kho' : restore ? ' · hoàn kho' : '') + (note ? ` · ${note}` : ''));
      return { stockAfter, patch: { status: next, stockDeducted: patch.stockDeducted, from: o.status } };
    });
    // Cập nhật bộ nhớ đệm
    const orders = await load('orders');
    const o = orders.find((x) => x.id === id);
    patchCache('orders', id, {
      status: next, stockDeducted: result.patch.stockDeducted, updatedAt: Timestamp.now(),
      ...(next === 'done' ? { doneAt: Timestamp.now() } : {}),
      statusHistory: [...(o?.statusHistory || []), { status: next, at: Timestamp.now(), by: me.uid, byEmail: me.email, note }]
    });
    for (const [pid, stock] of Object.entries(result.stockAfter)) patchCache('products', pid, { stock });
    toast(`Đơn #${shortId(id)}: ${STATUS[result.patch.from]} → ${STATUS[next]}.`);
    closeDialog();
    await render(document.querySelector('#view'), { ...params, reload: '' });
    refreshBadges();
  } catch (e) { toast(errMsg(e), 'err'); }
}


// ---------- Hoàn tiền (Bảng 1.2 "Xử lý sự cố đơn hàng", Bảng 1.3: CSKH trong hạn mức) ----------
async function loadRefunds(o, box, params) {
  try {
    const [snap, set] = await Promise.all([
      getDocs(query(collection(db, 'refunds'), where('orderId', '==', o.id))),
      getDoc(doc(db, 'settings', 'support')).catch(() => null)
    ]);
    const list = snap.docs.map((d) => d.data()).sort((a, b) => toMs(a.at) - toMs(b.at));
    const done = list.reduce((s, r) => s + r.amount, 0);
    const limit = set?.exists() ? set.data().refundLimit : null;
    const left = o.total - done;
    const admin = isAdminRole();
    box.innerHTML = `
      <h3>Hoàn tiền ${done ? `· đã hoàn ${money(done)}` : ''}</h3>
      ${list.length ? `<ul class="timeline">${list.map((r) => `<li><span class="sub">${esc(fmtDateTime(r.at))} · ${esc(r.byEmail)}</span><br>
        <strong>${money(r.amount)}</strong> · ${esc(REFUND_METHODS[r.method] || r.method)} · ${esc(r.reason)}</li>`).join('')}</ul>` : ''}
      ${left <= 0 ? '<p class="hint">Đã hoàn đủ tổng tiền đơn.</p>'
        : !admin && !limit ? '<p class="hint">Quản trị viên chưa cấp hạn mức hoàn tiền cho nhân viên (Cài đặt).</p>'
        : `<details class="ph"><summary>Hoàn tiền cho khách (thiếu hàng, giao sai, lỗi thanh toán…)</summary>
        <form class="form" id="rff" novalidate>
          <div class="grid2">
            <label>Số tiền (₫) <small>${admin ? `tối đa ${money(left)}` : `hạn mức của bạn ${money(limit)}/lần`}</small>
              <input name="amount" type="number" min="1000" step="1000" required inputmode="numeric" max="${admin ? left : Math.min(left, limit)}"></label>
            <label>Hình thức <select name="method">${Object.entries(REFUND_METHODS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
          </div>
          <label>Lý do <input name="reason" required maxlength="300" placeholder="vd: Giao thiếu 1 RAM, khách đồng ý hoàn tiền"></label>
          <div class="dlg-actions"><button type="submit" class="btn small primary">Ghi nhận hoàn tiền</button></div>
        </form></details>`}`;
    const f = box.querySelector('#rff');
    f?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const amount = Number(f.amount.value);
      if (!Number.isInteger(amount) || amount <= 0) return toast('Số tiền phải là số nguyên dương.', 'err');
      if (amount > left) return toast(`Không hoàn quá số còn lại của đơn (${money(left)}).`, 'err');
      if (!admin && amount > limit) return toast(`Vượt hạn mức ${money(limit)}. Hãy chuyển yêu cầu cho quản trị viên.`, 'err');
      if (!f.reason.value.trim()) return toast('Ghi lý do hoàn tiền.', 'err');
      busy(f.querySelector('[type=submit]'), async () => {
        try {
          const batch = writeBatch(db);
          batch.set(doc(collection(db, 'refunds')), {
            orderId: o.id, userId: o.userId, amount, reason: f.reason.value.trim(), method: f.method.value,
            by: me.uid, byEmail: me.email, at: serverTimestamp()
          });
          audit(batch, 'order.refund', o.id, `#${shortId(o.id)}: ${amount} (${REFUND_METHODS[f.method.value]}) · ${f.reason.value.trim()}`);
          await batch.commit();
          toast(`Đã ghi nhận hoàn ${money(amount)} cho đơn #${shortId(o.id)}.`);
          loadRefunds(o, box, params);
        } catch (e) { toast(errMsg(e), 'err'); }
      });
    });
  } catch (e) {
    box.innerHTML = `<p class="hint">${esc(errMsg(e))}</p>`;
  }
}
