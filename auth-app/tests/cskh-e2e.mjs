// E2E vai trò Chăm sóc khách hàng (Bảng 1.2, 1.3 WebIdea.pdf) trên Firebase Emulator:
// admin gán vai trò + hạn mức hoàn tiền → khách gửi yêu cầu, đánh giá → nhân viên CSKH xử lý (chat realtime,
// mẫu trả lời, đóng phiếu + khảo sát hài lòng, đơn hàng theo luồng, giao thất bại, hoàn tiền trong hạn mức,
// duyệt đánh giá, bảo hành, ghi chú, thành viên, ưu đãi riêng, kiểm tra tương thích) → giới hạn quyền.
// Chạy: ./run.sh cskh (hoặc ./run.sh). Ảnh chụp: tests/shots/cskh-*.png.
import { mkdirSync, readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore';
import { chromium } from 'playwright';
import { SEED_PRODUCTS } from '../public/admin/seed-data.js';

const BASE = 'http://127.0.0.1:5000';
const AUTH = 'http://127.0.0.1:9099';
const PROJECT = 'demo-webbanhang';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 }
});
await env.clearFirestore();
await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });

async function signUp(email, password) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  return (await r.json()).localId;
}
const PASS = 'matkhau123';
const ADMIN = 'admin@nexora.test', STAFF = 'cskh@nexora.test', KHACH = 'khach@nexora.test';
const adminUid = await signUp(ADMIN, PASS);
const staffUid = await signUp(STAFF, PASS);
const khachUid = await signUp(KHACH, PASS);

const P = (id) => SEED_PRODUCTS.find((p) => p.id === id);
const CPU = P('cpu-intel-i5-14400f'), VGA = P('vga-gigabyte-rtx4070-super'), RAM = P('ram-kingston-fury-16-d4-3200');
const line = (p, qty = 1) => ({ productId: p.id, name: p.name, price: p.price, qty });
const mkOrder = (items, status, extra = {}) => {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  return { userId: khachUid, items, subtotal, shippingFee: 0, total: subtotal, voucher: '', discount: 0,
    shipping: { name: 'Khách Thử', phone: '0987654321', address: '1 Lê Lợi, Q.1' }, paymentMethod: 'cod', note: '',
    status, createdAt: Timestamp.fromMillis(Date.now() - 40 * 86400000), updatedAt: Timestamp.now(), ...extra };
};
const DONE_ORDER = mkOrder([line(VGA), line(CPU)], 'done', { stockDeducted: true, doneAt: Timestamp.fromMillis(Date.now() - 35 * 86400000) });

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  let t = Date.now();
  for (const { id, ...p } of SEED_PRODUCTS) {
    await setDoc(doc(db, 'products', id), { imageUrl: '', description: '', ...p, active: true, createdAt: Timestamp.fromMillis(t--) });
  }
  await setDoc(doc(db, 'admins', adminUid), {});
  await setDoc(doc(db, 'users', staffUid), { name: 'Nhân Viên', phone: '', address: '', email: STAFF, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  await setDoc(doc(db, 'orders', 'don-xong'), DONE_ORDER);
  await setDoc(doc(db, 'orders', 'don-cho'), mkOrder([line(RAM)], 'pending', { createdAt: Timestamp.fromMillis(Date.now() - 2 * 86400000) }));
  await setDoc(doc(db, 'orders', 'don-giao'), mkOrder([line(RAM)], 'shipping', { stockDeducted: true }));
});
async function asAdmin(fn) { let out; await env.withSecurityRulesDisabled(async (ctx) => { out = await fn(ctx.firestore()); }); return out; }
const read = (path) => asAdmin(async (db) => (await getDoc(doc(db, path))).data());
const where1 = (name, k, v) => asAdmin(async (db) => (await getDocs(query(collection(db, name), where(k, '==', v)))).docs.map((d) => ({ id: d.id, ...d.data() })));

const browser = await chromium.launch();
const errors = [];
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); }
};
async function step(name, fn) {
  try { const r = await fn(); check(name, r !== false); } catch (e) { check(name, false, e.message.split('\n')[0]); }
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth
  && [...document.querySelectorAll('#view *, .topbar *, main *')].every((el) => el.closest('.tbl-wrap, .chips, .side, .chat') || el.getBoundingClientRect().right <= window.innerWidth + 1));
