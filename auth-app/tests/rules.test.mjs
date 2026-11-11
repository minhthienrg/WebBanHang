// Test Firestore Security Rules trên emulator. Chạy qua ./run.sh.
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, Timestamp
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
  const day = 86400000;
  const V = { type: 'percent', value: 10, minOrder: 2000000, maxDiscount: 500000, active: true,
    startAt: Timestamp.fromMillis(Date.now() - day), endAt: Timestamp.fromMillis(Date.now() + day) };
  await setDoc(doc(db, 'vouchers/GIAM10'), { ...V, code: 'GIAM10' });
  await setDoc(doc(db, 'vouchers/BIG'), { ...V, code: 'BIG', type: 'fixed', value: 200000, maxDiscount: 0, minOrder: 0 });
  await setDoc(doc(db, 'vouchers/OLD'), { ...V, code: 'OLD', endAt: Timestamp.fromMillis(Date.now() - 1000) });
  await setDoc(doc(db, 'vouchers/OFF'), { ...V, code: 'OFF', active: false });
  await setDoc(doc(db, 'bans/mallory'), { reason: 'spam', by: 'admin', at: Timestamp.now() });
  await setDoc(doc(db, 'staff/sam'), { role: 'cskh', email: 'sam@x.com', addedBy: 'admin', addedAt: Timestamp.now() });
  await setDoc(doc(db, 'settings/support'), { refundLimit: 1000000 });
  await setDoc(doc(db, 'vouchers/ALICEONLY'), { ...V, code: 'ALICEONLY', type: 'fixed', value: 100000, maxDiscount: 0, minOrder: 0, userId: 'alice' });
  await setDoc(doc(db, 'orders/so1'), { userId: 'alice', status: 'pending', total: 3030000, items: [] });
  await setDoc(doc(db, 'orders/so2'), { userId: 'alice', status: 'shipping', total: 3030000, items: [] });
  await setDoc(doc(db, 'tickets/t1'), { userId: 'alice', status: 'open', subject: 'x' });
  await setDoc(doc(db, 'tickets/t2'), { userId: 'alice', status: 'closed', subject: 'y' });
  await setDoc(doc(db, 'stockMoves/secret'), { type: 'in', unitCost: 1 });
});

const anon = env.unauthenticatedContext().firestore();
const alice = env.authenticatedContext('alice', { email: 'alice@x.com' }).firestore();
const bob = env.authenticatedContext('bob', { email: 'bob@x.com' }).firestore();
const admin = env.authenticatedContext('admin', { email: 'ad@x.com' }).firestore();
const mallory = env.authenticatedContext('mallory', { email: 'm@x.com' }).firestore();
const sam = env.authenticatedContext('sam', { email: 'sam@x.com' }).firestore();   // nhân viên CSKH

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
    shipping: ship, paymentMethod: 'cod', note: '', status: 'pending', voucher: '', discount: 0,
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
const big = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`x${i}`, 1]));
await t('giỏ > 8 dòng bị từ chối', deny(setDoc(doc(alice, 'carts/alice'), { items: big, updatedAt: serverTimestamp() })));

await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'carts/bob'), { items: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`x${i}`, 1])), updatedAt: serverTimestamp() });
});
await t('giỏ cũ 10 dòng vẫn bớt được', assertSucceeds(setDoc(doc(bob, 'carts/bob'), { items: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`x${i}`, 1])), updatedAt: serverTimestamp() })));
await t('giỏ cũ 9 dòng không thêm được', deny(setDoc(doc(bob, 'carts/bob'), { items: big, updatedAt: serverTimestamp() })));

