// Nhật ký hoạt động: ai làm gì, lúc nào. Chỉ thêm, không sửa/xóa được (Security Rules).
import { latest, esc, num, fold, fmtDateTime, ACTIONS, hrefWith, downloadCsv } from './core.js';

const LIMIT = 500;

export async function render(box, params) {
  const logs = await latest('auditLogs', LIMIT);
  const words = fold(params.q || '').split(/\s+/).filter(Boolean);
  const group = params.nhom || '';
  const list = logs.filter((l) => (!group || l.action.startsWith(`${group}.`))
    && (!words.length || words.every((w) => fold(`${l.byEmail} ${l.target} ${l.detail} ${ACTIONS[l.action] || l.action}`).includes(w))));
  const groups = [['', 'Tất cả'], ['product', 'Sản phẩm'], ['price', 'Giá'], ['stock', 'Kho'], ['order', 'Đơn hàng'],
    ['customer', 'Khách hàng'], ['voucher', 'Mã giảm giá'], ['admin', 'Quản trị viên']];

  box.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">System</p><h1>Nhật ký hoạt động</h1></div>
      <div class="head-actions">
        <button type="button" class="btn small" id="btn-csv">Tải CSV</button>
        <a class="btn small" href="${hrefWith('nhat-ky', params, { t: Date.now() })}">Tải lại</a>
      </div>
    </div>
    <div class="chips">${groups.map(([k, v]) => `<a class="chip ${group === k ? 'on' : ''}" href="${hrefWith('nhat-ky', params, { nhom: k })}">${v}</a>`).join('')}</div>
    <form class="toolbar-row" id="lf">
      <label class="grow"><span class="sr-only">Tìm trong nhật ký</span>
        <input name="q" type="search" placeholder="Email người thực hiện, mã sản phẩm, mã đơn…" value="${esc(params.q || '')}"></label>
      <button class="btn small" type="submit">Tìm</button>
    </form>
    <p class="hint" role="status">${num.format(list.length)} thao tác (trong ${LIMIT} thao tác gần nhất)</p>
    ${list.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
      <tbody>${list.map((l) => `<tr>
        <td class="nowrap">${esc(fmtDateTime(l.at))}</td>
        <td>${esc(l.byEmail)}</td>
        <td><span class="mv mv-${esc(l.action.split('.')[0])}">${esc(ACTIONS[l.action] || l.action)}</span></td>
        <td class="sub">${esc(l.target)}</td>
        <td class="detail-cell">${esc(l.detail)}</td></tr>`).join('')}</tbody>
    </table></div>` : '<div class="empty">Chưa có thao tác nào.</div>'}`;

  const f = box.querySelector('#lf');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    location.hash = hrefWith('nhat-ky', params, { q: f.q.value.trim() });
  });
  box.querySelector('#btn-csv').addEventListener('click', () => downloadCsv('nhat-ky.csv', [
    ['Thời gian', 'Người thực hiện', 'Thao tác', 'Đối tượng', 'Chi tiết'],
    ...list.map((l) => [fmtDateTime(l.at), l.byEmail, ACTIONS[l.action] || l.action, l.target, l.detail])
  ]));
}
