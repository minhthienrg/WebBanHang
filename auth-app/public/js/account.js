// Đăng ký / đăng nhập / quên mật khẩu / hồ sơ / danh sách đơn hàng.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { auth, db } from './firebase.js';
import { $, $$, say, clearMsg, busy, errText, esc, money, normalizePhone, validPhone } from './ui.js';

const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();

// ---------- Hồ sơ: users/{uid} ----------
const profileRef = (uid) => doc(db, 'users', uid);
let currentProfile = null;
export const getProfile = () => currentProfile;

// Khi đăng ký, chờ ghi hồ sơ xong rồi mới đọc (tránh tạo hồ sơ 2 lần).
let pendingSignup = null;

export async function ensureProfile(user, name) {
  if (pendingSignup) await pendingSignup;
  const ref = profileRef(user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    currentProfile = snap.data();
    return currentProfile;
  }
  const data = {
    name: (name || user.displayName || user.email.split('@')[0]).slice(0, 100),
    phone: '',
    address: '',
    email: user.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(ref, data);
  currentProfile = data;
  return data;
}

export function clearProfile() { currentProfile = null; }

/** Lưu SĐT/địa chỉ vào hồ sơ (dùng ở trang thanh toán khi hồ sơ còn trống). */
export async function saveProfile(user, { name, phone, address }) {
  await updateDoc(profileRef(user.uid), {
    name, phone, address, email: user.email, updatedAt: serverTimestamp()
  });
  currentProfile = { ...currentProfile, name, phone, address };
}

// ---------- Màn đăng nhập ----------
export function showTab(tab) {
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#form-login').hidden = tab !== 'login';
  $('#form-register').hidden = tab !== 'register';
}

export function setAuthReason(text) {
  const el = $('#auth-reason');
  el.textContent = text || '';
  el.hidden = !text;
}

// ---------- Trang tài khoản ----------
const STATUS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  shipping: 'Đang giao',
  done: 'Hoàn tất',
  cancelled: 'Đã hủy'
};
export const statusText = (s) => STATUS[s] || s;
export const shortId = (id) => id.slice(0, 8).toUpperCase();

export async function renderAccount(user) {
  const data = currentProfile || await ensureProfile(user);
  $('#hello').textContent = `Xin chào, ${data.name || ''}`.trim();
  $('#user-email').textContent = user.email;
  const avatar = $('#avatar');
  avatar.hidden = !user.photoURL;
  if (user.photoURL) avatar.src = user.photoURL;
  $('#verify-note').hidden = user.emailVerified;
  const f = $('#form-profile');
  f.name.value = data.name || '';
  f.phone.value = data.phone || '';
  f.address.value = data.address || '';
  await renderOrders(user);
}

async function renderOrders(user) {
  const box = $('#orders');
  box.innerHTML = '<p class="hint">Đang tải…</p>';
  try {
    // Chỉ lọc theo userId (không cần composite index), sắp xếp ở trình duyệt.
    const snap = await getDocs(query(collection(db, 'orders'), where('userId', '==', user.uid)));
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (!orders.length) {
      box.innerHTML = '<p class="hint">Bạn chưa có đơn hàng nào. <a href="#/">Mua sắm ngay</a></p>';
      return;
    }
    box.innerHTML = orders.map((o) => `
      <article class="order">
        <div class="order-head">
          <strong>#${esc(shortId(o.id))}</strong>
          <span class="status s-${esc(o.status)}">${esc(statusText(o.status))}</span>
        </div>
        <p class="hint">${o.createdAt ? esc(o.createdAt.toDate().toLocaleString('vi-VN')) : ''}
          · ${o.items.reduce((n, i) => n + i.qty, 0)} sản phẩm · <strong>${money(o.total)}</strong></p>
        <ul class="order-items">
          ${o.items.map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join('')}
        </ul>
        ${o.status === 'pending'
          ? `<button type="button" class="link danger" data-cancel="${esc(o.id)}">Hủy đơn</button>` : ''}
      </article>`).join('');
  } catch (e) {
    box.innerHTML = `<p class="msg err">${esc(errText(e))}</p>`;
  }
}

