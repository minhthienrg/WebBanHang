// E2E trang quản trị trên Firebase Emulator: chuyển hướng khi admin đăng nhập, mã giảm giá, sản phẩm,
// kho, đơn hàng (trừ / hoàn kho), khách hàng (khóa), nhật ký, báo cáo, cài đặt; giao diện điện thoại.
// Chạy qua ./run.sh admin (hoặc ./run.sh). Ảnh chụp lưu ở tests/shots/admin-*.png.
import { mkdirSync, readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, Timestamp } from 'firebase/firestore';
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
const ADMIN = 'admin@nexora.test', KHACH = 'khach@nexora.test';
const adminUid = await signUp(ADMIN, PASS);
const khachUid = await signUp(KHACH, PASS);

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  let t = Date.now();
  for (const { id, ...p } of SEED_PRODUCTS) {
    await setDoc(doc(db, 'products', id), { imageUrl: '', description: '', ...p, active: true, createdAt: Timestamp.fromMillis(t--) });
  }
  await setDoc(doc(db, 'admins', adminUid), {});
});
// withSecurityRulesDisabled không trả về giá trị của callback → lấy qua biến ngoài.
async function admin(fn) { let out; await env.withSecurityRulesDisabled(async (ctx) => { out = await fn(ctx.firestore()); }); return out; }
const read = (path) => admin(async (db) => (await getDoc(doc(db, path))).data());
const count = (name) => admin(async (db) => (await getDocs(collection(db, name))).size);

const browser = await chromium.launch();
const errors = [];
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); }
};
async function step(name, fn) {
  try { const r = await fn(); check(name, r !== false); } catch (e) { check(name, false, e.message.split('\n')[0]); }
}
// body có overflow-x: hidden nên đo cả phần tử nào tràn ra ngoài khung nhìn.
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth
  && [...document.querySelectorAll("#view *, .topbar *")].every((el) => el.closest(".tbl-wrap, .chips, .side") || el.getBoundingClientRect().right <= window.innerWidth + 1));

async function newPage(viewport, tag, extra = {}) {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Lỗi do test cố ý gây ra: tài khoản bị khóa ghi giỏ → PERMISSION_DENIED.
    if (/PERMISSION_DENIED|permission-denied|Missing or insufficient permissions/.test(t)) return;
    errors.push(`${tag} console: ${t.split('\n')[0]}`);
  });
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

