// Kiểm tra tương thích linh kiện — theo Bảng 4.2 của WebIdea.pdf. Dùng cho công cụ tra cứu của
// nhân viên CSKH (và sau này cho Build PC). Chỉ dựa trên thông số có trong products.specs; thiếu
// thông số thì báo "chưa đủ dữ liệu" thay vì đoán.
//   CPU – Mainboard: khớp socket          Mainboard – RAM: khớp thế hệ DDR
//   Mainboard – Case: khớp kích thước     Nguồn: ≥ tổng TDP × 1,3 (dự phòng 30%) + 100 W cho phần còn lại
//   Tản nhiệt – Case: chiều cao ≤ giới hạn case;  Tản nhiệt – CPU: hỗ trợ socket
//   VGA – Case: chiều dài ≤ giới hạn case

const num = (v) => {
  const m = String(v ?? '').replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : NaN;
};
const list = (v) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s-]/g, '');
const ddr = (v) => (String(v ?? '').toUpperCase().match(/DDR\d/g) || []);
// "Micro-ATX" ~ "M-ATX" ~ "mATX"; "Mini-ITX" ~ "ITX"
const formKey = (v) => {
  const s = norm(v);
  if (s.includes('eatx')) return 'eatx';
  if (s.includes('itx')) return 'itx';
  if (s.includes('micro') || s.includes('matx')) return 'matx';
  if (s.includes('atx')) return 'atx';
  return s;
};

/** parts: { cpu, mainboard, ram, vga, nguon, case, 'tan-nhiet' } (sản phẩm hoặc undefined).
 *  Trả về [{ level: 'ok'|'warn'|'error'|'info', pair, text }]. */
export function checkCompat(parts) {
  const out = [];
  const add = (level, pair, text) => out.push({ level, pair, text });
  const s = (p, k) => p?.specs?.[k];
  const { cpu, mainboard: mb, ram, vga, nguon: psu, case: cs } = parts;
  const cooler = parts['tan-nhiet'];

  if (cpu && mb) {
    const a = s(cpu, 'Socket'), b = s(mb, 'Socket');
    if (!a || !b) add('info', 'CPU – Mainboard', 'Thiếu thông số socket, chưa kiểm tra được.');
    else if (norm(a) === norm(b)) add('ok', 'CPU – Mainboard', `Cùng socket ${a}.`);
    else add('error', 'CPU – Mainboard', `Khác socket: CPU ${a}, mainboard ${b}.`);
  }
  if (mb && ram) {
    const a = ddr(s(mb, 'Chuẩn RAM')), b = ddr(s(ram, 'Chuẩn'));
    if (!a.length || !b.length) add('info', 'Mainboard – RAM', 'Thiếu thông số chuẩn RAM, chưa kiểm tra được.');
    else if (b.some((x) => a.includes(x))) add('ok', 'Mainboard – RAM', `Mainboard hỗ trợ ${b.join('/')}.`);
    else add('error', 'Mainboard – RAM', `Mainboard dùng ${a.join('/')}, RAM là ${b.join('/')}.`);
  }
  if (cpu && ram && s(cpu, 'Bộ nhớ hỗ trợ')) {
    const a = ddr(s(cpu, 'Bộ nhớ hỗ trợ')), b = ddr(s(ram, 'Chuẩn'));
    if (b.length && a.length && !b.some((x) => a.includes(x))) add('error', 'CPU – RAM', `CPU chỉ hỗ trợ ${a.join('/')}.`);
  }
  if (mb && cs) {
    const size = s(mb, 'Kích thước'), sup = list(s(cs, 'Mainboard hỗ trợ'));
    if (!size || !sup.length) add('info', 'Mainboard – Case', 'Thiếu thông số kích thước, chưa kiểm tra được.');
    else if (sup.map(formKey).includes(formKey(size))) add('ok', 'Mainboard – Case', `Case hỗ trợ ${size}.`);
    else add('error', 'Mainboard – Case', `Case chỉ hỗ trợ ${sup.join(', ')}; mainboard là ${size}.`);
  }
  if (vga && cs) {
    const len = num(s(vga, 'Chiều dài')), max = num(s(cs, 'VGA dài tối đa'));
    if (Number.isNaN(len) || Number.isNaN(max)) add('info', 'VGA – Case', 'Thiếu chiều dài VGA hoặc giới hạn của case.');
    else if (len <= max) add('ok', 'VGA – Case', `VGA dài ${len} mm ≤ ${max} mm.`);
    else add('error', 'VGA – Case', `VGA dài ${len} mm, case chỉ chứa ${max} mm.`);
  }
  if (cooler && cs) {
    const h = num(s(cooler, 'Chiều cao')), max = num(s(cs, 'Tản CPU cao tối đa') ?? s(cs, 'Tản khí cao tối đa'));
    if (/nước|aio/i.test(s(cooler, 'Loại') || '')) add('info', 'Tản nhiệt – Case', 'Tản nước: kiểm tra vị trí lắp radiator của case.');
    else if (Number.isNaN(h) || Number.isNaN(max)) add('info', 'Tản nhiệt – Case', 'Thiếu chiều cao tản hoặc giới hạn của case.');
    else if (h <= max) add('ok', 'Tản nhiệt – Case', `Tản cao ${h} mm ≤ ${max} mm.`);
    else add('error', 'Tản nhiệt – Case', `Tản cao ${h} mm, case chỉ cho ${max} mm.`);
  }
  if (cooler && cpu && s(cooler, 'Socket hỗ trợ') && s(cpu, 'Socket')) {
    const ok = list(s(cooler, 'Socket hỗ trợ')).map(norm).includes(norm(s(cpu, 'Socket')));
    add(ok ? 'ok' : 'error', 'Tản nhiệt – CPU', ok ? `Tản hỗ trợ socket ${s(cpu, 'Socket')}.` : `Tản không hỗ trợ socket ${s(cpu, 'Socket')}.`);
  }
  if (psu) {
    const watt = num(s(psu, 'Công suất'));
    const tdp = (num(s(cpu, 'TDP')) || 0) + (num(s(vga, 'TDP')) || 0);
    const rec = num(s(vga, 'Nguồn đề nghị'));
    if (Number.isNaN(watt)) add('info', 'Nguồn', 'Thiếu thông số công suất nguồn.');
    else if (!tdp && Number.isNaN(rec)) add('info', 'Nguồn', 'Chọn thêm CPU / VGA để tính công suất cần thiết.');
    else {
      const need = Math.max(Math.ceil((tdp * 1.3 + 100) / 50) * 50, Number.isNaN(rec) ? 0 : rec);
      if (watt >= need) add('ok', 'Nguồn', `${watt} W ≥ khuyến nghị ${need} W (TDP ${tdp} W + dự phòng 30%).`);
      else if (watt >= tdp + 100) add('warn', 'Nguồn', `${watt} W hơi sát: khuyến nghị ${need} W.`);
      else add('error', 'Nguồn', `${watt} W không đủ: khuyến nghị ${need} W.`);
    }
  }
  return out;
}
