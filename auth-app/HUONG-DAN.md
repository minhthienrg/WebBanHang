# Hướng dẫn: cửa hàng NEXORA (Firebase + Google Sites)

## Tính năng

| Trang | Đường dẫn | Ghi chú |
|---|---|---|
| Danh sách sản phẩm | `#/` | Ô tìm kiếm trên header (không dấu, theo mã model). Chip danh mục, lọc theo danh mục, giá (khoảng có sẵn hoặc tự nhập), **hãng và thông số riêng từng danh mục** (sửa trong `js/categories.js` → `SPEC_FILTERS`), còn hàng, 5 kiểu sắp xếp, 12 sản phẩm/trang. Bộ lọc nằm trên URL nên chia sẻ link được |
| Chi tiết | `#/sp/{id}` | Giá, thông số chính, tồn kho, ô chính sách, bảng thông số, sản phẩm tương tự; thanh mua dính đáy trên điện thoại |
| Giỏ hàng | `#/gio-hang` | Lưu ở Firestore theo tài khoản, đồng bộ giữa các thiết bị; tăng/giảm/xóa; báo khi vượt tồn kho |
| Thanh toán | `#/thanh-toan` | 1 trang; tự điền từ hồ sơ; COD hoặc chuyển khoản; **mã giảm giá**; miễn phí giao từ 5.000.000₫ (dưới mức đó 30.000₫) |
| Đặt hàng xong | `#/dat-hang-thanh-cong/{id}` | Mã đơn, tóm tắt |
| Tài khoản | `#/tai-khoan` | Hồ sơ + danh sách đơn; hủy đơn khi còn "Chờ xác nhận" |
| Đăng nhập | `#/dang-nhap`, `#/quen-mat-khau` | Email/mật khẩu, Google, quên mật khẩu |
| Hỗ trợ khách hàng | `#/ho-tro`, `#/ho-tro/moi?loai=&don=`, `#/ho-tro/{id}` | Gửi yêu cầu (hỏi đáp, khiếu nại, hủy đơn, đổi trả, bảo hành…), **chat realtime** với nhân viên, khảo sát hài lòng khi phiếu đóng. Đơn trong tài khoản có nút "Yêu cầu hủy / đổi trả / bảo hành" |
| Đánh giá sản phẩm | trong `#/sp/{id}` | Khách đã đăng nhập viết đánh giá 1–5 sao; hiện công khai sau khi nhân viên duyệt, kèm phản hồi của cửa hàng |
| **Trang quản trị / CSKH** | `/admin/` | Quản trị viên và nhân viên CSKH. Đăng nhập ở cửa hàng sẽ được **chuyển thẳng** tới đây; menu theo vai trò |
| Nạp dữ liệu mẫu | `/admin/seed.html` | Chỉ quản trị viên |

### Trang quản trị (`/admin/`) — theo Bảng 1.1 của WebIdea.pdf

| Mục | Đường dẫn | Chức năng |
|---|---|---|
| Dashboard | `#/` | Doanh thu hôm nay / tháng, đơn chờ xác nhận (cảnh báo đơn chờ > 24 giờ), đơn đang xử lý, sản phẩm sắp hết, số khách; biểu đồ 30 ngày; đơn mới nhất |
| Báo cáo doanh thu | `#/bao-cao` | Theo ngày trong tháng / theo tháng trong năm, sản phẩm bán chạy, theo danh mục, tải CSV |
| Sản phẩm | `#/san-pham` | Thêm, sửa (ảnh, mô tả, thông số kỹ thuật, bảo hành, tồn tối thiểu), ẩn/hiện, xóa mềm/khôi phục, **đổi giá hàng loạt**, **lịch sử giá** |
| Kho hàng | `#/kho` | Phiếu nhập (giá vốn, nhà cung cấp), xuất, hủy hàng lỗi; cảnh báo tồn thấp; lịch sử phiếu kho |
| Đơn hàng | `#/don-hang` | Xem mọi đơn, lọc trạng thái / ngày, tìm theo mã, SĐT, email; đổi trạng thái. **Xác nhận đơn thì tự trừ kho, hủy thì tự hoàn kho** |
| Khách hàng | `#/khach-hang` | Danh sách, lịch sử mua, **khóa / mở khóa** (xử lý vi phạm), gửi email đặt lại mật khẩu |
| Mã giảm giá | `#/khuyen-mai` | Giảm % (có mức trần) hoặc số tiền, đơn tối thiểu, thời gian áp dụng, bật/tắt, thống kê lượt dùng |
| Nhật ký hoạt động | `#/nhat-ky` | Ai làm gì, lúc nào — không sửa/xóa được |
| Cài đặt | `#/cai-dat` | Cấp / gỡ quyền quản trị viên, đổi mật khẩu |

