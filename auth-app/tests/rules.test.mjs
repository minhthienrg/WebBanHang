// Test Firestore Security Rules trên emulator. Chạy qua ./run.sh.
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp
} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-webbanhang',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 }
});
await env.clearFirestore();

const P1 = { name: 'CPU A', category: 'cpu', price: 3000000, oldPrice: 0, stock: 5, active: true };
const P2 = { name: 'RAM B', category: 'ram', price: 1000000, oldPrice: 0, stock: 2, active: true };
const P3 = { name: 'Hidden', category: 'ram', price: 10, oldPrice: 0, stock: 2, active: false };

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'products/p1'), P1);
  await setDoc(doc(db, 'products/p2'), P2);
  await setDoc(doc(db, 'products/p3'), P3);
  for (let i = 0; i < 11; i++) await setDoc(doc(db, `products/x${i}`), { ...P2, name: `X${i}`, stock: 10 });
  await setDoc(doc(db, 'admins/admin'), {});
  await setDoc(doc(db, 'orders/bobOrder'), { userId: 'bob', status: 'pending', total: 1 });
});

const anon = env.unauthenticatedContext().firestore();
const alice = env.authenticatedContext('alice', { email: 'alice@x.com' }).firestore();
const bob = env.authenticatedContext('bob', { email: 'bob@x.com' }).firestore();
const admin = env.authenticatedContext('admin', { email: 'ad@x.com' }).firestore();

let pass = 0, fail = 0;
const deny = (p) => assertFails(p).then((e) => {
  if (/maximum of 1000/i.test(e.message)) throw new Error('bị từ chối do LỖI ĐÁNH GIÁ: ' + e.message.split('\n')[1]);
});
async function t(name, p) {
  try { await p; pass++; console.log('  ok  ', name); }
  catch (e) { fail++; console.log('  FAIL', name, '-', e.message.split('\n')[0]); }
}

const ship = { name: 'Alice', phone: '0912345678', address: '1 Đường A' };
function order(items, extra = {}) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shippingFee = subtotal >= 5000000 ? 0 : 30000;
  return {
    userId: 'alice', items, subtotal, shippingFee, total: subtotal + shippingFee,
    shipping: ship, paymentMethod: 'cod', note: '', status: 'pending',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra
  };
}
const L1 = { productId: 'p1', name: 'CPU A', price: 3000000, qty: 1 };
const L2 = { productId: 'p2', name: 'RAM B', price: 1000000, qty: 2 };

console.log('Products');
await t('anon đọc sản phẩm đang bán', assertSucceeds(getDoc(doc(anon, 'products/p1'))));
await t('anon không đọc sản phẩm ẩn', deny(getDoc(doc(anon, 'products/p3'))));
await t('anon query active==true', assertSucceeds(getDocs(query(collection(anon, 'products'), where('active', '==', true)))));
await t('anon query không lọc active bị từ chối', deny(getDocs(collection(anon, 'products'))));
await t('user thường không sửa giá', deny(updateDoc(doc(alice, 'products/p1'), { price: 1 })));
await t('admin sửa được sản phẩm', assertSucceeds(updateDoc(doc(admin, 'products/p1'), { sold: 1 })));
await t('admin đọc sản phẩm ẩn', assertSucceeds(getDoc(doc(admin, 'products/p3'))));

console.log('Users');
const prof = { name: 'Alice', phone: '', address: '', email: 'alice@x.com', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
await t('tạo hồ sơ của mình', assertSucceeds(setDoc(doc(alice, 'users/alice'), prof)));
await t('không tạo hồ sơ người khác', deny(setDoc(doc(alice, 'users/bob'), prof)));
await t('không đọc hồ sơ người khác', deny(getDoc(doc(bob, 'users/alice'))));
await t('sửa hồ sơ của mình', assertSucceeds(updateDoc(doc(alice, 'users/alice'), { phone: '0912345678', updatedAt: serverTimestamp() })));
await t('không sửa createdAt', deny(updateDoc(doc(alice, 'users/alice'), { createdAt: new Date(0), updatedAt: serverTimestamp() })));

console.log('Carts');
await t('ghi giỏ của mình', assertSucceeds(setDoc(doc(alice, 'carts/alice'), { items: { p1: 1 }, updatedAt: serverTimestamp() })));
await t('không đọc giỏ người khác', deny(getDoc(doc(bob, 'carts/alice'))));
await t('không ghi giỏ người khác', deny(setDoc(doc(bob, 'carts/alice'), { items: {}, updatedAt: serverTimestamp() })));
const big = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`x${i}`, 1]));
await t('giỏ > 10 dòng bị từ chối', deny(setDoc(doc(alice, 'carts/alice'), { items: big, updatedAt: serverTimestamp() })));

