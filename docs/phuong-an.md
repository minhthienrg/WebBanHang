# Phương án bố cục & trải nghiệm người dùng

> Tài liệu này học **cách tổ chức và trải nghiệm** của Phong Vũ, GearVN và CellphoneS để đề xuất cấu trúc cho website của nhóm. Không dùng logo, hình ảnh, nội dung, màu sắc hay nhận diện thương hiệu của các trang này. Tên riêng (như "S-Member", "PC GVN") chỉ được nhắc tới để mô tả, **không dùng lại**.
>
> Đọc kèm: [`yeu-cau.md`](yeu-cau.md).

## 0. Cách khảo sát & giới hạn

- Ngày khảo sát: 08/11/2026. Đọc nội dung HTML của: trang chủ cả 3 site; trang danh sách (GearVN – VGA, Phong Vũ – CPU, CellphoneS – Laptop); trang chi tiết (GearVN – RTX 5060, Phong Vũ – i5-14400F, CellphoneS – ASUS TUF A15); trang Build PC của GearVN và Phong Vũ.
- **Giới hạn:**
  - Công cụ đọc trang **không chạy JavaScript và không mở được giỏ hàng/checkout** (cần phiên đăng nhập và giỏ có hàng). Vì vậy phần **giỏ hàng, thanh toán, gợi ý tìm kiếm** dựa trên báo cáo khảo sát của nhóm (`WebIdea.pdf`, mục 2) và kiến thức chung về các trang này. Các dòng đó được đánh dấu *(chưa kiểm chứng trực tiếp)*.
  - **Giao diện điện thoại** không xem được trực tiếp. Chỉ thấy dấu hiệu trong mã trang: banner riêng cho mobile, thanh mua hàng dính đáy màn hình, bộ lọc dạng ngăn kéo (drawer). Nên mở thử trên điện thoại thật để kiểm tra lại.

---

## 1. Phân tích 3 website

### 1.1. Header & menu danh mục

| | Phong Vũ | GearVN | CellphoneS |
|---|---|---|---|
| Thanh tiện ích trên cùng | Hệ thống showroom, khách doanh nghiệp, hotline, tin tức, **Build PC**, khuyến mãi | Hotline, hệ thống cửa hàng, **tra cứu đơn hàng** | Thông điệp cam kết (chính hãng, có VAT, giao nhanh, thu cũ), cửa hàng gần bạn, **tra cứu đơn hàng**, hotline |
| Hàng chính | Nút "Danh mục sản phẩm" + ô tìm kiếm + giỏ + tài khoản; hàng phím tắt đến sản phẩm hot | Nút danh mục + **thanh điều hướng tính năng**: khuyến mãi, tin tức, **tra cứu bảo hành**, dịch vụ tại nhà, **thu cũ đổi mới**, **Build PC** | Nút "Danh mục" + **chọn tỉnh/thành** + tìm kiếm + giỏ + đăng nhập |
| Danh mục cấp 1 | ~16 nhóm ngành rộng (Laptop, PC, **Linh kiện máy tính** gom chung, Màn hình, Gaming gear, Điện thoại, Điện máy…) | **14 mục, linh kiện tách riêng từng loại**: Laptop, PC, Màn hình, Mainboard, CPU, VGA, RAM, Ổ cứng, Chuột, Bàn phím, Tai nghe, Case, Tản nhiệt, Nguồn | ~18 nhóm, thiên về điện thoại và gia dụng; PC/Màn hình chỉ là 1 mục |
| Menu con (mega menu) | Theo nhóm ngành → loại → hãng/series | Cột theo **hãng**, **khoảng giá**, **dòng chip/series** | "Xem tất cả" + hàng **thương hiệu** + một số loại con |

**Rút ra:**
- Shop chuyên linh kiện nên **đưa từng loại linh kiện lên cấp 1** (như GearVN). Khách tìm "VGA" bấm 1 lần là tới, không phải qua "Linh kiện máy tính → VGA".
- Mega menu có **3 cách vào cùng một danh sách**: theo hãng, theo khoảng giá, theo dòng (series/chip). Mỗi đường thực chất là trang danh sách đã áp sẵn bộ lọc, nên rất rẻ để làm.
- **Build PC, Tra cứu đơn hàng, Tra cứu bảo hành** nằm ngay trên header ở cả 3 site, là các lối tắt quan trọng.

### 1.2. Trang chủ

| Thứ tự | Phong Vũ | GearVN | CellphoneS |
|---|---|---|---|
| 1 | Lưới banner lớn + nhỏ | Banner trượt (carousel) | Lưới icon danh mục |
| 2 | Hàng icon "ưu đãi hot" | Dải icon danh mục | Banner trượt |
| 3 | **Flash sale** có đồng hồ đếm ngược, tab theo loại | Khối tin tức/review | Ô hành động nhanh (deal, định giá máy, sinh viên, thu cũ, thành viên) |
| 4 | Lưới sản phẩm theo loại | **Flash sale** đếm ngược | Lời mời đăng ký thành viên |
| 5 | — | **Khối "bán chạy" theo loại** (PC, laptop gaming, laptop văn phòng, chuột, phím, màn hình), mỗi khối có **tab theo hãng** | Tab: Deal sốc / Hot trend / Hàng mới về |
| 6 | — | Banner cuối | **Khối theo danh mục**: banner + chip hãng + lưới sản phẩm + "Xem tất cả" |
| Nút nổi | Gọi, Zalo, Messenger | Chatbot, Zalo | — |