Đơn hàng, danh sách khách và yêu cầu hỗ trợ cập nhật realtime (không cần tải lại trang).

### Vai trò Chăm sóc khách hàng (CSKH) — theo Bảng 1.2 và 1.3 của WebIdea.pdf

Admin gán vai trò ở **Cài đặt & nhân sự** (nhân viên tự đăng ký ở cửa hàng trước). Nhân viên dùng chung `/admin/`
nhưng chỉ thấy các mục dưới đây; Security Rules chặn ở máy chủ những việc ngoài quyền.

| Mục | Đường dẫn | Chức năng |
|---|---|---|
| Tổng quan CSKH | `#/cskh` | Yêu cầu chờ / chưa ai nhận, **cảnh báo** đơn chờ xác nhận > 24 giờ, đơn giao thất bại, yêu cầu chờ lâu; đánh giá chờ duyệt; bảo hành đang xử lý; mức hài lòng 30 ngày |
| Yêu cầu hỗ trợ | `#/ho-tro`, `#/ho-tro/{id}` | Hàng đợi (của tôi, chưa nhận, chờ khách, đã chuyển…), chat realtime, **mẫu trả lời nhanh** ({ten}, {ma_don}), nhận phiếu, **chuyển bộ phận / quản trị viên**, đóng phiếu (khách tự nhận khảo sát hài lòng), tạo phiếu hộ khi khách gọi **hotline** / gửi email |
| Đơn hàng | `#/don-hang` | Tra cứu theo mã / SĐT / email; đổi trạng thái **chỉ theo luồng** Chờ xác nhận → Đã xác nhận → Đang chuẩn bị → Đang giao → Hoàn tất / **Giao thất bại**; hủy (tự hoàn kho); **hoàn tiền trong hạn mức** admin cấp |
| Khách hàng & thành viên | `#/khach-hang` | Hồ sơ, lịch sử mua, **hạng thành viên** (Thành viên / S-Member ≥ 10tr / VIP ≥ 30tr), điểm (1 điểm / 10.000₫ + điểm cộng tay), **ghi chú nội bộ / cuộc gọi / email** (chỉ nhân viên thấy), **ưu đãi riêng** (mã chỉ khách đó dùng được) |
| Bảo hành | `#/bao-hanh` | Tra cứu theo serial / SĐT / email kèm **hạn bảo hành**, tạo phiếu từ đơn đã mua, cập nhật tiến độ gửi trung tâm bảo hành (khách xem ở trang tài khoản) |
| Đánh giá sản phẩm | `#/danh-gia` | Duyệt, ẩn, phản hồi công khai |
| Tra cứu & tương thích | `#/tra-cuu` | Xem nhanh thông số (không có giá vốn); **kiểm tra tương thích** theo Bảng 4.2 (socket, DDR, kích thước, công suất nguồn, chiều cao tản, chiều dài VGA), sao chép kết quả gửi khách |

