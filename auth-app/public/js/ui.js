// Tiện ích giao diện dùng chung.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const vnd = new Intl.NumberFormat('vi-VN');
export const money = (n) => `${vnd.format(Math.round(n || 0))}₫`;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

let toastTimer;
export function say(text, type = 'ok') {
  const box = $('#msg');
  box.textContent = text;
  box.className = `msg ${type}`;
  box.hidden = false;
  clearTimeout(toastTimer);
  if (type === 'ok') toastTimer = setTimeout(() => { box.hidden = true; }, 4000);
}
export function clearMsg() { $('#msg').hidden = true; }

export async function busy(button, fn) {
  if (button) button.disabled = true;
  try { return await fn(); } finally { if (button) button.disabled = false; }
}

const ERRORS = {
  'auth/invalid-email': 'Email không hợp lệ.',
  'auth/missing-email': 'Vui lòng nhập email.',
  'auth/missing-password': 'Vui lòng nhập mật khẩu.',
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
  'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
  'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
  'auth/user-disabled': 'Tài khoản đã bị khóa.',
  'auth/email-already-in-use': 'Email này đã được đăng ký.',
  'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự.',
  'auth/too-many-requests': 'Thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
  'auth/network-request-failed': 'Lỗi mạng. Kiểm tra kết nối và thử lại.',
  'auth/account-exists-with-different-credential': 'Email này đã đăng ký bằng mật khẩu. Hãy đăng nhập bằng email và mật khẩu.',
  'auth/unauthorized-domain': 'Tên miền chưa được cho phép đăng nhập (xem hướng dẫn, bước Authorized domains).',
  'permission-denied': 'Không có quyền thực hiện thao tác này (giá hoặc tồn kho có thể vừa thay đổi — hãy tải lại trang).',
  'unavailable': 'Không kết nối được máy chủ. Vui lòng thử lại.'
};
export function errText(e) {
  console.error(e);
  return ERRORS[e?.code] || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

export function normalizePhone(raw) { return raw.replace(/[\s.\-()]/g, ''); }
export function validPhone(p) { return /^(0|\+84)\d{9,10}$/.test(p); }
