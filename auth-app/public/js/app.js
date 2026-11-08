// Điều hướng bằng hash (#/...) — hợp với Firebase Hosting và iframe Google Sites.
//   #/?q=&cat=&gia=&min=&max=&con=&sx=&trang=&hang=&{thông số}=   danh sách / tìm kiếm
//   #/sp/{id}                                chi tiết
//   #/gio-hang · #/thanh-toan · #/dat-hang-thanh-cong/{id}
//   #/dang-nhap · #/quen-mat-khau · #/tai-khoan
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { auth } from './firebase.js';
import { $, $$, say, clearMsg, errText } from './ui.js';
import { renderList, renderDetail, listHref } from './catalog.js';
import { initAccount, ensureProfile, clearProfile, renderAccount, showTab, setAuthReason } from './account.js';
import { initCart, startCart, stopCart, addToCart, renderCart, renderCheckout, renderDone } from './cart.js';

let user = null;
let authKnown = false;
let returnTo = null;        // trang cần quay lại sau khi đăng nhập
let pendingAdd = null;      // sản phẩm khách bấm "thêm vào giỏ" khi chưa đăng nhập

const VIEWS = ['list', 'detail', 'cart', 'checkout', 'done', 'auth', 'forgot', 'account'];

function show(name, navKey) {
  $('#loading').hidden = true;
  for (const v of VIEWS) $(`#view-${v}`).hidden = v !== name;
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === navKey));
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), params: Object.fromEntries(new URLSearchParams(qs)) };
}

function requireLogin(reason) {
  returnTo = location.hash || '#/';
  setAuthReason(reason);
  location.hash = '#/dang-nhap';
}

async function route() {
  if (!authKnown) return;
  const { parts, params } = parseHash();
  const [page, arg] = parts;
  clearMsgOnNav();
  try {
    switch (page) {
      case undefined:
        show('list', 'list');
        await renderList(params);
        break;
      case 'sp':
        show('detail', 'list');
        $('#view-detail').innerHTML = '<p class="loading">Đang tải…</p>';
        await renderDetail(decodeURIComponent(arg || ''));
        break;
      case 'gio-hang':
        if (!user) return requireLogin('Đăng nhập để xem giỏ hàng của bạn.');
        show('cart', 'cart');
        await renderCart();
        break;
      case 'thanh-toan':
        if (!user) return requireLogin('Đăng nhập để đặt hàng.');
        show('checkout', 'cart');
        await renderCheckout();
        break;
      case 'dat-hang-thanh-cong':
        if (!user) return requireLogin();
        show('done', 'account');
        await renderDone(decodeURIComponent(arg || ''));
        break;
      case 'dang-nhap':
        if (user) { location.hash = returnTo || '#/tai-khoan'; returnTo = null; return; }
        show('auth', 'account');
        showTab('login');
        break;
      case 'quen-mat-khau':
        show('forgot', 'account');
        $('#form-forgot').email.value = $('#form-login').email.value;
        break;
      case 'tai-khoan':
        if (!user) { setAuthReason(''); location.hash = '#/dang-nhap'; return; }
        show('account', 'account');
        await renderAccount(user);
        break;
      default:
        location.hash = '#/';
    }
    window.scrollTo(0, 0);
  } catch (e) {
    say(errText(e), 'err');
  }
}

// Ẩn thông báo lỗi cũ khi chuyển trang (giữ thông báo thành công để người dùng kịp đọc).
function clearMsgOnNav() {
  if ($('#msg').classList.contains('err')) clearMsg();
}

function rerenderIfCartView() {
  const { parts } = parseHash();
  if (parts[0] === 'gio-hang') renderCart();
}

// ---------- Trạng thái đăng nhập ----------
onAuthStateChanged(auth, async (u) => {
  user = u;
  const nav = $('#nav-account');
  if (u) {
    nav.textContent = 'Tài khoản';
    startCart(u, rerenderIfCartView);
    try { await ensureProfile(u); } catch (e) { say(errText(e), 'err'); }
    if (pendingAdd) {
      const { id, qty } = pendingAdd;
      pendingAdd = null;
      addToCart(id, qty).catch((e) => say(errText(e), 'err'));
    }
  } else {
    nav.textContent = 'Đăng nhập';
    stopCart();
    clearProfile();
  }
  authKnown = true;
  const { parts } = parseHash();
  if (u && parts[0] === 'dang-nhap') {
    location.hash = returnTo || '#/tai-khoan';
    returnTo = null;
  } else {
    route();
  }
});

window.addEventListener('hashchange', route);

// ---------- Nút "thêm vào giỏ" / "mua ngay" ở mọi trang ----------
document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('[data-add], [data-buy]');
  if (!btn) return;
  ev.preventDefault();
  const id = btn.dataset.add || btn.dataset.buy;
  const qtyInput = btn.dataset.qtyFrom ? $(btn.dataset.qtyFrom) : null;
  const qty = Math.max(1, Number(qtyInput?.value) || 1);
  if (!user) {
    pendingAdd = { id, qty };
    requireLogin('Đăng nhập để thêm sản phẩm vào giỏ hàng.');
    return;
  }
  btn.disabled = true;
  try {
    const ok = await addToCart(id, qty);
    if (ok && btn.dataset.buy) location.hash = '#/gio-hang';
  } catch (e) {
    say(errText(e), 'err');
  } finally {
    btn.disabled = false;
  }
});

// ---------- Tìm kiếm (header): kết quả dùng lại trang danh sách, bỏ các bộ lọc cũ ----------
$('#search').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const q = $('#search-q').value.trim();
  location.hash = listHref({}, { q });
  $('#search-q').blur();   // đóng bàn phím trên điện thoại
});

// ---------- Bộ lọc: sắp xếp, khoảng giá tự nhập, còn hàng ----------
$('#sort').addEventListener('change', (ev) => {
  location.hash = listHref(parseHash().params, { sx: ev.target.value === 'pop' ? '' : ev.target.value });
});
$('#f-custom').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const f = ev.currentTarget;
  const min = f.min.value.trim();
  const max = f.max.value.trim();
  if (min && max && Number(min) > Number(max)) return say('Giá "từ" phải nhỏ hơn giá "đến".', 'err');
  location.hash = listHref(parseHash().params, { gia: '', min, max });
});
$('#f-stock').addEventListener('change', (ev) => {
  location.hash = listHref(parseHash().params, { con: ev.target.checked ? '1' : '' });
});

// Bộ lọc thu gọn sẵn trên màn hình hẹp.
if (window.matchMedia('(max-width: 720px)').matches) $('#filters').open = false;

initAccount();
initCart();