**Giới hạn quyền của CSKH (Bảng 1.3):** không xem giá vốn / phiếu kho / lịch sử giá / báo cáo doanh thu / nhật ký,
không sửa giá sản phẩm, không khóa tài khoản, không quản lý nhân viên, không tạo mã giảm giá chung. Ưu đãi riêng
tối đa 15% (trần 500.000₫) hoặc 300.000₫, hiệu lực ≤ 31 ngày. Hoàn tiền ≤ hạn mức mỗi lần (admin đặt ở Cài đặt; mặc định chưa cấp).

**Chưa làm** (cần thêm dịch vụ hoặc thuộc phần sau của đồ án): xác thực hai lớp (cần Identity Platform),
vai trò kho / kỹ thuật viên / lập trình viên, chatbot tự động, công cụ Build PC cho khách và cấu hình PC mẫu.

Khách chưa đăng nhập vẫn xem được sản phẩm. Khi bấm "Thêm vào giỏ", app chuyển sang đăng nhập; đăng nhập xong sẽ tự thêm sản phẩm đó và quay lại trang cũ.

## Cấu trúc

```
auth-app/
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── firebase-config.js  cấu hình Firebase
│   │   ├── firebase.js         khởi tạo; tự dùng emulator khi chạy ở localhost
│   │   ├── app.js              điều hướng (#/...), nút thêm giỏ, bộ lọc
│   │   ├── catalog.js          danh sách, lọc, sắp xếp, phân trang, chi tiết
│   │   ├── cart.js             giỏ hàng, thanh toán, đặt hàng
│   │   ├── account.js          đăng nhập/đăng ký, hồ sơ, đơn hàng của tôi
│   │   ├── categories.js       danh mục, khoảng giá, phí giao, giới hạn đơn, hạng thành viên, nhãn CSKH
│   │   ├── compat.js           kiểm tra tương thích linh kiện (Bảng 4.2)
│   │   ├── support.js          hỗ trợ khách hàng (chat), thành viên / ưu đãi / bảo hành trong tài khoản
│   │   ├── reviews.js          đánh giá sản phẩm (trang chi tiết)
│   │   └── ui.js               tiện ích chung
│   └── admin/
│       ├── index.html          trang quản trị
│       ├── admin.css
│       ├── js/                 main.js (kiểm tra quyền, điều hướng), core.js (dữ liệu, nhật ký, biểu đồ),
│       │                       dashboard, reports, products, inventory, orders, customers, vouchers, logs, settings,
│       │                       cskh, tickets, warranties, reviews, lookup (vai trò CSKH)
│       ├── seed.html           trang nạp sản phẩm mẫu
│       └── seed-data.js        23 sản phẩm mẫu (8 danh mục)
├── firestore.rules
├── firebase.json
└── .firebaserc
```

## Dữ liệu Firestore

