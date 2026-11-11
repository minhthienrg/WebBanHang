// Quản lý sản phẩm: danh sách + lọc, thêm/sửa (ảnh, mô tả, thông số kỹ thuật, bảo hành), ẩn/hiện,
// xóa mềm/khôi phục, đổi giá hàng loạt, lịch sử giá.
import {
  doc, getDoc, getDocs, collection, query, where, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  db, me, load, patchCache, audit, esc, money, num, fold, toast, errMsg, busy, openDialog, closeDialog, ask,
  pager, hrefWith, fmtDateTime, toMs, minStock, isLow, DEFAULT_MIN_STOCK, refreshBadges
} from './core.js';
import { CATEGORIES, SPEC_FILTERS, catName } from '../../js/categories.js';
import { thumb } from '../../js/catalog.js';

const PAGE = 30;
const STATES = {
  '': 'Tất cả (chưa xóa)',
  ban: 'Đang bán',
  an: 'Đang ẩn',
  thap: 'Sắp hết hàng',
  het: 'Hết hàng',
  xoa: 'Đã xóa'
};

let lastParams = {};
let selected = new Set();

const stateOf = (p) => (p.deleted ? 'xoa' : p.active ? 'ban' : 'an');
function stateBadge(p) {
  const s = stateOf(p);
  const label = { ban: 'Đang bán', an: 'Đang ẩn', xoa: 'Đã xóa' }[s];
  const cls = { ban: 's-done', an: 's-pending', xoa: 's-cancelled' }[s];
  return `<span class="status ${cls}">${label}</span>`;
}

function filterProducts(products, params) {
  const words = fold(params.q || '').split(/\s+/).filter(Boolean);
  return products.filter((p) => {
    const st = params.tt || '';
    if (st === 'xoa') { if (!p.deleted) return false; }
    else if (p.deleted) return false;
    if (st === 'ban' && !p.active) return false;
    if (st === 'an' && p.active) return false;
    if (st === 'thap' && !isLow(p)) return false;
    if (st === 'het' && p.stock > 0) return false;
    if (params.dm && p.category !== params.dm) return false;
    if (words.length) {
      const h = fold([p.name, p.brand, p.id, p.summary].join(' '));
      if (!words.every((w) => h.includes(w))) return false;
    }
    return true;
  });
}

const SORTS = {
  moi: (a, b) => toMs(b.createdAt) - toMs(a.createdAt),
  ten: (a, b) => a.name.localeCompare(b.name, 'vi'),
  'gia-tang': (a, b) => a.price - b.price,
  'gia-giam': (a, b) => b.price - a.price,
  'ton-tang': (a, b) => a.stock - b.stock,
  'ban-chay': (a, b) => (b.sold || 0) - (a.sold || 0)
};