console.log('Orders - tạo');
await t('đơn hợp lệ 1 dòng (có phí ship)', assertSucceeds(setDoc(doc(alice, 'orders/o1'), order([L1]))));
await t('đơn hợp lệ 2 dòng (miễn ship: 5tr)', assertSucceeds(setDoc(doc(alice, 'orders/o2'), order([L1, L2]))));
await t('batch đơn + xóa giỏ', (async () => {
  const b = writeBatch(alice);
  b.set(doc(alice, 'orders/o3'), order([L2]));
  b.set(doc(alice, 'carts/alice'), { items: {}, updatedAt: serverTimestamp() });
  await assertSucceeds(b.commit());
})());
const ten = Array.from({ length: 8 }, (_, i) => ({ productId: `x${i}`, name: `X${i}`, price: 1000000, qty: 1 }));
// Đơn tối đa 8 dòng: 8 sản phẩm + bans + mã giảm giá = 10 lần đọc (giới hạn của 1 lệnh ghi).
await t('đơn 8 dòng hợp lệ (batch)', (async () => {
  const b = writeBatch(alice);
  b.set(doc(alice, 'orders/o10'), order(ten));
  b.set(doc(alice, 'carts/alice'), { items: {}, updatedAt: serverTimestamp() });
  await assertSucceeds(b.commit());
})());
await t('đơn 8 dòng + mã giảm giá đơn lẻ', assertSucceeds(setDoc(doc(alice, 'orders/o8s'), order(ten, { voucher: 'GIAM10', discount: 500000, total: 8000000 - 500000 }))));
await t('đơn 8 dòng + mã giảm giá (batch)', (async () => {
  const b = writeBatch(alice);
  b.set(doc(alice, 'orders/o10v'), order(ten, { voucher: 'GIAM10', discount: 500000, total: 8000000 - 500000 }));
  b.set(doc(alice, 'carts/alice'), { items: {}, updatedAt: serverTimestamp() });
  await assertSucceeds(b.commit());
})());
const eleven = Array.from({ length: 9 }, (_, i) => ({ productId: `x${i}`, name: `X${i}`, price: 1000000, qty: 1 }));
await t('đơn 9 dòng bị từ chối', deny(setDoc(doc(alice, 'orders/o11'), order(eleven))));
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
await t('thiếu trường voucher bị từ chối', deny(setDoc(doc(alice, 'orders/bad12'), (({ voucher, ...o }) => o)(order([L1])))));
await t('qty số thực bị từ chối', deny(setDoc(doc(alice, 'orders/bad11'), order([{ ...L1, qty: 1.5 }]))));

console.log('Orders - mã giảm giá');
// L1 + L2 = 5.000.000: GIAM10 → 10% = 500.000 (đúng bằng mức trần)
const v = (code, discount, items = [L1, L2]) => {
  const o = order(items);
  return { ...o, voucher: code, discount, total: o.total - discount };
};
await t('mã % hợp lệ', assertSucceeds(setDoc(doc(alice, 'orders/v1'), v('GIAM10', 500000))));
await t('mã tiền cố định hợp lệ', assertSucceeds(setDoc(doc(alice, 'orders/v2'), v('BIG', 200000, [L1]))));
await t('giảm sai số tiền bị từ chối', deny(setDoc(doc(alice, 'orders/v3'), v('GIAM10', 600000))));
await t('chưa đủ đơn tối thiểu bị từ chối', deny(setDoc(doc(alice, 'orders/v4'), v('GIAM10', 100000, [{ ...L2, qty: 1 }]))));
await t('mã hết hạn bị từ chối', deny(setDoc(doc(alice, 'orders/v5'), v('OLD', 500000))));
await t('mã đã tắt bị từ chối', deny(setDoc(doc(alice, 'orders/v6'), v('OFF', 500000))));
await t('mã không tồn tại bị từ chối', deny(setDoc(doc(alice, 'orders/v7'), v('NOPE', 1000))));
await t('giảm giá không có mã bị từ chối', deny(setDoc(doc(alice, 'orders/v8'), v('', 1000))));
await t('khách đọc 1 mã', assertSucceeds(getDoc(doc(alice, 'vouchers/GIAM10'))));
await t('khách không liệt kê mã', deny(getDocs(collection(alice, 'vouchers'))));
await t('khách không tạo mã', deny(setDoc(doc(alice, 'vouchers/FREE'), { code: 'FREE' })));
const nv = { code: 'NEW1', type: 'percent', value: 5, minOrder: 0, maxDiscount: 0, active: true,
  startAt: Timestamp.now(), endAt: Timestamp.fromMillis(Date.now() + 1e9) };