**Thẻ sản phẩm (product card)** gần như giống nhau ở cả 3 site: ảnh, **nhãn giảm %**, tên, **1 dòng thông số tóm tắt** (GearVN, Phong Vũ), giá gốc gạch ngang, giá bán, nhãn quà tặng/combo. Phong Vũ có thêm nút "Thêm vào giỏ" ngay trên thẻ; CellphoneS có nhãn "Trả góp 0%", điểm đánh giá, nút "Yêu thích".

**Rút ra:** trang chủ = banner → icon danh mục → khuyến mãi có đếm ngược → **các khối theo danh mục, mỗi khối có tab lọc nhanh** → nội dung/tin tức → footer. Nên **giữ 1 mẫu thẻ sản phẩm thống nhất** dùng ở mọi nơi.

### 1.3. Trang danh sách sản phẩm (bộ lọc, sắp xếp)

| | Phong Vũ (CPU) | GearVN (VGA) | CellphoneS (Laptop) |
|---|---|---|---|
| Breadcrumb | Trang chủ › Linh kiện › CPU | Trang chủ / VGA | Trang chủ / Laptop |
| Lối vào nhanh phía trên | Ô Intel / AMD, link series | Banner | **Chip thương hiệu** (logo) + **ô "Chọn theo nhu cầu"** (Văn phòng, Gaming, Mỏng nhẹ, Đồ họa, Sinh viên…) |
| Bộ lọc | Giá (min–max), Hãng, **Nhu cầu**, Series, Thế hệ, Số nhân, **Socket** | **Rất sâu, ~20 nhóm**: giá (khoảng có sẵn + tự nhập), dòng sản phẩm, dòng VGA, hãng, CUDA, xung nhịp, VRAM, loại bộ nhớ, PCIe, cổng xuất hình, DLSS, Ray Tracing, nguồn, kích thước… Nhóm dài có "Xem thêm" | ~10 nhóm chính + mở rộng; **công tắc "Sẵn hàng"**; giá min–max; mở dạng **ngăn kéo có nút "Xem kết quả"** |
| Sắp xếp | Khuyến mãi tốt nhất, Giá tăng, Giá giảm, Mới nhất, **Bán chạy nhất** | Mới nhất, Giá tăng, Giá giảm, Tên A–Z | **Phổ biến**, Khuyến mãi HOT, Giá thấp–cao, Giá cao–thấp |
| Số lượng | "(152 sản phẩm)" | "Tìm thấy 170 kết quả" | Nằm trong nút "Xem thêm 668 sản phẩm" |
| Phân trang | Nút **"Xem thêm sản phẩm"** | **Đánh số trang** (`?page=`), 20 sản phẩm/trang | Nút **"Xem thêm N sản phẩm"** |
| Dưới lưới sản phẩm | **Bài viết SEO** (hướng dẫn chọn CPU, bảng tương thích), FAQ, tin liên quan | Bài viết SEO + bảng hướng dẫn chọn mua | Bài viết SEO dài + **Hỏi đáp** |

**Rút ra:**
- Bộ lọc **khác nhau theo từng danh mục**, đúng như yêu cầu mục 3.2 của nhóm. GearVN lọc quá chi tiết (~20 nhóm), gây rối. Mỗi danh mục chỉ nên giữ **5–8 nhóm lọc quan trọng**.
- **"Nhu cầu"** (Gaming / Văn phòng / Đồ họa / Sinh viên) xuất hiện ở cả Phong Vũ và CellphoneS. Đây là cách lọc thân thiện với khách phổ thông, khớp với "cấu hình dựng sẵn" trong yêu cầu.
- **Hiển thị bộ lọc đang áp dụng** dạng chip, có nút xóa từng chip / xóa tất cả. Cả 3 site đều có cơ chế tương tự.
- Bộ lọc và sắp xếp nên **nằm trong URL** (`?socket=AM5&sort=price_asc`) để chia sẻ link được và nút Back hoạt động đúng.
- Phân trang: **đánh số trang** đơn giản hơn với PHP thuần và tốt cho SEO; có thể thêm "Xem thêm" bằng JS sau.

### 1.4. Trang chi tiết sản phẩm

