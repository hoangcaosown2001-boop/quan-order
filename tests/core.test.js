// Test logic thuần: chạy bằng `node --test`
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const MENU = require('../menu.js');

const GIO = 3600000;
// 10:00 sáng giờ VN ngày 2026-10-06 = 03:00 UTC
const SANG = Date.UTC(2026, 9, 6, 3, 0);

function trangThai(now = SANG) {
  return C.khoiTao(null, MENU, now);
}
function khachDangChon(st) {
  return C.timKhach(st, st.dangChon);
}
function cham(st, monId) {
  return C.capNhatKhach(st, C.themMon(khachDangChon(st), monId));
}

test('menu: đủ 8 nhóm, 49 món, đúng thứ tự và món bán chạy', () => {
  assert.equal(MENU.nhom.length, 8);
  assert.equal(MENU.mon.length, 49);
  const nhom = C.nhomVaMon(MENU);
  assert.deepEqual(nhom.map((n) => n.ten), ['Cà phê Việt', 'Signature', 'Cà phê Ý', 'Nước ép', 'Kem', 'Tea', 'Matcha', 'Healthy Smoothies']);
  assert.equal(nhom.slice(0, 3).reduce((s, n) => s + n.mon.length, 0), 21);
  assert.deepEqual(MENU.mon.filter((m) => m.banChay).map((m) => m.ten).sort(), ['Saigon Milk Coffee', 'VN Sữa', 'VN Đen'].sort());
  assert.equal(nhom[1].mon[0].ten, 'Saigon Milk Coffee', 'món bán chạy lên đầu nhóm');
  assert.ok(MENU.mon.filter((m) => m.nhom === 'cpviet').every((m) => m.gia === 25000), 'Cà phê Việt đồng giá');
  assert.equal(new Set(MENU.mon.map((m) => m.id)).size, 49, 'id không trùng');
});

test('màu nhóm: chữ/nền tương phản ≥ 4.5', () => {
  for (const n of MENU.nhom) {
    const chu = C.mauChu(n.mau);
    assert.ok(C.tuongPhan(n.mau, chu) >= 4.5, `${n.ten} ${n.mau} chỉ đạt ${C.tuongPhan(n.mau, chu).toFixed(2)}`);
  }
  assert.equal(C.mauChu('#F3E5C8'), '#111111');
  assert.equal(C.mauChu('#8A5A3B'), '#ffffff');
  assert.equal(C.mauChu('#1F6FD1'), '#ffffff');
});

test('định dạng tiền kiểu Việt Nam', () => {
  assert.equal(C.dinhDangTien(125000), '125.000đ');
  assert.equal(C.dinhDangTien(0), '0đ');
  assert.equal(C.dinhDangTien(1250000), '1.250.000đ');
  assert.equal(C.dinhDangK(25000), '25k');
  assert.equal(C.dinhDangK(25500), '25,5k');
  assert.equal(C.dinhDangK(0), '0đ');
});

test('tổng tiền và tóm tắt món', () => {
  let st = trangThai();
  st = cham(st, 'latte');
  st = cham(st, 'latte');
  st = cham(st, 'egg-coffee');
  st = cham(st, 'vn-sua');
  const k = khachDangChon(st);
  assert.equal(C.tongTien(k, st.menu), 38000 * 2 + 55000 + 25000);
  assert.equal(C.soLy(k), 4);
  assert.equal(C.tomTat(k, st.menu), '2 Latte · 1 Egg Coffee · 1 VN Sữa');
});

test('+1 / −1 / xuống 0 thì xóa dòng', () => {
  let k = { id: 'a', so: 1, dong: [], lichSu: [] };
  k = C.themMon(k, 'latte');
  k = C.themMon(k, 'latte');
  assert.equal(C.soLuongMon(k, 'latte'), 2);
  k = C.botMon(k, 'latte');
  assert.equal(C.soLuongMon(k, 'latte'), 1);
  k = C.botMon(k, 'latte');
  assert.equal(k.dong.length, 0, 'xóa dòng khi về 0');
  const truoc = k;
  k = C.botMon(k, 'latte');
  assert.equal(k, truoc, 'bớt món không có thì không đổi');
});

test('hoàn tác nhiều bước, mỗi khách lịch sử riêng, tối đa 50 bước', () => {
  let st = trangThai();
  st = cham(st, 'latte');
  st = cham(st, 'mocha');
  st = cham(st, 'mocha');
  const k1 = st.dangChon;
  st = C.taoKhach(st, SANG + 1000);
  st = cham(st, 'vn-den');
  st = C.chonKhach(st, k1);
  let k = khachDangChon(st);
  k = C.hoanTac(k);
  assert.equal(C.soLuongMon(k, 'mocha'), 1);
  k = C.hoanTac(k);
  assert.equal(C.soLuongMon(k, 'mocha'), 0);
  k = C.hoanTac(k);
  assert.equal(k.dong.length, 0);
  assert.equal(C.coTheHoanTac(k), false);
  assert.equal(C.hoanTac(k), k, 'hết lịch sử thì không đổi');
  // khách 2 không bị ảnh hưởng
  assert.equal(C.soLuongMon(st.khach[1], 'vn-den'), 1);
  // hoàn tác cả thao tác − trong Danh sách
  let k2 = C.botMon(C.themMon({ id: 'b', so: 2, dong: [], lichSu: [] }, 'latte'), 'latte');
  k2 = C.hoanTac(k2);
  assert.equal(C.soLuongMon(k2, 'latte'), 1);
  // giới hạn 50
  let k3 = { id: 'c', so: 3, dong: [], lichSu: [] };
  for (let i = 0; i < 70; i++) k3 = C.themMon(k3, 'latte');
  assert.equal(k3.lichSu.length, 50);
  for (let i = 0; i < 60; i++) k3 = C.hoanTac(k3);
  assert.equal(C.soLuongMon(k3, 'latte'), 20);
});

