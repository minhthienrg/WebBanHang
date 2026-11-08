# Tóm tắt yêu cầu — Website bán linh kiện PC & Laptop

> **Nguồn:** thư mục `AdminSource/` chỉ có 1 file: `WebIdea.pdf` (20 trang, "Đồ án 1 – Báo cáo khảo sát tính năng hệ thống", Nhóm B, lớp 26CTT2A, GVHD ThS. Tiết Gia Hồng, ngày tạo 29/10/2026).
> Trong PDF có 2 ảnh: logo trường (trang 1) và Hình 5.1 – sơ đồ kiến trúc web 3 lớp chung chung (Users → Frontend HTML/CSS/JS → Web Server + File System + Database). Không có ảnh mockup giao diện nào.
> Không có file txt, docx hay ảnh rời nào khác.

---

## 1. Mục tiêu và đối tượng khách hàng

### Mục tiêu
- Xây dựng **website bán lẻ linh kiện máy tính (PC, laptop) và thiết bị công nghệ** tại Việt Nam.
- Điểm khác biệt so với web bán hàng thông thường: các chức năng **đặc thù cho linh kiện**, quan trọng nhất là **Build PC có kiểm tra tương thích**, lọc theo thông số kỹ thuật chuyên sâu, so sánh linh kiện.
- Bối cảnh: đồ án môn học, **thời gian thực hiện 4 tuần**.
- Công nghệ đã chọn: **HTML5/CSS3/JavaScript + PHP + MySQL** (không framework), chạy bằng bộ công cụ máy chủ đóng gói sẵn; dữ liệu linh kiện lấy từ các file `.json` của dự án mã nguồn mở **Buildcores** (GitHub); dùng AI (ví dụ Gemini) hỗ trợ viết code và xử lý dữ liệu.
- Tham khảo 3 website: **Phong Vũ** (Build PC đầy đủ, voucher tự động), **GearVN** (giao diện hiện đại hướng game thủ, lọc chuyên sâu, Build PC có cảnh báo tương thích), **CellphoneS** (tìm kiếm nhanh, checkout 1 trang, thu cũ đổi mới, hệ thống thành viên).

### Người dùng hệ thống (3 nhóm)
| Nhóm | Mô tả |
|---|---|
| **Khách hàng** | Người dùng phổ thông, game thủ, doanh nghiệp, tổ chức giáo dục |
| **Quản trị viên** | Quản lý nội dung, sản phẩm, tồn kho, giá, khuyến mãi, tài khoản nhân viên, báo cáo. Có thể cấp các vai trò con: Kỹ thuật viên phần cứng, Lập trình viên hệ thống, CSKH, Nhân viên kho |
| **Nhân viên CSKH / kỹ thuật** | Hỗ trợ, tư vấn, xử lý đơn hàng, bảo hành; dùng chung trang quản trị nhưng bị giới hạn quyền |

---

## 2. Danh sách trang / chức năng

### 2.1. Phía khách hàng (storefront)
| # | Trang / chức năng | Ghi chú từ tài liệu |
|---|---|---|
| 1 | **Trang chủ** | Menu danh mục (mega menu), banner, khuyến mãi |
| 2 | **Danh mục sản phẩm + tìm kiếm** | Gợi ý tìm kiếm hiện cả danh mục và sản phẩm |
| 3 | **Bộ lọc sản phẩm** | Lọc theo hãng, giá, nhu cầu + thông số riêng từng loại (mục 3.2) |
| 4 | **Chi tiết sản phẩm** | Tab thông số kỹ thuật, ảnh, mô tả, bảo hành & khuyến mãi cạnh nút mua; công cụ tính trả góp |
| 5 | **Giỏ hàng** | Áp mã giảm giá |
| 6 | **Đặt hàng / thanh toán** | Tính phí vận chuyển |
| 7 | **Đăng ký / đăng nhập / tài khoản** | |
| 8 | **Lịch sử & theo dõi đơn hàng** | Trạng thái: Đã xác nhận → Đang chuẩn bị → Đang giao → Hoàn tất; yêu cầu hủy/đổi trả |
| 9 | **Tra cứu bảo hành điện tử** | Theo số serial hoặc SĐT; kèm lịch sử sửa chữa, đổi trả |
| 10 | **Hóa đơn điện tử** | |
| 11 | **Đánh giá, bình luận, hỏi đáp** | CSKH duyệt và phản hồi |
| 12 | **Tích điểm, hạng thành viên** | Hạng thường/VIP |
| 13 | **Chatbot / live-chat / kênh hỗ trợ** | |
| 14 | **So sánh linh kiện** | 2–3 sản phẩm cạnh nhau, tự làm nổi bật thông số tốt hơn |
| 15 | **Trả góp** | Tính khoản vay qua thẻ tín dụng / công ty tài chính |