// ================= Quản trị viên (máy tính) =================
console.log('\n== Quản trị viên ==');
const ad = await newPage({ width: 1280, height: 900 }, 'admin');
await login(ad, ADMIN);
await step('admin đăng nhập → chuyển thẳng tới trang quản trị', () => ad.waitForURL(/\/admin\/(#.*)?$/, { timeout: 15000 }));
await step('Dashboard hiển thị', () => view(ad, 'Dashboard'));
await step('Dashboard có 6 chỉ số', async () => (await ad.locator('.kpi').count()) === 6);
await step('Dashboard có biểu đồ doanh thu', () => ad.locator('.chart svg').isVisible());
await ad.screenshot({ path: `${SHOTS}admin-1-dashboard.png`, fullPage: true });

// ---- Mã giảm giá ----
await ad.goto(`${BASE}/admin/#/khuyen-mai`);
await view(ad, 'Mã giảm giá');
await ad.click('#btn-new');
await ad.fill('#dlg-body [name=code]', 'test10');
await ad.fill('#dlg-body [name=value]', '10');
await ad.click('#dlg-body [type=submit]');
await step('tạo mã giảm giá TEST10', () => toast(ad, 'Đã lưu mã TEST10'));
await step('mã hiện trong bảng, đang áp dụng', async () => {
  await ad.waitForSelector('text=TEST10');
  return (await ad.textContent('#view tbody')).includes('Đang áp dụng');
});

// ---- Sản phẩm ----
await ad.goto(`${BASE}/admin/#/san-pham`);
await view(ad, 'Sản phẩm');
await step(`bảng sản phẩm hiện ${SEED_PRODUCTS.length} sản phẩm`, async () => (await ad.textContent('#view p.hint[role=status]')).includes(String(SEED_PRODUCTS.length)));
await ad.click('#btn-new');
await ad.selectOption('#dlg-body [name=category]', 'cpu');
await ad.fill('#dlg-body [name=brand]', 'Intel');
await ad.fill('#dlg-body [name=name]', 'CPU Test X1');
await ad.fill('#dlg-body [name=id]', 'cpu-test-x1');
await ad.fill('#dlg-body [name=price]', '1000000');
await ad.fill('#dlg-body [name=stock]', '2');
await ad.fill('#dlg-body [name=cost]', '800000');
await ad.fill('#dlg-body [name=warrantyMonths]', '36');
await ad.locator('#dlg-body [name=sv]').first().fill('LGA1700');
await ad.screenshot({ path: `${SHOTS}admin-2-product-form.png` });
await ad.click('#dlg-body [type=submit]');
await step('thêm sản phẩm mới', () => toast(ad, 'Đã thêm "CPU Test X1"'));
await step('sản phẩm mới lưu đủ thông số, bảo hành, tồn kho', async () => {
  const p = await read('products/cpu-test-x1');
  return p.stock === 2 && p.price === 1000000 && p.specs.Socket === 'LGA1700' && p.specs['Bảo hành'] === '36 tháng' && p.active === true;
});
await step('tạo phiếu nhập tồn kho ban đầu', async () => (await count('stockMoves')) === 1);

await ad.goto(`${BASE}/admin/#/san-pham?q=test x1`);
await ad.waitForSelector('[data-edit="cpu-test-x1"]');
await ad.locator('button.btn[data-edit="cpu-test-x1"]').click();
await ad.fill('#dlg-body [name=price]', '900000');
await ad.fill('#dlg-body [name=oldPrice]', '1000000');
await ad.click('#dlg-body [type=submit]');
await step('sửa giá sản phẩm', () => toast(ad, 'Đã lưu "CPU Test X1"'));
await step('ghi lịch sử giá', async () => (await count('priceHistory')) === 1);
await ad.locator('button.btn[data-edit="cpu-test-x1"]').click();
await ad.click('#ph summary');
await step('xem lịch sử giá trong form', () => ad.waitForFunction(() => document.querySelector('#ph-body')?.textContent.includes('900.000')));
await ad.click('#dlg [data-close]');
await ad.click('[data-act=hide][data-id="cpu-test-x1"]');
await step('ẩn sản phẩm', async () => { await toast(ad, 'Đã ẩn'); return (await read('products/cpu-test-x1')).active === false; });
await ad.click('[data-act=show][data-id="cpu-test-x1"]');
await step('hiện lại sản phẩm', async () => { await toast(ad, 'Đã hiện'); return (await read('products/cpu-test-x1')).active === true; });

// Đổi giá hàng loạt: 2 sản phẩm RAM giảm 10%
await ad.goto(`${BASE}/admin/#/san-pham?dm=ram`);
await ad.waitForSelector('[data-sel]');
const ramIds = await ad.$$eval('[data-sel]', (els) => els.slice(0, 2).map((e) => e.dataset.sel));
for (const id of ramIds) await ad.check(`[data-sel="${id}"]`);
await step('thanh thao tác hàng loạt hiện khi chọn', () => ad.locator('#bulk').isVisible());
const ramBefore = await read(`products/${ramIds[0]}`);
await ad.click('[data-bulk=price]');
await ad.selectOption('#dlg-body [name=mode]', 'pct-down');
await ad.fill('#dlg-body [name=v]', '10');
await ad.click('#dlg-body [type=submit]');
await step('đổi giá hàng loạt 2 sản phẩm', () => toast(ad, 'Đã đổi giá 2 sản phẩm'));
await step('giá mới = giảm 10%, làm tròn nghìn; giá cũ thành giá gốc', async () => {
  const p = await read(`products/${ramIds[0]}`);
  return p.price === Math.round(ramBefore.price * 0.9 / 1000) * 1000 && p.oldPrice >= ramBefore.price;
});

// ---- Kho ----
await ad.goto(`${BASE}/admin/#/kho?sp=cpu-test-x1`);
await view(ad, 'Kho hàng');
await ad.selectOption('#mf [name=type]', 'in');
await ad.fill('#mf [name=qty]', '3');
await ad.fill('#mf [name=cost]', '790000');
await ad.fill('#mf [name=supplier]', 'NCC Thử');
await ad.click('#mf [type=submit]');
await step('nhập kho 3 chiếc → tồn 5', async () => { await toast(ad, 'tồn mới 5'); return (await read('products/cpu-test-x1')).stock === 5; });
await ad.selectOption('#mf [name=type]', 'damaged');
await ad.fill('#mf [name=qty]', '1');
await ad.click('#mf [type=submit]');
await step('hủy hàng lỗi bắt buộc ghi lý do', () => toast(ad, 'lý do'));
await ad.fill('#mf [name=note]', 'Cong chân socket');
await ad.click('#mf [type=submit]');
await step('hủy 1 chiếc lỗi → tồn 4', async () => { await toast(ad, 'tồn mới 4'); return (await read('products/cpu-test-x1')).stock === 4; });
await ad.selectOption('#mf [name=type]', 'out');
await ad.fill('#mf [name=qty]', '99');
await ad.fill('#mf [name=note]', 'thử xuất quá');
await ad.click('#mf [type=submit]');
await step('không cho xuất quá tồn kho', () => toast(ad, 'Không đủ hàng'));
await step('lịch sử phiếu kho có giá vốn', async () => (await ad.textContent('#view')).includes('790.000'));
await ad.screenshot({ path: `${SHOTS}admin-3-kho.png`, fullPage: true });

// ================= Khách hàng đặt đơn có mã giảm giá =================
console.log('\n== Khách hàng ==');
const kh = await newPage({ width: 1280, height: 900 }, 'khach');
await login(kh, KHACH);
await step('khách đăng nhập → vào trang tài khoản (không vào trang quản trị)', () => kh.waitForFunction(() => location.hash === '#/tai-khoan', null, { timeout: 15000 }));
await step('khách không thấy nút Quản trị', async () => !(await kh.locator('#nav-admin').isVisible()));
await kh.goto(`${BASE}/#/sp/cpu-test-x1`);
await kh.click('#buy-row [data-add]');
await kh.waitForFunction(() => document.querySelector('#cart-count')?.textContent === '1');
await kh.goto(`${BASE}/#/thanh-toan`);
await kh.waitForSelector('#form-checkout');
await kh.fill('#form-checkout [name=phone]', '0912345678');
await kh.fill('#form-checkout [name=address]', '1 Lê Lợi, Q.1, TP.HCM');
await kh.fill('#voucher-code', 'KHONGCO');
await kh.click('#btn-voucher');
await step('mã không tồn tại → báo lỗi', () => kh.waitForFunction(() => document.querySelector('#voucher-msg').textContent.includes('không tồn tại')));
await kh.fill('#voucher-code', 'test10');
await kh.click('#btn-voucher');
await step('áp dụng mã TEST10 → giảm 90.000₫', () => kh.waitForFunction(() => document.querySelector('.summary')?.textContent.includes('−90.000')));
await kh.fill('#form-checkout [name=phone]', '0912345678');
await kh.fill('#form-checkout [name=address]', '1 Lê Lợi, Q.1, TP.HCM');
await kh.screenshot({ path: `${SHOTS}admin-4-checkout-voucher.png`, fullPage: true });
await kh.click('#form-checkout [type=submit]');
let orderId = '';
await step('đặt hàng có mã giảm giá thành công', async () => {
  await kh.waitForFunction(() => location.hash.startsWith('#/dat-hang-thanh-cong/'), null, { timeout: 15000 });
  orderId = decodeURIComponent((await kh.evaluate(() => location.hash)).split('/').pop());
  const o = await read(`orders/${orderId}`);
  return o.voucher === 'TEST10' && o.discount === 90000 && o.total === 900000 + 30000 - 90000;
});

// ================= Admin xử lý đơn =================
console.log('\n== Xử lý đơn ==');
await ad.goto(`${BASE}/admin/#/`);
await view(ad, 'Dashboard');
await step('Dashboard đếm 1 đơn chờ xác nhận', async () => (await ad.textContent('.kpis')).includes('Chờ xác nhận1'));
await ad.goto(`${BASE}/admin/#/don-hang?tt=pending`);
await view(ad, 'Đơn hàng');
await step('đơn mới trong danh sách chờ xác nhận', () => ad.waitForSelector(`[data-quick="${orderId}"]`));
await ad.fill('#of [name=q]', '0912345678');
await ad.click('#of [type=submit]');
await step('tìm đơn theo số điện thoại', () => ad.waitForSelector(`[data-quick="${orderId}"]`));
await ad.click(`[data-quick="${orderId}"]`);
await step('xác nhận đơn → trừ tồn kho (4 → 3)', async () => {
  await toast(ad, 'Đã xác nhận');
  const o = await read(`orders/${orderId}`); const p = await read('products/cpu-test-x1');
  return o.status === 'confirmed' && o.stockDeducted === true && p.stock === 3 && p.sold === 1;
});
await ad.goto(`${BASE}/admin/#/don-hang/${orderId}`);
await ad.waitForSelector('#sf');
await step('chi tiết đơn có giảm giá và tổng tiền', async () => (await ad.textContent('#dlg-body')).includes('TEST10') && (await ad.textContent('#dlg-body')).includes('840.000'));
await ad.screenshot({ path: `${SHOTS}admin-5-order.png` });
await ad.selectOption('#sf [name=status]', 'cancelled');
await ad.fill('#sf [name=note]', 'Khách gọi hủy');
await ad.click('#sf [type=submit]');
await step('hủy đơn đã xác nhận → hoàn kho (3 → 4)', async () => {
  await toast(ad, 'Đã hủy');
  const o = await read(`orders/${orderId}`); const p = await read('products/cpu-test-x1');
  return o.status === 'cancelled' && o.stockDeducted === false && p.stock === 4 && p.sold === 0 && o.statusHistory.length === 2;
});

// ---- Khách hàng: khóa tài khoản ----
await ad.goto(`${BASE}/admin/#/khach-hang`);
await view(ad, 'Khách hàng');
await step('danh sách có tài khoản khách', () => ad.waitForSelector(`[data-ban="${khachUid}"]`));
await ad.click(`[data-ban="${khachUid}"]`);
await ad.fill('#ask-form [name=v]', 'Bom hàng nhiều lần');
await ad.click('#ask-form [type=submit]');
await step('khóa tài khoản khách', async () => { await toast(ad, 'Đã khóa'); return !!(await read(`bans/${khachUid}`)); });
await kh.goto(`${BASE}/#/tai-khoan`);
await kh.reload();
await step('khách bị khóa thấy thông báo ở trang tài khoản', () => kh.waitForSelector('#ban-note:visible', { timeout: 15000 }));
await kh.goto(`${BASE}/#/sp/cpu-test-x1`);
await kh.click('#buy-row [data-add]');
await step('khách bị khóa không thêm được vào giỏ', () => toast(kh, 'bị khóa'));
await ad.click(`[data-unban="${khachUid}"]`);
await step('mở khóa tài khoản', async () => { await toast(ad, 'Đã mở khóa'); return !(await read(`bans/${khachUid}`)); });

// ---- Báo cáo, nhật ký, cài đặt ----
await ad.goto(`${BASE}/admin/#/bao-cao`);
await step('Báo cáo doanh thu theo ngày', async () => { await view(ad, 'Báo cáo'); return ad.locator('.chart svg').isVisible(); });
await ad.click('text=Theo tháng');
await step('Báo cáo theo tháng có 12 cột', () => ad.waitForFunction(() => document.querySelectorAll('.chart .bar').length === 12));
await ad.goto(`${BASE}/admin/#/nhat-ky`);
await view(ad, 'Nhật ký');
await step('nhật ký ghi lại các thao tác', async () => {
  await ad.waitForSelector('#view tbody tr');
  const text = await ad.textContent('#view tbody');
  return ['Tạo mã giảm giá', 'Thêm sản phẩm', 'Sửa sản phẩm', 'Nhập kho', 'Đổi trạng thái đơn', 'Khóa tài khoản', 'Đổi giá hàng loạt']
    .every((a) => text.includes(a)) && text.includes(ADMIN);
});
await ad.screenshot({ path: `${SHOTS}admin-6-logs.png`, fullPage: true });
await ad.goto(`${BASE}/admin/#/cai-dat`);
await view(ad, 'Cài đặt');
await ad.fill('#af [name=email]', KHACH);
await ad.click('#af [type=submit]');
await ad.click('#ask-form [type=submit]');
await step('cấp quyền admin cho tài khoản khác', async () => { await toast(ad, 'Đã cấp quyền'); return !!(await read(`admins/${khachUid}`)); });
await ad.click(`[data-rm="${khachUid}"]`);
await ad.click('#ask-form [type=submit]');
await step('gỡ quyền admin', async () => { await toast(ad, 'Đã gỡ quyền'); return !(await read(`admins/${khachUid}`)); });
await step('không có nút tự gỡ quyền của mình', async () => (await ad.locator(`[data-rm="${adminUid}"]`).count()) === 0);

// ---- Khách vào /admin/ → bị chặn ----
await kh.goto(`${BASE}/admin/`);
await step('khách mở /admin/ → báo không có quyền', () => kh.waitForFunction(() => document.querySelector('#gate')?.textContent.includes('Không có quyền'), null, { timeout: 15000 }));
await step('khách không thấy menu quản trị', async () => !(await kh.locator('#side').isVisible()));

// ================= Giao diện điện thoại =================
console.log('\n== Quản trị trên điện thoại (390px) ==');
const mb = await newPage({ width: 390, height: 844 }, 'admin-mobile', { isMobile: true, hasTouch: true });
await login(mb, ADMIN);
await mb.waitForURL(/\/admin\//, { timeout: 15000 });
for (const [hash, h1] of [['', 'Dashboard'], ['san-pham', 'Sản phẩm'], ['kho', 'Kho hàng'], ['don-hang', 'Đơn hàng'],
  ['khach-hang', 'Khách hàng'], ['khuyen-mai', 'Mã giảm giá'], ['bao-cao', 'Báo cáo'], ['nhat-ky', 'Nhật ký'], ['cai-dat', 'Cài đặt']]) {
  await mb.goto(`${BASE}/admin/#/${hash}`);
  await step(`${h1}: hiển thị, không cuộn ngang`, async () => { await view(mb, h1); return noHScroll(mb); });
  if (['', 'san-pham', 'don-hang'].includes(hash)) await mb.screenshot({ path: `${SHOTS}admin-m-${hash || 'dashboard'}.png`, fullPage: true });
}
await mb.goto(`${BASE}/admin/#/san-pham`);
await view(mb, 'Sản phẩm');
await mb.locator('button.btn[data-edit]').first().click();
await step('form sửa sản phẩm vừa màn hình điện thoại', async () => {
  const box = await mb.locator('#dlg').boundingBox();
  return box.width <= 390;
});

await browser.close();
await env.cleanup();
console.log(errors.length ? `\nLỗi JS trên trang:\n${errors.join('\n')}` : '\nKhông có lỗi JS trên trang.');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail || errors.length ? 1 : 0);
