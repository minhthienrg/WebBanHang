// Hỗ trợ kỹ thuật ban đầu (Bảng 1.2): xem nhanh thông số sản phẩm và kiểm tra tương thích một cấu hình
// khách hỏi (quy tắc Bảng 4.2, xem js/compat.js). Không hiện giá vốn.
import { load, esc, money, num, fold, toast, openDialog, hrefWith } from './core.js';
import { catName } from '../../js/categories.js';
import { checkCompat } from '../../js/compat.js';

const SLOTS = ['cpu', 'mainboard', 'ram', 'vga', 'nguon', 'case', 'tan-nhiet'];
const ICON = { ok: '✓', warn: '!', error: '✕', info: 'i' };
let picked = {};   // giữ cấu hình khi chuyển qua lại trong phiên

export async function render(box, params) {
  const products = (await load('products')).filter((p) => !p.deleted);
  const words = fold(params.q || '').split(/\s+/).filter(Boolean);
  const found = words.length ? products.filter((p) => words.every((w) => fold(`${p.name} ${p.brand} ${p.id} ${p.summary}`).includes(w))).slice(0, 30) : [];
  const label = (p) => `${p.name} [${p.id}]`;

  box.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">Chăm sóc khách hàng</p><h1>Tra cứu &amp; tương thích</h1></div></div>
    <div class="two-col">
      <section class="card">
        <h2>Tra cứu nhanh thông số</h2>
        <form class="toolbar-row" id="lf">
          <label class="grow"><span class="sr-only">Tìm sản phẩm</span>
            <input name="q" type="search" placeholder="Tên, mã model (vd: 14400f, 4060)…" value="${esc(params.q || '')}"></label>
          <button class="btn small" type="submit">Tìm</button>
        </form>
        ${found.length ? `<ul class="lk-list">${found.map((p) => `<li>
            <button type="button" class="link name" data-spec="${esc(p.id)}">${esc(p.name)}</button>
            <div class="sub">${esc(catName(p.category))} · ${money(p.price)} · tồn ${num.format(p.stock || 0)}${p.active ? '' : ' · <span class="neg">đang ẩn</span>'}</div>
            ${SLOTS.includes(p.category) ? `<button type="button" class="btn small" data-pick="${esc(p.id)}">Thêm vào cấu hình</button>` : ''}
          </li>`).join('')}</ul>` : words.length ? '<p class="hint">Không tìm thấy sản phẩm.</p>' : '<p class="hint">Gõ tên hoặc mã sản phẩm khách hỏi.</p>'}
      </section>

      <section class="card">
        <h2>Kiểm tra tương thích</h2>
        <p class="hint">Theo Bảng 4.2: socket CPU–mainboard, DDR mainboard–RAM, kích thước mainboard–case, công suất nguồn (TDP + 30%), chiều cao tản và chiều dài VGA so với case.</p>
        <form class="form" id="cf">
          ${SLOTS.map((k) => `<label>${esc(catName(k))}
            <input name="${k}" list="dl-${k}" autocomplete="off" placeholder="Chọn ${esc(catName(k))}…" value="${picked[k] ? esc(label(picked[k])) : ''}"></label>
            <datalist id="dl-${k}">${products.filter((p) => p.category === k).map((p) => `<option value="${esc(label(p))}">`).join('')}</datalist>`).join('')}
          <div class="head-actions">
            <button type="submit" class="btn small primary">Kiểm tra</button>
            <button type="button" class="btn small" id="cf-clear">Xóa cấu hình</button>
          </div>
        </form>
        <div id="cf-out"></div>
      </section>
    </div>`;

  const lf = box.querySelector('#lf');
  lf.addEventListener('submit', (ev) => { ev.preventDefault(); location.hash = hrefWith('tra-cuu', params, { q: lf.q.value.trim() }); });
  const cf = box.querySelector('#cf');
  const byLabel = (v) => {
    const m = String(v).match(/\[([^\]]+)\]\s*$/);
    return m ? products.find((p) => p.id === m[1]) : null;
  };
  const run = () => {
    picked = {};
    for (const k of SLOTS) { const p = byLabel(cf[k].value); if (p) picked[k] = p; }
    const n = Object.keys(picked).length;
    const res = checkCompat(picked);
    const total = Object.values(picked).reduce((s, p) => s + p.price, 0);
    const errs = res.filter((r) => r.level === 'error').length;
    box.querySelector('#cf-out').innerHTML = n < 2 ? '<p class="hint">Chọn ít nhất 2 linh kiện.</p>' : `
      <p class="${errs ? 'msg err' : 'msg ok'}">${errs ? `${errs} lỗi không tương thích` : 'Không phát hiện lỗi tương thích'} · tổng ${money(total)}</p>
      <ul class="compat">${res.map((r) => `<li class="c-${r.level}"><span class="c-ic" aria-hidden="true">${ICON[r.level]}</span>
        <strong>${esc(r.pair)}</strong> ${esc(r.text)}</li>`).join('') || '<li class="c-info">Chưa có cặp linh kiện nào để so sánh.</li>'}</ul>
      <button type="button" class="btn small" id="cf-copy">Sao chép kết quả để gửi khách</button>`;
    box.querySelector('#cf-copy')?.addEventListener('click', async () => {
      const text = ['Kiểm tra cấu hình NEXORA:', ...SLOTS.filter((k) => picked[k]).map((k) => `- ${catName(k)}: ${picked[k].name} (${money(picked[k].price)})`),
        `Tổng: ${money(total)}`, ...res.map((r) => `${r.level === 'ok' ? '✓' : r.level === 'error' ? '✕' : '•'} ${r.pair}: ${r.text}`)].join('\n');
      try { await navigator.clipboard.writeText(text); toast('Đã sao chép, dán vào khung chat với khách.'); }
      catch { toast('Trình duyệt chặn sao chép; hãy bôi đen và sao chép thủ công.', 'err'); }
    });
  };
  cf.addEventListener('submit', (ev) => { ev.preventDefault(); run(); });
  box.querySelector('#cf-clear').addEventListener('click', () => { picked = {}; cf.reset(); SLOTS.forEach((k) => { cf[k].value = ''; }); box.querySelector('#cf-out').innerHTML = ''; });
  if (Object.keys(picked).length) run();

  box.onclick = (ev) => {
    const s = ev.target.closest('[data-spec]');
    if (s) {
      const p = products.find((x) => x.id === s.dataset.spec);
      openDialog(p.name, `
        <p class="sub">${esc(p.id)} · ${esc(catName(p.category))}${p.brand ? ` · ${esc(p.brand)}` : ''}</p>
        <p><strong>${money(p.price)}</strong>${p.oldPrice > p.price ? ` <s class="sub">${money(p.oldPrice)}</s>` : ''} · tồn kho ${num.format(p.stock || 0)}
          ${p.warrantyMonths ? ` · bảo hành ${p.warrantyMonths} tháng${p.warrantyProvider ? ` (${esc(p.warrantyProvider)})` : ''}` : ''}</p>
        <table class="tbl"><tbody>${Object.entries(p.specs || {}).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
        ${p.description ? `<p class="mt">${esc(p.description)}</p>` : ''}
        <p class="mt"><a href="../#/sp/${esc(p.id)}" target="_blank" rel="noopener">Mở trang sản phẩm</a></p>`, { wide: true });
    }
    const pk = ev.target.closest('[data-pick]');
    if (pk) {
      const p = products.find((x) => x.id === pk.dataset.pick);
      cf[p.category].value = label(p);
      run();
      toast(`Đã thêm ${catName(p.category)} vào cấu hình.`);
    }
  };
}

