// Bảo hành (Bảng 1.2 "Xử lý bảo hành", Bảng 3.1 mục 9): tạo phiếu từ đơn đã mua, theo dõi trạng thái gửi
// trung tâm bảo hành, cập nhật tiến độ (khách xem ở trang tài khoản); tra cứu theo serial / SĐT / email
// và tính hạn bảo hành từ ngày mua + thời gian bảo hành của sản phẩm.
import {
  doc, collection, writeBatch, serverTimestamp, Timestamp, arrayUnion
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  db, me, load, loadAll, patchCache, audit, esc, num, fold, toast, errMsg, busy, openDialog, closeDialog,
  hrefWith, fmtDate, fmtDateTime, toMs, shortId
} from './core.js';
import { WARRANTY_STATUS } from '../../js/categories.js';

const OPEN = (w) => !['done', 'rejected'].includes(w.status);

/** Số tháng bảo hành của sản phẩm: trường warrantyMonths hoặc thông số "Bảo hành: 36 tháng". */
function warrantyMonths(p) {
  if (Number.isFinite(p?.warrantyMonths)) return p.warrantyMonths;
  const m = String(p?.specs?.['Bảo hành'] || '').match(/(\d+)\s*tháng/i);
  return m ? Number(m[1]) : null;
}
function expiry(order, product) {
  const months = warrantyMonths(product);
  const start = toMs(order?.doneAt) || toMs(order?.createdAt);
  if (!months || !start) return null;
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return { months, until: d.getTime(), valid: d.getTime() >= Date.now() };
}

