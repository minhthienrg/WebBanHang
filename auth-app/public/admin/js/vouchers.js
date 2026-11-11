// Mã giảm giá: theo % hoặc số tiền, đơn tối thiểu, mức giảm tối đa, thời gian áp dụng, bật/tắt.
// Khách nhập mã ở trang thanh toán; Security Rules kiểm tra lại số tiền giảm khi tạo đơn.
import {
  doc, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  db, load, loadAll, patchCache, audit, esc, money, num, toast, errMsg, busy, openDialog, closeDialog, ask,
  fmtDateTime, toMs, hrefWith
} from './core.js';

function stateOf(v, now = Date.now()) {
  if (!v.active) return ['Đã tắt', 's-cancelled'];
  if (toMs(v.startAt) > now) return ['Sắp diễn ra', 's-pending'];
  if (toMs(v.endAt) < now) return ['Hết hạn', 's-cancelled'];
  return ['Đang áp dụng', 's-done'];
}
const describe = (v) => (v.type === 'percent'
  ? `Giảm ${v.value}%${v.maxDiscount ? `, tối đa ${money(v.maxDiscount)}` : ''}`
  : `Giảm ${money(v.value)}`) + (v.minOrder ? ` · đơn từ ${money(v.minOrder)}` : '');

export async function render(box, params) {
  if (params.reload) await Promise.all([load('vouchers', true), load('orders', true)]);
  const [vouchers, orders] = await loadAll('vouchers', 'orders');
  const used = new Map();
  for (const o of orders) {
    if (!o.voucher || o.status === 'cancelled') continue;
    const u = used.get(o.voucher) || { n: 0, sum: 0 };
    u.n++; u.sum += o.discount || 0;
    used.set(o.voucher, u);
  }
  const list = [...vouchers].sort((a, b) => toMs(b.endAt) - toMs(a.endAt));

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Marketing</p><h1>Mã giảm giá</h1></div>
      <div class="head-actions">
        <a class="btn small" href="${hrefWith('khuyen-mai', params, { reload: Date.now() })}">Tải lại</a>
        <button type="button" class="btn small primary" id="btn-new">+ Tạo mã</button>
      </div>
    </div>
    <p class="hint">Giá khuyến mãi của từng sản phẩm (giá gốc gạch ngang) đặt trong <a href="#/san-pham">Sản phẩm</a>
      → Sửa → “Giá gốc”, hoặc chọn nhiều sản phẩm → “Đổi giá hàng loạt”.</p>
    ${list.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Mã</th><th>Ưu đãi</th><th>Thời gian áp dụng</th><th class="r">Đã dùng</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${list.map((v) => {
        const [label, cls] = stateOf(v);
        const u = used.get(v.id) || { n: 0, sum: 0 };
        return `<tr>
          <td><strong class="code">${esc(v.id)}</strong>${v.description ? `<div class="sub">${esc(v.description)}</div>` : ''}</td>
          <td>${esc(describe(v))}</td>
          <td>${esc(fmtDateTime(v.startAt))} → ${esc(fmtDateTime(v.endAt))}</td>
          <td class="r">${num.format(u.n)} đơn<div class="sub">${money(u.sum)}</div></td>
          <td><span class="status ${cls}">${label}</span></td>
          <td class="acts">
            <button type="button" class="btn small" data-toggle="${esc(v.id)}">${v.active ? 'Tắt' : 'Bật'}</button>
            <button type="button" class="btn small" data-edit="${esc(v.id)}">Sửa</button>
            <button type="button" class="btn small danger" data-del="${esc(v.id)}">Xóa</button>
          </td></tr>`;
      }).join('')}</tbody>
    </table></div>` : '<div class="empty">Chưa có mã giảm giá nào.</div>'}`;

  box.querySelector('#btn-new').addEventListener('click', () => editVoucher(null, params));
  box.onclick = async (ev) => {
    const e = ev.target.closest('[data-edit]');
    if (e) return editVoucher(vouchers.find((v) => v.id === e.dataset.edit), params);
    const t = ev.target.closest('[data-toggle]');
    if (t) {
      const v = vouchers.find((x) => x.id === t.dataset.toggle);
      return busy(t, () => save(v.id, { ...strip(v), active: !v.active }, 'voucher.update', `${v.id}: ${v.active ? 'tắt' : 'bật'}`, params));
    }
    const d = ev.target.closest('[data-del]');
    if (d) {
      const ok = await ask('Xóa mã giảm giá', `Xóa mã ${d.dataset.del}? Đơn đã dùng mã vẫn giữ nguyên số tiền giảm.`, { okText: 'Xóa', danger: true });
      if (!ok) return;
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'vouchers', d.dataset.del));
        audit(batch, 'voucher.delete', d.dataset.del, d.dataset.del);
        await batch.commit();
        patchCache('vouchers', d.dataset.del, null);
        toast(`Đã xóa mã ${d.dataset.del}.`);
        await render(box, { ...params, reload: '' });
      } catch (err) { toast(errMsg(err), 'err'); }
    }
  };
}

