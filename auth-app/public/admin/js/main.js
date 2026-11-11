// Trang quản trị: chỉ tài khoản có admins/{uid} mới vào được (Security Rules cũng chặn ở máy chủ).
//   #/              Dashboard          #/bao-cao      Báo cáo doanh thu
//   #/san-pham      Sản phẩm           #/kho          Kho hàng
//   #/don-hang      Đơn hàng           #/khach-hang   Khách hàng
//   #/khuyen-mai    Mã giảm giá        #/nhat-ky      Nhật ký hoạt động
//   #/cai-dat       Cài đặt & quản trị viên
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { $, $$ } from '../../js/ui.js';
import { auth, db, me, esc, toast, errMsg, closeDialog, refreshBadges } from './core.js';

const VIEWS = {
  'tong-quan': () => import('./dashboard.js'),
  'bao-cao': () => import('./reports.js'),
  'san-pham': () => import('./products.js'),
  'kho': () => import('./inventory.js'),
  'don-hang': () => import('./orders.js'),
  'khach-hang': () => import('./customers.js'),
  'khuyen-mai': () => import('./vouchers.js'),
  'nhat-ky': () => import('./logs.js'),
  'cai-dat': () => import('./settings.js')
};
const TITLES = {
  'tong-quan': 'Dashboard', 'bao-cao': 'Báo cáo doanh thu', 'san-pham': 'Sản phẩm', 'kho': 'Kho hàng',
  'don-hang': 'Đơn hàng', 'khach-hang': 'Khách hàng', 'khuyen-mai': 'Mã giảm giá',
  'nhat-ky': 'Nhật ký hoạt động', 'cai-dat': 'Cài đặt'
};

let ready = false;
let renderSeq = 0;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const [view, arg] = path.split('/').filter(Boolean);
  return { view: view || 'tong-quan', arg, params: Object.fromEntries(new URLSearchParams(qs)) };
}

async function route() {
  if (!ready) return;
  const { view, arg, params } = parseHash();
  if (!VIEWS[view]) { location.hash = '#/'; return; }
  const seq = ++renderSeq;
  $$('#side a').forEach((a) => {
    const on = a.dataset.view === view;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.title = `${TITLES[view]} · Quản trị NEXORA`;
  const box = $('#view');
  if (box.dataset.view !== view) box.innerHTML = '<p class="loading">Đang tải…</p>';
  box.dataset.view = view;
  box.onclick = null;   // mỗi trang gắn sự kiện bằng box.onclick / box.onchange (không bị cộng dồn)
  box.onchange = null;
  try {
    const mod = await VIEWS[view]();
    if (seq !== renderSeq) return;           // người dùng đã sang trang khác
    await mod.render(box, params, arg);
  } catch (e) {
    if (seq === renderSeq) box.innerHTML = `<p class="msg err">${esc(errMsg(e))}</p>`;
  }
  refreshBadges();
}

function deny(html) {
  ready = false;
  $('#side').hidden = true;
  $('#view').hidden = true;
  $('#gate').hidden = false;
  $('#gate').innerHTML = html;
}

onAuthStateChanged(auth, async (u) => {
  $('#btn-logout').hidden = !u;
  if (!u) {
    // Chưa đăng nhập → về trang đăng nhập của cửa hàng; đăng nhập xong sẽ tự quay lại đây.
    $('#who').textContent = '';
    location.replace('../#/dang-nhap');
    return;
  }
  $('#who').textContent = u.email;
  let isAdmin = false;
  try {
    isAdmin = (await getDoc(doc(db, 'admins', u.uid))).exists();
  } catch (e) {
    deny(`<p class="msg err">${esc(errMsg(e))}</p>`);
    return;
  }
  if (!isAdmin) {
    deny(`<div class="card narrow-card">
      <h1>Không có quyền truy cập</h1>
      <p>Tài khoản <strong>${esc(u.email)}</strong> không phải quản trị viên.</p>
      <p class="hint">Quản trị viên khác có thể cấp quyền ở mục Cài đặt. Admin đầu tiên tạo tài liệu
        <code>admins/${esc(u.uid)}</code> trong Firebase Console (xem HUONG-DAN.md).</p>
      <a class="btn primary" href="../">Về cửa hàng</a></div>`);
    return;
  }
  me.uid = u.uid;
  me.email = u.email;
  ready = true;
  $('#gate').hidden = true;
  $('#side').hidden = false;
  $('#view').hidden = false;
  route();
});

window.addEventListener('hashchange', () => { closeDialog(); route(); window.scrollTo(0, 0); });

// Dữ liệu realtime (đơn hàng) thay đổi → cập nhật số trên menu, vẽ lại trang đang xem nếu không làm phiền.
const LIVE_VIEWS = new Set(['tong-quan', 'don-hang', 'khach-hang', 'bao-cao']);
window.addEventListener('admin:data', (ev) => {
  refreshBadges();
  if (ev.detail.name === 'orders' && ev.detail.added) toast(`Có ${ev.detail.added} đơn hàng mới.`);
  const typing = document.activeElement?.matches('input, select, textarea');
  const { view, arg } = parseHash();
  if (LIVE_VIEWS.has(view) && !arg && !$('#dlg').open && !typing) route();
});

$('#btn-logout').addEventListener('click', async () => {
  await signOut(auth);
});
$('#skip').addEventListener('click', (ev) => { ev.preventDefault(); $('#main').focus(); });

// Nút đóng hộp thoại (mọi nút có data-close).
$('#dlg').addEventListener('click', (ev) => {
  if (ev.target.closest('[data-close]') || ev.target === ev.currentTarget) closeDialog();
});

window.addEventListener('unhandledrejection', (ev) => toast(errMsg(ev.reason), 'err'));
