// E2E trên Firebase Emulator: danh sách, lọc, chi tiết, đăng ký, đăng nhập, giỏ hàng, đặt hàng.
// Chạy cùng một luồng ở giao diện máy tính và điện thoại. Chạy qua ./run.sh (hoặc ./run.sh e2e).
// Ảnh chụp màn hình lưu ở tests/shots/ (không commit).
import { mkdirSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { chromium } from 'playwright';
import { SEED_PRODUCTS } from '../public/admin/seed-data.js';

const BASE = 'http://127.0.0.1:5000';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const env = await initializeTestEnvironment({
  projectId: 'demo-webbanhang',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 }
});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  let t = Date.now();
  for (const { id, ...p } of SEED_PRODUCTS) {
    await setDoc(doc(db, 'products', id), { imageUrl: '', description: '', ...p, active: true, createdAt: Timestamp.fromMillis(t--) });
  }
});
const TOTAL = SEED_PRODUCTS.length;
const count = (pred) => SEED_PRODUCTS.filter(pred).length;

const browser = await chromium.launch();
const errors = [];
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); }
};
/** Chạy 1 bước; lỗi (timeout…) được ghi là FAIL thay vì dừng cả bộ test. */
async function step(name, fn) {
  try { const r = await fn(); check(name, r !== false); } catch (e) { check(name, false, e.message.split('\n')[0]); }
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const resultCount = (page) => page.$eval('#result-count', (e) => parseInt(e.textContent, 10));
const waitCount = (page, n) => page.waitForFunction((n) => parseInt(document.querySelector('#result-count').textContent, 10) === n, n);
const badge = (page, n) => page.waitForFunction((n) => {
  const b = document.querySelector('#cart-count');
  return n === 0 ? b.hidden : b.textContent === String(n);
}, n, { timeout: 15000 });

async function newPage(viewport, tag, extra = {}) {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Bỏ qua lỗi do test cố ý gây ra (đăng nhập sai mật khẩu → HTTP 400 + auth/wrong-password).
    if (/auth\/(wrong-password|invalid-credential)|status of 400/.test(t)) return;
    errors.push(`${tag} console: ${t.split('\n')[0]}`);
  });
  return page;
}