// ---------- Gắn sự kiện (gọi 1 lần) ----------
export function initAccount() {
  $$('.tab').forEach((b) => b.addEventListener('click', () => { clearMsg(); showTab(b.dataset.tab); }));

  $('#form-login').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    busy(f.querySelector('[type=submit]'), async () => {
      clearMsg();
      try {
        await signInWithEmailAndPassword(auth, f.email.value.trim(), f.password.value);
        f.reset();
      } catch (e) { say(errText(e), 'err'); }
    });
  });

  $('#form-register').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const name = f.name.value.trim();
    if (!name) return say('Vui lòng nhập họ tên.', 'err');
    if (f.password.value !== f.password2.value) return say('Hai mật khẩu không khớp.', 'err');
    busy(f.querySelector('[type=submit]'), async () => {
      clearMsg();
      let release;
      pendingSignup = new Promise((r) => { release = r; });
      try {
        const { user } = await createUserWithEmailAndPassword(auth, f.email.value.trim(), f.password.value);
        await updateProfile(user, { displayName: name });
        const ref = profileRef(user.uid);
        const data = {
          name: name.slice(0, 100), phone: '', address: '', email: user.email,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        };
        await setDoc(ref, data);
        currentProfile = data;
        sendEmailVerification(user).catch(console.error);
        f.reset();
        say('Tạo tài khoản thành công. Hãy kiểm tra email để xác minh địa chỉ.');
      } catch (e) {
        say(errText(e), 'err');
      } finally {
        release();
        pendingSignup = null;
      }
    });
  });

  $('#btn-google').addEventListener('click', (ev) => {
    busy(ev.currentTarget, async () => {
      clearMsg();
      $('#open-tab-hint').hidden = true;
      try {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } catch (e) {
        const code = e?.code || '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        const blocked = [
          'auth/popup-blocked',
          'auth/operation-not-supported-in-this-environment',
          'auth/web-storage-unsupported',
          'auth/internal-error'
        ].includes(code);
        if (blocked && inIframe) {
          $('#open-tab-hint').hidden = false;
        } else {
          say(code === 'auth/popup-blocked'
            ? 'Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép pop-up và thử lại.'
            : errText(e), 'err');
        }
      }
    });
  });

  $('#form-forgot').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    busy(f.querySelector('[type=submit]'), async () => {
      clearMsg();
      try {
        await sendPasswordResetEmail(auth, f.email.value.trim());
        // Không tiết lộ email có tồn tại hay không.
        say('Nếu email đã đăng ký, link đặt lại mật khẩu đã được gửi. Kiểm tra cả thư mục Spam.');
      } catch (e) { say(errText(e), 'err'); }
    });
  });

  $('#form-profile').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const user = auth.currentUser;
    if (!user) return;
    const name = f.name.value.trim();
    const phone = normalizePhone(f.phone.value.trim());
    const address = f.address.value.trim();
    if (!name) return say('Vui lòng nhập họ tên.', 'err');
    if (phone && !validPhone(phone)) return say('Số điện thoại không hợp lệ (VD: 0912345678 hoặc +84912345678).', 'err');
    busy(f.querySelector('[type=submit]'), async () => {
      clearMsg();
      try {
        await saveProfile(user, { name, phone, address });
        f.phone.value = phone;
        $('#hello').textContent = `Xin chào, ${name}`;
        say('Đã lưu hồ sơ.');
      } catch (e) { say(errText(e), 'err'); }
    });
  });

  $('#btn-resend').addEventListener('click', (ev) => {
    busy(ev.currentTarget, async () => {
      try {
        await sendEmailVerification(auth.currentUser);
        say('Đã gửi lại email xác minh.');
      } catch (e) { say(errText(e), 'err'); }
    });
  });

  $('#orders').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-cancel]');
    if (!btn || !confirm('Hủy đơn hàng này?')) return;
    busy(btn, async () => {
      try {
        await updateDoc(doc(db, 'orders', btn.dataset.cancel), {
          status: 'cancelled', updatedAt: serverTimestamp()
        });
        say('Đã hủy đơn hàng.');
        await renderOrders(auth.currentUser);
      } catch (e) { say(errText(e), 'err'); }
    });
  });

  $('#btn-logout').addEventListener('click', async () => {
    clearMsg();
    await signOut(auth);
    location.hash = '#/';
  });
}