**Chức năng đặc thù (Bảng 4.3):**
| # | Chức năng | Ghi chú |
|---|---|---|
| A | **Build PC** | Chọn tuần tự 10 bước, kiểm tra tương thích, kiểm tra công suất nguồn & kích thước, tính tổng giá và tổng công suất |
| B | **Cấu hình dựng sẵn** | Ví dụ "PC Văn phòng", "PC Đồ họa", "PC Gaming AAA" theo nhu cầu/ngân sách |
| C | **Tư vấn nâng cấp** | Nhập cấu hình hiện tại → tính nghẽn cổ chai (bottleneck) → gợi ý linh kiện thay |
| D | **Chia sẻ cấu hình** | Link ngắn / mã QR; link chỉ lưu ID linh kiện, giá luôn tính theo giá mới nhất |
| E | **Mô phỏng hiệu năng** | Điểm Cinebench/3DMark, FPS dự kiến ở 1080p/2K/4K cho game eSports & AAA |
| F | **Thu cũ đổi mới + linh kiện cũ** | Định giá nhanh, kho hàng second-hand |

### 2.2. Trang quản trị (Admin Panel)
Các mục: **Dashboard** (báo cáo trực quan), **Catalog**, **Sales**, **Customers**, **Marketing**, **System Settings**.

**Quản trị viên:**
- Đăng nhập, đổi mật khẩu, xác thực 2 lớp (2FA)
- Quản lý tài khoản nhân viên: tạo, khóa, đặt lại mật khẩu, gán vai trò
- Quản lý tài khoản khách hàng, xử lý vi phạm
- Quản lý sản phẩm (thêm/sửa/ẩn/xóa mềm, ảnh, mô tả, tồn kho) + thông số kỹ thuật theo từng danh mục
- Quản lý danh mục (CPU, mainboard, RAM, VGA, SSD, nguồn, case…)
- Quản lý kho: nhập, xuất, loại bỏ hàng lỗi; nhà cung cấp, phiếu nhập, giá vốn theo lô; cảnh báo tồn kho tối thiểu
- Quản lý đơn hàng (toàn bộ, mọi trạng thái)
- Quản lý giá, giá khuyến mãi, voucher (theo sự kiện/điều kiện đơn, có thời hạn); cập nhật giá hàng loạt + lịch sử giá
- Quản lý quy tắc tương thích, cấu hình PC mẫu
- Thông tin bảo hành theo sản phẩm (thời hạn, nhà cung cấp, serial)
- Báo cáo doanh thu theo ngày/tháng
- Nhật ký hoạt động (ai, làm gì, lúc nào)
- Phân quyền chi tiết đến mức trường dữ liệu (ví dụ ai được xem giá vốn)

**Kỹ thuật viên phần cứng:** cập nhật bảo hành & lịch sử sửa chữa, quy tắc tương thích, dữ liệu benchmark.
**Lập trình viên hệ thống:** xem log lỗi, hiệu suất, sao lưu/phục hồi CSDL.

**Nhân viên CSKH:**
- Danh sách yêu cầu hỗ trợ đang chờ; tiếp nhận & xác nhận đơn mới, phối hợp kho đóng gói
- Tra cứu đơn theo mã đơn / SĐT / email; cập nhật một số trạng thái; xử lý hủy, đổi trả
- Xem thông tin & lịch sử mua của khách; ghi chú nội bộ
- Trả lời qua chat/email/ghi chú cuộc gọi; mẫu trả lời nhanh (FAQ)
- Duyệt và phản hồi đánh giá/bình luận
- Quản lý điểm, hạng thành viên, gửi ưu đãi cá nhân hóa
- Tư vấn Build PC, kiểm tra tương thích hộ khách
- Phiếu bảo hành: tạo, theo dõi, cập nhật tiến độ
- Xử lý sự cố đơn (thiếu hàng, giao sai, lỗi thanh toán), hoàn tiền trong hạn mức
- Cảnh báo đơn chờ quá lâu / giao thất bại
- Khảo sát mức hài lòng tự động khi đóng phiếu hỗ trợ
- Chuyển yêu cầu lên cấp trên

