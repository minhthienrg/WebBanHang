// Cài đặt & nhân sự.
//   Quản trị viên: cấp / gỡ quyền quản trị, quản lý tài khoản nhân viên CSKH (gán vai trò, gỡ, gửi email đặt lại
//   mật khẩu), hạn mức hoàn tiền của nhân viên, công cụ nạp dữ liệu.
//   Nhân viên CSKH: chỉ đổi mật khẩu của mình.
import {
  doc, getDoc, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  auth, db, me, load, loadAll, patchCache, audit, esc, money, toast, errMsg, busy, ask, fmtDateTime,
  isAdminRole, ROLE_NAMES
} from './core.js';

export async function render(box, params) {
  const hasPassword = auth.currentUser?.providerData.some((p) => p.providerId === 'password');
  const pwCard = `
    <section class="card">
      <h2>Đổi mật khẩu</h2>
      <p class="sub">${esc(me.email)} · ${esc(ROLE_NAMES[me.role])}</p>
      ${hasPassword ? `<form class="form" id="pw" novalidate>
        <input type="email" name="username" autocomplete="username" value="${esc(me.email)}" hidden>
        <label>Mật khẩu hiện tại <input name="cur" type="password" autocomplete="current-password" required></label>
        <label>Mật khẩu mới <small>(ít nhất 8 ký tự)</small><input name="n1" type="password" autocomplete="new-password" minlength="8" required></label>
        <label>Nhập lại mật khẩu mới <input name="n2" type="password" autocomplete="new-password" minlength="8" required></label>
        <button type="submit" class="btn primary">Đổi mật khẩu</button>
      </form>` : '<p class="hint">Tài khoản đăng nhập bằng Google — đổi mật khẩu trong tài khoản Google của bạn.</p>'}
    </section>`;

  if (!isAdminRole()) {
    box.innerHTML = `<div class="page-head"><div><p class="eyebrow">System</p><h1>Cài đặt</h1></div></div>
      <div class="two-col">${pwCard}
        <section class="card"><h2>Quyền của bạn</h2>
          <ul class="plain">
            <li>Xem và xử lý mọi đơn hàng theo đúng luồng trạng thái; hoàn tiền trong hạn mức được cấp.</li>
            <li>Yêu cầu hỗ trợ, bảo hành, duyệt đánh giá, ghi chú và ưu đãi riêng cho khách.</li>
            <li>Không xem giá vốn, không sửa giá sản phẩm, không xem báo cáo doanh thu, không quản lý nhân viên.</li>
          </ul>
          <p class="hint">Cần quyền cao hơn: dùng “Chuyển bộ phận → Quản trị viên” trong phiếu hỗ trợ.</p>
        </section></div>`;
    bindPassword(box);
    return;
  }

  if (params.reload) await Promise.all(['admins', 'users', 'staff'].map((n) => load(n, true)));
  const [admins, users, staff, tickets] = await loadAll('admins', 'users', 'staff', 'tickets');
  const sup = await getDoc(doc(db, 'settings', 'support')).catch(() => null);
  const refundLimit = sup?.exists() ? sup.data().refundLimit : 0;
  const userOf = new Map(users.map((u) => [u.id, u]));
  const taken = new Set([...admins.map((a) => a.id), ...staff.map((s) => s.id)]);
  const statsOf = (uid) => {
    const mine = tickets.filter((t) => t.assignee === uid);
    const rated = mine.filter((t) => t.rating);
    return { closed: mine.filter((t) => t.status === 'closed').length, open: mine.filter((t) => t.status !== 'closed').length,
      csat: rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1).replace('.', ',') : '—' };
  };

  box.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">System</p><h1>Cài đặt &amp; nhân sự</h1></div></div>

    <section class="card block-gap">
      <h2>Nhân viên chăm sóc khách hàng (${staff.length})</h2>
      <p class="hint">Vai trò CSKH dùng chung trang quản lý nhưng chỉ thấy: Tổng quan CSKH, yêu cầu hỗ trợ, đơn hàng, khách hàng,
        bảo hành, đánh giá, tra cứu. Không xem giá vốn / báo cáo doanh thu, không sửa giá, không quản lý nhân viên (Bảng 1.3).</p>
      ${staff.length ? `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Cấp lúc</th><th class="r">Phiếu đang mở</th><th class="r">Đã đóng</th><th class="r">Hài lòng</th><th></th></tr></thead>
        <tbody>${staff.map((s) => { const st = statsOf(s.id); const u = userOf.get(s.id); return `<tr>
          <td>${esc(u?.name || '')}<div class="sub">${esc(s.email || u?.email || s.id)}</div></td>
          <td>${esc(ROLE_NAMES[s.role] || s.role)}</td>
          <td>${esc(fmtDateTime(s.addedAt))}</td>
          <td class="r">${st.open}</td><td class="r">${st.closed}</td><td class="r">${st.csat}</td>
          <td class="acts"><button type="button" class="btn small" data-reset="${esc(s.email || u?.email || '')}">Đặt lại mật khẩu</button>
            <button type="button" class="btn small danger" data-rm-staff="${esc(s.id)}">Gỡ vai trò</button></td></tr>`; }).join('')}</tbody>
      </table></div>` : '<p class="hint">Chưa có nhân viên CSKH.</p>'}
      <form class="toolbar-row mt" id="sfm">
        <label class="grow">Gán vai trò CSKH cho tài khoản (email đã đăng ký trên cửa hàng)
          <input name="email" type="email" required placeholder="nhanvien@vidu.com" list="dl-free"></label>
        <datalist id="dl-free">${users.filter((u) => !taken.has(u.id)).map((u) => `<option value="${esc(u.email)}">`).join('')}</datalist>
        <button type="submit" class="btn small primary">Gán vai trò CSKH</button>
      </form>
      <p class="hint">Tạo tài khoản mới cho nhân viên: nhân viên tự đăng ký ở cửa hàng, sau đó gán vai trò ở đây. Khóa đăng nhập hẳn: Firebase Console → Authentication → Disable account.</p>
    </section>

    <div class="two-col">
      <section class="card">
        <h2>Hạn mức hoàn tiền của nhân viên</h2>
        <form class="form" id="rl">
          <label>Tối đa mỗi lần hoàn (₫) <small>0 = nhân viên không được hoàn tiền</small>
            <input name="limit" type="number" min="0" step="10000" inputmode="numeric" value="${refundLimit}"></label>
          <p class="hint">Hiện tại: ${refundLimit ? money(refundLimit) : 'chưa cấp'}. Quản trị viên hoàn không giới hạn (không vượt tổng tiền đơn).</p>
          <button type="submit" class="btn primary">Lưu hạn mức</button>
        </form>
      </section>
      ${pwCard}
    </div>

    <section class="card block-gap">
      <h2>Quản trị viên (${admins.length})</h2>
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
        <label class="grow">Cấp quyền quản trị cho tài khoản (email đã đăng ký)
          <input name="email" type="email" required placeholder="email@vidu.com" list="dl-users"></label>
        <datalist id="dl-users">${users.filter((u) => !admins.some((a) => a.id === u.id)).map((u) => `<option value="${esc(u.email)}">`).join('')}</datalist>
        <button type="submit" class="btn small primary">Cấp quyền</button>
      </form>
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
        <li>Vai trò kho, kỹ thuật viên, lập trình viên và phân quyền theo từng trường dữ liệu</li>
        <li>Chatbot tự động; công cụ Build PC cho khách (CSKH đã có công cụ kiểm tra tương thích)</li>
      </ul>
    </section>`;

  const findUser = (email) => users.find((x) => (x.email || '').toLowerCase() === email.trim().toLowerCase());

  const sfm = box.querySelector('#sfm');
  sfm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const u = findUser(sfm.email.value);
    if (!u) return toast('Không tìm thấy tài khoản với email này. Nhân viên cần đăng ký trên cửa hàng trước.', 'err');
    if (taken.has(u.id)) return toast('Tài khoản này đã là quản trị viên hoặc nhân viên.', 'err');
    busy(sfm.querySelector('[type=submit]'), async () => {
      const ok = await ask('Gán vai trò CSKH', `Gán vai trò Chăm sóc khách hàng cho ${u.email}?`, { okText: 'Gán vai trò' });
      if (!ok) return;
      try {
        const data = { role: 'cskh', email: u.email, addedBy: me.uid, addedAt: serverTimestamp() };
        const batch = writeBatch(db);
        batch.set(doc(db, 'staff', u.id), data);
        audit(batch, 'staff.add', u.id, `${u.email} → CSKH`);
        await batch.commit();
        patchCache('staff', u.id, { ...data, addedAt: Timestamp.now() });
        toast(`Đã gán vai trò CSKH cho ${u.email}.`);
        await render(box, {});
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });

  const rl = box.querySelector('#rl');
  rl.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const limit = Number(rl.limit.value || 0);
    if (!Number.isInteger(limit) || limit < 0) return toast('Hạn mức phải là số nguyên ≥ 0.', 'err');
    busy(rl.querySelector('[type=submit]'), async () => {
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'settings', 'support'), { refundLimit: limit, updatedBy: me.uid, updatedAt: serverTimestamp() });
        audit(batch, 'settings.support', 'support', `Hạn mức hoàn tiền nhân viên: ${refundLimit} → ${limit}`);
        await batch.commit();
        toast(`Đã lưu hạn mức ${money(limit)}.`);
        await render(box, {});
      } catch (e) { toast(errMsg(e), 'err'); }
    });
  });

  const af = box.querySelector('#af');
  af.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const u = findUser(af.email.value);
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
    const rs = ev.target.closest('[data-reset]');
    if (rs) {
      return busy(rs, async () => {
        try { await sendPasswordResetEmail(auth, rs.dataset.reset); toast(`Đã gửi email đặt lại mật khẩu tới ${rs.dataset.reset}.`); }
        catch (e) { toast(errMsg(e), 'err'); }
      });
    }
    const rmStaff = ev.target.closest('[data-rm-staff]');
    if (rmStaff) {
      const s = staff.find((x) => x.id === rmStaff.dataset.rmStaff);
      const ok = await ask('Gỡ vai trò CSKH', `Gỡ vai trò CSKH của ${s.email}? Tài khoản trở lại là khách thường.`, { okText: 'Gỡ vai trò', danger: true });
      if (!ok) return;
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'staff', s.id));
        audit(batch, 'staff.remove', s.id, s.email);
        await batch.commit();
        patchCache('staff', s.id, null);
        toast(`Đã gỡ vai trò của ${s.email}.`);
        await render(box, {});
      } catch (e) { toast(errMsg(e), 'err'); }
      return;
    }
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

  bindPassword(box);
}

function bindPassword(box) {
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