test('mệnh giá chỉ hiện loại LỚN HƠN tổng', () => {
  assert.deepEqual(C.menhGiaGoiY(25000), [50000, 100000, 200000, 500000]);
  assert.deepEqual(C.menhGiaGoiY(20000), [50000, 100000, 200000, 500000], 'bằng tổng thì không hiện');
  assert.deepEqual(C.menhGiaGoiY(5000), [10000, 20000, 50000, 100000, 200000, 500000]);
  assert.deepEqual(C.menhGiaGoiY(500000), []);
  assert.deepEqual(C.menhGiaGoiY(620000), []);
});

test('tiền thừa đúng', () => {
  assert.equal(C.tienThua(125000, 200000), 75000);
  assert.equal(C.tienThua(25000, 25000), 0);
  assert.equal(C.tienThua(80000, 50000), -30000);
  assert.equal(C.hieuSoTien('600'), 600000);
  assert.equal(C.hieuSoTien('650000'), 650000);
  assert.equal(C.hieuSoTien('650.000'), 650000);
  assert.equal(C.hieuSoTien(''), 0);
});

test('"Xong" xóa khách, chuyển sang khách kế tiếp; hoàn lại được', () => {
  let st = trangThai();
  st = C.taoKhach(st, SANG + 1);
  st = C.taoKhach(st, SANG + 2);
  const [k1, k2, k3] = st.khach;
  assert.deepEqual(st.khach.map(C.tenKhach), ['Khách 1', 'Khách 2', 'Khách 3']);
  st = C.chonKhach(st, k1.id);
  let r = C.xongKhach(st, k1.id, SANG + 3);
  assert.equal(r.st.dangChon, k2.id, 'chuyển sang khách đứng sau');
  assert.equal(r.st.khach.length, 2);
  // hoàn lại
  const lai = C.hoanLaiXong(r.st, r.banGhi);
  assert.deepEqual(lai.khach.map((k) => k.id), [k1.id, k2.id, k3.id]);
  assert.equal(lai.dangChon, k1.id);
  // khách cuối → về khách đứng trước
  r = C.xongKhach(C.chonKhach(st, k3.id), k3.id, SANG + 4);
  assert.equal(r.st.dangChon, k2.id);
  // khách duy nhất → tạo khách mới trống
  let mot = trangThai();
  mot = cham(mot, 'latte');
  r = C.xongKhach(mot, mot.dangChon, SANG + 5);
  assert.equal(r.st.khach.length, 1);
  assert.equal(r.st.khach[0].dong.length, 0);
  assert.equal(C.tenKhach(r.st.khach[0]), 'Khách 2');
  // hoàn lại thì bỏ khách mới trống
  const lai2 = C.hoanLaiXong(r.st, r.banGhi);
  assert.equal(lai2.khach.length, 1);
  assert.equal(C.tenKhach(lai2.khach[0]), 'Khách 1');
  assert.equal(C.soLuongMon(lai2.khach[0], 'latte'), 1);
});