function strip(v) {
  const { id, ...rest } = v;
  return rest;
}

const toLocalInput = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function editVoucher(v, params) {
  const isNew = !v;
  const now = Date.now();
  v = v || { type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, active: true, description: '' };
  const body = openDialog(isNew ? 'Tạo mã giảm giá' : `Sửa mã ${v.id}`, `
    <form class="form" id="vf" novalidate>
      ${isNew ? `<label>Mã <small>3–30 ký tự: chữ in hoa, số, “-” hoặc “_”</small>
        <input name="code" required maxlength="30" pattern="[A-Z0-9_-]{3,30}" placeholder="vd: SALE11" style="text-transform:uppercase"></label>` : ''}
      <label>Mô tả (nội bộ) <input name="description" maxlength="200" value="${esc(v.description || '')}" placeholder="vd: Ngày độc thân 11/11"></label>
      <div class="grid2">
        <label>Loại
          <select name="type">
            <option value="percent" ${v.type === 'percent' ? 'selected' : ''}>Giảm theo % tạm tính</option>
            <option value="fixed" ${v.type === 'fixed' ? 'selected' : ''}>Giảm số tiền cố định</option>
          </select></label>
        <label>Giá trị <small id="unit">${v.type === 'percent' ? '(%)' : '(₫)'}</small>
          <input name="value" type="number" min="1" step="1" required inputmode="numeric" value="${v.value}"></label>
      </div>
      <div class="grid2">
        <label>Đơn tối thiểu (₫) <input name="minOrder" type="number" min="0" step="1000" inputmode="numeric" value="${v.minOrder}"></label>
        <label>Giảm tối đa (₫) <small>0 = không giới hạn</small><input name="maxDiscount" type="number" min="0" step="1000" inputmode="numeric" value="${v.maxDiscount}"></label>
      </div>
      <div class="grid2">
        <label>Bắt đầu <input name="startAt" type="datetime-local" required value="${toLocalInput(toMs(v.startAt) || now)}"></label>
        <label>Kết thúc <input name="endAt" type="datetime-local" required value="${toLocalInput(toMs(v.endAt) || now + 7 * 86400000)}"></label>
      </div>
      <label class="check"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> Đang bật</label>
      <div class="dlg-actions">
        <button type="button" class="btn small" data-close>Hủy</button>
        <button type="submit" class="btn small primary">${isNew ? 'Tạo mã' : 'Lưu'}</button>
      </div>
    </form>`);
  const f = body.querySelector('#vf');
  f.type.addEventListener('change', () => { body.querySelector('#unit').textContent = f.type.value === 'percent' ? '(%)' : '(₫)'; });
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const code = isNew ? f.code.value.trim().toUpperCase() : v.id;
    const value = Number(f.value.value), minOrder = Number(f.minOrder.value || 0), maxDiscount = Number(f.maxDiscount.value || 0);
    const start = new Date(f.startAt.value).getTime(), end = new Date(f.endAt.value).getTime();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return toast('Mã gồm 3–30 ký tự: chữ in hoa không dấu, số, “-” hoặc “_”.', 'err');
    if (!Number.isInteger(value) || value < 1) return toast('Giá trị giảm phải là số nguyên dương.', 'err');
    if (f.type.value === 'percent' && value > 100) return toast('Giảm theo % tối đa 100.', 'err');
    if (![minOrder, maxDiscount].every((x) => Number.isInteger(x) && x >= 0)) return toast('Số tiền phải là số nguyên ≥ 0.', 'err');
    if (!start || !end || end <= start) return toast('Thời gian kết thúc phải sau thời gian bắt đầu.', 'err');
    busy(f.querySelector('[type=submit]'), async () => {
      if (isNew) {
        const all = await load('vouchers');
        if (all.some((x) => x.id === code)) return toast(`Mã ${code} đã tồn tại.`, 'err');
      }
      const data = {
        code, type: f.type.value, value, minOrder, maxDiscount,
        startAt: Timestamp.fromMillis(start), endAt: Timestamp.fromMillis(end),
        active: f.active.checked, description: f.description.value.trim(),
        updatedAt: serverTimestamp()
      };
      await save(code, data, isNew ? 'voucher.create' : 'voucher.update', `${code}: ${describe(data)}`, params);
      closeDialog();
    });
  });
}

async function save(code, data, action, detail, params) {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'vouchers', code), { ...data, updatedAt: serverTimestamp() });
    audit(batch, action, code, detail);
    await batch.commit();
    patchCache('vouchers', code, { ...data, updatedAt: Timestamp.now() });
    toast(`Đã lưu mã ${code}.`);
    await render(document.querySelector('#view'), { ...params, reload: '' });
  } catch (e) { toast(errMsg(e), 'err'); }
}