| Khối | Phong Vũ | GearVN | CellphoneS |
|---|---|---|---|
| Breadcrumb | Đủ 5 cấp | Đủ | Ngắn |
| Ảnh | Ảnh chính | Carousel + 11 ảnh nhỏ, bộ đếm "1/11" | Ảnh chính + ~21 ảnh nhỏ |
| Tiêu đề | Tên, **SKU**, hãng, điểm đánh giá, Chia sẻ, Yêu thích | Tên | Tên + dòng thông số tóm tắt |
| Biến thể | Bộ chọn "Tên CPU" (mỗi biến thể là 1 URL riêng) | — | Chọn **màu / cấu hình**, mỗi lựa chọn kèm giá |
| Giá | Giá bán + nhãn % | Giá bán, giá gốc gạch, nhãn % | "Giá cho bạn", giá gốc gạch, nhãn Flash Sale |
| Nút mua | Số lượng + **"Mua ngay"** | **"Tư vấn ngay"** (qua chat) + ghi chú "Giá tốt hơn khi build PC trọn bộ" | **"Mua ngay"**, "Đặt trước" (đặt cọc), **"Trả góp 0%"** |
| Chính sách | **Ô chính sách bán hàng**: miễn ship từ 5 triệu, đổi trả 10 ngày, cam kết chính hãng | Chỉ ở footer | Chỉ ở footer |
| Thông số | "Đặc điểm nổi bật" + link xem chi tiết | **"Thông số nổi bật" đặt trên giá** + "Xem tất cả thông số"; bảng đầy đủ ở dưới | Bảng tóm tắt + "Xem tất cả" mở toàn bộ |
| Mô tả | Thông báo "chỉ bán kèm bộ PC" | Bài review có **mục lục** | Bài viết dài theo từng mục |
| Liên quan | — | **"Sản phẩm tương tự"** | Tab **"So sánh"** |
| Hỏi đáp / đánh giá | Số đánh giá cạnh tên | Không thấy | **"Hỏi đáp"** + form gửi câu hỏi |
| Thanh dính (sticky) | Nút liên hệ nổi | Thanh thu gọn: ảnh, tên, giá, nút | **Thanh đáy trên mobile**: giá + "Mua Ngay" + "Lên đầu" + "Liên hệ" |

**Rút ra:**
- Trên màn hình đầu tiên (above the fold) cần đủ: **ảnh – tên – giá – 4–6 thông số chính – nút mua – ô chính sách** (bảo hành, đổi trả, giao hàng). Ô chính sách của Phong Vũ trả lời câu hỏi "có đáng tin không?" ngay cạnh nút mua.
- Riêng với linh kiện: hiển thị **thông số tương thích** (socket, DDR, form factor, TDP, chiều dài) ngay khối đầu, và thêm nút **"Thêm vào Build PC"**. Đây là điểm nối giữa trang sản phẩm và Build PC mà cả 3 site chưa làm rõ.
- Bảng thông số đầy đủ để thành **khối riêng** bên dưới, sinh tự động từ dữ liệu theo danh mục.
- Trên mobile, **thanh mua hàng dính đáy màn hình** là bắt buộc.

### 1.5. Giỏ hàng & thanh toán *(chưa kiểm chứng trực tiếp)*

| | Phong Vũ | GearVN | CellphoneS |
|---|---|---|---|
| Luồng | Checkout **2 bước** | Mượt, nhiều hình thức trả góp | **1 trang**, rút gọn tối đa |
| Voucher | **Tự áp** nếu đủ điều kiện | Combo/quà tặng khi build PC | Giảm thêm qua thẻ ngân hàng/ví |
| Thanh toán | VNPAY, thẻ, trả góp | Trả góp, mua trước trả sau | VNPay, MoMo, ZaloPay, Apple Pay, Kredivo… |
| Đăng nhập | Google/Facebook | — | Thành viên tích điểm |

Mẫu chung của các trang TMĐT Việt Nam: giỏ hàng gồm danh sách sản phẩm (+/− số lượng, xóa), ô mã giảm giá, tóm tắt tiền (tạm tính – giảm giá – phí ship – tổng), nút "Đặt hàng". Checkout gồm người nhận (tên, SĐT), địa chỉ (tỉnh → quận → phường), hình thức nhận (giao tận nơi / nhận tại cửa hàng), phương thức thanh toán (COD là mặc định), ghi chú, xuất hóa đơn công ty → trang **cảm ơn kèm mã đơn**.

### 1.6. Tìm kiếm

- Ô tìm kiếm nằm giữa header, **luôn hiển thị** ở cả 3 site.
- **Gợi ý khi gõ** (theo khảo sát của nhóm): hiện cả **danh mục** lẫn **sản phẩm** (Phong Vũ); CellphoneS gợi ý rất nhanh *(chưa kiểm chứng trực tiếp)*.
- Trang kết quả tìm kiếm dùng lại layout trang danh sách (bộ lọc + sắp xếp).

**Đề xuất cho nhóm:** gợi ý tối đa 5 sản phẩm (ảnh nhỏ, tên, giá) + 3 danh mục khớp; **tìm theo mã model** (ví dụ "14400F", "4060") và **không phân biệt dấu** ("o cung" vẫn ra "ổ cứng"). Với MySQL có thể dùng `LIKE` trên cột tên đã bỏ dấu, hoặc FULLTEXT.

### 1.7. Hiển thị trên điện thoại

Dấu hiệu quan sát được: banner có phiên bản riêng cho mobile (CellphoneS); bộ lọc mở dạng **ngăn kéo** với nút "Đóng" / "Xem kết quả" (CellphoneS); **thanh mua dính đáy** trên trang chi tiết (CellphoneS); nút liên hệ nổi (Phong Vũ, GearVN).