test('số khách tăng dần, không trùng, reset sang ngày mới lúc 04:00 giờ VN', () => {
  let st = trangThai();
  for (let i = 0; i < 4; i++) st = C.taoKhach(st, SANG + i);
  assert.equal(C.tenKhach(st.khach.at(-1)), 'Khách 5');
  // xong khách 2 rồi tạo mới → Khách 6 (không dùng lại số trong ngày)
  st = C.xongKhach(st, st.khach[1].id, SANG + 10).st;
  st = C.taoKhach(st, SANG + 11);
  assert.equal(C.tenKhach(st.khach.at(-1)), 'Khách 6');

  // 03:59 sáng hôm sau giờ VN vẫn là ngày cũ
  const truoc4h = Date.UTC(2026, 9, 6, 20, 59); // 03:59 ngày 07/10 giờ VN
  assert.equal(C.ngayKinhDoanh(truoc4h), C.ngayKinhDoanh(SANG));
  const sau4h = Date.UTC(2026, 9, 6, 21, 0); // 04:00 ngày 07/10 giờ VN
  assert.notEqual(C.ngayKinhDoanh(sau4h), C.ngayKinhDoanh(SANG));
  assert.equal(C.ngayKinhDoanh(sau4h), '2026-10-07');
  assert.equal(C.ngayKinhDoanh(Date.UTC(2026, 9, 6, 16, 30)), '2026-10-06', '23:30 tối vẫn ngày cũ');

  // tạo khách sau 04:00 → đếm lại, nhưng không trùng khách đang dở
  const conDo = C.taoKhach(st, truoc4h);
  const ngayMoi = C.taoKhach(conDo, sau4h);
  const so = ngayMoi.khach.map((k) => k.so);
  assert.equal(new Set(so).size, so.length, 'không trùng số');
  assert.equal(ngayMoi.khach.at(-1).so, 2, 'số nhỏ nhất chưa dùng (Khách 1 vẫn đang dở)');

  // mở app ngày mới: bỏ khách trống, giữ khách có món
  let hom = trangThai();
  hom = cham(hom, 'latte');
  hom = C.taoKhach(hom, SANG + 1); // Khách 2 trống
  const mo = C.khoiTao(JSON.parse(JSON.stringify(hom)), MENU, sau4h);
  assert.equal(mo.khach.length, 1);
  assert.equal(mo.ngay, '2026-10-07');
  const moi = C.taoKhach(mo, sau4h + 1);
  assert.equal(C.tenKhach(moi.khach.at(-1)), 'Khách 2');
  // mở app ngày mới không còn khách → có sẵn Khách 1
  const trong = C.khoiTao(JSON.parse(JSON.stringify(trangThai())), MENU, sau4h + 5 * GIO);
  assert.deepEqual(trong.khach.map(C.tenKhach), ['Khách 1']);
});

test('mở app khôi phục khách đang dở và hỗ trợ 20+ khách', () => {
  let st = trangThai();
  for (let i = 0; i < 24; i++) st = C.taoKhach(st, SANG + i);
  st = cham(st, 'latte');
  const mo = C.khoiTao(JSON.parse(JSON.stringify(st)), MENU, SANG + 2 * GIO);
  assert.equal(mo.khach.length, 25);
  assert.equal(mo.dangChon, st.dangChon);
  assert.equal(C.soLuongMon(C.timKhach(mo, mo.dangChon), 'latte'), 1);
});

test('chuyển đổi dữ liệu cũ không mất order', () => {
  const cu = { menu: C.saoMenu(MENU), khach: [{ id: 'x', so: 3, dong: [{ monId: 'latte', soLuong: 2 }] }], dangChon: 'x', ngay: C.ngayKinhDoanh(SANG) };
  const st = C.khoiTao(cu, MENU, SANG);
  assert.equal(st.phienBan, C.PHIEN_BAN_DU_LIEU);
  assert.equal(st.khach[0].nhanBan, null);
  assert.deepEqual(st.khach[0].lichSu, []);
  assert.equal(C.tongTien(st.khach[0], st.menu), 76000);
});

test('tìm kiếm không phân biệt hoa thường và dấu', () => {
  const ds = [
    { id: 1, ten: 'Cà phê sữa đá', nhom: 'cpviet', nguyenLieu: [{ ten: 'Sữa đặc' }] },
    { id: 2, ten: 'Matcha Latte', nhom: 'matcha', nguyenLieu: [{ ten: 'Bột matcha' }, { ten: 'Sữa tươi' }] },
    { id: 3, ten: 'Trà Đào', nhom: 'tea', nguyenLieu: [{ ten: 'Đào ngâm' }] },
  ];
  assert.deepEqual(C.timCongThuc(ds, 'ca phe').map((c) => c.id), [1]);
  assert.deepEqual(C.timCongThuc(ds, 'CÀ PHÊ').map((c) => c.id), [1]);
  assert.deepEqual(C.timCongThuc(ds, 'sua').map((c) => c.id), [1, 2], 'tìm theo nguyên liệu');
  assert.deepEqual(C.timCongThuc(ds, 'dao').map((c) => c.id), [3], 'đ → d');
  assert.deepEqual(C.timCongThuc(ds, 'latte bot').map((c) => c.id), [2], 'nhiều từ');
  assert.deepEqual(C.timCongThuc(ds, '', 'tea').map((c) => c.id), [3], 'lọc nhóm');
  assert.deepEqual(C.timCongThuc(ds, 'sua', 'matcha').map((c) => c.id), [2]);
  assert.equal(C.boDau('  Đường   Nâu '), 'duong nau');
});

test('nhắc sao lưu sau 14 ngày; kiểm tra file sao lưu', () => {
  const st = trangThai();
  assert.equal(C.canNhacSaoLuu(st, SANG + 13 * 24 * GIO), false);
  assert.equal(C.canNhacSaoLuu(st, SANG + 14 * 24 * GIO), true);
  assert.equal(C.canNhacSaoLuu({ ...st, lanSaoLuu: SANG + 10 * 24 * GIO }, SANG + 14 * 24 * GIO), false);
  assert.ok(C.kiemTraSaoLuu({}));
  assert.equal(C.kiemTraSaoLuu({ ung: 'quan-order', menu: MENU, congThuc: [], anh: [] }), null);
});
