// Danh sách sản phẩm (lọc theo danh mục + giá, sắp xếp, phân trang) và trang chi tiết.
//
// Cửa hàng nhỏ (vài trăm sản phẩm) nên tải toàn bộ sản phẩm đang bán MỘT lần rồi lọc/sắp xếp
// ở trình duyệt: nhanh, không cần composite index, đổi bộ lọc không tốn lượt đọc Firestore.
// Khi số sản phẩm lên hàng nghìn, chuyển sang truy vấn where(category)+where(price)+orderBy+limit.
import {
  collection, query, where, getDocs, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db } from './firebase.js';
import { CATEGORIES, PRICE_RANGES, catName } from './categories.js';
import { $, esc, money } from './ui.js';

const PAGE_SIZE = 12;
let products = null;          // mảng sản phẩm đã tải
let loading = null;

export async function loadProducts(force = false) {
  if (products && !force) return products;
  if (!loading || force) {
    loading = getDocs(query(collection(db, 'products'), where('active', '==', true)))
      .then((snap) => {
        products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return products;
      })
      .finally(() => { loading = null; });
  }
  return loading;
}

/** Lấy 1 sản phẩm: ưu tiên bộ nhớ đệm, nếu chưa có thì đọc Firestore. */
export async function getProduct(id, fresh = false) {
  if (!fresh && products) {
    const p = products.find((x) => x.id === id);
    if (p) return p;
  }
  const snap = await getDoc(doc(db, 'products', id));
  if (!snap.exists() || snap.data().active !== true) return null;
  const p = { id: snap.id, ...snap.data() };
  if (products) {
    const i = products.findIndex((x) => x.id === id);
    if (i >= 0) products[i] = p; else products.push(p);
  }
  return p;
}

// ---------- Tham số lọc trên URL: #/?cat=cpu&gia=2-5&min=&max=&con=1&sx=price_asc&trang=2 ----------
export function listHref(params, patch = {}) {
  const next = { ...params, ...patch };
  if (!('trang' in patch)) delete next.trang;     // đổi bộ lọc thì về trang 1
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v !== '' && v != null) qs.set(k, v);
  const s = qs.toString();
  return `#/${s ? `?${s}` : ''}`;
}

function priceBounds(params) {
  const r = PRICE_RANGES.find((x) => x.key === params.gia);
  if (r) return { min: r.min, max: r.max, label: r.label };
  const min = Number(params.min) || 0;
  const max = Number(params.max) || Infinity;
  if (!params.min && !params.max) return null;
  const label = `${params.min ? money(min) : '0₫'} – ${params.max ? money(max) : '∞'}`;
  return { min, max, label };
}

const discount = (p) => (p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);

function applyFilters(list, params) {
  let out = list;
  if (params.cat) out = out.filter((p) => p.category === params.cat);
  const b = priceBounds(params);
  if (b) out = out.filter((p) => p.price >= b.min && p.price <= b.max);
  if (params.con === '1') out = out.filter((p) => p.stock > 0);
  const sorters = {
    pop: (a, b) => (b.sold || 0) - (a.sold || 0),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    new: (a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0),
    discount: (a, b) => discount(b) - discount(a)
  };
  return [...out].sort(sorters[params.sx] || sorters.pop);
}

// ---------- Thẻ sản phẩm (dùng chung) ----------
export function thumb(p, cls = 'thumb') {
  return p.imageUrl
    ? `<img class="${cls}" src="${esc(p.imageUrl)}" alt="${esc(p.name)}" loading="lazy">`
    : `<div class="${cls} ph" aria-hidden="true"><span>${esc(catName(p.category))}</span></div>`;
}

