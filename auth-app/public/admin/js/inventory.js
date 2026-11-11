// Kho hàng: nhập hàng (kèm giá vốn, nhà cung cấp), xuất hàng, hủy hàng hỏng/lỗi; cảnh báo tồn thấp;
// lịch sử phiếu kho (gồm cả trừ/hoàn kho theo đơn hàng).
import {
  doc, collection, runTransaction, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  db, me, load, latest, patchCache, audit, esc, money, num, fold, toast, errMsg, userError, busy,
  hrefWith, fmtDateTime, minStock, isLow, refreshBadges, downloadCsv, shortId
} from './core.js';
import { catName } from '../../js/categories.js';

const TYPES = {
  in: { label: 'Nhập hàng', sign: 1 },
  out: { label: 'Xuất hàng', sign: -1 },
  damaged: { label: 'Hủy hàng hỏng/lỗi', sign: -1 },
  order: { label: 'Xuất theo đơn', sign: -1 },
  'order-return': { label: 'Hoàn kho (hủy đơn)', sign: 1 }
};

export async function render(box, params) {
  const [products, moves] = await Promise.all([load('products', !!params.reload), latest('stockMoves', 300)]);
  const live = products.filter((p) => !p.deleted);
  const low = live.filter(isLow).sort((a, b) => a.stock - b.stock);
  const pre = params.sp ? products.find((p) => p.id === params.sp) : null;
  const suppliers = [...new Set(moves.map((m) => m.supplier).filter(Boolean))].sort();
  const words = fold(params.q || '').split(/\s+/).filter(Boolean);
  const shown = moves.filter((m) => (!params.loai || m.type === params.loai)
    && (!words.length || words.every((w) => fold(`${m.name} ${m.productId} ${m.supplier || ''} ${m.note || ''}`).includes(w))));

  // Giá vốn bình quân các lần nhập gần đây (trong 300 phiếu mới nhất)
  const costs = new Map();
  for (const m of moves) {
    if (m.type !== 'in' || !m.unitCost) continue;
    const c = costs.get(m.productId) || { qty: 0, value: 0 };
    c.qty += m.qty; c.value += m.qty * m.unitCost;
    costs.set(m.productId, c);
  }

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Catalog</p><h1>Kho hàng</h1></div>
      <a class="btn small" href="${hrefWith('kho', params, { reload: Date.now() })}">Tải lại</a>
    </div>

    <div class="two-col">
      <section class="card">
        <h2>Lập phiếu kho</h2>
        <form class="form" id="mf" novalidate>
          <label>Sản phẩm
            <input name="product" list="dl-products" required placeholder="Gõ tên hoặc mã sản phẩm…" autocomplete="off"
              value="${pre ? esc(`${pre.name} [${pre.id}]`) : ''}"></label>
          <datalist id="dl-products">${live.map((p) => `<option value="${esc(`${p.name} [${p.id}]`)}">`).join('')}</datalist>
          <p class="hint" id="mf-cur">${pre ? curText(pre, costs) : ''}</p>
          <div class="grid2">
            <label>Loại phiếu
              <select name="type">
                <option value="in">Nhập hàng</option>
                <option value="out">Xuất hàng (chuyển kho, bán ngoài…)</option>
                <option value="damaged">Hủy hàng hỏng / lỗi</option>
              </select></label>
            <label>Số lượng <input name="qty" type="number" min="1" step="1" required inputmode="numeric" value="1"></label>
          </div>
          <div class="grid2" id="in-only">
            <label>Giá vốn / chiếc (₫) <input name="cost" type="number" min="0" step="1000" inputmode="numeric"></label>
            <label>Nhà cung cấp <input name="supplier" maxlength="100" list="dl-sup"></label>
          </div>
          <datalist id="dl-sup">${suppliers.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
          <label>Ghi chú <input name="note" maxlength="300" placeholder="Số phiếu, lý do xuất / hủy…"></label>
          <button type="submit" class="btn primary">Lưu phiếu kho</button>
        </form>
      </section>

      <section class="card">
        <div class="sec-head"><h2>Cảnh báo tồn kho thấp (${low.length})</h2></div>
        <p class="hint">Sản phẩm đang bán có tồn kho ≤ mức tối thiểu (đặt trong form sửa sản phẩm).</p>
        ${low.length ? `<div class="tbl-wrap scroll-y"><table class="tbl">
          <thead><tr><th>Sản phẩm</th><th class="r">Tồn</th><th class="r">Tối thiểu</th><th></th></tr></thead>
          <tbody>${low.map((p) => `<tr>
            <td>${esc(p.name)}<div class="sub">${esc(catName(p.category))}</div></td>
            <td class="r ${p.stock === 0 ? 'neg' : 'warn-text'}">${num.format(p.stock)}</td>
            <td class="r">${num.format(minStock(p))}</td>
            <td><button type="button" class="btn small" data-pick="${esc(p.id)}">Nhập</button></td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="hint">Không có sản phẩm nào.</p>'}
      </section>
    </div>

    <section class="card block-gap">
      <div class="sec-head">
        <h2>Lịch sử phiếu kho</h2>
        <button type="button" class="btn small" id="btn-csv">Tải CSV</button>
      </div>
      <form class="toolbar-row" id="hf">
        <label class="grow"><span class="sr-only">Tìm phiếu kho</span>
          <input name="q" type="search" placeholder="Tìm theo sản phẩm, nhà cung cấp, ghi chú…" value="${esc(params.q || '')}"></label>
        <label class="inline">Loại
          <select name="loai"><option value="">Tất cả</option>
            ${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${params.loai === k ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select></label>
        <button class="btn small" type="submit">Lọc</button>
      </form>
      <p class="hint">${num.format(shown.length)} phiếu (tối đa 300 phiếu mới nhất).</p>
      ${shown.length ? `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Thời gian</th><th>Loại</th><th>Sản phẩm</th><th class="r">SL</th><th class="r">Tồn sau</th><th class="r">Giá vốn</th><th>Nhà cung cấp / ghi chú</th><th>Người lập</th></tr></thead>
        <tbody>${shown.map((m) => `<tr>
          <td>${esc(fmtDateTime(m.at))}</td>
          <td><span class="mv mv-${esc(m.type)}">${esc(TYPES[m.type]?.label || m.type)}</span></td>
          <td>${esc(m.name)}<div class="sub">${esc(m.productId)}</div></td>
          <td class="r ${m.qty < 0 ? 'neg' : 'pos'}">${m.qty > 0 ? '+' : ''}${num.format(m.qty)}</td>
          <td class="r">${m.stockAfter ?? '—'}</td>
          <td class="r">${m.unitCost ? money(m.unitCost) : '—'}</td>
          <td>${esc(m.supplier || '')}${m.orderId ? `<a href="#/don-hang/${esc(m.orderId)}">Đơn #${esc(shortId(m.orderId))}</a>` : ''}
            ${m.note ? `<div class="sub">${esc(m.note)}</div>` : ''}</td>
          <td class="sub">${esc(m.byEmail || '')}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="hint">Chưa có phiếu kho.</p>'}
    </section>`;

  const f = box.querySelector('#mf');
  const findProduct = () => {
    const m = f.product.value.match(/\[([^\]]+)\]\s*$/);
    const v = m ? m[1] : f.product.value.trim();
    return products.find((p) => p.id === v) || null;
  };
  const sync = () => {
    box.querySelector('#in-only').hidden = f.type.value !== 'in';
    const p = findProduct();
    box.querySelector('#mf-cur').innerHTML = p ? curText(p, costs) : '';
  };
  sync();
  f.addEventListener('input', sync);
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    busy(f.querySelector('[type=submit]'), () => saveMove(f, findProduct(), params));
  });

  const hf = box.querySelector('#hf');
  hf.addEventListener('submit', (ev) => {
    ev.preventDefault();
    location.hash = hrefWith('kho', params, { q: hf.q.value.trim(), loai: hf.loai.value, reload: '' });
  });
  hf.loai.addEventListener('change', () => hf.requestSubmit());

  box.onclick = (ev) => {
    const pick = ev.target.closest('[data-pick]');
    if (pick) {
      const p = products.find((x) => x.id === pick.dataset.pick);
      f.product.value = `${p.name} [${p.id}]`;
      f.type.value = 'in';
      f.qty.value = Math.max(1, minStock(p) * 2 - p.stock);
      sync();
      f.qty.focus();
      f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (ev.target.closest('#btn-csv')) {
      downloadCsv('phieu-kho.csv', [
        ['Thời gian', 'Loại', 'Mã SP', 'Sản phẩm', 'Số lượng', 'Tồn sau', 'Giá vốn', 'Nhà cung cấp', 'Ghi chú', 'Mã đơn', 'Người lập'],
        ...shown.map((m) => [fmtDateTime(m.at), TYPES[m.type]?.label || m.type, m.productId, m.name, m.qty, m.stockAfter,
          m.unitCost || '', m.supplier || '', m.note || '', m.orderId || '', m.byEmail || ''])
      ]);
    }
  };
}

function curText(p, costs) {
  const c = costs.get(p.id);
  return `Tồn hiện tại: <strong>${num.format(p.stock || 0)}</strong> · tối thiểu ${num.format(minStock(p))} · giá bán ${money(p.price)}`
    + (c ? ` · giá vốn bình quân gần đây ${money(Math.round(c.value / c.qty))}` : '');
}

async function saveMove(f, p, params) {
  if (!p) return toast('Chọn sản phẩm trong danh sách gợi ý.', 'err');
  const type = f.type.value;
  const qty = Number(f.qty.value);
  if (!Number.isInteger(qty) || qty < 1 || qty > 100000) return toast('Số lượng phải là số nguyên từ 1.', 'err');
  const cost = f.cost.value === '' ? 0 : Number(f.cost.value);
  if (type === 'in' && (!Number.isInteger(cost) || cost < 0)) return toast('Giá vốn phải là số nguyên ≥ 0.', 'err');
  if (type !== 'in' && !f.note.value.trim()) return toast('Ghi rõ lý do xuất / hủy hàng ở ô Ghi chú.', 'err');
  const delta = TYPES[type].sign * qty;
  try {
    const after = await runTransaction(db, async (tx) => {
      const ref = doc(db, 'products', p.id);
      const snap = await tx.get(ref);
      if (!snap.exists()) throw userError('Sản phẩm không còn tồn tại.');
      const stock = snap.data().stock || 0;
      const next = stock + delta;
      if (next < 0) throw userError(`Không đủ hàng: tồn kho hiện tại chỉ còn ${stock}.`);
      tx.update(ref, { stock: next, updatedAt: serverTimestamp() });
      tx.set(doc(collection(db, 'stockMoves')), {
        productId: p.id, name: p.name, type, qty: delta,
        unitCost: type === 'in' ? cost : 0,
        supplier: type === 'in' ? f.supplier.value.trim() : '',
        note: f.note.value.trim(), stockAfter: next, orderId: '',
        by: me.uid, byEmail: me.email, at: serverTimestamp()
      });
      audit(tx, `stock.${type}`, p.id, `${p.name}: ${delta > 0 ? '+' : ''}${delta} → tồn ${next}`
        + (type === 'in' && cost ? ` · giá vốn ${cost}` : '') + (f.note.value.trim() ? ` · ${f.note.value.trim()}` : ''));
      return next;
    });
    patchCache('products', p.id, { stock: after, updatedAt: Timestamp.now() });
    toast(`Đã lưu phiếu ${TYPES[type].label.toLowerCase()}: ${p.name} ${delta > 0 ? '+' : ''}${delta}, tồn mới ${after}.`);
    await render(document.querySelector('#view'), { ...params, sp: p.id, reload: '' });
    refreshBadges();
  } catch (e) { toast(errMsg(e), 'err'); }
}