export async function render(box, params, arg) {
  if (params.reload) await load('warranties', true);
  const [list, orders, products, users] = await loadAll('warranties', 'orders', 'products', 'users');
  const words = fold(params.q || '').split(/\s+/).filter(Boolean);
  const shown = list.filter((w) => (params.tt === 'xong' ? !OPEN(w) : params.tt === 'tat-ca' ? true : OPEN(w))
    && (!words.length || words.every((x) => fold(`${w.serial} ${w.phone} ${w.email} ${w.customerName} ${w.productName} ${w.id} ${w.orderId}`).includes(x))))
    .sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));

  // Tra cứu theo serial / SĐT / email: liệt kê cả sản phẩm đã mua (để biết còn hạn không).
  let lookup = '';
  if (words.length) {
    const q = fold(params.q);
    const buyers = users.filter((u) => fold(`${u.phone} ${u.email}`).includes(q)).map((u) => u.id);
    const bought = orders.filter((o) => o.status === 'done' && (buyers.includes(o.userId) || fold(o.shipping?.phone || '').includes(q)));
    if (bought.length) {
      lookup = `<section class="card block-gap"><h2>Sản phẩm đã mua (${bought.length} đơn hoàn tất)</h2>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Sản phẩm</th><th>Đơn</th><th>Ngày mua</th><th>Hạn bảo hành</th><th></th></tr></thead>
        <tbody>${bought.flatMap((o) => o.items.map((i) => {
          const ex = expiry(o, products.find((p) => p.id === i.productId));
          return `<tr><td>${esc(i.name)}</td><td><a href="#/don-hang/${esc(o.id)}">#${esc(shortId(o.id))}</a></td>
            <td>${esc(fmtDate(o.doneAt || o.createdAt))}</td>
            <td>${ex ? `<span class="${ex.valid ? 'pos' : 'neg'}">${ex.valid ? 'Còn hạn' : 'Hết hạn'} đến ${esc(fmtDate(ex.until))}</span><div class="sub">${ex.months} tháng</div>` : '<span class="sub">Chưa rõ</span>'}</td>
            <td><button type="button" class="btn small" data-new="${esc(o.id)}" data-pid="${esc(i.productId)}">Tạo phiếu</button></td></tr>`;
        })).join('')}</tbody></table></div></section>`;
    }
  }

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Chăm sóc khách hàng</p><h1>Bảo hành</h1></div>
      <div class="head-actions">
        <a class="btn small" href="${hrefWith('bao-hanh', params, { reload: Date.now() })}">Tải lại</a>
        <button type="button" class="btn small primary" id="btn-new">+ Tạo phiếu bảo hành</button>
      </div>
    </div>
    <div class="chips">
      ${[['', 'Đang xử lý', list.filter(OPEN).length], ['xong', 'Đã xong / từ chối', list.filter((w) => !OPEN(w)).length], ['tat-ca', 'Tất cả', list.length]]
        .map(([k, v, n]) => `<a class="chip ${(params.tt || '') === k ? 'on' : ''}" href="${hrefWith('bao-hanh', params, { tt: k })}">${v} <small>${n}</small></a>`).join('')}
    </div>
    <form class="toolbar-row" id="wf">
      <label class="grow"><span class="sr-only">Tra cứu bảo hành</span>
        <input name="q" type="search" placeholder="Tra cứu theo số serial, số điện thoại, email, tên sản phẩm…" value="${esc(params.q || '')}"></label>
      <button class="btn small" type="submit">Tra cứu</button>
    </form>
    ${lookup}
    <p class="hint">${num.format(shown.length)} phiếu</p>
    ${shown.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Phiếu</th><th>Sản phẩm</th><th>Khách</th><th>Lỗi</th><th>Trạng thái</th><th>Cập nhật</th><th></th></tr></thead>
      <tbody>${shown.map((w) => `<tr>
        <td>#${esc(shortId(w.id))}<div class="sub">${esc(fmtDate(w.createdAt))}</div></td>
        <td>${esc(w.productName)}<div class="sub">${w.serial ? `SN ${esc(w.serial)}` : 'Chưa có serial'}${w.orderId ? ` · đơn #${esc(shortId(w.orderId))}` : ''}</div></td>
        <td>${esc(w.customerName || '')}<div class="sub">${esc(w.phone || '')}</div></td>
        <td class="detail-cell">${esc(w.issue || '')}</td>
        <td><span class="status wr-${esc(w.status)}">${esc(WARRANTY_STATUS[w.status] || w.status)}</span>${w.center ? `<div class="sub">${esc(w.center)}</div>` : ''}</td>
        <td class="nowrap">${esc(fmtDateTime(w.updatedAt))}</td>
        <td><button type="button" class="btn small" data-open="${esc(w.id)}">Cập nhật</button></td></tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty">Không có phiếu bảo hành.</div>'}`;

  const f = box.querySelector('#wf');
  f.addEventListener('submit', (ev) => { ev.preventDefault(); location.hash = hrefWith('bao-hanh', params, { q: f.q.value.trim(), tt: f.q.value.trim() ? 'tat-ca' : params.tt }); });
  box.querySelector('#btn-new').addEventListener('click', () => createWarranty(params));
  box.onclick = (ev) => {
    const o = ev.target.closest('[data-open]');
    if (o) return updateWarranty(list.find((w) => w.id === o.dataset.open), params);
    const n = ev.target.closest('[data-new]');
    if (n) return createWarranty(params, n.dataset.new, n.dataset.pid);
  };
  if (arg) { const w = list.find((x) => x.id === arg); if (w) updateWarranty(w, params); }
  if (params.moi) createWarranty(params, params.moi);
}

async function createWarranty(params, orderId = '', productId = '') {
  const [orders, products, users] = await loadAll('orders', 'products', 'users');
  const order = orders.find((o) => o.id === orderId);
  const body = openDialog('Tạo phiếu bảo hành', `
    <form class="form" id="cw" novalidate>
      <label>Email khách <input name="email" type="email" required list="dl-wc" value="${esc(order ? users.find((u) => u.id === order.userId)?.email || '' : '')}"></label>
      <datalist id="dl-wc">${users.map((u) => `<option value="${esc(u.email)}">${esc(u.name || '')}</option>`).join('')}</datalist>
      <label>Sản phẩm (từ đơn đã mua) <select name="line"></select></label>
      <p class="hint" id="cw-exp"></p>
      <div class="grid2">
        <label>Số serial <input name="serial" maxlength="60" placeholder="In trên tem sản phẩm"></label>
        <label>Trung tâm bảo hành <input name="center" maxlength="100" placeholder="vd: Trung tâm BH ASUS Q.10"></label>
      </div>
      <label>Mô tả lỗi <textarea name="issue" rows="3" maxlength="1000" required></textarea></label>
      <div class="dlg-actions"><button type="button" class="btn small" data-close>Hủy</button>
        <button type="submit" class="btn small primary">Tạo phiếu</button></div>
    </form>`);
  const f = body.querySelector('#cw');
  const lines = () => {
    const u = users.find((x) => (x.email || '').toLowerCase() === f.email.value.trim().toLowerCase());
    const own = u ? orders.filter((o) => o.userId === u.id && ['done', 'shipping', 'failed'].includes(o.status)) : [];
    f.line.innerHTML = own.flatMap((o) => o.items.map((i) => {
      const v = `${o.id}|${i.productId}`;
      return `<option value="${esc(v)}" ${o.id === orderId && (!productId || i.productId === productId) ? 'selected' : ''}>${esc(i.name)} — đơn #${esc(shortId(o.id))} (${esc(fmtDate(o.doneAt || o.createdAt))})</option>`;
    })).join('') || '<option value="">Khách chưa có đơn đã giao</option>';
    showExp();
  };
  const showExp = () => {
    const [oid, pid] = f.line.value.split('|');
    const ex = expiry(orders.find((o) => o.id === oid), products.find((p) => p.id === pid));
    body.querySelector('#cw-exp').innerHTML = !oid ? '' : ex
      ? `<span class="${ex.valid ? 'pos' : 'neg'}">${ex.valid ? 'Còn hạn' : 'ĐÃ HẾT HẠN'} bảo hành (${ex.months} tháng) đến ${esc(fmtDate(ex.until))}.</span>`
      : 'Chưa rõ thời hạn bảo hành của sản phẩm này.';
  };
  lines();
  f.email.addEventListener('change', lines);
  f.line.addEventListener('change', showExp);
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const u = users.find((x) => (x.email || '').toLowerCase() === f.email.value.trim().toLowerCase());
    const [oid, pid] = f.line.value.split('|');
    const o = orders.find((x) => x.id === oid);
    const item = o?.items.find((i) => i.productId === pid);
    if (!u || !item) return toast('Chọn khách và sản phẩm đã mua.', 'err');
    if (!f.issue.value.trim()) return toast('Mô tả lỗi sản phẩm.', 'err');
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        const ref = doc(collection(db, 'warranties'));
        const data = {
          userId: u.id, customerName: (u.name || o.shipping?.name || '').slice(0, 100), phone: u.phone || o.shipping?.phone || '', email: u.email,
          orderId: oid, productId: pid, productName: item.name, serial: f.serial.value.trim(), issue: f.issue.value.trim(),
          center: f.center.value.trim(), status: 'received',
          history: [{ status: 'received', note: 'Tiếp nhận sản phẩm', at: Timestamp.now(), byEmail: me.email }],
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(), by: me.uid
        };
        const batch = writeBatch(db);
        batch.set(ref, data);
        audit(batch, 'warranty.create', ref.id, `${item.name} · ${u.email}${data.serial ? ` · SN ${data.serial}` : ''}`);
        await batch.commit();
        patchCache('warranties', ref.id, { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
        closeDialog();
        toast('Đã tạo phiếu bảo hành. Khách theo dõi được ở trang tài khoản.');
        await render(document.querySelector('#view'), { ...params, moi: '', reload: '' });
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });
}

function updateWarranty(w, params) {
  const body = openDialog(`Bảo hành #${shortId(w.id)} — ${w.productName}`, `
    <p>${esc(w.customerName)} · ${esc(w.phone)} · ${esc(w.email)}<br>
      <span class="sub">Serial: ${esc(w.serial || '—')} · đơn ${w.orderId ? `<a href="#/don-hang/${esc(w.orderId)}">#${esc(shortId(w.orderId))}</a>` : '—'}</span></p>
    <p class="note">Lỗi: ${esc(w.issue)}</p>
    <form class="form" id="uw">
      <div class="grid2">
        <label>Trạng thái <select name="status">${Object.entries(WARRANTY_STATUS).map(([k, v]) => `<option value="${k}" ${k === w.status ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <label>Trung tâm bảo hành <input name="center" maxlength="100" value="${esc(w.center || '')}"></label>
      </div>
      <div class="grid2">
        <label>Số serial <input name="serial" maxlength="60" value="${esc(w.serial || '')}"></label>
        <label>Ghi chú tiến độ (khách xem được) <input name="note" maxlength="300" placeholder="vd: Đã gửi hãng, dự kiến 7 ngày"></label>
      </div>
      <div class="dlg-actions"><button type="button" class="btn small" data-close>Đóng</button>
        <button type="submit" class="btn small primary">Cập nhật</button></div>
    </form>
    <h3>Lịch sử</h3>
    <ul class="timeline">${(w.history || []).map((h) => `<li><span class="sub">${esc(fmtDateTime(h.at))} · ${esc(h.byEmail || '')}</span><br>
      <span class="status wr-${esc(h.status)}">${esc(WARRANTY_STATUS[h.status] || h.status)}</span> ${esc(h.note || '')}</li>`).join('')}</ul>`, { wide: true });
  const f = body.querySelector('#uw');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        const entry = { status: f.status.value, note: f.note.value.trim(), at: Timestamp.now(), byEmail: me.email };
        const patch = { status: f.status.value, center: f.center.value.trim(), serial: f.serial.value.trim(), updatedAt: serverTimestamp() };
        const batch = writeBatch(db);
        batch.update(doc(db, 'warranties', w.id), { ...patch, history: arrayUnion(entry) });
        audit(batch, 'warranty.update', w.id, `${w.productName}: ${WARRANTY_STATUS[w.status]} → ${WARRANTY_STATUS[f.status.value]}${entry.note ? ` · ${entry.note}` : ''}`);
        await batch.commit();
        patchCache('warranties', w.id, { ...patch, updatedAt: Timestamp.now(), history: [...(w.history || []), entry] });
        closeDialog();
        toast('Đã cập nhật phiếu bảo hành.');
        await render(document.querySelector('#view'), { ...params, reload: '' });
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });
}