export function card(p) {
  const d = discount(p);
  const out = !(p.stock > 0);
  return `
    <article class="pcard">
      <a href="#/sp/${esc(p.id)}" class="pcard-link">
        ${d ? `<span class="tag-sale">-${d}%</span>` : ''}
        ${thumb(p)}
        <h3 class="pname">${esc(p.name)}</h3>
        ${p.summary ? `<p class="psum">${esc(p.summary)}</p>` : ''}
      </a>
      <div class="pprice">
        <strong>${money(p.price)}</strong>
        ${d ? `<s>${money(p.oldPrice)}</s>` : ''}
      </div>
      <div class="pfoot">
        <span class="stock ${out ? 'out' : ''}">${out ? 'Hết hàng' : 'Còn hàng'}</span>
        <button type="button" class="btn small primary" data-add="${esc(p.id)}" ${out ? 'disabled' : ''}
          aria-label="Thêm ${esc(p.name)} vào giỏ">+ Giỏ</button>
      </div>
    </article>`;
}

// ---------- Trang danh sách ----------
export async function renderList(params) {
  const all = await loadProducts();
  const cat = params.cat && CATEGORIES.some((c) => c.key === params.cat) ? params.cat : '';
  params = { ...params, cat };

  $('#list-crumbs').innerHTML = cat
    ? `<a href="#/">Trang chủ</a> › <span>${esc(catName(cat))}</span>`
    : '<span>Trang chủ</span>';
  $('#list-title').textContent = cat ? catName(cat) : 'Tất cả sản phẩm';

  // Chip danh mục (lối vào nhanh)
  const count = (key) => all.filter((p) => p.category === key).length;
  $('#cat-chips').innerHTML = [
    `<a class="chip ${cat ? '' : 'on'}" href="${listHref(params, { cat: '' })}">Tất cả</a>`,
    ...CATEGORIES.map((c) => `<a class="chip ${cat === c.key ? 'on' : ''}" href="${listHref(params, { cat: c.key })}">${esc(c.name)} <small>${count(c.key)}</small></a>`)
  ].join('');

  // Bộ lọc bên trái
  $('#f-cats').innerHTML = [
    `<a class="opt ${cat ? '' : 'on'}" href="${listHref(params, { cat: '' })}">Tất cả</a>`,
    ...CATEGORIES.map((c) => `<a class="opt ${cat === c.key ? 'on' : ''}" href="${listHref(params, { cat: c.key })}">${esc(c.name)}</a>`)
  ].join('');
  $('#f-prices').innerHTML = PRICE_RANGES.map((r) => {
    const on = params.gia === r.key;
    return `<a class="opt ${on ? 'on' : ''}" href="${listHref(params, { gia: on ? '' : r.key, min: '', max: '' })}">${esc(r.label)}</a>`;
  }).join('');
  const fc = $('#f-custom');
  fc.min.value = params.min || '';
  fc.max.value = params.max || '';
  $('#f-stock').checked = params.con === '1';
  $('#sort').value = params.sx || 'pop';

  // Chip bộ lọc đang áp dụng
  const active = [];
  if (cat) active.push(`<a class="chip on" href="${listHref(params, { cat: '' })}">${esc(catName(cat))} ✕</a>`);
  const b = priceBounds(params);
  if (b) active.push(`<a class="chip on" href="${listHref(params, { gia: '', min: '', max: '' })}">${esc(b.label)} ✕</a>`);
  if (params.con === '1') active.push(`<a class="chip on" href="${listHref(params, { con: '' })}">Còn hàng ✕</a>`);
  if (active.length > 1) active.push(`<a class="link" href="${listHref({}, {})}">Xóa tất cả</a>`);
  $('#active-filters').innerHTML = active.join('');

  // Kết quả + phân trang
  const list = applyFilters(all, params);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.trang) || 1), pages);
  const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  $('#result-count').textContent = `${list.length} sản phẩm`;
  $('#grid').innerHTML = slice.length
    ? slice.map(card).join('')
    : `<div class="empty">Không có sản phẩm phù hợp. <a href="${listHref({}, {})}">Bỏ bộ lọc</a></div>`;

  $('#pager').innerHTML = pages > 1
    ? [
        page > 1 ? `<a href="${listHref(params, { trang: page - 1 })}">‹</a>` : '',
        ...Array.from({ length: pages }, (_, i) => i + 1)
          .map((n) => `<a class="${n === page ? 'on' : ''}" href="${listHref(params, { trang: n })}">${n}</a>`),
        page < pages ? `<a href="${listHref(params, { trang: page + 1 })}">›</a>` : ''
      ].join('')
    : '';
}

