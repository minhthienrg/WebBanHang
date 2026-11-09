// Chuyển dữ liệu linh kiện của nhóm (collection `components` trên project do-an-1-nmcntt,
// định dạng BuildCores OpenDB) sang định dạng `products` của web này.
//
//   node tools/convert-nexora.mjs              (cần mạng: kiểm tra từng ảnh)
//   node tools/convert-nexora.mjs --no-check   (bỏ qua kiểm tra ảnh)
//
// Vào:  ../AdminSource/nexora-components.json   (bản sao chỉ-đọc từ Firestore của nhóm)
//       ../AdminSource/anh-san-pham.json           (ảnh thay thế cho link Amazon trống, có trang nguồn)
//       ../AdminSource/gia-thi-truong-2026-11.json (giá bán theo thị trường, ghi đè giá của nhóm; có nguồn từng shop)
// Ra:   public/admin/nexora-data.js              (export NEXORA_PRODUCTS)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SRC = new URL('../../AdminSource/nexora-components.json', import.meta.url);
const OUT = new URL('../public/admin/nexora-data.js', import.meta.url);
const PRICES = new URL('../../AdminSource/gia-thi-truong-2026-11.json', import.meta.url);
const IMAGES = new URL('../../AdminSource/anh-san-pham.json', import.meta.url);
const IMG = existsSync(IMAGES) ? JSON.parse(readFileSync(IMAGES, 'utf8')).products : {};
const MARKET = existsSync(PRICES) ? JSON.parse(readFileSync(PRICES, 'utf8')).products : {};
const USED_NOTE = 'Hàng đã qua sử dụng (2nd). Dòng sản phẩm đã ngừng bán mới; giá tham khảo thị trường hàng cũ tháng 11/2026.';

const CAT = {
  CPU: 'cpu', Motherboard: 'mainboard', RAM: 'ram', GPU: 'vga',
  Storage: 'o-cung', PSU: 'nguon', PCCase: 'case', CPUCooler: 'tan-nhiet'
};
// Tiền tố tên giống dữ liệu mẫu ("CPU Intel…", "Mainboard ASUS…").
const PREFIX = {
  cpu: 'CPU', mainboard: 'Mainboard', ram: 'RAM', vga: 'Card màn hình',
  'o-cung': 'Ổ cứng', nguon: 'Nguồn', case: 'Case', 'tan-nhiet': 'Tản nhiệt'
};
const SKIP_NAMES = [/^test linh kien$/i];   // bản ghi thử của nhóm

