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
export const MAX_LINES = 10;   // số dòng sản phẩm khác nhau trong 1 đơn
export const MAX_QTY = 10;     // số lượng tối đa mỗi dòng