async function flow(tag, viewport, mobile) {
  console.log(`\n== ${tag} (${viewport.width}px) ==`);
  const page = await newPage(viewport, tag, mobile ? { isMobile: true, hasTouch: true } : {});
  const shot = (name, full = false) => page.screenshot({ path: `${SHOTS}${tag}-${name}.png`, fullPage: full });

  // ---------- Danh sách ----------
  await page.goto(`${BASE}/`);
  await page.waitForSelector('#grid .pcard', { timeout: 20000 });
  await step('danh sách trang 1 có 12 sản phẩm', async () => (await page.locator('#grid .pcard').count()) === 12);
  await step(`đếm tổng ${TOTAL} sản phẩm`, async () => (await resultCount(page)) === TOTAL);
  await step('không cuộn ngang (danh sách)', () => noHScroll(page));
  if (mobile) {
    await step('lưới 2 cột', async () => (await page.$eval('#grid', (g) => getComputedStyle(g).gridTemplateColumns.split(' ').length)) === 2);
    await step('bộ lọc thu gọn sẵn', async () => !(await page.$eval('#filters', (d) => d.open)));
  }
  await shot('1-list');

  // Lọc VGA + khoảng giá + sắp xếp
  await page.click('#cat-chips >> text=VGA');
  const nVga = count((p) => p.category === 'vga');
  await step(`lọc VGA còn ${nVga}`, () => waitCount(page, nVga));
  if (mobile) await page.click('#filters summary');
  await page.click('#f-prices >> text=5 – 10 triệu');
  const nVga510 = count((p) => p.category === 'vga' && p.price >= 5e6 && p.price <= 1e7);
  await step(`VGA 5–10 triệu còn ${nVga510}`, () => waitCount(page, nVga510));
  await step('hiện chip bộ lọc đang áp dụng', async () => (await page.locator('#active-filters .chip').count()) === 2);
  await page.selectOption('#sort', 'price_desc');
  await page.waitForFunction(() => location.hash.includes('sx=price_desc'));
  await step('sắp xếp giá giảm dần', async () => {
    const ps = await page.$$eval('#grid .pprice strong', (els) => els.map((e) => Number(e.textContent.replace(/\D/g, ''))));
    return ps.every((p, i) => i === 0 || ps[i - 1] >= p);
  });

  // ---------- Chi tiết ----------
  await page.goto(`${BASE}/#/sp/cpu-intel-i5-14400f`);
  await page.waitForSelector('.detail h1');
  await step('chi tiết có tên sản phẩm', async () => (await page.textContent('.detail h1')).includes('i5-14400F'));
  await step('có bảng thông số', async () => (await page.locator('.specs tr').count()) >= 5);
  await step('có sản phẩm tương tự', async () => (await page.locator('.block .pcard').count()) >= 1);
  await step('không cuộn ngang (chi tiết)', () => noHScroll(page));
  if (mobile) await step('thanh mua dính đáy hiện', () => page.locator('.sticky-buy').isVisible());
  await shot('2-detail', true);

  // ---------- Thêm giỏ khi chưa đăng nhập → đăng ký ----------
  await page.locator(mobile ? '.sticky-buy [data-add]' : '#buy-row [data-add]').click();
  await step('chưa đăng nhập → chuyển sang trang đăng nhập', () => page.waitForFunction(() => location.hash === '#/dang-nhap'));
  await step('hiện lý do cần đăng nhập', async () => (await page.textContent('#auth-reason')).includes('giỏ'));

  await page.click('.tab[data-tab=register]');
  const email = `${tag}${Date.now()}@test.com`;
  const pass1 = 'matkhau123';
  await page.fill('#form-register [name=name]', 'Người Thử');
  await page.fill('#form-register [name=email]', email);
  await page.fill('#form-register [name=password]', pass1);
  await page.fill('#form-register [name=password2]', 'khac123');
  await page.click('#form-register [type=submit]');
  await step('báo lỗi khi 2 mật khẩu không khớp', async () => (await page.textContent('#msg')).includes('không khớp'));
  await page.fill('#form-register [name=password2]', pass1);
  await shot('3-register');
  await page.click('#form-register [type=submit]');
  await step('đăng ký xong quay lại trang sản phẩm', () => page.waitForFunction(() => location.hash.startsWith('#/sp/'), null, { timeout: 15000 }));
  await step('sản phẩm đang chờ được tự thêm vào giỏ (badge = 1)', () => badge(page, 1));

  // ---------- Đăng xuất → đăng nhập lại ----------
  await page.goto(`${BASE}/#/tai-khoan`);
  await page.waitForSelector('#btn-logout:visible');
  await step('trang tài khoản hiện tên đã đăng ký', async () => (await page.textContent('#hello')).includes('Người Thử'));
  await page.click('#btn-logout');
  await step('đăng xuất', () => page.waitForFunction(() => document.querySelector('#nav-account').textContent.includes('Đăng nhập')));
  await step('đăng xuất thì ẩn badge giỏ', () => badge(page, 0));

  await page.goto(`${BASE}/#/dang-nhap`);
  await page.fill('#form-login [name=email]', email);
  await page.fill('#form-login [name=password]', 'saimatkhau');
  await page.click('#form-login [type=submit]');
  await step('sai mật khẩu → báo lỗi', () => page.waitForFunction(() => document.querySelector('#msg').textContent.includes('không đúng')));
  await page.fill('#form-login [name=password]', pass1);
  await page.click('#form-login [type=submit]');
  await step('đăng nhập đúng → vào tài khoản', () => page.waitForFunction(() => location.hash === '#/tai-khoan', null, { timeout: 15000 }));
  await step('giỏ hàng được giữ sau khi đăng nhập lại (badge = 1)', () => badge(page, 1));

  // ---------- Thêm giỏ từ thẻ sản phẩm ----------
  await page.goto(`${BASE}/#/?cat=ram`);
  await page.waitForSelector('#grid .pcard');
  await page.locator('#grid [data-add]:not([disabled])').first().click();
  await step('thêm từ thẻ sản phẩm (badge = 2)', () => badge(page, 2));

  // ---------- Giỏ hàng ----------
  await page.click('[data-nav=cart]');
  await page.waitForSelector('.cart-lines .line');
  await step('giỏ có 2 dòng', async () => (await page.locator('.cart-lines .line').count()) === 2);
  await page.locator('[data-step][data-d="1"]').first().click();
  await step('tăng số lượng (badge = 3)', () => badge(page, 3));
  await page.locator('[data-step][data-d="-1"]').first().click();
  await step('giảm số lượng (badge = 2)', () => badge(page, 2));
  await step('không cuộn ngang (giỏ)', () => noHScroll(page));
  await shot('4-cart');

  // ---------- Thanh toán ----------
  await page.click('text=Tiến hành đặt hàng');
  await page.waitForSelector('#form-checkout');
  await step('họ tên tự điền từ hồ sơ', async () => (await page.inputValue('#form-checkout [name=name]')) === 'Người Thử');
  await page.click('#form-checkout [type=submit]');
  await step('báo lỗi khi thiếu địa chỉ/SĐT', () => page.locator('#msg.err').isVisible());
  await page.fill('#form-checkout [name=phone]', '0912 345 678');
  await page.fill('#form-checkout [name=address]', '12 Nguyễn Văn Cừ, Q.5, TP.HCM');
  await step('không cuộn ngang (thanh toán)', () => noHScroll(page));
  await shot('5-checkout', true);
  await page.click('#form-checkout [type=submit]');
  await step('đặt hàng thành công', async () => {
    await page.waitForFunction(() => location.hash.startsWith('#/dat-hang-thanh-cong/'), null, { timeout: 15000 });
    await page.waitForSelector('#view-done h1');
    return (await page.textContent('#view-done h1')).includes('thành công');
  });
  await step('giỏ được làm trống sau khi đặt', () => badge(page, 0));

  // ---------- Đơn hàng trong tài khoản ----------
  await page.click('text=Xem đơn hàng');
  await page.waitForSelector('#orders .order');
  await step('hồ sơ đã lưu SĐT từ trang thanh toán', async () => (await page.inputValue('#form-profile [name=phone]')) === '0912345678');
  await step('có 1 đơn "Chờ xác nhận"', async () => (await page.textContent('#orders .status')).includes('Chờ xác nhận'));
  page.once('dialog', (d) => d.accept());
  await page.click('[data-cancel]');
  await step('hủy đơn', () => page.waitForFunction(() => document.querySelector('#orders .status')?.textContent.includes('Đã hủy')));
  await step('không cuộn ngang (tài khoản)', () => noHScroll(page));
  await shot('6-account');

  await page.context().close();
}

await flow('desktop', { width: 1280, height: 900 }, false);
await flow('mobile', { width: 390, height: 844 }, true);

await browser.close();
await env.cleanup();
console.log(errors.length ? `\nLỗi JS trên trang:\n${errors.join('\n')}` : '\nKhông có lỗi JS trên trang.');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