| Collection | ID | Trường | Ai đọc / ghi |
|---|---|---|---|
| `products` | slug, ví dụ `cpu-intel-i5-14400f` | `name, category, brand, price, oldPrice, stock, active, sold, summary, specs{}, description, imageUrl, createdAt`; trang quản trị thêm `minStock, warrantyMonths, warrantyProvider, deleted, updatedAt` | Ai cũng đọc được sản phẩm `active == true`; chỉ quản trị viên ghi |
| `carts` | `uid` | `items { productId: qty }, updatedAt` | Chủ giỏ |
| `orders` | tự sinh | `userId, items[{productId,name,price,qty}], subtotal, shippingFee, voucher, discount, total, shipping{name,phone,address}, paymentMethod, note, status, createdAt, updatedAt`; admin thêm `stockDeducted, statusHistory[], doneAt` | Khách tạo và xem đơn của mình, hủy khi `pending`; quản trị viên xem và sửa tất cả |
| `users` | `uid` | `name, phone, address, email, createdAt, updatedAt` | Chủ hồ sơ; quản trị viên được đọc |
| `admins` | `uid` | `email, addedBy, addedAt` (admin đầu tiên: rỗng) | Admin đầu tiên tạo tay trong Console; sau đó admin cấp/gỡ ở trang Cài đặt (không tự gỡ mình) |
| `bans` | `uid` | `reason, by, at` | Admin; khách đọc được của mình. Bị khóa thì không sửa giỏ, không đặt hàng |
| `vouchers` | mã, ví dụ `SALE11` | `code, type ('percent'/'fixed'), value, minOrder, maxDiscount, startAt, endAt, active, description` | Khách đọc 1 mã khi gõ đúng (không liệt kê được); admin ghi |
| `stockMoves` | tự sinh | `productId, name, type (in/out/damaged/order/order-return), qty, unitCost, supplier, note, stockAfter, orderId, by, byEmail, at` | Chỉ admin (có giá vốn) |
| `priceHistory` | tự sinh | `productId, name, fromPrice, toPrice, fromOldPrice, toOldPrice, note, by, byEmail, at` | Chỉ admin |
| `auditLogs` | tự sinh | `action, target, detail, by, byEmail, at` | Admin đọc; admin + CSKH ghi; chỉ thêm, không sửa/xóa |
| `staff` | `uid` | `role ('cskh'), email, addedBy, addedAt` | Admin cấp / gỡ |
| `settings` | `support` | `refundLimit` | Admin ghi; nhân viên đọc |
| `tickets` (+ `messages`) | tự sinh | `userId, userEmail, userName, subject, category, orderId, channel, status (open/waiting/closed), dept, assignee, …, rating, ratingComment` | Khách tạo & chat trong phiếu của mình, chấm điểm 1 lần khi đóng; nhân viên xử lý mọi phiếu |
| `customerNotes` | tự sinh | `userId, type (note/call/email/offer), text, by, byEmail, at` | Chỉ nhân viên; không sửa/xóa |
| `members` | `uid` | `bonusPoints, tier, note, by, at` | Khách đọc của mình; nhân viên ghi |
| `reviews` | `{productId}_{uid}` | `productId, productName, userId, userName, rating, text, status (pending/approved/hidden), reply…` | Ai cũng đọc bài đã duyệt; khách viết/sửa của mình (phải duyệt lại); nhân viên duyệt / phản hồi |
| `warranties` | tự sinh | `userId, customerName, phone, email, orderId, productId, productName, serial, issue, center, status, history[]` | Nhân viên tạo / cập nhật; khách xem của mình |
| `refunds` | tự sinh | `orderId, userId, amount, reason, method, by, byEmail, at` | Nhân viên ≤ hạn mức / lần, admin ≤ tổng đơn; khách xem của mình |
| `replyTemplates` | tự sinh | `title, text, by, at` | Nhân viên |

`category` nhận một trong các giá trị: `cpu, mainboard, ram, vga, o-cung, nguon, case, tan-nhiet` (khai báo trong `js/categories.js`).
Giá là **số nguyên, đơn vị đồng**. `oldPrice = 0` nghĩa là không giảm giá.

### Security Rules chặn được gì khi đặt hàng

Khách chỉnh code trên trình duyệt cũng **không** làm được các việc sau:
- Sửa giá (giá từng dòng phải bằng giá sản phẩm trong CSDL).
- Sai tổng tiền, phí giao hoặc số tiền giảm của mã giảm giá (rules tự tính lại từ mã trong CSDL).
- Đặt vượt tồn kho, đặt sản phẩm đã ẩn, số lượng ngoài khoảng 1–10 hoặc không phải số nguyên.
- Đặt hộ người khác, tự đặt trạng thái khác `pending`, sửa đơn sau khi đặt (chỉ được hủy).

Rules đã chạy trên Firestore emulator với 163 ca kiểm thử (gồm quyền CSKH, hoàn tiền, phiếu hỗ trợ, đánh giá, ưu đãi riêng). Tất cả đều đạt.

### Giới hạn hiện tại (cần biết)