await t('admin tạo mã', assertSucceeds(setDoc(doc(admin, 'vouchers/NEW1'), nv)));
await t('admin: mã > 100% bị từ chối', deny(setDoc(doc(admin, 'vouchers/NEW2'), { ...nv, code: 'NEW2', value: 150 })));
await t('admin: code khác ID bị từ chối', deny(setDoc(doc(admin, 'vouchers/NEW3'), nv)));

console.log('Khóa tài khoản');
await t('tài khoản bị khóa không đặt hàng', deny(setDoc(doc(mallory, 'orders/m1'), order([L1], { userId: 'mallory' }))));
await t('tài khoản bị khóa không sửa giỏ', deny(setDoc(doc(mallory, 'carts/mallory'), { items: {}, updatedAt: serverTimestamp() })));
await t('tự đọc trạng thái khóa', assertSucceeds(getDoc(doc(mallory, 'bans/mallory'))));
await t('không tự mở khóa', deny(deleteDoc(doc(mallory, 'bans/mallory'))));
await t('khách không khóa người khác', deny(setDoc(doc(alice, 'bans/bob'), { reason: '', by: 'alice', at: serverTimestamp() })));
await t('admin khóa', assertSucceeds(setDoc(doc(admin, 'bans/bob'), { reason: 'x', by: 'admin', at: serverTimestamp() })));
await t('admin khóa: ghi sai người thực hiện bị từ chối', deny(setDoc(doc(admin, 'bans/bob2'), { reason: 'x', by: 'alice', at: serverTimestamp() })));
await t('admin mở khóa', assertSucceeds(deleteDoc(doc(admin, 'bans/bob'))));

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
await t('khách không xem danh sách admin', deny(getDocs(collection(alice, 'admins'))));
await t('admin xem danh sách admin', assertSucceeds(getDocs(collection(admin, 'admins'))));
await t('admin cấp quyền admin', assertSucceeds(setDoc(doc(admin, 'admins/carol'), { email: 'c@x.com', addedBy: 'admin', addedAt: serverTimestamp() })));
await t('admin không tự gỡ quyền mình', deny(deleteDoc(doc(admin, 'admins/admin'))));
await t('admin gỡ quyền admin khác', assertSucceeds(deleteDoc(doc(admin, 'admins/carol'))));
await t('admin đọc danh sách khách', assertSucceeds(getDocs(collection(admin, 'users'))));
await t('khách không đọc danh sách khách', deny(getDocs(collection(alice, 'users'))));

console.log('Kho, giá, nhật ký');
const log = { action: 'product.update', target: 'p1', detail: 'x', by: 'admin', byEmail: 'ad@x.com', at: serverTimestamp() };
await t('admin ghi nhật ký', assertSucceeds(setDoc(doc(admin, 'auditLogs/l1'), log)));
await t('admin không sửa nhật ký', deny(updateDoc(doc(admin, 'auditLogs/l1'), { detail: 'y' })));
await t('admin không xóa nhật ký', deny(deleteDoc(doc(admin, 'auditLogs/l1'))));
await t('nhật ký sai người thực hiện bị từ chối', deny(setDoc(doc(admin, 'auditLogs/l2'), { ...log, by: 'alice' })));
await t('khách không đọc nhật ký', deny(getDocs(collection(alice, 'auditLogs'))));
const mv = { productId: 'p1', name: 'CPU A', type: 'in', qty: 5, unitCost: 2500000, supplier: 'NCC A', note: '', stockAfter: 10, by: 'admin', at: serverTimestamp() };
await t('admin tạo phiếu nhập', assertSucceeds(setDoc(doc(admin, 'stockMoves/m1'), mv)));
await t('phiếu kho loại lạ bị từ chối', deny(setDoc(doc(admin, 'stockMoves/m2'), { ...mv, type: 'gift' })));
await t('khách không xem giá vốn (phiếu kho)', deny(getDoc(doc(alice, 'stockMoves/m1'))));
await t('admin ghi lịch sử giá', assertSucceeds(setDoc(doc(admin, 'priceHistory/h1'), { productId: 'p1', from: 1, to: 2, by: 'admin', at: serverTimestamp() })));
await t('khách không đọc lịch sử giá', deny(getDocs(collection(alice, 'priceHistory'))));

