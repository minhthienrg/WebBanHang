// Danh mục sản phẩm. `key` là giá trị trường `category` trong Firestore.
export const CATEGORIES = [
  { key: 'cpu',       name: 'CPU' },
  { key: 'mainboard', name: 'Mainboard' },
  { key: 'ram',       name: 'RAM' },
  { key: 'vga',       name: 'VGA' },
  { key: 'o-cung',    name: 'Ổ cứng' },
  { key: 'nguon',     name: 'Nguồn' },
  { key: 'case',      name: 'Case' },
  { key: 'tan-nhiet', name: 'Tản nhiệt' }
];

export const catName = (key) => CATEGORIES.find((c) => c.key === key)?.name || key;

// Ảnh minh họa theo danh mục (cùng bộ ảnh với trang NEXORA trên Google Sites),
// dùng khi sản phẩm chưa có imageUrl riêng.
const U = (id) => `https://images.unsplash.com/photo-${id}?w=400&q=80`;
const CAT_IMAGES = {
  cpu:         U('1555680202-c86f0e12f086'),
  mainboard:   U('1518770660439-4636190af475'),
  ram:         U('1562976540-1502c2145186'),
  vga:         U('1587202372616-b43abea06c2a'),
  'o-cung':    U('1597872200969-2b65d56bd16b'),
  nguon:       U('1587202372775-e229f172b9d7'),
  case:        U('1587202372634-32705e3bf49c'),
  'tan-nhiet': U('1587202372775-e229f172b9d7')  // ảnh gốc 1618764400608 đã bị Unsplash gỡ (404)
};
const CPU_RYZEN = U('1591799264318-7e6ef8ddb7ea');

export function catImage(p) {
  if (p.category === 'cpu' && /ryzen/i.test(p.name || '')) return CPU_RYZEN;
  return CAT_IMAGES[p.category] || CAT_IMAGES.nguon;
}

// Khoảng giá có sẵn (đơn vị: đồng).
export const PRICE_RANGES = [
  { key: '0-2',   label: 'Dưới 2 triệu',   min: 0,          max: 2_000_000 },
  { key: '2-5',   label: '2 – 5 triệu',    min: 2_000_000,  max: 5_000_000 },
  { key: '5-10',  label: '5 – 10 triệu',   min: 5_000_000,  max: 10_000_000 },
  { key: '10-',   label: 'Trên 10 triệu',  min: 10_000_000, max: Infinity }
];

// Phí giao hàng — PHẢI khớp với hàm shippingFee() trong firestore.rules.
export const FREE_SHIP_FROM = 5_000_000;
export const SHIP_FEE = 30_000;
export const shippingFee = (subtotal) => (subtotal >= FREE_SHIP_FROM ? 0 : SHIP_FEE);

// Giới hạn đơn hàng — PHẢI khớp với firestore.rules.
export const MAX_LINES = 8;    // số dòng sản phẩm khác nhau trong 1 đơn (giới hạn 10 lần đọc/lệnh ghi của Firestore)
export const MAX_QTY = 10;     // số lượng tối đa mỗi dòng

// Bộ lọc thông số riêng từng danh mục (yêu cầu mục 3.2, phương án mục 3.4: 5–8 nhóm mỗi danh mục).
//   key   tên tham số trên URL (#/?cat=cpu&socket=AM5,LGA1700)
//   spec  tên trường trong products.specs
//   split true nếu một sản phẩm có nhiều giá trị, ghi cách nhau bằng dấu phẩy ("DDR4, DDR5")
export const SPEC_FILTERS = {
  cpu: [
    { key: 'socket', spec: 'Socket', label: 'Socket' },
    { key: 'ddr', spec: 'Bộ nhớ hỗ trợ', label: 'Hỗ trợ RAM', split: true },
    { key: 'igpu', spec: 'Đồ họa tích hợp', label: 'Đồ họa tích hợp' }
  ],
  mainboard: [
    { key: 'socket', spec: 'Socket', label: 'Socket' },
    { key: 'chipset', spec: 'Chipset', label: 'Chipset' },
    { key: 'size', spec: 'Kích thước', label: 'Kích thước' },
    { key: 'ddr', spec: 'Chuẩn RAM', label: 'Chuẩn RAM' },
    { key: 'wifi', spec: 'Wi-Fi', label: 'Wi-Fi' }
  ],
  ram: [
    { key: 'ddr', spec: 'Chuẩn', label: 'Chuẩn DDR' },
    { key: 'bus', spec: 'Bus', label: 'Bus' },
    { key: 'dl', spec: 'Dung lượng', label: 'Dung lượng' },
    { key: 'rgb', spec: 'LED RGB', label: 'LED RGB' }
  ],
  vga: [
    { key: 'gpu', spec: 'GPU', label: 'GPU' },
    { key: 'vram', spec: 'VRAM', label: 'VRAM' },
    { key: 'fan', spec: 'Số quạt', label: 'Số quạt' }
  ],
  'o-cung': [
    { key: 'loai', spec: 'Loại', label: 'Loại' },
    { key: 'dl', spec: 'Dung lượng', label: 'Dung lượng' },
    { key: 'chuan', spec: 'Chuẩn', label: 'Chuẩn' }
  ],
  nguon: [
    { key: 'w', spec: 'Công suất', label: 'Công suất' },
    { key: 'cert', spec: 'Chứng nhận', label: 'Chứng nhận' },
    { key: 'day', spec: 'Kiểu dây', label: 'Kiểu dây' }
  ],
  case: [
    { key: 'kieu', spec: 'Kiểu', label: 'Kiểu' },
    { key: 'main', spec: 'Mainboard hỗ trợ', label: 'Mainboard hỗ trợ', split: true }
  ],
  'tan-nhiet': [
    { key: 'loai', spec: 'Loại', label: 'Loại' },
    { key: 'socket', spec: 'Socket hỗ trợ', label: 'Socket hỗ trợ', split: true }
  ]
};

// Số tiền giảm của mã giảm giá — PHẢI khớp với voucherMatch()/capDiscount() trong firestore.rules.
//   type 'percent': value% của tạm tính (làm tròn xuống), tối đa maxDiscount (0 = không giới hạn)
//   type 'fixed':   value đồng
// Không bao giờ giảm quá tạm tính.
export function voucherDiscount(v, subtotal) {
  const raw = v.type === 'percent' ? Math.floor(subtotal * v.value / 100) : v.value;
  const capped = v.maxDiscount > 0 && raw > v.maxDiscount ? v.maxDiscount : raw;
  return Math.min(capped, subtotal);
}

/** Lý do mã không dùng được (null nếu dùng được). */
export function voucherProblem(v, subtotal, now = Date.now()) {
  if (!v || v.active !== true) return 'Mã giảm giá không tồn tại hoặc đã ngừng áp dụng.';
  if (v.startAt?.toMillis?.() > now) return 'Mã giảm giá chưa tới thời gian áp dụng.';
  if (v.endAt?.toMillis?.() < now) return 'Mã giảm giá đã hết hạn.';
  if (subtotal < v.minOrder) return `Mã chỉ áp dụng cho đơn từ ${new Intl.NumberFormat('vi-VN').format(v.minOrder)}₫.`;
  return null;
}