**Đề xuất mobile cho nhóm:**
- Header thu gọn: ☰ (mở menu danh mục dạng trượt) · logo · 🔍 · 🛒 có số lượng.
- **Thanh điều hướng đáy** cố định: Trang chủ · Danh mục · **Build PC** · Giỏ hàng · Tài khoản.
- Trang danh sách: hàng chip cuộn ngang (nhu cầu/hãng), 2 nút "Bộ lọc" và "Sắp xếp" mở ngăn kéo từ dưới lên; lưới **2 cột**.
- Trang chi tiết: ảnh vuốt ngang; thanh đáy "Thêm vào giỏ | Mua ngay".
- Build PC: mỗi slot là 1 thẻ dọc; chọn linh kiện mở **màn hình toàn trang**; tổng tiền + tổng công suất **dính đáy**.
- Bảng so sánh: cột thuộc tính cố định bên trái, cuộn ngang phần sản phẩm.

### 1.8. Build PC (bổ sung, vì là tính năng chính của nhóm)

| | Phong Vũ | GearVN |
|---|---|---|
| Lối vào | Header | Header + footer |
| Cấu hình mẫu | PC Gaming / Đồ họa / Văn phòng | PC Gaming / Đồ họa / Văn phòng – Học tập / AI |
| Nhiều cấu hình | **Tab "Cấu hình 1/2/3"** | — |
| Danh sách slot | 14 slot dọc, mỗi slot có nút "Chọn" | 14 slot (thêm Phần mềm) |
| Hành động | Tạo lại, Tải cấu hình | Chọn lại từ đầu, **Xem và in**, **Chia sẻ cấu hình**, **Tải file cấu hình** |
| Tổng kết | *(không thấy trong nội dung đọc được)* | "Tạm tính" (số nhóm linh kiện + tổng tiền) + **Thêm vào giỏ / Mua ngay** |
| Kiểm tra tương thích | *(không thấy)* | **Không thấy cảnh báo trong giao diện**; bài hướng dẫn để khách tự kiểm tra |

**Đây là chỗ nhóm có thể làm tốt hơn:** cả hai đều chỉ là "danh sách chọn + tổng tiền". Kiểm tra tương thích tự động, tổng công suất, gợi ý nguồn là **điểm khác biệt thật** của đồ án.

---

## 2. So sánh với yêu cầu trong `yeu-cau.md`

| Hạng mục | Yêu cầu hiện có | 3 site đang làm | Nhận xét / điều chỉnh |
|---|---|---|---|
| Danh mục | CPU, Main, RAM, VGA, SSD, PSU, Case (+ Tản nhiệt, Màn hình, Phụ kiện ở Build PC) | Linh kiện tách riêng từng loại ở cấp 1 (GearVN) | ✅ Khớp. Bổ sung **Tản nhiệt, Màn hình, Phụ kiện** vào danh mục chính thức. Laptop vẫn chờ chốt (mục 4.B.5 của `yeu-cau.md`) |
| Bộ lọc theo thông số | Có bảng thuộc tính theo từng loại | Cả 3 đều có; GearVN quá nhiều | ✅ Khớp. Thêm nhóm lọc chung: **Giá, Hãng, Nhu cầu, Còn hàng** |
| Lọc theo nhu cầu | Chỉ có ở "cấu hình dựng sẵn" | Phong Vũ, CellphoneS có ở trang danh sách | ➕ **Thêm** thuộc tính "Nhu cầu" (gán tag cho sản phẩm) |
| Sắp xếp | **Chưa có trong yêu cầu** | Cả 3 đều có | ➕ **Thêm**: Phổ biến, Giá tăng, Giá giảm, Mới nhất, Giảm giá nhiều |
| Phân trang | Chưa nêu | Đánh số / Xem thêm | ➕ Đánh số trang, 20 sản phẩm/trang |
| Trang chi tiết | Ảnh, mô tả, thông số, bảo hành, trả góp | Thông số nổi bật trên đầu, ô chính sách, sticky bar | ➕ Thêm **ô chính sách**, **thông số tương thích**, nút **"Thêm vào Build PC"**, sản phẩm tương tự |
| So sánh | 2–3 sản phẩm, làm nổi bật thông số tốt hơn | Chỉ CellphoneS có tab So sánh | ✅ Giữ, là điểm cộng. Chốt: **tối đa 3, chỉ cùng danh mục** |
| Giỏ & checkout | Giỏ, voucher, phí ship, thanh toán | 1–2 bước, voucher tự áp | ➕ Đề xuất checkout **1 trang**, **COD là mặc định**; cổng online để giả lập (chờ chốt mục 4.A.2) |
| Tìm kiếm | Chỉ ghi "Tìm kiếm" | Gợi ý khi gõ (danh mục + sản phẩm) | ➕ Thêm **gợi ý khi gõ**, tìm không dấu, tìm theo mã model |
| Tra cứu đơn / bảo hành | Có (trong tài khoản; bảo hành theo serial/SĐT) | Đặt **trên header**, không cần đăng nhập | ➕ Trang tra cứu **công khai** theo mã đơn + SĐT |
| Build PC | 10 bước, 6 quy tắc tương thích, QR/link, mẫu dựng sẵn | 14 slot, không cảnh báo, có in/chia sẻ/xuất file | ✅ Yêu cầu của nhóm **mạnh hơn** cả 2 site. Thêm: **In / xuất ảnh**, **thêm cả bộ vào giỏ** |
| Mobile | **Chưa có yêu cầu** | Banner mobile, drawer lọc, sticky bar | ➕ **Bắt buộc responsive** (mục 1.7) |
| Footer / chính sách | Chưa nêu | Cả 3 có: hotline theo mục đích, chính sách, hướng dẫn mua, thanh toán | ➕ Thêm các trang tĩnh chính sách |
| Tin tức / bài viết SEO | Chưa nêu | Cả 3 có | ⏸ Để sau MVP; trang danh mục có 1 đoạn mô tả ngắn là đủ |
| Flash sale, thu cũ, thành viên, chatbot | Có trong yêu cầu | Có | ⏸ Để sau MVP (xem mục 4) |