export async function render(box, params) {
  if (params.reload) await load('products', true);
  if (JSON.stringify({ ...params, trang: '' }) !== JSON.stringify({ ...lastParams, trang: '' })) selected = new Set();
  lastParams = params;
  const products = await load('products');
  const list = filterProducts(products, params).sort(SORTS[params.sx] || SORTS.moi);
  const page = Math.max(1, Math.min(Number(params.trang) || 1, Math.ceil(list.length / PAGE) || 1));
  const rows = list.slice((page - 1) * PAGE, page * PAGE);
  const live = products.filter((p) => !p.deleted);
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.key, live.filter((p) => p.category === c.key).length]));

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Catalog</p><h1>Sản phẩm</h1></div>
      <div class="head-actions">
        <a class="btn small" href="${hrefWith('san-pham', params, { reload: Date.now() })}">Tải lại</a>
        <button type="button" class="btn small primary" id="btn-new">+ Thêm sản phẩm</button>
      </div>
    </div>

    <div class="chips" aria-label="Danh mục">
      <a class="chip ${!params.dm ? 'on' : ''}" href="${hrefWith('san-pham', params, { dm: '' })}">Tất cả <small>${live.length}</small></a>
      ${CATEGORIES.map((c) => `<a class="chip ${params.dm === c.key ? 'on' : ''}" href="${hrefWith('san-pham', params, { dm: c.key })}">${esc(c.name)} <small>${counts[c.key]}</small></a>`).join('')}
    </div>

    <form class="toolbar-row" id="pf">
      <label class="grow"><span class="sr-only">Tìm sản phẩm</span>
        <input name="q" type="search" placeholder="Tìm theo tên, hãng, mã sản phẩm…" value="${esc(params.q || '')}"></label>
      <label class="inline">Trạng thái
        <select name="tt">${Object.entries(STATES).map(([k, v]) => `<option value="${k}" ${(params.tt || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="inline">Sắp xếp
        <select name="sx">
          ${[['moi', 'Mới thêm'], ['ten', 'Tên A–Z'], ['gia-tang', 'Giá tăng'], ['gia-giam', 'Giá giảm'], ['ton-tang', 'Tồn kho ít nhất'], ['ban-chay', 'Bán chạy']]
            .map(([k, v]) => `<option value="${k}" ${(params.sx || 'moi') === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select></label>
      <button class="btn small" type="submit">Lọc</button>
    </form>

    <div class="bulk" id="bulk" hidden>
      <strong id="bulk-n"></strong>
      <button type="button" class="btn small" data-bulk="price">Đổi giá hàng loạt</button>
      <button type="button" class="btn small" data-bulk="show">Hiện</button>
      <button type="button" class="btn small" data-bulk="hide">Ẩn</button>
      <button type="button" class="link" data-bulk="clear">Bỏ chọn</button>
    </div>

    <p class="hint" role="status">${num.format(list.length)} sản phẩm</p>
    ${rows.length ? `<div class="tbl-wrap"><table class="tbl products">
      <thead><tr>
        <th class="chk"><input type="checkbox" id="chk-all" aria-label="Chọn tất cả trên trang này"></th>
        <th>Sản phẩm</th><th>Danh mục</th><th class="r">Giá bán</th><th class="r">Tồn kho</th><th class="r">Đã bán</th><th>Trạng thái</th><th><span class="sr-only">Thao tác</span></th>
      </tr></thead>
      <tbody>${rows.map((p) => `
        <tr data-id="${esc(p.id)}">
          <td class="chk"><input type="checkbox" data-sel="${esc(p.id)}" ${selected.has(p.id) ? 'checked' : ''} aria-label="Chọn ${esc(p.name)}"></td>
          <td class="pcell">${thumb(p, 'tiny')}<div><button type="button" class="link name" data-edit="${esc(p.id)}">${esc(p.name)}</button>
            <div class="sub">${esc(p.id)}${p.brand ? ` · ${esc(p.brand)}` : ''}</div></div></td>
          <td>${esc(catName(p.category))}</td>
          <td class="r">${money(p.price)}${p.oldPrice > p.price ? `<div class="sub"><s>${money(p.oldPrice)}</s></div>` : ''}</td>
          <td class="r ${p.stock === 0 ? 'neg' : isLow(p) ? 'warn-text' : ''}">${num.format(p.stock || 0)}</td>
          <td class="r">${num.format(p.sold || 0)}</td>
          <td>${stateBadge(p)}</td>
          <td class="acts">
            <button type="button" class="btn small" data-edit="${esc(p.id)}">Sửa</button>
            ${p.deleted
              ? `<button type="button" class="btn small" data-act="restore" data-id="${esc(p.id)}">Khôi phục</button>`
              : `<button type="button" class="btn small" data-act="${p.active ? 'hide' : 'show'}" data-id="${esc(p.id)}">${p.active ? 'Ẩn' : 'Hiện'}</button>
                 <button type="button" class="btn small danger" data-act="delete" data-id="${esc(p.id)}">Xóa</button>`}
          </td>
        </tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty">Không có sản phẩm phù hợp.</div>'}
    ${pager(list.length, page, PAGE, (i) => hrefWith('san-pham', params, { trang: i }))}`;

  const f = box.querySelector('#pf');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    location.hash = hrefWith('san-pham', params, { q: f.q.value.trim(), tt: f.tt.value, sx: f.sx.value === 'moi' ? '' : f.sx.value, reload: '' });
  });
  f.tt.addEventListener('change', () => f.requestSubmit());
  f.sx.addEventListener('change', () => f.requestSubmit());

  const syncBulk = () => {
    box.querySelector('#bulk').hidden = !selected.size;
    box.querySelector('#bulk-n').textContent = `Đã chọn ${selected.size} sản phẩm`;
    const all = box.querySelector('#chk-all');
    if (all) all.checked = rows.length > 0 && rows.every((p) => selected.has(p.id));
  };
  syncBulk();

  box.querySelector('#btn-new').addEventListener('click', () => editProduct(null, params));
  box.onclick = async (ev) => {
    const t = ev.target;
    const edit = t.closest('[data-edit]');
    if (edit) return editProduct(products.find((p) => p.id === edit.dataset.edit), params);
    const act = t.closest('[data-act]');
    if (act) return busy(act, () => quickAction(act.dataset.act, [act.dataset.id], params));
    const bulk = t.closest('[data-bulk]');
    if (bulk) {
      const ids = [...selected];
      if (bulk.dataset.bulk === 'clear') { selected.clear(); box.querySelectorAll('[data-sel]').forEach((c) => { c.checked = false; }); return syncBulk(); }
      if (bulk.dataset.bulk === 'price') return bulkPrice(ids, params);
      return busy(bulk, () => quickAction(bulk.dataset.bulk, ids, params));
    }
  };
  box.onchange = (ev) => {
    const c = ev.target;
    if (c.matches('[data-sel]')) { c.checked ? selected.add(c.dataset.sel) : selected.delete(c.dataset.sel); syncBulk(); }
    if (c.id === 'chk-all') {
      for (const p of rows) c.checked ? selected.add(p.id) : selected.delete(p.id);
      box.querySelectorAll('[data-sel]').forEach((x) => { x.checked = c.checked; });
      syncBulk();
    }
  };
}

const rerender = (params) => render(document.querySelector('#view'), { ...params, reload: '' });

// ---------- Ẩn / hiện / xóa mềm / khôi phục ----------
async function quickAction(act, ids, params) {
  const products = await load('products');
  const items = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  if (!items.length) return;
  if (act === 'delete') {
    const ok = await ask('Xóa sản phẩm', `Xóa "${items[0].name}"? Sản phẩm sẽ bị ẩn khỏi cửa hàng và chuyển vào mục "Đã xóa" (khôi phục được). Đơn hàng cũ không bị ảnh hưởng.`, { okText: 'Xóa', danger: true });
    if (!ok) return;
  }
  const patch = {
    hide: { active: false },
    show: { active: true },
    delete: { active: false, deleted: true, deletedAt: serverTimestamp() },
    restore: { deleted: false }
  }[act];
  try {
    for (let i = 0; i < items.length; i += 200) {
      const batch = writeBatch(db);
      const chunk = items.slice(i, i + 200);
      for (const p of chunk) batch.update(doc(db, 'products', p.id), { ...patch, updatedAt: serverTimestamp() });
      audit(batch, `product.${act}`, chunk.length === 1 ? chunk[0].id : `${chunk.length} sản phẩm`,
        chunk.map((p) => p.name).join('; '));
      await batch.commit();
      for (const p of chunk) {
        const local = { ...patch };
        if (local.deletedAt) local.deletedAt = Timestamp.now();
        patchCache('products', p.id, local);
      }
    }
    toast({ hide: 'Đã ẩn', show: 'Đã hiện', delete: 'Đã xóa', restore: 'Đã khôi phục (đang ẩn — bấm "Hiện" để bán lại)' }[act]
      + (items.length > 1 ? ` ${items.length} sản phẩm.` : ` "${items[0].name}".`));
    if (act !== 'delete' && act !== 'restore') selected.clear();
    await rerender(params);
    refreshBadges();
  } catch (e) { toast(errMsg(e), 'err'); }
}

// ---------- Đổi giá hàng loạt ----------
function bulkPrice(ids, params) {
  const body = openDialog(`Đổi giá ${ids.length} sản phẩm`, `
    <form class="form" id="bp">
      <div class="grid2">
        <label>Cách đổi
          <select name="mode">
            <option value="pct-down">Giảm theo %</option>
            <option value="pct-up">Tăng theo %</option>
            <option value="amt-down">Giảm số tiền</option>
            <option value="amt-up">Tăng số tiền</option>
            <option value="set">Đặt giá cố định</option>
          </select></label>
        <label>Giá trị <input name="v" type="number" min="0" step="any" required inputmode="decimal"></label>
      </div>
      <label class="check"><input type="checkbox" name="keepOld" checked> Khi giảm giá: lưu giá hiện tại làm “giá gốc” (hiện gạch ngang và % giảm)</label>
      <label class="check"><input type="checkbox" name="clearOld"> Khi tăng giá: bỏ giá gốc (kết thúc khuyến mãi)</label>
      <p class="hint">Giá mới được làm tròn tới 1.000₫. Mỗi thay đổi được ghi vào lịch sử giá.</p>
      <div id="bp-preview" class="hint"></div>
      <div class="dlg-actions">
        <button type="button" class="btn small" data-close>Hủy</button>
        <button type="submit" class="btn small primary">Áp dụng</button>
      </div>
    </form>`);
  const f = body.querySelector('#bp');
  const calc = (p) => {
    const v = Number(f.v.value) || 0;
    const m = f.mode.value;
    let x = p.price;
    if (m === 'pct-down') x = p.price * (1 - v / 100);
    if (m === 'pct-up') x = p.price * (1 + v / 100);
    if (m === 'amt-down') x = p.price - v;
    if (m === 'amt-up') x = p.price + v;
    if (m === 'set') x = v;
    return Math.max(0, Math.round(x / 1000) * 1000);
  };
  const preview = async () => {
    const products = await load('products');
    const sample = ids.slice(0, 3).map((id) => products.find((p) => p.id === id)).filter(Boolean);
    body.querySelector('#bp-preview').innerHTML = f.v.value
      ? `Ví dụ: ${sample.map((p) => `${esc(p.name.slice(0, 40))}: ${money(p.price)} → <strong>${money(calc(p))}</strong>`).join('<br>')}`
      : '';
  };
  f.addEventListener('input', preview);
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (f.mode.value.startsWith('pct') && Number(f.v.value) >= 100 && f.mode.value === 'pct-down') {
      toast('Không giảm được từ 100% trở lên.', 'err');
      return;
    }
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        const products = await load('products');
        const items = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
        const changes = items.map((p) => {
          const price = calc(p);
          let oldPrice = p.oldPrice || 0;
          if (price < p.price && f.keepOld.checked) oldPrice = Math.max(oldPrice, p.price);
          if (price > p.price && f.clearOld.checked) oldPrice = 0;
          if (oldPrice && oldPrice <= price) oldPrice = 0;
          return { p, price, oldPrice };
        }).filter((c) => c.price !== c.p.price || c.oldPrice !== (c.p.oldPrice || 0));
        if (!changes.length) { toast('Không có giá nào thay đổi.'); return; }
        for (let i = 0; i < changes.length; i += 200) {
          const chunk = changes.slice(i, i + 200);
          const batch = writeBatch(db);
          for (const c of chunk) {
            batch.update(doc(db, 'products', c.p.id), { price: c.price, oldPrice: c.oldPrice, updatedAt: serverTimestamp() });
            priceLog(batch, c.p, c.price, c.oldPrice, 'Đổi giá hàng loạt');
          }
          audit(batch, 'price.bulk', `${chunk.length} sản phẩm`,
            `${f.mode.options[f.mode.selectedIndex].text} ${f.v.value}: ` + chunk.map((c) => `${c.p.id} ${c.p.price}→${c.price}`).join('; '));
          await batch.commit();
          for (const c of chunk) patchCache('products', c.p.id, { price: c.price, oldPrice: c.oldPrice });
        }
        closeDialog();
        selected.clear();
        toast(`Đã đổi giá ${changes.length} sản phẩm.`);
        await rerender(params);
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });
}

function priceLog(batch, p, price, oldPrice, note) {
  batch.set(doc(collection(db, 'priceHistory')), {
    productId: p.id, name: p.name,
    fromPrice: p.price || 0, toPrice: price,
    fromOldPrice: p.oldPrice || 0, toOldPrice: oldPrice,
    note, by: me.uid, byEmail: me.email, at: serverTimestamp()
  });
}

// ---------- Thêm / sửa sản phẩm ----------
function slugify(s) {
  return fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

async function editProduct(p, params) {
  const isNew = !p;
  p = p || { category: params.dm || 'cpu', specs: {}, active: true, price: 0, oldPrice: 0, stock: 0, minStock: DEFAULT_MIN_STOCK };
  const products = await load('products');
  const brands = [...new Set(products.map((x) => x.brand).filter(Boolean))].sort();
  const specRows = Object.entries(p.specs || {});
  const body = openDialog(isNew ? 'Thêm sản phẩm' : `Sửa: ${p.name}`, `
    <form class="form" id="ef" novalidate>
      <div class="grid2">
        <label>Danh mục
          <select name="category">${CATEGORIES.map((c) => `<option value="${c.key}" ${p.category === c.key ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label>Hãng <input name="brand" maxlength="60" list="dl-brands" value="${esc(p.brand || '')}"></label>
      </div>
      <datalist id="dl-brands">${brands.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
      <label>Tên sản phẩm <input name="name" required maxlength="200" value="${esc(p.name || '')}"></label>
      ${isNew ? `<label>Mã sản phẩm (ID) <small>để trống sẽ tự tạo từ tên; không đổi được sau khi tạo</small>
        <input name="id" maxlength="80" pattern="[a-z0-9-]+" placeholder="vd: cpu-intel-i5-14400f"></label>` : `<p class="hint">Mã: <code>${esc(p.id)}</code></p>`}
      <div class="grid3">
        <label>Giá bán (₫) <input name="price" type="number" min="0" step="1000" required inputmode="numeric" value="${p.price || 0}"></label>
        <label>Giá gốc (₫) <small>0 = không khuyến mãi</small><input name="oldPrice" type="number" min="0" step="1000" inputmode="numeric" value="${p.oldPrice || 0}"></label>
        <label>Tồn tối thiểu <small>cảnh báo khi ≤</small><input name="minStock" type="number" min="0" step="1" inputmode="numeric" value="${minStock(p)}"></label>
      </div>
      ${isNew ? `<div class="grid3">
        <label>Tồn kho ban đầu <input name="stock" type="number" min="0" step="1" inputmode="numeric" value="0"></label>
        <label>Giá vốn / chiếc (₫) <input name="cost" type="number" min="0" step="1000" inputmode="numeric" value="0"></label>
        <label>Nhà cung cấp <input name="supplier" maxlength="100"></label>
      </div>` : `<p class="hint">Tồn kho hiện tại: <strong>${num.format(p.stock || 0)}</strong> — thay đổi tồn kho ở <a href="#/kho?sp=${encodeURIComponent(p.id)}">Kho hàng</a> (nhập / xuất / hủy hàng lỗi) để giữ lịch sử.</p>`}
      <div class="img-row">
        <label class="grow">Link ảnh <input name="imageUrl" type="url" maxlength="500" placeholder="https://…" value="${esc(p.imageUrl || '')}"></label>
        <div id="img-prev">${thumb(p, 'tiny big-tiny')}</div>
      </div>
      <label>Tóm tắt (hiện trên thẻ sản phẩm) <input name="summary" maxlength="200" value="${esc(p.summary || '')}" placeholder="vd: LGA1700 · 10C/16T · 4.7GHz · 65W"></label>
      <label>Mô tả <textarea name="description" rows="3" maxlength="5000">${esc(p.description || '')}</textarea></label>

      <fieldset class="fs">
        <legend>Bảo hành</legend>
        <div class="grid2">
          <label>Thời gian (tháng) <input name="warrantyMonths" type="number" min="0" max="120" step="1" inputmode="numeric" value="${p.warrantyMonths ?? ''}"></label>
          <label>Nơi bảo hành / nhà cung cấp <input name="warrantyProvider" maxlength="100" value="${esc(p.warrantyProvider || '')}"></label>
        </div>
      </fieldset>

      <fieldset class="fs">
        <legend>Thông số kỹ thuật</legend>
        <p class="hint" id="spec-hint"></p>
        <div id="specs">${specRows.map(([k, v]) => specRow(k, v)).join('')}</div>
        <datalist id="dl-spec"></datalist>
        <button type="button" class="btn small" id="add-spec">+ Thêm thông số</button>
      </fieldset>

      <label class="check"><input type="checkbox" name="active" ${p.active && !p.deleted ? 'checked' : ''} ${p.deleted ? 'disabled' : ''}> Đang bán (hiện trên cửa hàng)</label>

      ${isNew ? '' : `<details class="ph" id="ph"><summary>Lịch sử giá</summary><div id="ph-body" class="hint">Đang tải…</div></details>`}

      <div class="dlg-actions">
        <button type="button" class="btn small" data-close>Hủy</button>
        <button type="submit" class="btn small primary">${isNew ? 'Thêm sản phẩm' : 'Lưu thay đổi'}</button>
      </div>
    </form>`, { wide: true });

  const f = body.querySelector('#ef');
  const specsBox = body.querySelector('#specs');
  const refreshSpecHints = () => {
    const cat = f.category.value;
    const keys = new Set((SPEC_FILTERS[cat] || []).map((x) => x.spec));
    for (const x of products) if (x.category === cat) for (const k of Object.keys(x.specs || {})) keys.add(k);
    body.querySelector('#dl-spec').innerHTML = [...keys].map((k) => `<option value="${esc(k)}">`).join('');
    const filt = (SPEC_FILTERS[cat] || []).map((x) => x.spec);
    body.querySelector('#spec-hint').textContent = filt.length
      ? `Bộ lọc của danh mục ${catName(cat)} dùng các thông số: ${filt.join(', ')}. Ghi đúng tên để sản phẩm hiện trong bộ lọc.` : '';
    if (isNew && !specsBox.children.length) specsBox.innerHTML = filt.map((k) => specRow(k, '')).join('');
  };
  refreshSpecHints();
  f.category.addEventListener('change', () => {
    if (isNew && [...specsBox.querySelectorAll('[name=sv]')].every((i) => !i.value)) specsBox.innerHTML = '';
    refreshSpecHints();
  });
  body.querySelector('#add-spec').addEventListener('click', () => {
    specsBox.insertAdjacentHTML('beforeend', specRow('', ''));
    specsBox.lastElementChild.querySelector('input').focus();
  });
  specsBox.addEventListener('click', (ev) => {
    const rm = ev.target.closest('[data-rm-spec]');
    if (rm) rm.closest('.spec-row').remove();
  });
  f.imageUrl.addEventListener('change', () => {
    body.querySelector('#img-prev').innerHTML = thumb({ ...p, category: f.category.value, imageUrl: f.imageUrl.value.trim() }, 'tiny big-tiny');
  });

  if (!isNew) {
    body.querySelector('#ph').addEventListener('toggle', async (ev) => {
      if (!ev.currentTarget.open || ev.currentTarget.dataset.loaded) return;
      ev.currentTarget.dataset.loaded = '1';
      const out = body.querySelector('#ph-body');
      try {
        const snap = await getDocs(query(collection(db, 'priceHistory'), where('productId', '==', p.id)));
        const hist = snap.docs.map((d) => d.data()).sort((a, b) => toMs(b.at) - toMs(a.at));
        out.innerHTML = hist.length ? `<table class="tbl"><thead><tr><th>Thời gian</th><th class="r">Giá bán</th><th class="r">Giá gốc</th><th>Người đổi</th></tr></thead>
          <tbody>${hist.map((h) => `<tr><td>${esc(fmtDateTime(h.at))}${h.note ? `<div class="sub">${esc(h.note)}</div>` : ''}</td>
            <td class="r">${money(h.fromPrice)} → ${money(h.toPrice)}</td>
            <td class="r">${money(h.fromOldPrice)} → ${money(h.toOldPrice)}</td>
            <td>${esc(h.byEmail || '')}</td></tr>`).join('')}</tbody></table>` : 'Chưa có thay đổi giá nào được ghi lại.';
      } catch (e) { out.textContent = errMsg(e); }
    });
  }

  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    busy(f.querySelector('[type=submit]'), () => saveProduct(f, isNew ? null : p, params));
  });
}

function specRow(k, v) {
  return `<div class="spec-row">
    <input name="sk" maxlength="60" placeholder="Tên thông số" list="dl-spec" value="${esc(k)}" aria-label="Tên thông số">
    <input name="sv" maxlength="200" placeholder="Giá trị" value="${esc(v)}" aria-label="Giá trị">
    <button type="button" class="link danger" data-rm-spec aria-label="Xóa thông số">✕</button>
  </div>`;
}

const int = (v) => (v === '' || v == null ? NaN : Number(v));

async function saveProduct(f, old, params) {
  const name = f.name.value.trim();
  const price = int(f.price.value);
  const oldPrice = int(f.oldPrice.value || 0);
  const min = int(f.minStock.value || 0);
  const wm = f.warrantyMonths.value === '' ? null : int(f.warrantyMonths.value);
  if (!name) return toast('Vui lòng nhập tên sản phẩm.', 'err');
  if (!Number.isInteger(price) || price < 0) return toast('Giá bán phải là số nguyên ≥ 0.', 'err');
  if (!Number.isInteger(oldPrice) || oldPrice < 0) return toast('Giá gốc phải là số nguyên ≥ 0.', 'err');
  if (oldPrice && oldPrice <= price) return toast('Giá gốc phải lớn hơn giá bán (hoặc để 0).', 'err');
  if (!Number.isInteger(min) || min < 0) return toast('Tồn tối thiểu phải là số nguyên ≥ 0.', 'err');
  if (wm !== null && (!Number.isInteger(wm) || wm < 0)) return toast('Thời gian bảo hành phải là số tháng nguyên.', 'err');
  const img = f.imageUrl.value.trim();
  if (img && !/^https:\/\//i.test(img)) return toast('Link ảnh phải bắt đầu bằng https://', 'err');

  const specs = {};
  const ks = [...f.querySelectorAll('[name=sk]')], vs = [...f.querySelectorAll('[name=sv]')];
  ks.forEach((k, i) => { const key = k.value.trim(); const val = vs[i].value.trim(); if (key && val) specs[key] = val; });
  if (wm) specs['Bảo hành'] = `${wm} tháng`;

  const data = {
    name,
    category: f.category.value,
    brand: f.brand.value.trim(),
    price, oldPrice,
    minStock: min,
    imageUrl: img,
    summary: f.summary.value.trim(),
    description: f.description.value.trim(),
    specs,
    warrantyMonths: wm,
    warrantyProvider: f.warrantyProvider.value.trim(),
    updatedAt: serverTimestamp()
  };
  if (!old?.deleted) data.active = f.active.checked;

  try {
    const batch = writeBatch(db);
    let id;
    if (!old) {
      id = (f.id.value.trim() || slugify(`${catName(data.category)} ${name}`)).toLowerCase();
      if (!/^[a-z0-9-]{3,80}$/.test(id)) return toast('Mã sản phẩm chỉ gồm chữ thường không dấu, số và dấu "-" (3–80 ký tự).', 'err');
      if ((await getDoc(doc(db, 'products', id))).exists()) return toast(`Mã "${id}" đã tồn tại. Hãy đặt mã khác.`, 'err');
      const stock = int(f.stock.value || 0);
      const cost = int(f.cost.value || 0);
      if (!Number.isInteger(stock) || stock < 0) return toast('Tồn kho ban đầu phải là số nguyên ≥ 0.', 'err');
      batch.set(doc(db, 'products', id), { ...data, stock, sold: 0, deleted: false, createdAt: serverTimestamp() });
      if (stock > 0) {
        batch.set(doc(collection(db, 'stockMoves')), {
          productId: id, name, type: 'in', qty: stock, unitCost: Number.isInteger(cost) ? cost : 0,
          supplier: f.supplier.value.trim(), note: 'Tồn kho ban đầu khi thêm sản phẩm', stockAfter: stock,
          orderId: '', by: me.uid, byEmail: me.email, at: serverTimestamp()
        });
      }
      audit(batch, 'product.create', id, `${name} · ${money(price)} · tồn ${stock}`);
      await batch.commit();
      patchCache('products', id, { ...data, stock, sold: 0, deleted: false, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
      toast(`Đã thêm "${name}".`);
    } else {
      id = old.id;
      batch.update(doc(db, 'products', id), data);
      if (price !== old.price || oldPrice !== (old.oldPrice || 0)) priceLog(batch, old, price, oldPrice, 'Sửa sản phẩm');
      const changed = Object.keys(data).filter((k) => k !== 'updatedAt' && JSON.stringify(data[k]) !== JSON.stringify(old[k] ?? (k === 'warrantyMonths' ? null : undefined)));
      audit(batch, 'product.update', id, `${name}: ${changed.join(', ') || 'không đổi'}`
        + (price !== old.price ? ` · giá ${old.price}→${price}` : ''));
      await batch.commit();
      patchCache('products', id, { ...data, updatedAt: Timestamp.now() });
      toast(`Đã lưu "${name}".`);
    }
    closeDialog();
    await rerender(params);
    refreshBadges();
  } catch (e) { toast(errMsg(e), 'err'); }
}
