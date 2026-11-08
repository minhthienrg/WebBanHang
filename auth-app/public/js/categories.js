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