---

## 3. Đề xuất cấu trúc cho website của nhóm

### 3.1. Sơ đồ trang (sitemap)

```
Khách hàng
├── /                               Trang chủ
├── /danh-muc/{slug}                Danh sách theo loại (cpu, mainboard, ram, vga,
│                                   o-cung, nguon, case, tan-nhiet, man-hinh, phu-kien)
│     ?hang=&gia_tu=&gia_den=&nhu_cau=&{thuoc_tinh}=&sap_xep=&trang=
├── /tim-kiem?q=                    Kết quả tìm kiếm (dùng lại layout danh sách)
├── /san-pham/{slug}                Chi tiết sản phẩm
├── /so-sanh?ids=1,2,3              So sánh (tối đa 3, cùng danh mục)
├── /build-pc                       Công cụ Build PC
│     /build-pc?c={mã}              Mở cấu hình được chia sẻ (link ngắn / QR)
├── /cau-hinh-mau                   Cấu hình dựng sẵn (Gaming, Đồ họa, Văn phòng…)
├── /gio-hang                       Giỏ hàng
├── /thanh-toan                     Checkout 1 trang
├── /dat-hang-thanh-cong/{mã đơn}   Cảm ơn + mã đơn
├── /tra-cuu-don                    Tra cứu đơn (mã đơn + SĐT), không cần đăng nhập
├── /tra-cuu-bao-hanh               Tra cứu bảo hành (serial hoặc SĐT)
├── /dang-nhap  /dang-ky  /quen-mat-khau
├── /tai-khoan                      Thông tin · Sổ địa chỉ · Đơn hàng · Cấu hình đã lưu
│     /tai-khoan/don-hang/{mã}      Chi tiết + theo dõi trạng thái
└── /trang/{slug}                   Trang tĩnh: giới thiệu, chính sách bảo hành,
                                    đổi trả, giao hàng, thanh toán, hướng dẫn mua

Quản trị (/admin) — theo bảng phân quyền trong yeu-cau.md
├── Tổng quan (Dashboard)    doanh thu ngày/tháng, đơn mới, sắp hết hàng
├── Sản phẩm                 danh sách, thêm/sửa, thông số theo danh mục, ảnh
├── Danh mục & thuộc tính    định nghĩa bộ thông số + thuộc tính nào dùng để lọc
├── Kho                      nhập/xuất, tồn kho, cảnh báo tồn tối thiểu
├── Đơn hàng                 danh sách, chi tiết, đổi trạng thái
├── Khách hàng               danh sách, lịch sử mua, ghi chú nội bộ
├── Khuyến mãi               voucher, giá khuyến mãi
├── Build PC                 quy tắc tương thích, cấu hình mẫu
├── Bảo hành                 phiếu bảo hành
└── Hệ thống                 tài khoản nhân viên, vai trò, nhật ký hoạt động
```

> Với PHP thuần, các URL đẹp ở trên cần rewrite bằng `.htaccess` về một `index.php` (front controller). Nếu muốn đơn giản hơn có thể dùng dạng `danh-muc.php?slug=cpu`. Cấu trúc trang không đổi.

### 3.2. Header & menu

**Desktop:**
```
┌───────────────────────────────────────────────────────────────────────┐
│ Hotline · Tra cứu đơn hàng · Tra cứu bảo hành · Chính sách            │ ← thanh tiện ích
├───────────────────────────────────────────────────────────────────────┤
│ [Logo]  [☰ Danh mục]  [ 🔍 Tìm CPU, VGA, mã sản phẩm...      ]          │
│                       [🛠 Build PC]  [⇄ So sánh (2)]  [👤]  [🛒 3]      │
└───────────────────────────────────────────────────────────────────────┘
```
**Mega menu** khi rê vào một danh mục (ví dụ CPU):
```
CPU          │ Theo hãng      │ Theo dòng          │ Theo socket   │ Theo giá
Mainboard    │ Intel          │ Core i3 / i5 / i7  │ LGA1700       │ Dưới 3 triệu
RAM          │ AMD            │ Core Ultra         │ LGA1851       │ 3 – 6 triệu
VGA  ▶       │                │ Ryzen 5 / 7 / 9    │ AM4 · AM5     │ 6 – 10 triệu
Ổ cứng       │                │                    │               │ Trên 10 triệu
Nguồn · Case · Tản nhiệt · Màn hình · Phụ kiện
```
Mỗi link trong mega menu chỉ là URL danh sách đã gắn sẵn tham số lọc. **Không cần trang riêng.**