console.log('CSKH - quyền hạn (Bảng 1.3)');
await t('CSKH xem mọi đơn', assertSucceeds(getDocs(collection(sam, 'orders'))));
await t('CSKH xem hồ sơ khách', assertSucceeds(getDocs(collection(sam, 'users'))));
await t('CSKH xác nhận đơn chờ', assertSucceeds(updateDoc(doc(sam, 'orders/so1'), { status: 'confirmed', updatedAt: serverTimestamp() })));
await t('CSKH không nhảy cóc trạng thái (confirmed → done)', deny(updateDoc(doc(sam, 'orders/so1'), { status: 'done' })));
await t('CSKH không đưa đơn về "Chờ xác nhận"', deny(updateDoc(doc(sam, 'orders/so1'), { status: 'pending' })));
await t('CSKH báo giao thất bại', assertSucceeds(updateDoc(doc(sam, 'orders/so2'), { status: 'failed' })));
await t('CSKH không sửa tổng tiền đơn', deny(updateDoc(doc(sam, 'orders/so2'), { total: 1 })));
await t('CSKH không sửa giá sản phẩm', deny(updateDoc(doc(sam, 'products/p1'), { price: 1 })));
await t('CSKH trừ tồn kho khi xác nhận đơn', assertSucceeds(updateDoc(doc(sam, 'products/p1'), { stock: 4, sold: 2, updatedAt: serverTimestamp() })));
await t('CSKH không đặt tồn kho âm', deny(updateDoc(doc(sam, 'products/p1'), { stock: -1 })));
await t('CSKH không xem giá vốn (phiếu kho)', deny(getDoc(doc(sam, 'stockMoves/secret'))));
await t('CSKH ghi phiếu trừ kho theo đơn', assertSucceeds(setDoc(doc(sam, 'stockMoves/s1'), { ...mv, type: 'order', qty: -1, by: 'sam' })));
await t('CSKH không lập phiếu nhập kho', deny(setDoc(doc(sam, 'stockMoves/s2'), { ...mv, by: 'sam' })));
await t('CSKH không xem lịch sử giá', deny(getDocs(collection(sam, 'priceHistory'))));
await t('CSKH không xem nhật ký', deny(getDocs(collection(sam, 'auditLogs'))));
await t('CSKH ghi nhật ký thao tác của mình', assertSucceeds(setDoc(doc(sam, 'auditLogs/s1'), { ...log, by: 'sam', byEmail: 'sam@x.com' })));
await t('CSKH không khóa tài khoản', deny(setDoc(doc(sam, 'bans/bob'), { reason: 'x', by: 'sam', at: serverTimestamp() })));
await t('CSKH không tự cấp quyền admin', deny(setDoc(doc(sam, 'admins/sam'), { email: 'sam@x.com', addedBy: 'sam', addedAt: serverTimestamp() })));
await t('CSKH không tạo nhân viên khác', deny(setDoc(doc(sam, 'staff/bob'), { role: 'cskh', email: 'b', addedBy: 'sam', addedAt: serverTimestamp() })));
await t('admin cấp vai trò CSKH', assertSucceeds(setDoc(doc(admin, 'staff/bob'), { role: 'cskh', email: 'bob@x.com', addedBy: 'admin', addedAt: serverTimestamp() })));
await t('admin gỡ vai trò CSKH', assertSucceeds(deleteDoc(doc(admin, 'staff/bob'))));
await t('khách không đọc danh sách nhân viên', deny(getDocs(collection(alice, 'staff'))));
await t('CSKH không sửa hạn mức hoàn tiền', deny(setDoc(doc(sam, 'settings/support'), { refundLimit: 9e9 })));

