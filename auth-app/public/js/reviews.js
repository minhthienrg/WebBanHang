// Đánh giá sản phẩm trên trang chi tiết (Bảng 3.1 mục 11). Khách đã đăng nhập viết đánh giá
// (1 đánh giá / sản phẩm, sửa được); nhân viên CSKH duyệt trước khi hiện công khai và có thể phản hồi.
import {
  collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { auth, db } from './firebase.js';
import { getProfile, banInfo } from './account.js';
import { $, esc, say, busy, errText } from './ui.js';

const stars = (n) => `<span class="stars" aria-label="${n} trên 5 sao">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
const date = (t) => (t?.toDate ? t.toDate().toLocaleDateString('vi-VN') : '');

export async function renderReviews(p) {
  const box = $('#reviews');
  if (!box) return;
  const user = auth.currentUser;
  let list = [], mine = null;
  try {
    const [snap, own] = await Promise.all([
      getDocs(query(collection(db, 'reviews'), where('productId', '==', p.id), where('status', '==', 'approved'))),
      user ? getDoc(doc(db, 'reviews', `${p.id}_${user.uid}`)).catch(() => null) : null
    ]);
    list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    mine = own?.exists() ? own.data() : null;
  } catch (e) {
    console.error(e);
  }
  if (!$('#reviews') || location.hash !== `#/sp/${p.id}`) return;   // đã sang trang khác
  const avg = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => [n, list.filter((r) => r.rating === n).length]);

  box.innerHTML = `
    <h2 id="reviews-h">Đánh giá sản phẩm</h2>
    ${list.length ? `<div class="rv-summary">
        <div class="rv-avg"><strong>${avg.toFixed(1).replace('.', ',')}</strong>${stars(Math.round(avg))}<span class="hint">${list.length} đánh giá</span></div>
        <ul class="rv-dist">${dist.map(([n, c]) => `<li><span>${n}★</span><span class="rv-bar"><span style="width:${(c / list.length) * 100}%"></span></span><span class="hint">${c}</span></li>`).join('')}</ul>
      </div>` : '<p class="hint">Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá sản phẩm này.</p>'}

    <div class="rv-form-wrap">
      ${!user ? `<p class="hint"><a href="#/dang-nhap">Đăng nhập</a> để viết đánh giá.</p>`
        : banInfo() ? '<p class="hint">Tài khoản đang bị khóa nên không viết đánh giá được.</p>'
        : `${mine ? `<p class="note">${mine.status === 'pending' ? 'Đánh giá của bạn đang chờ nhân viên duyệt.'
            : mine.status === 'hidden' ? 'Đánh giá của bạn đã bị ẩn vì chưa phù hợp quy định. Bạn có thể sửa lại.'
            : 'Đánh giá của bạn đã được đăng. Sửa lại sẽ cần duyệt lại.'}</p>` : ''}
        <details class="rv-details" ${mine ? '' : 'open'}>
          <summary>${mine ? 'Sửa đánh giá của bạn' : 'Viết đánh giá'}</summary>
          <form id="rv-form" class="form" novalidate>
            <fieldset class="rv-stars">
              <legend>Chấm điểm</legend>
              ${[5, 4, 3, 2, 1].map((n) => `<label class="check"><input type="radio" name="rating" value="${n}" ${(mine?.rating || 5) === n ? 'checked' : ''}> ${stars(n)}</label>`).join('')}
            </fieldset>
            <label>Nhận xét <textarea name="text" rows="3" maxlength="1000" placeholder="Sản phẩm dùng thế nào? Đóng gói, giao hàng ra sao?">${esc(mine?.text || '')}</textarea></label>
            <button type="submit" class="btn primary">Gửi đánh giá</button>
          </form>
        </details>`}
    </div>

    ${list.length ? `<ul class="rv-list">${list.map((r) => `
      <li class="rv">
        <div class="rv-head"><strong>${esc(r.userName)}</strong> ${stars(r.rating)} <span class="hint">${esc(date(r.createdAt))}</span></div>
        ${r.text ? `<p>${esc(r.text)}</p>` : ''}
        ${r.reply ? `<div class="rv-reply"><strong>${esc(r.replyByName || 'NEXORA')}</strong> phản hồi: ${esc(r.reply)}</div>` : ''}
      </li>`).join('')}</ul>` : ''}`;

  const f = $('#rv-form');
  f?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    busy(f.querySelector('[type=submit]'), async () => {
      try {
        const u = auth.currentUser;
        const name = (getProfile()?.name || u.displayName || u.email.split('@')[0]).slice(0, 100);
        await setDoc(doc(db, 'reviews', `${p.id}_${u.uid}`), {
          productId: p.id, productName: p.name.slice(0, 200), userId: u.uid, userName: name,
          rating: Number(f.rating.value), text: f.text.value.trim(), status: 'pending',
          createdAt: mine?.createdAt || serverTimestamp(), updatedAt: serverTimestamp()
        });
        say('Cảm ơn bạn! Đánh giá sẽ hiện sau khi nhân viên duyệt.');
        renderReviews(p);
      } catch (e) { say(errText(e), 'err'); }
    });
  });
}