### 3.3. Trang chủ

1. **Banner** (1 lớn + 2 nhỏ bên cạnh). Ảnh tự thiết kế hoặc ảnh có giấy phép.
2. **Lưới icon danh mục** (10 loại linh kiện).
3. **Khối Build PC nổi bật**: "Tự build PC – tự kiểm tra tương thích" + 3–4 thẻ cấu hình mẫu theo nhu cầu (Văn phòng / Gaming / Đồ họa) → mở `/build-pc` với cấu hình mẫu đã điền sẵn.
4. **Đang giảm giá**: lưới sản phẩm có giá khuyến mãi (đồng hồ đếm ngược để sau MVP).
5. **Khối theo danh mục** (CPU, VGA, Mainboard, RAM…): tiêu đề + **tab hãng/series** + 1 hàng 5 sản phẩm + "Xem tất cả".
6. **Ô cam kết**: chính hãng, bảo hành, đổi trả, giao hàng.
7. **Footer**: liên hệ (hotline theo mục đích: bán hàng / kỹ thuật – bảo hành / khiếu nại), chính sách, hướng dẫn, tra cứu, phương thức thanh toán.

**Mẫu thẻ sản phẩm thống nhất:**
```
┌──────────────────────┐
│ [-12%]          [⇄]  │  ← nhãn giảm giá · nút thêm vào so sánh
│       (ảnh)          │
│ Tên sản phẩm 2 dòng… │
│ AM5 · 6C/12T · 65W   │  ← dòng thông số chính (lấy theo danh mục)
│ 4.990.000₫           │
│ 5.690.000₫ (gạch)    │
│ [Còn hàng]   [🛒 +]   │
└──────────────────────┘
```

### 3.4. Trang danh sách sản phẩm

```
Trang chủ › VGA
VGA – Card màn hình (170 sản phẩm)
[Gaming] [Đồ họa] [Văn phòng]   [NVIDIA] [AMD]  ← chip lọc nhanh: nhu cầu, hãng
┌─────────────┬────────────────────────────────────────────────────────┐
│ BỘ LỌC      │ Đang lọc: [VRAM 8GB ✕] [PCIe 4.0 ✕]  Xóa tất cả          │
│ Giá         │ Sắp xếp: [Phổ biến ▾]                                   │
│  ○ < 5tr    │ ┌────┐┌────┐┌────┐┌────┐                                │
│  ○ 5–10tr   │ │card││card││card││card│   lưới 4 cột (desktop)          │
│  [từ][đến]  │ └────┘└────┘└────┘└────┘                                │
│ Hãng     ☐  │ ...                                                     │
│ Dòng GPU ☐  │                                                         │
│ VRAM     ☐  │         ‹ 1 2 3 … 9 ›                                    │
│ Còn hàng ☑  │                                                         │
│ (+ Xem thêm)│ Đoạn mô tả ngắn về danh mục (SEO)                         │
└─────────────┴────────────────────────────────────────────────────────┘
```
- **Nhóm lọc chung:** Giá (khoảng có sẵn + tự nhập), Hãng, Nhu cầu, Còn hàng.
- **Nhóm lọc riêng:** lấy từ bảng thuộc tính theo danh mục (mục 3.2 của `yeu-cau.md`), tối đa ~6 nhóm, phần dư ẩn dưới "Xem thêm". Admin đánh dấu thuộc tính nào là "dùng để lọc".
- **Chọn nhiều** trong cùng nhóm (logic OR), giữa các nhóm là AND.
- **Sắp xếp:** Phổ biến (mặc định) · Giá tăng dần · Giá giảm dần · Mới nhất · Giảm giá nhiều nhất.
- Bấm ô lọc là **tải lại trang với tham số URL mới** (đơn giản, đúng với PHP thuần). Có thể nâng cấp sang AJAX sau.
- Không có kết quả: hiện gợi ý "Bỏ bớt bộ lọc" kèm danh sách chip đang áp dụng.

### 3.5. Trang chi tiết sản phẩm

```
Trang chủ › CPU › Intel › Core i5-14400F
┌──────────────────────┬──────────────────────────────────────────┐
│                      │ Intel Core i5-14400F                     │
│   (ảnh chính)         │ Mã: CPU-0123 · Hãng: Intel · ★4.6 (12)    │
│                      │ 4.990.000₫  5.690.000₫  -12%             │
│ [▫][▫][▫][▫]         │ ┌ Thông số tương thích ─────────────────┐│
│                      │ │ Socket LGA1700 · DDR4/DDR5 · TDP 65W  ││
│                      │ │ 10 nhân / 16 luồng · Không iGPU        ││
│                      │ └───────────────────────────────────────┘│
│                      │ Tình trạng: Còn hàng                     │
│                      │ [− 1 +] [Thêm vào giỏ] [Mua ngay]         │
│                      │ [🛠 Thêm vào Build PC]  [⇄ So sánh]       │
│                      │ ┌ Bảo hành 36 tháng · Đổi trả 7 ngày ───┐│
│                      │ │ Miễn phí giao từ X đ · Hàng chính hãng ││
│                      │ └───────────────────────────────────────┘│
└──────────────────────┴──────────────────────────────────────────┘
[Thông số kỹ thuật] [Mô tả] [Đánh giá & Hỏi đáp]   ← tab hoặc các khối nối tiếp
Bảng thông số đầy đủ (sinh từ thuộc tính danh mục)
Sản phẩm tương thích: Mainboard LGA1700, Tản nhiệt hỗ trợ LGA1700  ← dùng chính quy tắc Build PC
Sản phẩm tương tự (cùng danh mục, giá gần)
```
- Khối **"Sản phẩm tương thích"** dùng lại engine tương thích của Build PC. Không site nào trong 3 site có khối này, là điểm khác biệt rẻ mà giá trị.
- Mobile: thanh đáy dính `[giá] [Thêm vào giỏ] [Mua ngay]`.