console.log('Orders - tạo');
await t('đơn hợp lệ 1 dòng (có phí ship)', assertSucceeds(setDoc(doc(alice, 'orders/o1'), order([L1]))));
await t('đơn hợp lệ 2 dòng (miễn ship: 5tr)', assertSucceeds(setDoc(doc(alice, 'orders/o2'), order([L1, L2]))));
await t('batch đơn + xóa giỏ', (async () => {
  const b = writeBatch(alice);
  b.set(doc(alice, 'orders/o3'), order([L2]));
  b.set(doc(alice, 'carts/alice'), { items: {}, updatedAt: serverTimestamp() });
  await assertSucceeds(b.commit());
})());
const ten = Array.from({ length: 10 }, (_, i) => ({ productId: `x${i}`, name: `X${i}`, price: 1000000, qty: 1 }));
await t('đơn 10 dòng hợp lệ', assertSucceeds(setDoc(doc(alice, 'orders/o10'), order(ten))));
const eleven = Array.from({ length: 11 }, (_, i) => ({ productId: `x${i}`, name: `X${i}`, price: 1000000, qty: 1 }));
await t('đơn 11 dòng bị từ chối', deny(setDoc(doc(alice, 'orders/o11'), order(eleven))));
await t('sửa giá thấp hơn bị từ chối', deny(setDoc(doc(alice, 'orders/bad1'), order([{ ...L1, price: 1000 }]))));
await t('subtotal sai bị từ chối', deny(setDoc(doc(alice, 'orders/bad2'), order([L1], { subtotal: 1, total: 30001 }))));
await t('phí ship sai bị từ chối', deny(setDoc(doc(alice, 'orders/bad3'), order([L1], { shippingFee: 0, total: 3000000 }))));
await t('vượt tồn kho bị từ chối', deny(setDoc(doc(alice, 'orders/bad4'), order([{ ...L2, qty: 3 }]))));
await t('sản phẩm ẩn bị từ chối', deny(setDoc(doc(alice, 'orders/bad5'), order([{ productId: 'p3', name: 'Hidden', price: 10, qty: 1 }]))));
await t('sản phẩm không tồn tại bị từ chối', deny(setDoc(doc(alice, 'orders/bad6'), order([{ productId: 'nope', name: 'N', price: 10, qty: 1 }]))));
await t('đặt hộ người khác bị từ chối', deny(setDoc(doc(alice, 'orders/bad7'), order([L1], { userId: 'bob' }))));
await t('status khác pending bị từ chối', deny(setDoc(doc(alice, 'orders/bad8'), order([L1], { status: 'done' }))));
await t('SĐT sai bị từ chối', deny(setDoc(doc(alice, 'orders/bad9'), order([L1], { shipping: { ...ship, phone: '123' } }))));
await t('anon không đặt được', deny(setDoc(doc(anon, 'orders/bad10'), order([L1]))));
await t('qty số thực bị từ chối', deny(setDoc(doc(alice, 'orders/bad11'), order([{ ...L1, qty: 1.5 }]))));

console.log('Orders - đọc/sửa');
await t('query đơn của mình', assertSucceeds(getDocs(query(collection(alice, 'orders'), where('userId', '==', 'alice')))));
await t('query toàn bộ đơn bị từ chối', deny(getDocs(collection(alice, 'orders'))));
await t('không đọc đơn người khác', deny(getDoc(doc(alice, 'orders/bobOrder'))));
await t('admin đọc mọi đơn', assertSucceeds(getDocs(collection(admin, 'orders'))));
await t('không sửa tổng tiền', deny(updateDoc(doc(alice, 'orders/o1'), { total: 1 })));
await t('không tự đặt "done"', deny(updateDoc(doc(alice, 'orders/o1'), { status: 'done', updatedAt: serverTimestamp() })));
await t('hủy đơn pending của mình', assertSucceeds(updateDoc(doc(alice, 'orders/o1'), { status: 'cancelled', updatedAt: serverTimestamp() })));
await t('không hủy đơn đã hủy', deny(updateDoc(doc(alice, 'orders/o1'), { status: 'cancelled', updatedAt: serverTimestamp() })));
await t('không hủy đơn người khác', deny(updateDoc(doc(alice, 'orders/bobOrder'), { status: 'cancelled', updatedAt: serverTimestamp() })));
await t('admin đổi trạng thái', assertSucceeds(updateDoc(doc(admin, 'orders/o2'), { status: 'confirmed' })));

console.log('Admins');
await t('không tự cấp quyền admin', deny(setDoc(doc(alice, 'admins/alice'), {})));

await env.cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
