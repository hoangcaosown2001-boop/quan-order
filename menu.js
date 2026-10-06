/*
 * MENU MẶC ĐỊNH CỦA QUÁN — file duy nhất chứa menu.
 * Sửa nhanh trong app: ⚙ Cài đặt → Menu (thay đổi lưu trên điện thoại).
 * File này chỉ dùng cho lần mở app đầu tiên hoặc khi bấm "Khôi phục menu gốc".
 *
 * Mỗi món: { id, nhom, ten, gia, banChay }
 */
(function (root) {
  'use strict';

  // Nhóm + màu. 4 nhóm đầu giữ đúng màu yêu cầu; 4 nhóm sau đã chỉnh cho đủ tương phản.
  const NHOM = [
    { id: 'cpviet', ten: 'Cà phê Việt', mau: '#1F6FD1' },
    { id: 'signature', ten: 'Signature', mau: '#8A5A3B' },
    { id: 'cpy', ten: 'Cà phê Ý', mau: '#F3E5C8' },
    { id: 'nuocep', ten: 'Nước ép', mau: '#F4B400' },
    { id: 'kem', ten: 'Kem', mau: '#F48FB1' },
    { id: 'tea', ten: 'Tea', mau: '#C43D22' },
    { id: 'matcha', ten: 'Matcha', mau: '#3F7A2E' },
    { id: 'smoothie', ten: 'Healthy Smoothies', mau: '#B8A1E8' },
  ];

  // Thứ tự nhóm từ trên xuống trên màn Order.
  const THU_TU_NHOM = ['cpviet', 'signature', 'cpy', 'nuocep', 'kem', 'tea', 'matcha', 'smoothie'];

  // Nhóm | Tên | Giá | Bán chạy (x = có)
  const BANG = `
cpviet | VN Sữa | 25000 | x
cpviet | VN Đen | 25000 | x
cpviet | VN Đá | 25000 |
signature | Special Vietnam Coffee | 45000 |
signature | Egg Coffee | 55000 |
signature | White Coffee | 35000 |
signature | Saigon Milk Coffee | 25000 | x
signature | Coconut Coffee | 30000 |
signature | Salted Coffee | 35000 |
signature | Salted Coconut Coffee | 39000 |
cpy | Espresso | 25000 |
cpy | Americano | 30000 |
cpy | Long Black | 30000 |
cpy | Cappuccino | 38000 |
cpy | Latte | 38000 |
cpy | Flat White | 38000 |
cpy | Mocha | 40000 |
cpy | Dark Caramel | 40000 |
cpy | Macchiato | 40000 |
cpy | Affogato | 65000 |
cpy | Frappuccino | 65000 |
nuocep | Cam (Orange) | 39000 |
nuocep | Xoài (Mango) | 39000 |
nuocep | Dứa (Pineapple) | 39000 |
nuocep | Chanh dây (Passion) | 39000 |
nuocep | Chanh (Lemonade) | 39000 |
nuocep | Ổi (Guava) | 39000 |
nuocep | Dừa (Coconut) | 39000 |
kem | Kem 1 scoop | 30000 |
kem | Kem 2 scoop | 50000 |
kem | Yoghurt | 32000 |
kem | Cocoa | 32000 |
kem | Chocolate | 32000 |
tea | Earl Grey | 35000 |
tea | Jasmin | 35000 |
tea | Ginger | 35000 |
tea | Orange Ginger | 35000 |
matcha | Matcha Latte | 45000 |
matcha | Matcha Coconut | 50000 |
matcha | Matcha Lychee Yakult | 55000 |
matcha | Strawberry Coconut Matcha | 55000 |
smoothie | Strawberry Yoghurt | 45000 |
smoothie | Mango Yoghurt | 45000 |
smoothie | Banana Strawberry Yoghurt | 45000 |
smoothie | Banana Ice Cream Chocomint | 45000 |
smoothie | Mango Ice Cream Coconut | 45000 |
smoothie | Avocado Ice Cream Coconut | 45000 |
smoothie | Lemonade Ice Cream Coconut | 45000 |
smoothie | Passion Ice Cream Coconut | 45000 |
`;

  // Tạo id ổn định từ tên: "Cam (Orange)" → "cam-orange"
  function taoId(ten) {
    return ten.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  const MON = BANG.trim().split('\n').map(function (dong) {
    const o = dong.split('|').map(function (s) { return s.trim(); });
    return { id: taoId(o[1]), nhom: o[0], ten: o[1], gia: Number(o[2]), banChay: o[3] === 'x' };
  });

  const MENU = { phienBanMenu: 1, nhom: NHOM, thuTuNhom: THU_TU_NHOM, mon: MON };

  if (typeof module === 'object' && module.exports) module.exports = MENU;
  else root.MENU_MAC_DINH = MENU;
})(typeof self !== 'undefined' ? self : this);
