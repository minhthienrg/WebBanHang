// Duyệt và phản hồi đánh giá trên trang sản phẩm (Bảng 1.2). Đánh giá mới ở trạng thái "chờ duyệt";
// chỉ đánh giá đã duyệt mới hiện công khai.
import {
  doc, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  db, me, load, patchCache, audit, esc, num, fold, toast, errMsg, busy, hrefWith, fmtDateTime, toMs
} from './core.js';

const STATUS = { pending: 'Chờ duyệt', approved: 'Đã đăng', hidden: 'Đã ẩn' };
const CLS = { pending: 's-pending', approved: 's-done', hidden: 's-cancelled' };
const stars = (n) => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;

export async function render(box, params) {
  const all = await load('reviews', !!params.reload);
  const tt = params.tt ?? 'pending';
  const words = fold(params.q || '').split(/\s+/).filter(Boolean);
  const list = all.filter((r) => (!tt || r.status === tt)
    && (!params.sao || r.rating <= Number(params.sao))
    && (!words.length || words.every((w) => fold(`${r.productName} ${r.userName} ${r.text}`).includes(w))))
    .sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">Chăm sóc khách hàng</p><h1>Đánh giá sản phẩm</h1></div>
      <a class="btn small" href="${hrefWith('danh-gia', params, { reload: Date.now() })}">Tải lại</a>
    </div>
    <div class="chips">
      ${[['pending', 'Chờ duyệt'], ['approved', 'Đã đăng'], ['hidden', 'Đã ẩn'], ['', 'Tất cả']].map(([k, v]) =>
        `<a class="chip ${tt === k ? 'on' : ''}" href="${hrefWith('danh-gia', params, { tt: k })}">${v} <small>${k ? all.filter((r) => r.status === k).length : all.length}</small></a>`).join('')}
      <a class="chip ${params.sao ? 'on' : ''}" href="${hrefWith('danh-gia', params, { sao: params.sao ? '' : '2' })}">Chỉ 1–2 sao</a>
    </div>
    <form class="toolbar-row" id="rf">
      <label class="grow"><span class="sr-only">Tìm đánh giá</span><input name="q" type="search" placeholder="Sản phẩm, tên khách, nội dung…" value="${esc(params.q || '')}"></label>
      <button class="btn small" type="submit">Tìm</button>
    </form>
    <p class="hint">${num.format(list.length)} đánh giá</p>
    ${list.length ? `<ul class="rv-admin">${list.map((r) => `
      <li class="card" data-id="${esc(r.id)}">
        <div class="sec-head">
          <div><a href="../#/sp/${esc(r.productId)}" target="_blank" rel="noopener">${esc(r.productName)}</a>
            <div class="sub">${esc(r.userName)} · ${esc(fmtDateTime(r.updatedAt))}</div></div>
          <span class="status ${CLS[r.status]}">${STATUS[r.status]}</span>
        </div>
        <p>${stars(r.rating)}</p>
        <p class="rv-text">${r.text ? esc(r.text) : '<span class="sub">(không có nhận xét)</span>'}</p>
        ${r.reply ? `<p class="rv-reply"><strong>Phản hồi:</strong> ${esc(r.reply)}</p>` : ''}
        <form class="reply-form" data-reply="${esc(r.id)}">
          <label class="sr-only" for="rp-${esc(r.id)}">Phản hồi</label>
          <textarea id="rp-${esc(r.id)}" name="reply" rows="2" maxlength="1000" placeholder="Phản hồi công khai của cửa hàng (không bắt buộc)">${esc(r.reply || '')}</textarea>
          <div class="head-actions">
            ${r.status !== 'approved' ? '<button type="submit" class="btn small primary" value="approved">Duyệt &amp; đăng</button>' : ''}
            ${r.status !== 'hidden' ? '<button type="submit" class="btn small danger" value="hidden">Ẩn</button>' : ''}
            <button type="submit" class="btn small" value="">Lưu phản hồi</button>
          </div>
        </form>
      </li>`).join('')}</ul>` : '<div class="empty">Không có đánh giá nào.</div>'}`;

  const f = box.querySelector('#rf');
  f.addEventListener('submit', (ev) => { ev.preventDefault(); location.hash = hrefWith('danh-gia', params, { q: f.q.value.trim() }); });
  box.querySelectorAll('[data-reply]').forEach((form) => form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const r = all.find((x) => x.id === form.dataset.reply);
    const status = ev.submitter?.value || r.status;
    const reply = form.reply.value.trim();
    busy(ev.submitter, async () => {
      try {
        const patch = { status, moderatedBy: me.uid, moderatedAt: serverTimestamp() };
        if (reply !== (r.reply || '')) Object.assign(patch, { reply, replyBy: me.uid, replyByName: 'NEXORA', replyAt: serverTimestamp() });
        const batch = writeBatch(db);
        batch.update(doc(db, 'reviews', r.id), patch);
        audit(batch, status === 'approved' && r.status !== 'approved' ? 'review.approve' : status === 'hidden' && r.status !== 'hidden' ? 'review.hide' : 'review.reply',
          r.id, `${r.productName} · ${r.userName} · ${r.rating}★${reply ? ` · phản hồi: ${reply}` : ''}`);
        await batch.commit();
        patchCache('reviews', r.id, { ...patch, moderatedAt: Timestamp.now(), ...(patch.replyAt ? { replyAt: Timestamp.now() } : {}) });
        toast(status === 'approved' && r.status !== 'approved' ? 'Đã duyệt, đánh giá hiện trên trang sản phẩm.'
          : status === 'hidden' && r.status !== 'hidden' ? 'Đã ẩn đánh giá.' : 'Đã lưu phản hồi.');
        await render(box, { ...params, reload: '' });
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  }));
}
