// Điều hướng bằng hash (#/...) — hợp với Firebase Hosting và iframe Google Sites.
//   #/?q=&cat=&gia=&min=&max=&con=&sx=&trang=&hang=&{thông số}=   danh sách / tìm kiếm
//   #/sp/{id}                                chi tiết
//   #/gio-hang · #/thanh-toan · #/dat-hang-thanh-cong/{id}
//   #/dang-nhap · #/quen-mat-khau · #/tai-khoan
//   #/ho-tro · #/ho-tro/moi?loai=&don= · #/ho-tro/{id}     hỗ trợ khách hàng (chat với nhân viên)
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { auth } from './firebase.js';
import { $, $$, say, clearMsg, errText } from './ui.js';
import { renderList, renderDetail, listHref, loadProducts } from './catalog.js';
import { initAccount, ensureProfile, clearProfile, renderAccount, showTab, setAuthReason, loadRoles } from './account.js';
import { initCart, startCart, stopCart, addToCart, renderCart, renderCheckout, renderDone } from './cart.js';
import { renderSupport, stopSupport } from './support.js';

let user = null;
let authKnown = false;
let returnTo = null;        // trang cần quay lại sau khi đăng nhập
let pendingAdd = null;      // sản phẩm khách bấm "thêm vào giỏ" khi chưa đăng nhập

const VIEWS = ['list', 'detail', 'cart', 'checkout', 'done', 'auth', 'forgot', 'account', 'support'];
// Trang xem được khi chưa biết trạng thái đăng nhập: hiện ngay, không chờ Firebase Auth.
const PUBLIC = new Set([undefined, 'sp']);
let renderedHash = null;   // hash đã hiển thị xong
let lastPage = null;       // để chỉ chuyển focus khi sang trang khác (không phải khi đổi bộ lọc)

// Bắt đầu tải sản phẩm ngay, song song với việc khôi phục phiên đăng nhập.
loadProducts().catch(() => {});

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
  const { parts, params } = parseHash();
  const [page, arg] = parts;
  if (!authKnown && !PUBLIC.has(page)) return;
  const hash = location.hash;
  clearMsgOnNav();
  if (page !== 'ho-tro') stopSupport();   // ngừng nghe tin nhắn realtime khi rời trang hỗ trợ
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
      case 'ho-tro':
        if (!user) return requireLogin('Đăng nhập để gửi yêu cầu hỗ trợ và chat với nhân viên.');
        show('support', 'account');
        await renderSupport(user, params, arg && decodeURIComponent(arg));
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
    renderedHash = hash;
    // Sang trang khác: đưa focus tới tiêu đề để trình đọc màn hình đọc trang mới (bỏ qua lần tải đầu).
    if (lastPage !== null && lastPage !== (page || 'list')) focusHeading();
    lastPage = page || 'list';
  } catch (e) {
    say(errText(e), 'err');
  }
}

function focusHeading() {
  const h = VIEWS.map((v) => $(`#view-${v}`)).find((el) => !el.hidden)?.querySelector('h1');
  if (!h) return;
  h.tabIndex = -1;
  h.focus({ preventScroll: true });
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
// Trang quản trị (admin/) — nằm cùng thư mục với trang này.
const ADMIN_URL = new URL('admin/', location.href.split('#')[0]).href;

onAuthStateChanged(auth, async (u) => {
  user = u;
  const nav = $('#nav-account');
  const fromLogin = parseHash().parts[0] === 'dang-nhap';
  if (u) {
    nav.textContent = 'Tài khoản';
    const roles = await loadRoles(u);
    $('#nav-admin').hidden = !(roles.admin || roles.staff);
    $('#nav-admin').textContent = roles.admin ? 'Quản trị' : 'CSKH';
    // Quản trị viên / nhân viên CSKH vừa đăng nhập → chuyển thẳng tới trang quản lý.
    if ((roles.admin || roles.staff) && fromLogin) {
      location.replace(ADMIN_URL);
      return;
    }
    if (roles.ban) say(`Tài khoản đã bị khóa${roles.ban.reason ? ` (lý do: ${roles.ban.reason})` : ''}. Bạn không đặt hàng được.`, 'err');
    startCart(u, rerenderIfCartView);
    try { await ensureProfile(u); } catch (e) { say(errText(e), 'err'); }
    if (pendingAdd) {
      const { id, qty } = pendingAdd;
      pendingAdd = null;
      addToCart(id, qty).catch((e) => say(errText(e), 'err'));
    }
  } else {
    nav.textContent = 'Đăng nhập';
    $('#nav-admin').hidden = true;
    stopSupport();
    stopCart();
    clearProfile();
  }
  authKnown = true;
  const { parts } = parseHash();
  if (u && parts[0] === 'dang-nhap') {
    location.hash = returnTo || '#/tai-khoan';
    returnTo = null;
  } else if (!(PUBLIC.has(parts[0]) && renderedHash === location.hash)) {
    route();   // trang công khai đã hiện từ trước thì không vẽ lại
  }
});

window.addEventListener('hashchange', route);
route();

// Link "Bỏ qua tới nội dung chính": app dùng hash để điều hướng nên không để trình duyệt đổi hash.
$('#skip').addEventListener('click', (ev) => {
  ev.preventDefault();
  $('#main').focus();
});

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
