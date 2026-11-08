// Danh sách sản phẩm (tìm kiếm; lọc theo danh mục, giá, hãng, thông số; sắp xếp; phân trang) và chi tiết.
//
// Cửa hàng nhỏ (vài trăm sản phẩm) nên tải toàn bộ sản phẩm đang bán MỘT lần rồi lọc/sắp xếp
// ở trình duyệt: nhanh, không cần composite index, đổi bộ lọc không tốn lượt đọc Firestore.
// Khi số sản phẩm lên hàng nghìn, chuyển sang truy vấn where(category)+where(price)+orderBy+limit.
import {
  collection, query, where, getDocs, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { db } from './firebase.js';
import { CATEGORIES, PRICE_RANGES, SPEC_FILTERS, catName } from './categories.js';
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

// ---------- Tìm kiếm: không phân biệt dấu, hoa/thường; tìm cả mã model ("14400f", "4060") ----------
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const haystack = new WeakMap();
function matchesQuery(p, words) {
  let h = haystack.get(p);
  if (h === undefined) {
    h = fold([p.name, p.brand, p.id, p.summary, catName(p.category)].join(' '));
    haystack.set(p, h);
  }
  return words.every((w) => h.includes(w));
}
const queryWords = (q) => fold(q).split(/\s+/).filter(Boolean);

// ---------- Bộ lọc chọn nhiều: hãng + thông số riêng của danh mục ----------
// Trong cùng một nhóm là HOẶC, giữa các nhóm là VÀ. Giá trị trên URL cách nhau bằng dấu phẩy.
const BRAND = { key: 'hang', label: 'Hãng' };
const groupsFor = (cat) => [BRAND, ...(SPEC_FILTERS[cat] || [])];
const selected = (params, key) => (params[key] ? params[key].split(',').filter(Boolean) : []);
function valuesOf(p, g) {
  if (g === BRAND) return p.brand ? [p.brand] : [];
  const v = p.specs?.[g.spec];
  if (v == null || v === '') return [];
  return g.split ? String(v).split(/\s*,\s*/) : [String(v)];
}

/** Lọc theo tham số URL. `skip`: bỏ qua 1 nhóm (dùng để đếm số sản phẩm của từng lựa chọn). */
function applyFilters(list, params, skip = null) {
  let out = list;
  if (params.cat) out = out.filter((p) => p.category === params.cat);
  const words = queryWords(params.q);
  if (words.length) out = out.filter((p) => matchesQuery(p, words));
  const b = priceBounds(params);
  if (b) out = out.filter((p) => p.price >= b.min && p.price <= b.max);
  if (params.con === '1') out = out.filter((p) => p.stock > 0);
  for (const g of groupsFor(params.cat)) {
    if (g.key === skip) continue;
    const want = selected(params, g.key);
    if (want.length) out = out.filter((p) => valuesOf(p, g).some((v) => want.includes(v)));
  }
  return out;
}

function sortList(out, params) {
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
// Đổi danh mục thì bỏ các bộ lọc riêng của danh mục cũ (hãng, thông số), giữ tìm kiếm/giá/sắp xếp.
function catHref(params, cat) {
  const keep = {};
  for (const k of ['q', 'gia', 'min', 'max', 'con', 'sx']) if (params[k]) keep[k] = params[k];
  return listHref(keep, { cat });
}

function toggleHref(params, key, value) {
  const cur = selected(params, key);
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  return listHref(params, { [key]: next.join(',') });
}

const SR_ON = '<span class="sr-only"> (đang chọn)</span>';
const byNatural = (a, b) => a.localeCompare(b, 'vi', { numeric: true });

/** Các nhóm lọc chọn nhiều. Mỗi lựa chọn hiện số sản phẩm nếu chọn thêm nó. */
function facetHtml(all, params) {
  // Ở "Tất cả sản phẩm" có quá nhiều hãng; chỉ hiện khi đã chọn danh mục hoặc đang tìm kiếm.
  if (!params.cat && !params.q) return '';
  return groupsFor(params.cat).map((g) => {
    const want = selected(params, g.key);
    const base = applyFilters(all, params, g.key);
    const counts = new Map();
    for (const p of base) for (const v of valuesOf(p, g)) counts.set(v, (counts.get(v) || 0) + 1);
    for (const v of want) if (!counts.has(v)) counts.set(v, 0);
    if (counts.size < 2 && !want.length) return '';          // chỉ 1 lựa chọn thì không cần lọc
    const opts = [...counts.keys()].sort(byNatural).map((v) => {
      const on = want.includes(v);
      return `<a class="opt ${on ? 'on' : ''}" href="${toggleHref(params, g.key, v)}">${esc(v)}${on ? SR_ON : ''} <small>${counts.get(v)}</small></a>`;
    }).join('');
    return `<div class="filter-group"><h3>${esc(g.label)}</h3>${opts}</div>`;
  }).join('');
}

export async function renderList(params) {
  const all = await loadProducts();
  const cat = params.cat && CATEGORIES.some((c) => c.key === params.cat) ? params.cat : '';
  params = { ...params, cat };
  const q = (params.q || '').trim();

  const title = q ? `Kết quả cho “${q}”` : cat ? catName(cat) : 'Tất cả sản phẩm';
  $('#list-crumbs').innerHTML = cat || q
    ? `<a href="#/">Trang chủ</a> › <span aria-current="page">${esc(cat ? catName(cat) : 'Tìm kiếm')}</span>`
    : '<span aria-current="page">Trang chủ</span>';
  $('#list-title').textContent = title;
  document.title = `${title} – Linh Kiện PC`;
  $('#search-q').value = q;

  // Chip danh mục (lối vào nhanh). Số đếm theo tìm kiếm hiện tại.
  const words = queryWords(q);
  const pool = words.length ? all.filter((p) => matchesQuery(p, words)) : all;
  const count = (key) => pool.filter((p) => p.category === key).length;
  const chip = (key, label, n) => `<a class="chip ${cat === key ? 'on' : ''}" href="${catHref(params, key)}"${cat === key ? ' aria-current="true"' : ''}>${esc(label)}${n == null ? '' : ` <small>${n}</small>`}</a>`;
  $('#cat-chips').innerHTML = [chip('', 'Tất cả'), ...CATEGORIES.map((c) => chip(c.key, c.name, count(c.key)))].join('');

  // Bộ lọc bên trái
  $('#f-cats').innerHTML = [
    `<a class="opt ${cat ? '' : 'on'}" href="${catHref(params, '')}">Tất cả${cat ? '' : SR_ON}</a>`,
    ...CATEGORIES.map((c) => `<a class="opt ${cat === c.key ? 'on' : ''}" href="${catHref(params, c.key)}">${esc(c.name)}${cat === c.key ? SR_ON : ''}</a>`)
  ].join('');
  $('#f-prices').innerHTML = PRICE_RANGES.map((r) => {
    const on = params.gia === r.key;
    return `<a class="opt ${on ? 'on' : ''}" href="${listHref(params, { gia: on ? '' : r.key, min: '', max: '' })}">${esc(r.label)}${on ? SR_ON : ''}</a>`;
  }).join('');
  $('#f-facets').innerHTML = facetHtml(all, params);
  const fc = $('#f-custom');
  fc.min.value = params.min || '';
  fc.max.value = params.max || '';
  $('#f-stock').checked = params.con === '1';
  $('#sort').value = params.sx || 'pop';

  // Chip bộ lọc đang áp dụng (bấm để bỏ)
  const active = [];
  const rm = (href, label) => active.push(`<a class="chip on" href="${href}" aria-label="Bỏ lọc ${esc(label)}">${esc(label)} <span aria-hidden="true">✕</span></a>`);
  if (q) rm(listHref(params, { q: '' }), `“${q}”`);
  if (cat) rm(catHref(params, ''), catName(cat));
  const b = priceBounds(params);
  if (b) rm(listHref(params, { gia: '', min: '', max: '' }), b.label);
  if (params.con === '1') rm(listHref(params, { con: '' }), 'Còn hàng');
  for (const g of groupsFor(cat)) for (const v of selected(params, g.key)) rm(toggleHref(params, g.key, v), `${g.label}: ${v}`);
  if (active.length > 1) active.push(`<a class="link" href="${listHref({}, {})}">Xóa tất cả</a>`);
  $('#active-filters').innerHTML = active.join('');

  // Kết quả + phân trang
  const list = sortList(applyFilters(all, params), params);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.trang) || 1), pages);
  const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  $('#result-count').textContent = `${list.length} sản phẩm`;
  $('#grid').innerHTML = slice.length
    ? slice.map(card).join('')
    : `<div class="empty">Không có sản phẩm phù hợp${q ? ` với “${esc(q)}”` : ''}.
        ${active.length ? `<a href="${listHref({}, {})}">Bỏ tất cả bộ lọc</a>` : ''}</div>`;

  $('#pager').innerHTML = pages > 1
    ? [
        page > 1 ? `<a href="${listHref(params, { trang: page - 1 })}" aria-label="Trang trước">‹</a>` : '',
        ...Array.from({ length: pages }, (_, i) => i + 1)
          .map((n) => `<a class="${n === page ? 'on' : ''}" href="${listHref(params, { trang: n })}" aria-label="Trang ${n}"${n === page ? ' aria-current="page"' : ''}>${n}</a>`),
        page < pages ? `<a href="${listHref(params, { trang: page + 1 })}" aria-label="Trang sau">›</a>` : ''
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