// ---------- Trang chi tiết ----------
export async function renderDetail(id) {
  const view = $('#view-detail');
  const p = await getProduct(id);
  if (!p) {
    view.innerHTML = '<div class="empty">Không tìm thấy sản phẩm. <a href="#/">Về danh sách</a></div>';
    return;
  }
  const d = discount(p);
  const out = !(p.stock > 0);
  const specs = Object.entries(p.specs || {});
  const all = await loadProducts();
  const similar = all
    .filter((x) => x.category === p.category && x.id !== p.id)
    .sort((a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price))
    .slice(0, 4);

  document.title = `${p.name} – Linh Kiện PC`;
  view.innerHTML = `
    <nav class="crumbs">
      <a href="#/">Trang chủ</a> › <a href="#/?cat=${esc(p.category)}">${esc(catName(p.category))}</a> ›
      <span>${esc(p.name)}</span>
    </nav>
    <div class="detail">
      <div class="detail-media">${thumb(p, 'big')}</div>
      <div class="detail-info">
        <h1>${esc(p.name)}</h1>
        <p class="hint">Mã: ${esc(p.id)}${p.brand ? ` · Hãng: ${esc(p.brand)}` : ''}</p>
        <div class="pprice big-price">
          <strong>${money(p.price)}</strong>
          ${d ? `<s>${money(p.oldPrice)}</s> <span class="tag-sale inline">-${d}%</span>` : ''}
        </div>
        ${p.summary ? `<div class="keyspecs"><h3>Thông số chính</h3><p>${esc(p.summary)}</p></div>` : ''}
        <p class="stock ${out ? 'out' : ''}">${out ? 'Tạm hết hàng' : `Còn hàng (${p.stock})`}</p>
        <div class="buy-row" id="buy-row">
          <label class="qty">SL
            <input id="qty" type="number" min="1" max="${Math.min(10, p.stock || 1)}" value="1" inputmode="numeric" ${out ? 'disabled' : ''}>
          </label>
          <button type="button" class="btn" data-add="${esc(p.id)}" data-qty-from="#qty" ${out ? 'disabled' : ''}>Thêm vào giỏ</button>
          <button type="button" class="btn primary" data-buy="${esc(p.id)}" data-qty-from="#qty" ${out ? 'disabled' : ''}>Mua ngay</button>
        </div>
        <ul class="policy">
          <li>Bảo hành chính hãng${p.specs?.['Bảo hành'] ? ` ${esc(p.specs['Bảo hành'])}` : ''}</li>
          <li>Đổi trả trong 7 ngày nếu lỗi do nhà sản xuất</li>
          <li>Miễn phí giao hàng cho đơn từ 5.000.000₫</li>
          <li>Thanh toán khi nhận hàng (COD) hoặc chuyển khoản</li>
        </ul>
      </div>
    </div>

    ${specs.length ? `
    <section class="block">
      <h2>Thông số kỹ thuật</h2>
      <table class="specs"><tbody>
        ${specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
      </tbody></table>
    </section>` : ''}

    ${p.description ? `<section class="block"><h2>Mô tả</h2><p class="desc">${esc(p.description)}</p></section>` : ''}

    ${similar.length ? `
    <section class="block">
      <h2>Sản phẩm tương tự</h2>
      <div class="grid">${similar.map(card).join('')}</div>
    </section>` : ''}

    <div class="sticky-buy">
      <strong>${money(p.price)}</strong>
      <button type="button" class="btn" data-add="${esc(p.id)}" data-qty-from="#qty" ${out ? 'disabled' : ''}>Thêm vào giỏ</button>
      <button type="button" class="btn primary" data-buy="${esc(p.id)}" data-qty-from="#qty" ${out ? 'disabled' : ''}>Mua ngay</button>
    </div>`;
}