**Bảng phân quyền tóm tắt (Bảng 1.3):**
| Chức năng | Quản trị viên | CSKH |
|---|---|---|
| Xem/tra cứu đơn | Toàn bộ | Toàn bộ |
| Cập nhật trạng thái đơn | Mọi trạng thái | Một số trạng thái |
| Quản lý sản phẩm & giá | Có | Không |
| Xem giá vốn | Có | Không |
| Hoàn tiền | Không giới hạn | Trong hạn mức |
| Phiếu bảo hành | Có | Có |
| Quản lý tài khoản nhân viên | Có | Không |
| Báo cáo doanh thu | Có | Không |

---

## 3. Giao diện, danh mục sản phẩm, quy trình mua hàng

### 3.1. Giao diện
Tài liệu **gần như không có yêu cầu giao diện cụ thể** (không có màu sắc, logo, tên cửa hàng, mockup, font). Chỉ có các nhận xét định hướng từ khảo sát:
- Thích phong cách **hiện đại, trẻ trung, hướng game thủ** như GearVN; chê Phong Vũ "giao diện hơi cũ".
- Mega menu theo nhóm ngành, banner khuyến mãi.
- Trang chi tiết: tab thông số rõ ràng, chính sách bảo hành/khuyến mãi ngay cạnh nút mua.
- Checkout gọn (Phong Vũ 2 bước, CellphoneS 1 trang).
- Build PC: giao diện trực quan, sản phẩm không tương thích bị **làm mờ** ở bước sau hoặc **cảnh báo đỏ** nếu cố chọn.
- Bảng so sánh: sản phẩm xếp theo cột, thông số tốt hơn tự động được làm nổi bật.
- Admin: Dashboard có báo cáo trực quan (biểu đồ).

### 3.2. Danh mục sản phẩm và thuộc tính lọc
| Danh mục | Thuộc tính lọc / thông số |
|---|---|
| **CPU** | Hãng (Intel Core i3/i5/i7/i9/Ultra, AMD Ryzen 3/5/7/9); thế hệ/series (Intel Gen 13, 14; Ryzen 5000/7000/9000); socket (LGA1700, LGA1851, AM4, AM5); hậu tố (K/KF, F, X/X3D); số nhân, số luồng; TDP |
| **Mainboard** | Chipset (B760, Z790, B650…); kích thước (ATX, Micro-ATX, ITX); Wi-Fi; socket; chuẩn DDR hỗ trợ |
| **RAM** | Bus (3200, 6000MHz…); chuẩn DDR; CAS latency; LED RGB; dung lượng |
| **VGA** | VRAM (8/12/24GB); GPU (RTX 4060, RX 7800XT…); số quạt (1/2/3); PCIe 4.0/5.0; TDP; cổng xuất hình; chiều dài |
| **Ổ cứng** | HDD/SSD; chuẩn & kích thước (M.2 NVMe Gen 3/4/5, 2.5" SATA, 3.5" SATA); dung lượng (64GB–4TB); tốc độ đọc/ghi |
| **Nguồn (PSU)** | Công suất |
| **Case** | Kích thước mainboard hỗ trợ; kiểu thiết kế; kích thước quạt; hỗ trợ tản nước; khoảng trống cho tản nhiệt & VGA |
| **Tản nhiệt CPU** | Khí/nước; chiều cao hoặc kích thước radiator; socket hỗ trợ |
| **Màn hình**, **Phụ kiện khác** | Chỉ xuất hiện ở bước 9–10 của Build PC, chưa có thuộc tính lọc |

**Thứ tự Build PC:** CPU → Mainboard → RAM → VGA → SSD/HDD → PSU → Case → Tản nhiệt → Màn hình → Phụ kiện.