### 3.6. So sánh

- Nút "⇄" trên thẻ sản phẩm và trang chi tiết → **thanh so sánh nổi ở đáy** hiện tối đa 3 ô → "So sánh ngay".
- Chỉ cho so sánh **cùng danh mục**. Thêm sản phẩm khác loại thì báo "Chỉ so sánh được sản phẩm cùng loại".
- Bảng: hàng = thuộc tính của danh mục đó, cột = sản phẩm; **tô đậm giá trị tốt hơn** (cấu hình theo thuộc tính: lớn hơn là tốt như nhân, VRAM; nhỏ hơn là tốt như giá, TDP); công tắc "Chỉ hiện điểm khác nhau".
- Lưu danh sách so sánh trong session/localStorage.

### 3.7. Build PC

```
[Cấu hình mẫu: Văn phòng | Gaming 1080p | Gaming 2K | Đồ họa]
┌─────────────────────────────────────────────┬───────────────────────┐
│ 1 CPU        Core i5-14400F   4.990.000 [Đổi][✕]│ TÓM TẮT              │
│ 2 Mainboard  B760M …          3.290.000 [Đổi][✕]│ Tổng: 24.560.000₫    │
│ 3 RAM        ⚠ DDR4 – main hỗ trợ DDR5  [Đổi]  │ Công suất ước tính:   │
│ 4 VGA        [ + Chọn VGA ]                    │  420W → nên dùng ≥550W│
│ 5 Ổ cứng     [ + Chọn ]                        │ ✔ 4 tương thích       │
│ 6 Nguồn      [ + Chọn ]                        │ ⚠ 1 cảnh báo          │
│ 7 Case · 8 Tản nhiệt · 9 Màn hình · 10 Phụ kiện│ [Thêm cả bộ vào giỏ]  │
└─────────────────────────────────────────────┴───────────────────────┘
[Chia sẻ link / QR]  [In / Xuất ảnh]  [Lưu vào tài khoản]  [Làm lại]
```
- Bấm "Chọn" → **cửa sổ chọn linh kiện** có ô tìm kiếm + bộ lọc rút gọn + sắp xếp giá. Mặc định **chỉ hiện linh kiện tương thích**, có công tắc "Hiện cả không tương thích" (hiện mờ, có lý do). Cách này giải quyết mâu thuẫn "ẩn hay cảnh báo" ở mục 4.C.9 của `yeu-cau.md`; vẫn cần bạn chốt.
- Cho chọn **không bắt buộc theo thứ tự** (có thể bắt đầu từ VGA), nhưng gợi ý thứ tự 1→10.
- Cấu hình đang build lưu trong session; khi đăng nhập thì lưu được nhiều cấu hình (như tab "Cấu hình 1/2/3" của Phong Vũ).
- Link chia sẻ chỉ chứa **mã cấu hình → danh sách ID linh kiện**, giá tính lại khi mở (đúng yêu cầu).

### 3.8. Giỏ hàng & thanh toán

**Giỏ hàng** (`/gio-hang`)
- Danh sách sản phẩm: ảnh, tên, đơn giá, [− n +], thành tiền, xóa. Sản phẩm thêm từ Build PC được **gom thành nhóm "Bộ PC: …"**, có thể xóa cả nhóm.
- Cảnh báo nếu số lượng vượt tồn kho.
- Bên phải: ô mã giảm giá, tạm tính, giảm giá, phí giao (ước tính), **tổng**, nút **"Tiến hành đặt hàng"**.
- Giỏ trống: hiện lối tắt đến danh mục và Build PC.

**Thanh toán — 1 trang** (`/thanh-toan`)
```
1. Thông tin người nhận   Họ tên · SĐT · Email (để gửi xác nhận)
2. Nhận hàng              ○ Giao tận nơi: Tỉnh → Quận/Huyện → Phường/Xã → Địa chỉ
                          ○ Nhận tại cửa hàng (nếu có)
3. Thanh toán             ● COD (mặc định)  ○ Chuyển khoản (hiện QR + nội dung CK)
                          ○ VNPAY/thẻ – giả lập (chờ chốt)
4. Ghi chú · ☐ Xuất hóa đơn công ty (Tên công ty, MST, địa chỉ)
                                     ┌ Tóm tắt đơn (dính bên phải) ┐
                                     │ sản phẩm · voucher · phí · tổng│
                                     │ [ĐẶT HÀNG]                    │
                                     └──────────────────────────────┘
```
- **Cho phép mua không cần đăng nhập** (chờ chốt mục 4.D.18). Nếu đã đăng nhập thì tự điền và chọn từ sổ địa chỉ.
- Phí giao đề xuất: bảng phí cố định theo vùng + miễn phí từ một mức tổng đơn. Không tích hợp API hãng giao hàng trong MVP.
- Sau khi đặt: trang cảm ơn hiện **mã đơn**, tóm tắt, link "Theo dõi đơn"; trạng thái ban đầu **"Chờ xác nhận"**.