async function newPage(viewport, tag, extra = {}) {
  const ctx = await browser.newContext({ viewport, ...extra });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text().split('\n')[0]}`); });
  page.on('popup', (p) => p.close().catch(() => {}));   // mailto:
  return page;
}
async function login(page, email) {
  await page.goto(`${BASE}/#/dang-nhap`);
  await page.fill('#form-login [name=email]', email);
  await page.fill('#form-login [name=password]', PASS);
  await page.click('#form-login [type=submit]');
}
const toast = (page, text) => page.waitForFunction((t) => document.querySelector('#msg')?.textContent.includes(t), text, { timeout: 15000 });
const view = (page, h1) => page.waitForFunction((t) => document.querySelector('#view h1')?.textContent.includes(t), h1, { timeout: 15000 });

// ================= Admin: gán vai trò CSKH, hạn mức hoàn tiền =================
console.log('\n== Quản trị viên cấu hình CSKH ==');
const ad = await newPage({ width: 1280, height: 900 }, 'admin');
await login(ad, ADMIN);
await ad.waitForURL(/\/admin\//, { timeout: 15000 });
await ad.goto(`${BASE}/admin/#/cai-dat`);
await view(ad, 'Cài đặt');
await ad.fill('#sfm [name=email]', STAFF);
await ad.click('#sfm [type=submit]');
await ad.click('#ask-form [type=submit]');
await step('admin gán vai trò CSKH cho nhân viên', async () => { await toast(ad, 'Đã gán vai trò CSKH'); return (await read(`staff/${staffUid}`))?.role === 'cskh'; });
await ad.fill('#rl [name=limit]', '500000');
await ad.click('#rl [type=submit]');
await step('admin đặt hạn mức hoàn tiền 500.000₫', async () => { await toast(ad, 'Đã lưu hạn mức'); return (await read('settings/support'))?.refundLimit === 500000; });

// ================= Khách: đánh giá, hạng thành viên, gửi yêu cầu đổi trả =================
console.log('\n== Khách hàng ==');
const kh = await newPage({ width: 1280, height: 900 }, 'khach');
await login(kh, KHACH);
await kh.waitForFunction(() => location.hash === '#/tai-khoan', null, { timeout: 15000 });
await step('khách thấy hạng S-Member và điểm tích lũy (1 điểm / 10.000₫)', async () => {
  await kh.waitForSelector('#member-box .member-tier');
  const t = await kh.textContent('#member-box');
  return t.includes('S-Member') && t.includes(new Intl.NumberFormat('vi-VN').format(Math.floor(DONE_ORDER.total / 10000)));
});
await step('đơn hoàn tất có nút yêu cầu đổi trả / bảo hành', () => kh.waitForSelector('#orders a[href*="loai=doi-tra"]'));
await step('đơn đang giao có nút hỏi về giao hàng', () => kh.waitForSelector('#orders a[href*="loai=giao-hang"]'));

await kh.goto(`${BASE}/#/sp/${CPU.id}`);
await kh.waitForSelector('#rv-form');
await kh.check('#rv-form [name=rating][value="5"]');
await kh.fill('#rv-form [name=text]', 'CPU mát, chạy ổn định, giao nhanh.');
await kh.click('#rv-form [type=submit]');
await step('khách gửi đánh giá → chờ duyệt', async () => { await kh.waitForSelector('#reviews .note'); return (await kh.textContent('#reviews .note')).includes('chờ'); });
await step('đánh giá chưa duyệt chưa hiện công khai', async () => (await kh.locator('#reviews .rv').count()) === 0);

await kh.goto(`${BASE}/#/tai-khoan`);
await kh.waitForSelector('#orders a[href*="loai=doi-tra"]');
await kh.click('#orders a[href*="loai=doi-tra"]');
await kh.waitForSelector('#tk-form');
await step('form yêu cầu điền sẵn loại "đổi trả" và đơn hàng', async () =>
  (await kh.inputValue('#tk-form [name=category]')) === 'doi-tra' && (await kh.inputValue('#tk-form [name=orderId]')) === 'don-xong');
await kh.fill('#tk-form [name=subject]', 'Card màn hình bị sọc');
await kh.fill('#tk-form [name=text]', 'Tôi muốn đổi trả sản phẩm vì: VGA bị sọc màn hình sau 1 tháng.');
await kh.click('#tk-form [type=submit]');
await step('gửi yêu cầu hỗ trợ → vào trang hội thoại', () => kh.waitForFunction(() => /^#\/ho-tro\/[A-Za-z0-9]+$/.test(location.hash) && document.querySelectorAll('#chat li.me').length === 1, null, { timeout: 15000 }));
const ticketId = (await kh.evaluate(() => location.hash)).split('/').pop();
await kh.screenshot({ path: `${SHOTS}cskh-1-khach-chat.png`, fullPage: true });

// ================= Nhân viên CSKH =================
console.log('\n== Nhân viên CSKH ==');
const st = await newPage({ width: 1280, height: 900 }, 'cskh');
await login(st, STAFF);
await step('nhân viên đăng nhập → chuyển thẳng tới trang quản lý', () => st.waitForURL(/\/admin\//, { timeout: 15000 }));
await step('trang đầu là Tổng quan CSKH', () => view(st, 'Tổng quan CSKH'));
await step('menu không có Sản phẩm, Kho, Báo cáo, Mã giảm giá, Nhật ký, Dashboard', async () => {
  for (const v of ['san-pham', 'kho', 'bao-cao', 'khuyen-mai', 'nhat-ky', 'tong-quan']) if (await st.locator(`#side a[data-view="${v}"]`).isVisible()) return false;
  return st.locator('#side a[data-view="ho-tro"]').isVisible();
});
await step('Tổng quan CSKH cảnh báo đơn chờ quá 24 giờ', async () => (await st.textContent('.todo')).includes('Quá 24 giờ'));
await st.screenshot({ path: `${SHOTS}cskh-2-tong-quan.png`, fullPage: true });
await st.goto(`${BASE}/admin/#/kho`);
await step('vào thẳng #/kho bị chặn', async () => { await toast(st, 'không có quyền'); return !(await st.evaluate(() => location.hash.includes('kho'))); });

// Mẫu trả lời nhanh
await st.goto(`${BASE}/admin/#/ho-tro`);
await view(st, 'Yêu cầu hỗ trợ');
await step('yêu cầu của khách có trong hàng đợi', () => st.waitForSelector(`a[href="#/ho-tro/${ticketId}"]`));
await st.click('#btn-tpl');
await st.fill('#tpf [name=title]', 'Đổi trả');
await st.fill('#tpf [name=text]', 'Chào {ten}, NEXORA đã nhận yêu cầu cho đơn {ma_don}. Bạn mang sản phẩm tới cửa hàng giúp mình nhé.');
await st.click('#tpf [type=submit]');
await step('tạo mẫu trả lời nhanh', () => toast(st, 'Đã lưu mẫu'));
await st.click('#dlg [data-close]');

await st.goto(`${BASE}/admin/#/ho-tro/${ticketId}`);
await st.waitForSelector('#th-head h1');
await step('xem hội thoại + thông tin khách và đơn liên quan', async () => (await st.textContent('#th-side')).includes('S-Member') && (await st.textContent('#th-side')).includes('#DON-XONG'));
await st.click('[data-act=claim]');
await step('nhận phiếu', async () => { await st.waitForFunction(() => document.querySelector('#th-head').textContent.includes('cskh@nexora.test')); return true; });
const tplId = await st.$eval('#reply [name=tpl] option:nth-child(2)', (o) => o.value);
await st.selectOption('#reply [name=tpl]', tplId);
await step('chèn mẫu trả lời, tự thay tên khách và mã đơn', async () => {
  const v = await st.inputValue('#reply [name=text]');
  return v.includes('Chào khach') && v.includes('#DON-XONG');
});
await st.click('#reply [value=waiting]');
await step('khách nhận tin nhắn của nhân viên ngay (realtime)', () => kh.waitForFunction(() => document.querySelectorAll('#chat li.them').length >= 1, null, { timeout: 15000 }));
await step('phiếu chuyển sang "Chờ bạn phản hồi" ở phía khách', () => kh.waitForFunction(() => document.querySelector('#tk-head .status').textContent.includes('Chờ bạn')));
await kh.fill('#reply [name=text]', 'Chiều mai mình mang tới được không?');
await kh.click('#reply [type=submit]');
await step('nhân viên thấy tin nhắn mới của khách ngay', () => st.waitForFunction(() => [...document.querySelectorAll('#chat li.them .bubble')].some((b) => b.textContent.includes('Chiều mai')), null, { timeout: 15000 }));
await st.screenshot({ path: `${SHOTS}cskh-3-thread.png`, fullPage: true });
await st.fill('#reply [name=text]', 'Được bạn nhé, mình đã ghi chú lại.');
await st.click('#reply [value=close]');
await step('gửi & đóng phiếu', async () => { await toast(st, 'Đã đóng phiếu'); return (await read(`tickets/${ticketId}`)).status === 'closed'; });
await step('khách nhận khảo sát hài lòng tự động', () => kh.waitForSelector('#rate', { timeout: 15000 }));
await kh.check('#rate [name=rating][value="4"]');
await kh.fill('#rate [name=c]', 'Nhân viên hỗ trợ nhanh');
await kh.click('#rate [type=submit]');
await step('khách chấm điểm hài lòng', async () => { await toast(kh, 'Cảm ơn bạn đã đánh giá'); return (await read(`tickets/${ticketId}`)).rating === 4; });

// Tạo phiếu hộ khi khách gọi hotline
await st.goto(`${BASE}/admin/#/ho-tro`);
await view(st, 'Yêu cầu hỗ trợ');
await st.click('#btn-new');
await st.fill('#nt [name=email]', KHACH);
await st.selectOption('#nt [name=category]', 'giao-hang');
await st.fill('#nt [name=order]', 'don-giao');
await st.fill('#nt [name=subject]', 'Hỏi tiến độ giao đơn RAM');
await st.fill('#nt [name=text]', 'Khách gọi hotline hỏi khi nào giao.');
await st.click('#nt [type=submit]');
await step('tạo phiếu hộ khách gọi hotline', async () => { await toast(st, 'Đã tạo phiếu'); return (await where1('tickets', 'channel', 'phone')).length === 1; });

// ---- Đơn hàng theo luồng ----
await st.goto(`${BASE}/admin/#/don-hang/don-cho`);
await st.waitForSelector('#sf');
await step('CSKH chỉ chọn được bước tiếp theo (Đã xác nhận / Đã hủy)', async () => {
  const opts = await st.$$eval('#sf [name=status] option', (os) => os.map((o) => o.value));
  return opts.join(',') === 'confirmed,cancelled';
});
const ramBefore = (await read(`products/${RAM.id}`)).stock;
await st.click('#sf [type=submit]');
await step('CSKH xác nhận đơn → trừ tồn kho', async () => {
  await toast(st, 'Đã xác nhận');
  return (await read('orders/don-cho')).status === 'confirmed' && (await read(`products/${RAM.id}`)).stock === ramBefore - 1;
});
await st.goto(`${BASE}/admin/#/don-hang/don-giao`);
await st.waitForSelector('#sf');
await st.selectOption('#sf [name=status]', 'failed');
await st.fill('#sf [name=note]', 'Shipper gọi khách không nghe máy');
await st.click('#sf [type=submit]');
await step('CSKH báo giao thất bại', async () => { await toast(st, 'Giao thất bại'); return (await read('orders/don-giao')).status === 'failed'; });
await st.goto(`${BASE}/admin/#/cskh`);
await step('Tổng quan CSKH cảnh báo đơn giao thất bại', async () => { await view(st, 'Tổng quan CSKH'); return (await st.textContent('.todo')).includes('giao thất bại'); });

// ---- Hoàn tiền trong hạn mức ----
await st.goto(`${BASE}/admin/#/don-hang/don-xong`);
await st.waitForSelector('#rf-box summary');
await step('đơn hoàn tất: CSKH không đổi được trạng thái', async () => (await st.locator('#sf').count()) === 0);
await st.click('#rf-box summary');
await st.fill('#rff [name=amount]', '600000');
await st.fill('#rff [name=reason]', 'Bù phí do lỗi');
await st.click('#rff [type=submit]');
await step('hoàn tiền vượt hạn mức bị chặn', () => toast(st, 'Vượt hạn mức'));
await st.fill('#rff [name=amount]', '200000');
await st.click('#rff [type=submit]');
await step('hoàn tiền trong hạn mức', async () => { await toast(st, 'Đã ghi nhận hoàn'); return (await where1('refunds', 'orderId', 'don-xong')).length === 1; });
await st.screenshot({ path: `${SHOTS}cskh-4-hoan-tien.png`, fullPage: true });

// ---- Duyệt đánh giá ----
await st.goto(`${BASE}/admin/#/danh-gia`);
await view(st, 'Đánh giá');
await st.waitForSelector(`[data-reply="${CPU.id}_${khachUid}"]`);
await st.fill(`[data-reply="${CPU.id}_${khachUid}"] [name=reply]`, 'Cảm ơn bạn đã tin chọn NEXORA!');
await st.click(`[data-reply="${CPU.id}_${khachUid}"] [value=approved]`);
await step('duyệt và phản hồi đánh giá', async () => { await toast(st, 'Đã duyệt'); return (await read(`reviews/${CPU.id}_${khachUid}`)).status === 'approved'; });

// ---- Bảo hành ----
await st.goto(`${BASE}/admin/#/bao-hanh?q=0987654321&tt=tat-ca`);
await view(st, 'Bảo hành');
await step('tra cứu theo SĐT: thấy sản phẩm đã mua và hạn bảo hành', async () => {
  await st.waitForSelector('[data-new="don-xong"]');
  return (await st.textContent('#view')).includes('Còn hạn');
});
await st.click(`[data-new="don-xong"][data-pid="${VGA.id}"]`);
await st.fill('#cw [name=serial]', 'SN-4070-0001');
await st.fill('#cw [name=center]', 'TT bảo hành Gigabyte Q.10');
await st.fill('#cw [name=issue]', 'Sọc màn hình khi chơi game');
await st.click('#cw [type=submit]');
await step('tạo phiếu bảo hành từ đơn đã mua', async () => { await toast(st, 'Đã tạo phiếu bảo hành'); return (await where1('warranties', 'userId', khachUid)).length === 1; });
const wId = (await where1('warranties', 'userId', khachUid))[0].id;
await st.goto(`${BASE}/admin/#/bao-hanh/${wId}`);
await st.waitForSelector('#uw');
await st.selectOption('#uw [name=status]', 'sent');
await st.fill('#uw [name=note]', 'Đã gửi hãng, dự kiến 7 ngày');
await st.click('#uw [type=submit]');
await step('cập nhật tiến độ bảo hành', async () => { await toast(st, 'Đã cập nhật'); const w = await read(`warranties/${wId}`); return w.status === 'sent' && w.history.length === 2; });

// ---- Khách hàng: thành viên, ghi chú, ưu đãi riêng ----
await st.goto(`${BASE}/admin/#/khach-hang?q=${KHACH}`);
await view(st, 'Khách hàng');
await step('CSKH không thấy nút khóa tài khoản', async () => (await st.locator('[data-ban]').count()) === 0);
await st.click(`[data-open="${khachUid}"]`);
await st.waitForSelector('#nf');
await st.selectOption('#nf [name=type]', 'call');
await st.fill('#nf [name=text]', 'Khách gọi hỏi tiến độ bảo hành VGA');
await st.click('#nf [type=submit]');
await step('ghi chú cuộc gọi vào hồ sơ khách', async () => { await st.waitForFunction(() => document.querySelector('#notes').textContent.includes('tiến độ bảo hành')); return true; });
await st.click('#mf >> xpath=ancestor::details/summary');
await st.fill('#mf [name=bonus]', '100');
await st.fill('#mf [name=note]', 'Bù điểm do VGA lỗi');
await st.click('#mf [type=submit]');
await step('cộng điểm thành viên', async () => { await toast(st, 'Đã cập nhật thành viên'); return (await read(`members/${khachUid}`)).bonusPoints === 100; });
await st.waitForSelector('#of', { state: 'attached' });
await st.click('#of >> xpath=ancestor::details/summary');
await st.fill('#of [name=value]', '30');
await st.click('#of [type=submit]');
await step('ưu đãi vượt mức cho phép của nhân viên bị chặn', () => toast(st, 'tối đa 15%'));
await st.fill('#of [name=value]', '10');
await st.fill('#of [name=max]', '200000');
await st.fill('#of [name=note]', 'Xin lỗi vì sự cố VGA');
await st.click('#of [type=submit]');
await step('gửi ưu đãi riêng cho khách', async () => { await toast(st, 'Khách thấy ở trang tài khoản'); return (await where1('vouchers', 'userId', khachUid)).length === 1; });
await st.screenshot({ path: `${SHOTS}cskh-5-khach-hang.png`, fullPage: true });
await st.click('#dlg [data-close]');

// ---- Tra cứu & tương thích ----
await st.goto(`${BASE}/admin/#/tra-cuu?q=14400f`);
await view(st, 'Tra cứu');
await st.click(`[data-pick="${CPU.id}"]`);
await st.fill('#cf [name=mainboard]', `${P('main-gigabyte-b650m-ds3h').name} [main-gigabyte-b650m-ds3h]`);
await st.click('#cf [type=submit]');
await step('kiểm tra tương thích phát hiện lệch socket CPU – mainboard', async () => (await st.textContent('#cf-out')).includes('Khác socket'));
await st.click('#cf-copy');
await step('sao chép kết quả để gửi khách', () => toast(st, 'Đã sao chép'));
await st.screenshot({ path: `${SHOTS}cskh-6-tuong-thich.png`, fullPage: true });

await st.goto(`${BASE}/admin/#/cai-dat`);
await step('Cài đặt của CSKH chỉ có đổi mật khẩu (không quản lý nhân viên)', async () => { await view(st, 'Cài đặt'); return (await st.locator('#sfm, #af, #rl').count()) === 0 && (await st.locator('#pw').count()) === 1; });

// ================= Khách thấy kết quả xử lý =================
console.log('\n== Khách thấy kết quả ==');
await kh.goto(`${BASE}/#/tai-khoan`);
await kh.reload();
await step('khách thấy phiếu bảo hành và tiến độ', async () => { await kh.waitForSelector('#warranty-box:not([hidden])'); return (await kh.textContent('#warranty-box')).includes('Đã gửi trung tâm bảo hành'); });
await step('khách thấy ưu đãi riêng', async () => { await kh.waitForSelector('#offers-box:not([hidden])'); return (await kh.textContent('#offers-box')).includes('UD-'); });
await step('điểm thành viên có cộng thêm 100', async () => (await kh.textContent('#member-box')).includes(new Intl.NumberFormat('vi-VN').format(Math.floor(DONE_ORDER.total / 10000) + 100)));
await step('đơn hiện số tiền đã hoàn', async () => (await kh.textContent('#orders')).includes('đã hoàn 200.000'));
await kh.screenshot({ path: `${SHOTS}cskh-7-khach-tai-khoan.png`, fullPage: true });
await kh.goto(`${BASE}/#/sp/${CPU.id}`);
await step('đánh giá đã duyệt hiện công khai kèm phản hồi', async () => {
  await kh.waitForSelector('#reviews .rv');
  return (await kh.textContent('#reviews')).includes('Cảm ơn bạn đã tin chọn NEXORA');
});

// ================= Điện thoại =================
console.log('\n== CSKH trên điện thoại (390px) ==');
const mb = await newPage({ width: 390, height: 844 }, 'cskh-mobile', { isMobile: true, hasTouch: true });
await login(mb, STAFF);
await mb.waitForURL(/\/admin\//, { timeout: 15000 });
for (const [hash, h1] of [['cskh', 'Tổng quan CSKH'], ['ho-tro', 'Yêu cầu hỗ trợ'], ['bao-hanh', 'Bảo hành'], ['danh-gia', 'Đánh giá'], ['tra-cuu', 'Tra cứu']]) {
  await mb.goto(`${BASE}/admin/#/${hash}`);
  await step(`${h1}: hiển thị, không cuộn ngang`, async () => { await view(mb, h1); return noHScroll(mb); });
}
await mb.goto(`${BASE}/admin/#/ho-tro/${ticketId}`);
await step('hội thoại vừa màn hình điện thoại', async () => { await mb.waitForSelector('#th-head h1'); return noHScroll(mb); });
await mb.screenshot({ path: `${SHOTS}cskh-m-thread.png`, fullPage: true });
const mk = await newPage({ width: 390, height: 844 }, 'khach-mobile', { isMobile: true, hasTouch: true });
await login(mk, KHACH);
await mk.waitForFunction(() => location.hash === '#/tai-khoan', null, { timeout: 15000 });
await mk.goto(`${BASE}/#/ho-tro`);
await step('trang Hỗ trợ của khách vừa màn hình điện thoại', async () => { await mk.waitForSelector('.tk-list'); return noHScroll(mk); });
await mk.goto(`${BASE}/#/tai-khoan`);
await step('trang tài khoản (thành viên, ưu đãi, bảo hành) vừa màn hình điện thoại', async () => { await mk.waitForSelector('#warranty-box:not([hidden])'); return noHScroll(mk); });
await mk.screenshot({ path: `${SHOTS}cskh-m-khach.png`, fullPage: true });

await browser.close();
await env.cleanup();
console.log(errors.length ? `\nLỗi JS trên trang:\n${errors.join('\n')}` : '\nKhông có lỗi JS trên trang.');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail || errors.length ? 1 : 0);