- **Tồn kho trừ khi quản trị viên xác nhận đơn**, không trừ lúc khách đặt (lúc đặt rules chỉ kiểm tra `qty ≤ stock`). Hủy đơn đã xác nhận thì tự hoàn kho.
- **Tối đa 8 loại sản phẩm mỗi đơn, mỗi loại tối đa 10 chiếc.** Lý do: mỗi lệnh ghi chỉ được đọc tối đa 10 tài liệu khác (8 sản phẩm + mã giảm giá + kiểm tra khóa tài khoản) và tối đa 1000 biểu thức. Cũng vì giới hạn này, `name` trong đơn **không được rules kiểm tra** (chỉ để hiển thị); khi xử lý đơn, hãy đối chiếu theo `productId`.
- **Khóa tài khoản chỉ chặn đặt hàng / giỏ hàng**, khách vẫn đăng nhập được. Muốn chặn đăng nhập: Console → Authentication → Disable account.
- **Danh sách tải toàn bộ sản phẩm đang bán một lần** rồi lọc ở trình duyệt. Cách này phù hợp với vài trăm sản phẩm. Nếu lên hàng nghìn, cần chuyển sang truy vấn có phân trang ở phía Firestore.
- Sản phẩm chưa có ảnh nên hiện khung chữ theo danh mục. Điền `imageUrl` (ảnh bạn có quyền dùng) để thay.

---

## Lần đầu deploy

> Nếu bạn đã làm bước 1–3 ở lần trước thì bỏ qua, đi thẳng tới bước 4.

### Bước 1 — Bật đăng nhập
<https://console.firebase.google.com/project/mindmap-4ad79/authentication>
1. **Sign-in method**: bật **Email/Password** và **Google** (chọn support email).
2. **Settings → Authorized domains**: thêm `da1gb.web.app` nếu chưa có.
3. *(Tùy chọn)* **Templates**: đổi ngôn ngữ email sang *Vietnamese*.

### Bước 2 — Khai báo domain với Google OAuth
<https://console.cloud.google.com/apis/credentials?project=mindmap-4ad79> → **Web client (auto created by Google Service)**:
- Authorized JavaScript origins: `https://da1gb.web.app`
- Authorized redirect URIs: `https://da1gb.web.app/__/auth/handler`

### Bước 3 — Tạo Firestore
<https://console.firebase.google.com/project/mindmap-4ad79/firestore> → **Create database** → Standard → **asia-southeast1** → **production mode**.

### Bước 4 — Deploy
```bash
cd ~/Project/WebBanHang/auth-app
firebase deploy --only hosting,firestore:rules
```
Lệnh `hosting` chỉ ghi vào site `da1gb`, không ảnh hưởng app "My mind map". Lệnh `firestore:rules` thay toàn bộ rules của project; nếu app mind map sau này dùng Firestore, phải gộp rules lại.

### Bước 5 — Tự cấp quyền quản trị cho mình
1. Mở <https://da1gb.web.app>, đăng ký hoặc đăng nhập bằng tài khoản của bạn.
2. Console → **Authentication → Users** → copy **User UID** của bạn.
3. Console → **Firestore → Data → Start collection** → Collection ID: `admins` → Document ID: *dán UID* → bấm **Save**. Có thể để trống trường; nếu Console bắt buộc thì thêm trường `role` = `admin`.

### Bước 6 — Nạp sản phẩm mẫu
Mở **trực tiếp** (không qua Google Sites) <https://da1gb.web.app/admin/seed.html>. Trang sẽ báo "là quản trị viên"; bấm **Nạp / cập nhật 254 linh kiện NEXORA** (hoặc nút 23 sản phẩm mẫu). Bấm lại thì sản phẩm cùng ID sẽ bị ghi đè.

Sau này thêm hoặc sửa sản phẩm: Console → Firestore → `products`. Để ẩn sản phẩm, đặt `active = false`.