### 3.9. Tìm kiếm

- Ô tìm kiếm luôn hiển thị (desktop) / icon 🔍 mở ô toàn màn hình (mobile).
- Gợi ý khi gõ (từ ký tự thứ 2, debounce ~300ms, gọi `api/goi-y.php?q=`): **3 danh mục + 5 sản phẩm** (ảnh, tên, giá) + "Xem tất cả kết quả cho 'xxx'".
- Tìm trên: tên, mã model, hãng, tag; **không phân biệt dấu và hoa/thường**.
- Trang kết quả = trang danh sách + bộ lọc theo danh mục chiếm đa số kết quả; không có kết quả thì gợi ý danh mục phổ biến.

### 3.10. Responsive

| Điểm ngắt | Lưới sản phẩm | Bộ lọc | Điều hướng |
|---|---|---|---|
| ≥ 1200px | 4–5 cột | Cột trái | Header đầy đủ + mega menu |
| 768–1199px | 3 cột | Ngăn kéo | Header thu gọn |
| < 768px | 2 cột | Ngăn kéo từ dưới lên | ☰ + thanh điều hướng đáy (Trang chủ · Danh mục · Build PC · Giỏ · Tài khoản) |

Làm theo hướng **mobile-first** bằng CSS Grid/Flexbox và media query; không cần framework.

---

## 4. Thứ tự ưu tiên đề xuất (khớp 4 tuần)

| Tuần | Phía khách | Phía quản trị |
|---|---|---|
| 1 | CSDL (danh mục, thuộc tính, sản phẩm), nhập dữ liệu Buildcores, header/footer/layout responsive, thẻ sản phẩm, **trang danh sách + lọc + sắp xếp**, trang chi tiết | Đăng nhập admin, CRUD sản phẩm + thông số |
| 2 | Tìm kiếm + gợi ý, giỏ hàng, checkout (COD), đăng ký/đăng nhập, tài khoản + đơn hàng, tra cứu đơn | Quản lý đơn + trạng thái, phân quyền Admin/CSKH, kho cơ bản |
| 3 | **Build PC** (chọn, kiểm tra tương thích, công suất, thêm cả bộ vào giỏ), cấu hình mẫu, so sánh | Quản lý quy tắc tương thích, cấu hình mẫu, voucher |
| 4 | Chia sẻ link/QR, trang chủ hoàn chỉnh, trang tĩnh, kiểm thử mobile, sửa lỗi | Dashboard doanh thu, nhật ký hoạt động, phiếu bảo hành |
| Sau MVP | Flash sale đếm ngược, thành viên/tích điểm, thanh toán online thật, trả góp, chatbot, tư vấn nâng cấp, FPS/benchmark, thu cũ đổi mới, tin tức | 2FA, nhà cung cấp/lô hàng, phân quyền mức trường dữ liệu |

---

## 5. Quyết định cần bạn chốt thêm (ngoài danh sách trong `yeu-cau.md`)

1. Trang danh sách: **đánh số trang** (đề xuất) hay nút "Xem thêm"?
2. Có cho mua hàng **không cần đăng nhập** không? (đề xuất: có)
3. Phương thức thanh toán MVP: **COD + chuyển khoản QR** (đề xuất), còn cổng online để giả lập?
4. Build PC: **mặc định ẩn linh kiện không tương thích, có công tắc để hiện** — đồng ý không?
5. Có làm **"Nhận tại cửa hàng"** không (tức là có cửa hàng giả định)?
6. Thanh điều hướng đáy trên mobile gồm 5 mục như mục 3.10 — đồng ý không?

---

## Nguồn tham khảo (truy cập 08/11/2026)

- Phong Vũ: [trang chủ](https://phongvu.vn/) · [danh mục CPU](https://phongvu.vn/c/cpu) · [CPU i5-14400F](https://phongvu.vn/cpu-intel-core-i5-14400f-2-5ghz-4-7ghz-turbo-boost--s231204441) · [Build PC](https://phongvu.vn/buildpc)
- GearVN: [trang chủ](https://gearvn.com/) · [danh mục VGA](https://gearvn.com/collections/vga-card-man-hinh) · [RTX 5060 Windforce Max OC](https://gearvn.com/products/card-man-hinh-gigabyte-geforce-rtx-5060-windforce-max-oc-8gb) · [Build PC](https://gearvn.com/pages/build-pc)
- CellphoneS: [trang chủ](https://cellphones.com.vn/) · [danh mục Laptop](https://cellphones.com.vn/laptop.html) · [ASUS TUF A15 FA506NCG](https://cellphones.com.vn/laptop-asus-tuf-gaming-a15-fa506ncg-hn390w.html)
- Báo cáo khảo sát của nhóm: `AdminSource/WebIdea.pdf`, mục 2.
