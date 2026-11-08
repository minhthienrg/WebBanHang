# Tiến độ

> Đầu mỗi phiên: đọc file này trước, làm tiếp từ việc chưa đánh dấu.
> Chạy test: `cd auth-app/tests && ./run.sh` (xem mục "Cách test").

## Danh sách việc

### Bước 1–2: Tài liệu
- [x] Đọc `AdminSource/WebIdea.pdf` → `docs/yeu-cau.md`
- [x] Khảo sát Phong Vũ, CellphoneS, GearVN (chỉ bố cục/UX) → `docs/phuong-an.md`

### Bước 3: Đăng nhập / đăng ký / hồ sơ
- [x] Đăng ký, đăng nhập email/mật khẩu, đăng nhập Google, quên mật khẩu
- [x] Hồ sơ người dùng (`users/{uid}`): họ tên, SĐT, địa chỉ
- [x] Tự dùng Auth/Firestore Emulator khi chạy ở localhost
- [x] Test Playwright trong repo (máy tính 1280px + điện thoại 390px): đăng ký, sai mật khẩu, đăng xuất, đăng nhập lại

### Bước 4: Sản phẩm, bộ lọc, chi tiết, giỏ hàng, đặt hàng
- [x] Danh sách + lọc danh mục, giá, còn hàng + sắp xếp + phân trang
- [x] Chi tiết sản phẩm, sản phẩm tương tự, thanh mua dính đáy trên mobile
- [x] Giỏ hàng (Firestore), thanh toán 1 trang, đặt hàng, hủy đơn
- [x] Security Rules chặn sửa giá/tổng tiền/vượt tồn kho
- [x] Lọc theo hãng và thông số riêng từng danh mục (cấu hình `SPEC_FILTERS` trong `js/categories.js`); chọn nhiều, có số đếm
- [x] Tìm kiếm trên header: không dấu, theo mã model, theo tên danh mục
- [x] Test Playwright (lọc, chi tiết, thêm giỏ, giỏ, thanh toán, hủy đơn) + 43 test rules — tất cả đạt

### Bước 5: Tối ưu
- [x] Tốc độ tải: `modulepreload` cho mọi module (trước đây tải tuần tự theo chuỗi import), tải sản phẩm
      song song với khôi phục đăng nhập, trang công khai (danh sách, chi tiết) hiện ngay không chờ Auth.
      Đo trên emulator: sản phẩm đầu tiên ~1,9 s lần đầu (gần hết là tải Firebase SDK ~245 KB nén từ
      gstatic), **75–135 ms khi mở lại** (SDK được cache 1 năm).
- [x] Accessibility: `tests/audit.mjs` chạy axe-core (WCAG 2.2 AA + best practice) trên 5 màn hình × sáng/tối ×
      máy tính/điện thoại → **0 lỗi** (ban đầu: lỗi tương phản màu, thiếu `main`, thứ tự heading, trang đăng nhập
      thiếu h1, link chỉ phân biệt bằng màu). Thêm: link "Bỏ qua tới nội dung chính", viền focus rõ, chuyển
      focus tới tiêu đề khi sang trang, tab Đăng nhập/Đăng ký theo mẫu ARIA (phím mũi tên), nhãn đầy đủ cho
      nút trong giỏ, số kết quả lọc được đọc tự động (`role=status`).
- [x] Điện thoại: header 1 hàng + ô tìm kiếm, chữ ô nhập 16px (iOS không tự phóng to), thông báo không bị
      header che, ảnh chi tiết thấp hơn để giá và nút mua hiện sớm.
- [x] Đối chiếu tài liệu: Firebase *redirect best practices* (app đã dùng popup + `authDomain` = domain Hosting,
      đúng khuyến nghị), Firebase Hosting cache (giữ `no-cache` cho js/css vì tên file không có mã băm),
      Firestore offline cache (KHÔNG bật — xem "Cần tôi xác nhận"), Google Sites nhúng trang (chỉ https,
      trang đích phải cho phép nhúng, có kiểu "Full page embed" — đã ghi vào HUONG-DAN.md).

## Cách test
```bash
cd auth-app/tests
npm install                       # lần đầu
npx playwright install chromium   # lần đầu (hoặc đặt PLAYWRIGHT_BROWSERS_PATH)
./run.sh          # rules + E2E;  ./run.sh rules  /  ./run.sh e2e
```
- Emulator chạy với `--project demo-webbanhang`; app tự đổi sang project này khi mở ở localhost
  (`public/js/firebase.js`). Project `demo-*` không bao giờ gọi tới dịch vụ thật.
- Cần Java 11+. Máy hiện chưa cài; tạm dùng `JAVA_HOME` trỏ tới JRE 21 trong thư mục tạm (mất khi khởi động lại).
  Nên cài hẳn: `sudo apt install openjdk-21-jre-headless`.
- Ảnh chụp màn hình: `auth-app/tests/shots/` (không commit).

## Vấn đề gặp phải
- Thư mục chưa phải git repo khi bắt đầu phiên 09/11/2026 → đã `git init` (nhánh `main`), commit phần đã có.
- Test mobile: ngăn bộ lọc `<details>` giữ trạng thái mở giữa các lần đổi hash, nên test phải kiểm tra
  `open` trước khi bấm (nếu không sẽ tự đóng lại).
- Máy không cài Java; Firebase Emulator (Firestore) cần Java. Dùng JRE 21 tải về thư mục tạm của phiên trước.

- Trang trợ giúp Google Sites (support.google.com) chặn truy cập tự động (captcha), nên thông tin về Google
  Sites lấy từ blog Google Workspace Updates và hướng dẫn bên thứ ba. Nên tự kiểm tra lại menu trong Sites.
- Chưa giảm được thời gian tải lần đầu thêm nữa vì gần hết là Firebase SDK. Muốn nhanh hơn phải tách:
  dùng Firestore REST/Lite cho trang danh sách và chỉ tải SDK đầy đủ khi đăng nhập/giỏ hàng — thay đổi
  kiến trúc lớn, chưa làm.

## Cần tôi xác nhận
1. **Chưa push được**: repo không có remote, máy không có `gh` và SSH key. Khi có remote, chạy
   `git remote add origin <url> && git push -u origin main`.
2. **Cấu hình Firebase**: tin nhắn ghi `[dán firebaseConfig]` nhưng chưa dán nội dung. Tôi giữ cấu hình đang có
   trong `auth-app/public/js/firebase-config.js` (project `mindmap-4ad79`). `HUONG-DAN.md` có nhắc project
   `webbanhang-431c7`; nếu muốn dùng project đó, hãy gửi firebaseConfig của nó.
3. **Firestore offline cache (`persistentLocalCache`)**: giúp mở lại nhanh hơn, nhưng tài liệu Firebase lưu ý cache
   không tự xóa giữa các phiên (máy dùng chung sẽ còn lưu đơn hàng, hồ sơ), và trong iframe Google Sites IndexedDB
   có thể bị chặn. Phương án an toàn: **chưa bật**. Nếu muốn bật, chỉ nên bật cho sản phẩm.
4. **Ẩn link "Sản phẩm" trên điện thoại** (logo đã dẫn về trang chủ) để header gọn 1 hàng. Nếu muốn giữ, cần đổi
   sang thanh điều hướng đáy như `phuong-an.md` mục 3.10 (sẽ chồng với thanh mua ở trang chi tiết).
5. **Màu chủ đạo đổi nhẹ** `#1f6feb` → `#1a5fd0`, màu giảm giá `#d92d20` → `#c4271b` để đạt tương phản WCAG AA.