### Bước 7 — Thử luồng mua hàng
Danh sách → lọc → chi tiết → Thêm vào giỏ → đăng nhập → giỏ hàng → thanh toán → đặt hàng → Tài khoản (thấy đơn) → Hủy đơn.
Kiểm tra trong Console: `orders` có đơn mới, `carts/{uid}` có `items` rỗng.

### Bước 8 — Nhúng vào Google Sites
Google Sites chỉ nhúng được URL **https** và trang đích phải cho phép nhúng (app đã đặt `frame-ancestors` cho
`sites.google.com` trong `firebase.json`).

**Cách A (nên dùng) — trang nhúng toàn màn hình:** **Trang → Trang mới → Nhúng toàn trang** (*Full page embed*)
→ dán URL app. App chiếm cả trang nên không phải chỉnh chiều cao khung.

**Cách B — khung trong một trang có nội dung khác:**
1. Chế độ chỉnh sửa → **Chèn → Nhúng → Nhúng theo URL** → `https://da1gb.web.app` → **Toàn bộ trang** → **Chèn**.
2. Kéo khung rộng hết cột, cao khoảng **900–1200px**. Đây là cửa hàng nên cần khung cao hơn bản chỉ có đăng nhập. Google Sites không tự giãn chiều cao, phần thừa sẽ cuộn bên trong khung.
3. **Xem trước** ở chế độ điện thoại và máy tính → **Xuất bản**.

Có thể nhúng thẳng một trang con, ví dụ danh mục VGA: `https://da1gb.web.app/#/?cat=vga`.

## Kiểm thử tự động

```bash
cd auth-app/tests && npm install && ./run.sh   # rules + E2E (máy tính + điện thoại) + accessibility/tốc độ
```
Chi tiết và yêu cầu (Java, Chromium) xem `docs/TIEN-DO.md` mục "Cách test".

## Chạy thử trên máy (không đụng dữ liệu thật)

Khi mở ở `localhost` / `127.0.0.1`, app tự dùng Auth và Firestore **giả lập**, với project `demo-webbanhang`
(project `demo-*` không bao giờ gọi dịch vụ thật). Cần cài Java 11 trở lên.
```bash
cd ~/Project/WebBanHang/auth-app
firebase emulators:start --project demo-webbanhang
```
- App: <http://127.0.0.1:5000>. Giao diện emulator để xem và sửa dữ liệu: <http://127.0.0.1:4000>.
- Dữ liệu giả lập mất khi tắt emulator. Để nạp mẫu: đăng ký 1 tài khoản → trong Emulator UI tạo `admins/{uid}` → mở `http://127.0.0.1:5000/admin/seed.html`.
- Đăng nhập Google trên emulator hiện một màn tài khoản giả. Đây là hành vi bình thường.

## Giới hạn khi chạy trong iframe

- Safari, và Chrome khi chặn cookie bên thứ ba, sẽ tách riêng phiên đăng nhập của khung nhúng. Một số trình duyệt bắt đăng nhập lại sau khi tải lại trang.
- Nếu pop-up Google bị chặn, app hiện link **"Mở trong tab mới"**.
- Link trong email xác minh/đặt lại mật khẩu mở trang của Firebase, không mở trong Google Sites.

## Cập nhật

- Sửa giao diện hoặc code: `firebase deploy --only hosting`.
- Sửa rules: `firebase deploy --only firestore:rules`. Nếu đổi phí giao hoặc giới hạn đơn, phải sửa **cả** `js/categories.js` **và** `firestore.rules`.

## Dùng project `webbanhang-431c7` thay vì `mindmap-4ad79`

1. Project `webbanhang-431c7` → **Project settings → Add app (Web)** (tích *Firebase Hosting*) → copy cấu hình vào `public/js/firebase-config.js`, đặt `authDomain` = `webbanhang-431c7.web.app`.
2. `.firebaserc` → `default: webbanhang-431c7`; `firebase.json` → `"site": "webbanhang-431c7"`.
3. Làm lại các bước 1–8 với domain `webbanhang-431c7.web.app`.