**Quy tắc tương thích (Bảng 4.2):**
| Cặp | Quy tắc |
|---|---|
| CPU ↔ Mainboard | Cùng socket |
| Mainboard ↔ RAM | Cùng thế hệ DDR |
| Mainboard ↔ Case | Case hỗ trợ kích thước mainboard |
| PSU | Công suất ≥ tổng TDP hệ thống + 20–30% dự phòng |
| Tản nhiệt ↔ Case | Chiều cao tản ≤ khoảng trống case |
| VGA ↔ Case | Chiều dài VGA ≤ khoảng trống case |

**Nguồn dữ liệu:** file `.json` Buildcores → script/AI lọc và phân loại thành (1) thông tin cơ bản cho khách, (2) thông số kỹ thuật chi tiết, (3) thông tin khác cho admin → nhập vào MySQL.

### 3.3. Quy trình mua hàng
Ghép từ các mục rải rác (tài liệu không vẽ luồng cụ thể):
1. Khách tìm kiếm / duyệt danh mục / lọc → xem chi tiết (hoặc dùng Build PC / cấu hình dựng sẵn để thêm cả bộ).
2. Thêm vào giỏ → áp voucher (có thể tự áp nếu đủ điều kiện).
3. Checkout: thông tin giao hàng, phí vận chuyển, chọn hình thức thanh toán (khảo sát nhắc tới VNPAY, thẻ tín dụng, trả góp — **chưa chốt**).
4. Đơn mới → CSKH xác nhận → phối hợp kho đóng gói → cập nhật trạng thái: **Đã xác nhận → Đang chuẩn bị → Đang giao → Hoàn tất**.
5. Khách theo dõi đơn trong tài khoản; có thể yêu cầu hủy / đổi trả.
6. Sau mua: hóa đơn điện tử, tích điểm, đánh giá sản phẩm, tra cứu bảo hành theo serial/SĐT.

---

## 4. Điểm mơ hồ / mâu thuẫn cần bạn xác nhận

### A. Phạm vi & ưu tiên (quan trọng nhất)
1. **Phạm vi quá lớn so với 4 tuần.** Tài liệu liệt kê 15 tính năng cơ bản + 6 tính năng đặc thù + admin đầy đủ (2FA, phân quyền mức trường, nhật ký, nhà cung cấp, lô hàng, backup…). Cần chốt **bản MVP** gồm những gì. Đề xuất mức tối thiểu: trang chủ, danh mục + lọc, chi tiết, giỏ hàng, checkout, tài khoản + đơn hàng, Build PC có kiểm tra tương thích, so sánh, admin (sản phẩm, đơn, kho cơ bản) + phân quyền Admin/CSKH.
2. Các tính năng cần **dịch vụ bên ngoài** — làm thật, làm giả lập, hay bỏ? Thanh toán online (VNPAY/thẻ), trả góp (Home Credit, HD Saison…), hóa đơn điện tử, phí vận chuyển (API hãng giao hàng hay bảng phí cố định?), live-chat/chatbot, gửi email (khảo sát hài lòng, ưu đãi), đăng nhập Google/Facebook (có trong khảo sát nhưng không có trong danh sách yêu cầu).
3. **Mô phỏng FPS / benchmark / tư vấn nghẽn cổ chai**: Buildcores chỉ cung cấp thông số, **không có dữ liệu benchmark/FPS**. Lấy dữ liệu từ đâu, hay bỏ khỏi MVP?
4. **Thu cũ đổi mới + kho linh kiện cũ**: cần quy trình định giá và quản lý hàng second-hand riêng — có làm không?

### B. Sản phẩm & danh mục
5. Tên đề tài là "linh kiện điện tử dành cho **PC và laptop**", nhưng danh mục và bộ lọc chỉ có linh kiện PC. Có bán **laptop**, linh kiện laptop (RAM/SSD laptop), **PC ráp sẵn** không? Nếu có thì thuộc tính lọc là gì?
6. **Màn hình** và **phụ kiện** có trong Build PC nhưng không có trong danh sách danh mục admin và chưa có thuộc tính lọc.
7. **Giá bán (VND), tồn kho và ảnh sản phẩm** lấy từ đâu? Buildcores là dữ liệu quốc tế, không có giá VN. Nhập tay, sinh dữ liệu mẫu, hay để AI gán giá?
8. Mục ổ cứng ghi dung lượng "64GB đến 4TB" — HDD thường lớn hơn 4TB; có giới hạn thật không hay chỉ là ví dụ?