console.log('CSKH - hoàn tiền');
const rf = (amount, extra = {}) => ({ orderId: 'so2', userId: 'alice', amount, reason: 'Giao thiếu hàng', method: 'bank', by: 'sam', byEmail: 'sam@x.com', at: serverTimestamp(), ...extra });
await t('CSKH hoàn tiền trong hạn mức', assertSucceeds(setDoc(doc(sam, 'refunds/r1'), rf(500000))));
await t('CSKH hoàn tiền vượt hạn mức bị từ chối', deny(setDoc(doc(sam, 'refunds/r2'), rf(1500000))));
await t('admin hoàn tiền vượt hạn mức nhân viên', assertSucceeds(setDoc(doc(admin, 'refunds/r3'), rf(1500000, { by: 'admin' }))));
await t('hoàn quá tổng tiền đơn bị từ chối', deny(setDoc(doc(admin, 'refunds/r4'), rf(5000000, { by: 'admin' }))));
await t('hoàn sai khách của đơn bị từ chối', deny(setDoc(doc(sam, 'refunds/r5'), rf(1000, { userId: 'bob' }))));
await t('khách xem khoản hoàn của mình', assertSucceeds(getDocs(query(collection(alice, 'refunds'), where('userId', '==', 'alice')))));

console.log('CSKH - yêu cầu hỗ trợ');
const tk = (extra = {}) => ({ userId: 'alice', userEmail: 'alice@x.com', userName: 'Alice', subject: 'Hỏi bảo hành', category: 'bao-hanh',
  orderId: '', productId: '', channel: 'web', status: 'open', dept: 'cskh', assignee: '', assigneeEmail: '',
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessageAt: serverTimestamp(), lastFrom: 'customer', ...extra });
await t('khách tạo yêu cầu hỗ trợ', assertSucceeds(setDoc(doc(alice, 'tickets/n1'), tk())));
await t('khách tạo phiếu + tin nhắn đầu trong 1 batch', (async () => {
  const b = writeBatch(alice);
  b.set(doc(alice, 'tickets/nb'), tk());
  b.set(doc(alice, 'tickets/nb/messages/m0'), { from: 'customer', text: 'Nội dung', by: 'alice', byName: 'Alice', at: serverTimestamp() });
  await assertSucceeds(b.commit());
})());
await t('khách không tạo yêu cầu đứng tên người khác', deny(setDoc(doc(alice, 'tickets/n2'), tk({ userId: 'bob' }))));
await t('khách không tự gán nhân viên', deny(setDoc(doc(alice, 'tickets/n3'), tk({ assignee: 'sam' }))));
await t('khách bị khóa vẫn gửi được yêu cầu hỗ trợ', assertSucceeds(setDoc(doc(mallory, 'tickets/n4'), tk({ userId: 'mallory', userEmail: 'm@x.com' }))));
await t('CSKH tạo phiếu hộ khi khách gọi hotline', assertSucceeds(setDoc(doc(sam, 'tickets/n5'), tk({ channel: 'phone', lastFrom: 'staff', assignee: 'sam' }))));
await t('khách không đọc phiếu người khác', deny(getDoc(doc(bob, 'tickets/t1'))));
await t('khách liệt kê phiếu của mình', assertSucceeds(getDocs(query(collection(alice, 'tickets'), where('userId', '==', 'alice')))));
const msg = (from, by, extra = {}) => ({ from, text: 'Xin chào', by, byName: 'X', at: serverTimestamp(), ...extra });
await t('khách nhắn vào phiếu của mình', assertSucceeds(setDoc(doc(alice, 'tickets/t1/messages/m1'), msg('customer', 'alice'))));
await t('khách không nhắn giả danh nhân viên', deny(setDoc(doc(alice, 'tickets/t1/messages/m2'), msg('staff', 'alice'))));
await t('khách không nhắn vào phiếu người khác', deny(setDoc(doc(bob, 'tickets/t1/messages/m3'), msg('customer', 'bob'))));
await t('khách không nhắn vào phiếu đã đóng', deny(setDoc(doc(alice, 'tickets/t2/messages/m4'), msg('customer', 'alice'))));
await t('CSKH trả lời', assertSucceeds(setDoc(doc(sam, 'tickets/t1/messages/m5'), msg('staff', 'sam'))));
await t('khách đọc hội thoại của mình', assertSucceeds(getDocs(collection(alice, 'tickets/t1/messages'))));
await t('khách không đọc hội thoại người khác', deny(getDocs(collection(bob, 'tickets/t1/messages'))));
await t('khách cập nhật thời điểm nhắn', assertSucceeds(updateDoc(doc(alice, 'tickets/t1'), { status: 'open', lastFrom: 'customer', lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() })));
await t('khách không tự đóng/chuyển phiếu', deny(updateDoc(doc(alice, 'tickets/t1'), { dept: 'admin' })));
await t('CSKH đóng phiếu', assertSucceeds(updateDoc(doc(sam, 'tickets/t1'), { status: 'closed', assignee: 'sam' })));
await t('khách chấm điểm hài lòng phiếu đã đóng', assertSucceeds(updateDoc(doc(alice, 'tickets/t2'), { rating: 5, ratingComment: 'Tốt', ratedAt: serverTimestamp() })));
await t('khách không chấm lại lần 2', deny(updateDoc(doc(alice, 'tickets/t2'), { rating: 1, ratingComment: '', ratedAt: serverTimestamp() })));
await t('điểm ngoài 1–5 bị từ chối', deny(updateDoc(doc(alice, 'tickets/t1'), { rating: 9, ratingComment: '', ratedAt: serverTimestamp() })));

