// Nạp sản phẩm mẫu vào Firestore Emulator (project demo-webbanhang) để chạy thử trên máy.
// Chỉ kết nối emulator 127.0.0.1:8080 — không đụng project thật.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { SEED_PRODUCTS } from '../public/admin/seed-data.js';
import { NEXORA_PRODUCTS } from '../public/admin/nexora-data.js';

// node seed.mjs          → dữ liệu NEXORA của nhóm (254 linh kiện)
// node seed.mjs mau      → 23 sản phẩm mẫu (bộ dữ liệu bộ test đang dùng)
const PRODUCTS = process.argv[2] === 'mau' ? SEED_PRODUCTS : NEXORA_PRODUCTS;

const env = await initializeTestEnvironment({
  projectId: 'demo-webbanhang',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 }
});
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  let t = Date.now();
  for (const { id, ...p } of PRODUCTS) {
    await setDoc(doc(db, 'products', id), { imageUrl: '', description: '', ...p, active: true, createdAt: Timestamp.fromMillis(t--) });
  }
});
await env.cleanup();
console.log(`Đã nạp ${PRODUCTS.length} sản phẩm. Mở http://localhost:5000 — Ctrl+C để dừng.`);