// ---------- tiện ích ----------
const s = (v) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const yesNo = (b) => (b ? 'Có' : 'Không');
// "LGA 1700" → "LGA1700" để cùng một giá trị giữa CPU, mainboard, tản nhiệt.
const sock = (v) => s(v).replace(/^LGA\s+/i, 'LGA');
const ff = (v) => s(v).replace(/^Micro ATX/i, 'Micro-ATX').replace(/^EATX$/i, 'E-ATX');
const gb = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}TB` : `${n}GB`);
const chip = (v) => s(v).replace(/^(Intel|AMD)\s+/i, '');
function slug(t) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => s(v) !== '' && v !== '0 W'));

// ---------- thông số theo danh mục (tên khóa khớp SPEC_FILTERS trong js/categories.js) ----------
const SPECS = {
  cpu(r) {
    const c = r.cores || {}, sp = r.specifications || {};
    const ig = s(sp.integratedGraphics?.model);
    return {
      'Socket': sock(r.socket),
      'Số nhân / luồng': c.total ? `${c.total} / ${c.threads || c.total}` : '',
      'Xung boost': r.clocks?.performance?.boost ? `${r.clocks.performance.boost} GHz` : '',
      'TDP': num(sp.tdp || r.tdp || r.wattage) ? `${num(sp.tdp || r.tdp || r.wattage)} W` : '',
      'Bộ nhớ hỗ trợ': (sp.memory?.types || []).slice().sort().join(', ') || s(r.ram_type),
      'Đồ họa tích hợp': sp.integratedGraphics ? (ig && ig !== 'None' ? ig : 'Không') : '',
      'Kiến trúc': s(r.microarchitecture)
    };
  },
  mainboard(r) {
    const m = r.memory || {};
    return {
      'Socket': sock(r.socket),
      'Chipset': chip(r.chipset),
      'Kích thước': ff(r.form_factor),
      'Chuẩn RAM': s(m.ram_type || r.ram_type),
      'Số khe RAM': m.slots ? String(m.slots) : '',
      'RAM tối đa': m.max ? `${m.max} GB` : '',
      'Wi-Fi': r.metadata ? yesNo(r.wireless_networking) : ''
    };
  },
  ram(r) {
    const md = r.modules || {};
    return {
      'Chuẩn': s(r.ram_type),
      'Bus': r.speed ? `${r.speed}MHz` : '',
      'Dung lượng': r.capacity ? `${r.capacity}GB${md.quantity ? ` (${md.quantity}×${md.capacity_gb})` : ''}` : '',
      'CAS': r.cas_latency ? `CL${r.cas_latency}` : '',
      'LED RGB': r.metadata ? yesNo(r.rgb) : ''
    };
  },
  vga(r) {
    const fans = s(r.cooling).match(/^(\d+)/);
    return {
      'GPU': s(r.chipset),
      'VRAM': r.memory ? `${r.memory}GB ${s(r.memory_type)}`.trim() : '',
      'Số quạt': fans ? `${fans[1]} quạt` : s(r.cooling),
      'Xung boost': r.core_boost_clock ? `${r.core_boost_clock} MHz` : '',
      'Chiều dài': r.length ? `${r.length} mm` : '',
      'TDP': num(r.tdp) ? `${r.tdp} W` : ''
    };
  },
  'o-cung'(r) {
    const iface = s(r.interface);
    return {
      'Loại': s(r.storage_type),
      'Dung lượng': r.capacity ? gb(num(r.capacity)) : '',
      'Chuẩn': r.nvme ? `M.2 NVMe ${(iface.match(/PCIe \d\.\d/) || [''])[0]}`.trim()
        : /M\.2/i.test(iface) ? 'M.2 SATA' : iface ? 'SATA' : '',
      'Kích thước': s(r.form_factor).replace(/^M\.2-/, 'M.2 ')
    };
  },
  nguon(r) {
    const mod = { Full: 'Full modular', 'Semi-Modular': 'Semi modular', 'Non-Modular': 'Liền dây' }[s(r.modular)] || s(r.modular);
    return {
      'Công suất': r.wattage ? `${r.wattage}W` : '',
      'Chứng nhận': s(r.efficiency_rating) || (r.metadata ? 'Không' : ''),
      'Kiểu dây': mod,
      'Chuẩn': s(r.form_factor)
    };
  },
  case(r) {
    return {
      'Kiểu': s(r.form_factor).replace(/^Micro ATX/i, 'Micro-ATX'),
      'Mainboard hỗ trợ': (r.supported_motherboard_form_factors || []).map(ff).join(', '),
      'VGA dài tối đa': r.max_video_card_length ? `${r.max_video_card_length} mm` : '',
      'Tản CPU cao tối đa': r.max_cpu_cooler_height ? `${r.max_cpu_cooler_height} mm` : '',
      'Kính cường lực': r.side_panel ? (/glass/i.test(r.side_panel) ? 'Có' : 'Không') : ''
    };
  },
  'tan-nhiet'(r) {
    const rad = num(r.radiator_size);
    return {
      'Loại': r.water_cooled ? `Tản nước${rad ? ` ${rad}mm` : ''}` : 'Tản khí',
      'Socket hỗ trợ': (r.cpu_sockets || []).map(sock).join(', '),
      'Chiều cao': r.height ? `${r.height} mm` : '',
      'Quạt': r.fan_size ? `${r.fan_size} mm` : ''
    };
  }
};

// ---------- chuyển đổi ----------
const rows = JSON.parse(readFileSync(SRC, 'utf8'));
const out = [];
const ids = new Set();
const skipped = [];
for (const r of rows) {
  const category = CAT[r.category];
  const rawName = s(r.metadata?.name || r.name);
  if (!category || !rawName || SKIP_NAMES.some((re) => re.test(rawName))) { skipped.push(rawName || r._id); continue; }

  const brand = s(r.metadata?.manufacturer || r.manufacturer) || 'Khác';
  const name = `${PREFIX[category]} ${rawName}`.slice(0, 200);
  const specs = clean(SPECS[category](r));
  if (MARKET[r._id]?.used) specs['Tình trạng'] = 'Hàng cũ (2nd)';
  // Bản ghi thiếu metadata (nhóm tự nhập tay) chỉ có chuỗi `specs` tóm tắt.
  const summary = Object.keys(specs).length >= 2
    ? Object.values(specs).filter((v) => v.length <= 30).slice(0, 4).join(' · ')
    : s(r.specs).replace(/\s+-\s+/g, ' · ');
  if (!Object.keys(specs).length && s(r.specs)) specs['Thông số'] = s(r.specs);

  let id = `${category}-${slug(rawName)}`;
  if (ids.has(id)) id += `-${r._id.slice(0, 4)}`;
  ids.add(id);

  out.push({
    id, category, brand, name,
    price: MARKET[r._id]?.price ?? Math.round(num(r.price)),
    oldPrice: 0,
    stock: r.stock === undefined || r.stock === null ? 10 : Math.max(0, Math.round(num(r.stock))),
    sold: 0,
    summary,
    imageUrl: IMG[r._id]?.image || s(r.image),
    description: MARKET[r._id]?.used ? USED_NOTE : '',
    specs,
    sourceId: r._id
  });
}

// Nhiều link ảnh Amazon (/images/P/<ASIN>…) trả về GIF trong suốt 1×1 (43 byte) thay vì ảnh thật.
// Bỏ các link đó để web dùng ảnh minh họa theo danh mục.
let dropped = 0;
if (!process.argv.includes('--no-check')) {
  await Promise.all(out.map(async (p) => {
    if (!p.imageUrl) return;
    try {
      const r = await fetch(p.imageUrl, { signal: AbortSignal.timeout(15000) });
      const size = (await r.arrayBuffer()).byteLength;
      if (!r.ok || size < 1000) { p.imageUrl = ''; dropped++; }
    } catch { /* lỗi mạng tạm thời: giữ link, web vẫn tự thay ảnh khi tải hỏng */ }
  }));
}

out.sort((a, b) => a.category.localeCompare(b.category) || a.price - b.price);
writeFileSync(OUT,
  '// TỰ SINH bởi tools/convert-nexora.mjs từ AdminSource/nexora-components.json — đừng sửa tay.\n' +
  '// Nguồn: collection `components` của project do-an-1-nmcntt (dữ liệu nhóm NEXORA).\n' +
  `export const NEXORA_PRODUCTS = ${JSON.stringify(out, null, 1)};\n`);
console.log(`Đã chuyển ${out.length} sản phẩm → public/admin/nexora-data.js. Bỏ qua: ${skipped.join(', ') || 'không'}.`);
console.log(`Ảnh trống/hỏng đã thay bằng ảnh danh mục: ${dropped}.`);
console.log(`Ảnh thay thế từ anh-san-pham.json: ${out.filter((p) => IMG[p.sourceId]).length}.`);
const priced = out.filter((p) => MARKET[p.sourceId]).length;
console.log(`Giá thị trường áp dụng: ${priced}/${out.length} (hàng cũ: ${out.filter((p) => MARKET[p.sourceId]?.used).length}).`);