### C. Build PC & so sánh
9. Sản phẩm không tương thích: **ẩn/làm mờ** hay **vẫn cho chọn kèm cảnh báo đỏ**? Tài liệu nêu cả hai ("hoặc").
10. Quy tắc PSU: dự phòng **20% hay 30%**? Có tính TDP của các linh kiện ngoài CPU+VGA không (dùng hằng số cho mainboard/RAM/ổ/quạt?).
11. Thứ tự chọn 10 bước là **bắt buộc tuần tự** hay khách được chọn tự do? Bước nào bắt buộc, bước nào tùy chọn?
12. Quy tắc tương thích **lưu trong CSDL để admin sửa** (như tài liệu nói) hay **code cứng** cho kịp tiến độ? Ai là người sửa: Quản trị viên hay Kỹ thuật viên (tài liệu ghi cả hai)?
13. Bảng so sánh: tối đa **2 hay 3** sản phẩm? Cột thuộc tính cố định (Core, Thread, Clock, VRAM, TDP, Price) trộn CPU và VGA — chỉ cho so sánh **cùng loại** hay có cột riêng theo từng danh mục?

### D. Người dùng & phân quyền
14. Mục 1.2 nói "hệ thống có **ba** nhóm người dùng" rồi lại viết "**hai** nhóm này dùng chung một hệ thống quản lý" (ý là 2 nhóm nội bộ) — xác nhận cách hiểu: khách hàng + 2 nhóm nội bộ.
15. Admin gán được các vai trò **Kỹ thuật viên, CSKH, Nhân viên kho, Lập trình viên**, nhưng bảng phân quyền chỉ định nghĩa **Admin và CSKH**. Có cần làm các vai trò còn lại không, và quyền cụ thể là gì?
16. CSKH được cập nhật **"một số trạng thái"** — cụ thể trạng thái nào? Danh sách trạng thái cũng thiếu: Chờ xác nhận, Đã hủy, Giao thất bại, Đổi trả/Hoàn tiền.
17. **Hạn mức hoàn tiền** của CSKH là bao nhiêu? Hoàn tiền thật (qua cổng thanh toán) hay chỉ ghi nhận trạng thái?
18. Có cho **mua hàng không cần đăng nhập** (guest checkout) không?

### E. Kho & bảo hành
19. Tra cứu bảo hành theo **số serial** đòi hỏi quản lý từng đơn vị hàng (mỗi chiếc có serial), trong khi kho được mô tả theo **số lượng tồn**. Có quản lý serial từng sản phẩm không? Nếu không thì chỉ tra theo SĐT/mã đơn.
20. Quản lý **lô hàng, giá vốn theo lô, nhà cung cấp** có trong MVP không?

### F. Giao diện & kỹ thuật
21. **Tên cửa hàng, logo, màu chủ đạo**? Phong cách "gaming" (tối, neon kiểu GearVN) hay sáng, trung tính?
22. Có yêu cầu **responsive cho điện thoại** không (tài liệu khen CellphoneS tối ưu mobile nhưng không ghi thành yêu cầu)?
23. Giao diện admin dùng tên tiếng Anh (Dashboard, Catalog, Sales…) hay tiếng Việt? Website chỉ tiếng Việt, tiền tệ VND?
24. "Không framework" có cho phép dùng **thư viện CSS/JS nhỏ** (Bootstrap, Chart.js cho Dashboard, thư viện tạo QR) không?
25. **"Bộ công cụ máy chủ đóng gói sẵn"** cụ thể là gì (XAMPP, Laragon…), phiên bản PHP/MySQL nào? Có cần deploy lên hosting thật để nộp không?
26. Tên hạng thành viên: tài liệu dùng "**S-Member**" — đây là thương hiệu của CellphoneS, nên đổi tên riêng cho dự án.
