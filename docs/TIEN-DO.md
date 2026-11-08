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
- [ ] Tốc độ tải
- [ ] Khả năng truy cập (accessibility)
- [ ] Hiển thị trên điện thoại
- [ ] Đối chiếu tài liệu chính thức Firebase và Google Sites

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

## Cần tôi xác nhận
1. **Chưa push được**: repo không có remote, máy không có `gh` và SSH key. Khi có remote, chạy
   `git remote add origin <url> && git push -u origin main`.
2. **Cấu hình Firebase**: tin nhắn ghi `[dán firebaseConfig]` nhưng chưa dán nội dung. Tôi giữ cấu hình đang có
   trong `auth-app/public/js/firebase-config.js` (project `mindmap-4ad79`). `HUONG-DAN.md` có nhắc project
   `webbanhang-431c7`; nếu muốn dùng project đó, hãy gửi firebaseConfig của nó.
