// Nạp sản phẩm mẫu vào Firestore Emulator (project demo-webbanhang) để chạy thử trên máy.
// Chỉ kết nối emulator 127.0.0.1:8080 — không đụng project thật.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { SEED_PRODUCTS } from '../public/admin/seed-data.js';

const env = await initializeTestEnvironment({
  projectId: 'demo-webbanhang',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 }
});
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  let t = Date.now();
  for (const { id, ...p } of SEED_PRODUCTS) {
    await setDoc(doc(db, 'products', id), { imageUrl: '', description: '', ...p, active: true, createdAt: Timestamp.fromMillis(t--) });
  }
});
await env.cleanup();
console.log(`Đã nạp ${SEED_PRODUCTS.length} sản phẩm mẫu. Mở http://localhost:5000 — Ctrl+C để dừng.`);
