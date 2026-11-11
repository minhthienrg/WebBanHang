// Kiểm tra accessibility (axe-core, chuẩn WCAG 2.2 AA) và đo tốc độ trên emulator.
// Chạy qua ./run.sh audit. In ra các lỗi; thoát mã 1 nếu có lỗi mức serious/critical.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { chromium } from 'playwright';
import { SEED_PRODUCTS } from '../public/admin/seed-data.js';

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const BASE = 'http://127.0.0.1:5000';

const env = await initializeTestEnvironment({
  projectId: 'demo-webbanhang',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 }
});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  let t = Date.now();
  for (const { id, ...p } of SEED_PRODUCTS) {
    await setDoc(doc(ctx.firestore(), 'products', id), { imageUrl: '', description: '', ...p, active: true, createdAt: Timestamp.fromMillis(t--) });
  }
});

const browser = await chromium.launch();
let serious = 0;

async function audit(page, label) {
  await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(() => window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }
  }));
  for (const v of res.violations) {
    if (['serious', 'critical'].includes(v.impact)) serious++;
    console.log(`  [${v.impact}] ${label}: ${v.id} — ${v.help} (${v.nodes.length})`);
    for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(' ')}`);
  }
  if (!res.violations.length) console.log(`  ok   ${label}`);
}

for (const [tag, viewport, mobile] of [['desktop', { width: 1280, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  console.log(`\n== ${tag} ==`);
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, colorScheme: scheme });
    const page = await ctx.newPage();

    // Tốc độ: thời gian tới khi thẻ sản phẩm đầu tiên hiện ra (lần tải đầu, không cache).
    const t0 = Date.now();
    await page.goto(`${BASE}/`);
    await page.waitForSelector('#grid .pcard', { timeout: 20000 });
    const firstCard = Date.now() - t0;
    const nav = await page.evaluate(() => {
      const r = performance.getEntriesByType('resource');
      return { requests: r.length, kb: Math.round(r.reduce((s, x) => s + (x.transferSize || 0), 0) / 1024) };
    });
    if (scheme === 'light') {
      const t1 = Date.now();
      await page.reload();
      await page.waitForSelector('#grid .pcard', { timeout: 20000 });
      console.log(`  tốc độ: sản phẩm đầu tiên sau ${firstCard} ms (lần đầu) · ${Date.now() - t1} ms (mở lại, có cache) · ${nav.requests} request`);
    }

    await audit(page, `${scheme} danh sách`);
    await page.goto(`${BASE}/#/?cat=cpu`);
    await page.waitForSelector('#f-facets .filter-group', { state: 'attached' });
    await audit(page, `${scheme} danh mục + bộ lọc`);
    await page.goto(`${BASE}/#/sp/cpu-intel-i5-14400f`);
    await page.waitForSelector('.detail h1');
    await page.waitForFunction(() => !document.querySelector('#reviews')?.textContent.includes('Đang tải'));
    await audit(page, `${scheme} chi tiết + đánh giá`);
    await page.goto(`${BASE}/#/dang-nhap`);
    await page.waitForSelector('#form-login:visible');
    await audit(page, `${scheme} đăng nhập`);
    await page.click('.tab[data-tab=register]');
    await audit(page, `${scheme} đăng ký`);
    // Đăng ký rồi kiểm tra các trang cần đăng nhập: hỗ trợ khách hàng, tài khoản (thành viên).
    await page.fill('#form-register [name=name]', 'Người Kiểm Tra');
    await page.fill('#form-register [name=email]', `a11y-${tag}-${scheme}-${Date.now()}@test.com`);
    await page.fill('#form-register [name=password]', 'matkhau123');
    await page.fill('#form-register [name=password2]', 'matkhau123');
    await page.click('#form-register [type=submit]');
    await page.waitForFunction(() => location.hash === '#/tai-khoan', null, { timeout: 15000 });
    await page.waitForSelector('#member-box .member-tier');
    await audit(page, `${scheme} tài khoản + thành viên`);
    await page.goto(`${BASE}/#/ho-tro`);
    await page.waitForSelector('#view-support h1');
    await audit(page, `${scheme} hỗ trợ`);
    await page.goto(`${BASE}/#/ho-tro/moi`);
    await page.waitForSelector('#tk-form');
    await audit(page, `${scheme} gửi yêu cầu hỗ trợ`);
    await ctx.close();
  }
}

await browser.close();
await env.cleanup();
console.log(`\n${serious} lỗi mức serious/critical`);
process.exit(serious ? 1 : 0);
