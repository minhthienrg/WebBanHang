// Cài đặt: danh sách quản trị viên (cấp / gỡ quyền), đổi mật khẩu, công cụ nạp dữ liệu.
import {
  doc, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  auth, db, me, load, loadAll, patchCache, audit, esc, toast, errMsg, busy, ask, fmtDateTime
} from './core.js';

export async function render(box, params) {
  if (params.reload) await Promise.all([load('admins', true), load('users', true)]);
  const [admins, users] = await loadAll('admins', 'users');
  const userOf = new Map(users.map((u) => [u.id, u]));
  const hasPassword = auth.currentUser?.providerData.some((p) => p.providerId === 'password');

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">System</p><h1>Cài đặt</h1></div>
    </div>

    <section class="card block-gap">
      <h2>Quản trị viên (${admins.length})</h2>
      <p class="hint">Quản trị viên có toàn quyền: sản phẩm, giá, giá vốn, kho, đơn hàng, khách hàng, mã giảm giá, báo cáo.</p>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Tài khoản</th><th>Cấp quyền lúc</th><th>Người cấp</th><th></th></tr></thead>
        <tbody>${admins.map((a) => {
          const u = userOf.get(a.id);
          const by = a.addedBy ? userOf.get(a.addedBy)?.email || a.addedBy : 'Firebase Console';
          return `<tr>
            <td>${esc(u?.name || '')}<div class="sub">${esc(a.email || u?.email || a.id)}</div></td>
            <td>${a.addedAt ? esc(fmtDateTime(a.addedAt)) : '—'}</td>
            <td class="sub">${esc(by)}</td>
            <td class="acts">${a.id === me.uid ? '<span class="sub">(bạn)</span>'
              : `<button type="button" class="btn small danger" data-rm="${esc(a.id)}">Gỡ quyền</button>`}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
      <form class="toolbar-row mt" id="af">
        <label class="grow">Cấp quyền cho tài khoản (email đã đăng ký)
          <input name="email" type="email" required placeholder="email@vidu.com" list="dl-users"></label>
        <datalist id="dl-users">${users.filter((u) => !admins.some((a) => a.id === u.id)).map((u) => `<option value="${esc(u.email)}">`).join('')}</datalist>
        <button type="submit" class="btn small primary">Cấp quyền</button>
      </form>
    </section>

    <div class="two-col">
      <section class="card">
        <h2>Đổi mật khẩu</h2>
        ${hasPassword ? `<form class="form" id="pw" novalidate>
          <input type="email" name="username" autocomplete="username" value="${esc(me.email)}" hidden>
          <label>Mật khẩu hiện tại <input name="cur" type="password" autocomplete="current-password" required></label>
          <label>Mật khẩu mới <small>(ít nhất 8 ký tự)</small><input name="n1" type="password" autocomplete="new-password" minlength="8" required></label>
          <label>Nhập lại mật khẩu mới <input name="n2" type="password" autocomplete="new-password" minlength="8" required></label>
          <button type="submit" class="btn primary">Đổi mật khẩu</button>
        </form>` : '<p class="hint">Tài khoản đăng nhập bằng Google — đổi mật khẩu trong tài khoản Google của bạn.</p>'}
      </section>
      <section class="card">
        <h2>Công cụ</h2>
        <ul class="plain">
          <li><a href="seed.html">Nạp / cập nhật dữ liệu linh kiện NEXORA</a> <span class="sub">(ghi đè sản phẩm cùng mã)</span></li>
          <li><a href="../" target="_blank" rel="noopener">Mở cửa hàng ở tab mới</a></li>
        </ul>
        <h2 class="mt2">Chưa có trong bản này</h2>
        <ul class="plain sub">
          <li>Xác thực hai lớp (cần nâng cấp Firebase Identity Platform)</li>
          <li>Tài khoản nhân viên theo vai trò (CSKH, kho, kỹ thuật viên) và phân quyền theo trường dữ liệu</li>
          <li>Quy tắc tương thích Build PC, cấu hình PC mẫu, tra cứu bảo hành theo serial</li>
        </ul>
      </section>
    </div>`;

  const af = box.querySelector('#af');
  af.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const email = af.email.value.trim().toLowerCase();
    const u = users.find((x) => (x.email || '').toLowerCase() === email);
    if (!u) return toast('Không tìm thấy tài khoản với email này. Người đó cần đăng ký trên cửa hàng trước.', 'err');
    if (admins.some((a) => a.id === u.id)) return toast('Tài khoản này đã là quản trị viên.', 'err');
    busy(af.querySelector('[type=submit]'), async () => {
      const ok = await ask('Cấp quyền quản trị', `Cấp toàn quyền quản trị cho ${u.email}?`, { okText: 'Cấp quyền' });
      if (!ok) return;
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'admins', u.id), { email: u.email, addedBy: me.uid, addedAt: serverTimestamp() });
        audit(batch, 'admin.add', u.id, u.email);
        await batch.commit();
        patchCache('admins', u.id, { email: u.email, addedBy: me.uid, addedAt: Timestamp.now() });
        toast(`Đã cấp quyền quản trị cho ${u.email}.`);
        await render(box, {});
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });

  box.onclick = async (ev) => {
    const rm = ev.target.closest('[data-rm]');
    if (!rm) return;
    const a = admins.find((x) => x.id === rm.dataset.rm);
    const email = a.email || userOf.get(a.id)?.email || a.id;
    const ok = await ask('Gỡ quyền quản trị', `Gỡ quyền quản trị của ${email}?`, { okText: 'Gỡ quyền', danger: true });
    if (!ok) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'admins', a.id));
      audit(batch, 'admin.remove', a.id, email);
      await batch.commit();
      patchCache('admins', a.id, null);
      toast(`Đã gỡ quyền của ${email}.`);
      await render(box, {});
    } catch (e) { toast(errMsg(e), 'err'); }
  };

  const pw = box.querySelector('#pw');
  pw?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (pw.n1.value.length < 8) return toast('Mật khẩu mới phải có ít nhất 8 ký tự.', 'err');
    if (pw.n1.value !== pw.n2.value) return toast('Hai mật khẩu mới không khớp.', 'err');
    busy(pw.querySelector('[type=submit]'), async () => {
      try {
        const user = auth.currentUser;
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw.cur.value));
        await updatePassword(user, pw.n1.value);
        pw.reset();
        toast('Đã đổi mật khẩu.');
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });
}