console.log('CSKH - ghi chú, thành viên, mẫu trả lời');
const note = { userId: 'alice', type: 'call', text: 'Khách gọi hỏi giao hàng', by: 'sam', byEmail: 'sam@x.com', at: serverTimestamp() };
await t('CSKH ghi chú cuộc gọi', assertSucceeds(setDoc(doc(sam, 'customerNotes/c1'), note)));
await t('khách không đọc ghi chú nội bộ', deny(getDocs(query(collection(alice, 'customerNotes'), where('userId', '==', 'alice')))));
await t('ghi chú không sửa được', deny(updateDoc(doc(sam, 'customerNotes/c1'), { text: 'x' })));
const mem = { bonusPoints: 50, tier: 'vip', note: 'Khách thân thiết', by: 'sam', at: serverTimestamp() };
await t('CSKH nâng hạng thành viên', assertSucceeds(setDoc(doc(sam, 'members/alice'), mem)));
await t('khách xem hạng của mình', assertSucceeds(getDoc(doc(alice, 'members/alice'))));
await t('khách không tự nâng hạng', deny(setDoc(doc(alice, 'members/alice'), { ...mem, by: 'alice' })));
await t('CSKH tạo mẫu trả lời', assertSucceeds(setDoc(doc(sam, 'replyTemplates/r1'), { title: 'Bảo hành', text: 'Sản phẩm bảo hành 36 tháng', by: 'sam', at: serverTimestamp() })));
await t('khách không đọc mẫu trả lời', deny(getDocs(collection(alice, 'replyTemplates'))));

console.log('CSKH - ưu đãi riêng');
const offer = (extra = {}) => ({ code: 'VIPALICE', type: 'percent', value: 10, minOrder: 0, maxDiscount: 300000, active: true,
  startAt: Timestamp.now(), endAt: Timestamp.fromMillis(Date.now() + 7 * 86400000), userId: 'alice', createdBy: 'sam', ...extra });
await t('CSKH tạo ưu đãi riêng cho khách', assertSucceeds(setDoc(doc(sam, 'vouchers/VIPALICE'), offer())));
await t('CSKH không tạo mã chung cho mọi khách', deny(setDoc(doc(sam, 'vouchers/ALL1'), offer({ code: 'ALL1', userId: '' }))));
await t('CSKH không tạo ưu đãi quá 15%', deny(setDoc(doc(sam, 'vouchers/BIG1'), offer({ code: 'BIG1', value: 50 }))));
await t('CSKH không tạo ưu đãi hiệu lực > 31 ngày', deny(setDoc(doc(sam, 'vouchers/LONG1'), offer({ code: 'LONG1', endAt: Timestamp.fromMillis(Date.now() + 90 * 86400000) }))));
await t('CSKH không sửa mã chung của admin', deny(updateDoc(doc(sam, 'vouchers/GIAM10'), { value: 99 })));
await t('khách xem ưu đãi riêng của mình', assertSucceeds(getDocs(query(collection(alice, 'vouchers'), where('userId', '==', 'alice')))));
await t('khách khác không dùng được ưu đãi riêng', deny(setDoc(doc(bob, 'orders/vb'), { ...order([L1], { userId: 'bob' }), voucher: 'ALICEONLY', discount: 100000, total: 2930000 })));
await t('chủ ưu đãi dùng được', assertSucceeds(setDoc(doc(alice, 'orders/va'), { ...order([L1]), voucher: 'ALICEONLY', discount: 100000, total: 2930000 })));

console.log('CSKH - đánh giá, bảo hành');
const rv = (extra = {}) => ({ productId: 'p1', productName: 'CPU A', userId: 'alice', userName: 'Alice', rating: 5, text: 'Tốt',
  status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
await t('khách viết đánh giá (chờ duyệt)', assertSucceeds(setDoc(doc(alice, 'reviews/p1_alice'), rv())));
await t('khách không tự duyệt đánh giá', deny(setDoc(doc(bob, 'reviews/p1_bob'), rv({ userId: 'bob', status: 'approved' }))));
await t('khách không viết hộ người khác', deny(setDoc(doc(bob, 'reviews/p1_alice'), rv())));
await t('người khác chưa xem được đánh giá chờ duyệt', deny(getDoc(doc(anon, 'reviews/p1_alice'))));
await t('CSKH duyệt và phản hồi đánh giá', assertSucceeds(updateDoc(doc(sam, 'reviews/p1_alice'), { status: 'approved', reply: 'Cảm ơn bạn', replyBy: 'sam', replyByName: 'NEXORA', replyAt: serverTimestamp() })));
await t('CSKH không sửa nội dung đánh giá', deny(updateDoc(doc(sam, 'reviews/p1_alice'), { text: 'sửa' })));
await t('ai cũng xem đánh giá đã duyệt', assertSucceeds(getDocs(query(collection(anon, 'reviews'), where('productId', '==', 'p1'), where('status', '==', 'approved')))));
const wr = { userId: 'alice', customerName: 'Alice', phone: '0912345678', orderId: 'so2', productId: 'p1', productName: 'CPU A',
  serial: 'SN123', issue: 'Không lên hình', status: 'received', center: '', history: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(), by: 'sam' };
await t('CSKH tạo phiếu bảo hành', assertSucceeds(setDoc(doc(sam, 'warranties/w1'), wr)));
await t('khách xem phiếu bảo hành của mình', assertSucceeds(getDocs(query(collection(alice, 'warranties'), where('userId', '==', 'alice')))));
await t('khách không tự tạo phiếu bảo hành', deny(setDoc(doc(alice, 'warranties/w2'), wr)));

await env.cleanup();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
