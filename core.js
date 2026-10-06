/*
 * core.js — logic thuần (không đụng giao diện) để dễ viết test.
 * Tiền, khách, hoàn tác, thanh toán, đổi ngày, tìm kiếm, chuyển đổi dữ liệu.
 * Các hàm không sửa dữ liệu đầu vào: luôn trả về object mới.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Core = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PHIEN_BAN_DU_LIEU = 1;
  const MENH_GIA = [10000, 20000, 50000, 100000, 200000, 500000];
  const MENH_GIA_BANG = [50000, 100000, 200000, 500000]; // bảng nút ở màn thanh toán
  const MAX_LICH_SU = 50;
  const LECH_GIO_VN = 7; // Asia/Ho_Chi_Minh = UTC+7, không có giờ mùa hè
  const GIO_DOI_NGAY = 4; // ngày mới bắt đầu lúc 04:00 sáng

  /* ---------- Tiền ---------- */

  // 125000 → "125.000"
  function dinhDangSo(n) {
    const am = n < 0;
    const s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (am ? '-' : '') + s;
  }

  // 125000 → "125.000đ"
  function dinhDangTien(n) {
    return dinhDangSo(n) + 'đ';
  }

  // 25000 → "25k", 25500 → "25,5k", 0 → "0đ"
  function dinhDangK(n) {
    if (!n) return '0đ';
    const k = n / 1000;
    if (Number.isInteger(k)) return dinhDangSo(k) + 'k';
    return String(Math.round(k * 10) / 10).replace('.', ',') + 'k';
  }

  /* ---------- Menu ---------- */

  function timMon(menu, monId) {
    for (let i = 0; i < menu.mon.length; i++) if (menu.mon[i].id === monId) return menu.mon[i];
    return null;
  }

  // Danh sách nhóm theo thuTuNhom, mỗi nhóm kèm món; món bán chạy lên đầu (giữ thứ tự gốc).
  function nhomVaMon(menu) {
    const ketQua = [];
    const daCo = new Set();
    const thuTu = (menu.thuTuNhom || []).concat(menu.nhom.map(function (n) { return n.id; }));
    thuTu.forEach(function (id) {
      if (daCo.has(id)) return;
      const nhom = menu.nhom.find(function (n) { return n.id === id; });
      if (!nhom) return;
      daCo.add(id);
      const mon = menu.mon.filter(function (m) { return m.nhom === id; });
      const banChay = mon.filter(function (m) { return m.banChay; });
      const thuong = mon.filter(function (m) { return !m.banChay; });
      ketQua.push(Object.assign({}, nhom, { mon: banChay.concat(thuong) }));
    });
    return ketQua;
  }

  // Tạo id mới cho món/nhóm do người dùng thêm
  function taoIdMoi(tienTo, daCo) {
    let id;
    do { id = tienTo + Math.random().toString(36).slice(2, 8); } while (daCo && daCo.indexOf(id) >= 0);
    return id;
  }

  /* ---------- Màu ---------- */

  function doSang(hex) {
    const h = String(hex).replace('#', '');
    const day = h.length === 3 ? h.split('').map(function (c) { return c + c; }).join('') : h;
    const kenh = [0, 2, 4].map(function (i) {
      const v = parseInt(day.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * kenh[0] + 0.7152 * kenh[1] + 0.0722 * kenh[2];
  }

  // Tỉ lệ tương phản WCAG giữa 2 màu
  function tuongPhan(a, b) {
    const la = doSang(a), lb = doSang(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // Chọn chữ đen hay trắng cho nền
  function mauChu(nen) {
    return tuongPhan(nen, '#ffffff') >= tuongPhan(nen, '#111111') ? '#ffffff' : '#111111';
  }

  /* ---------- Order của 1 khách ---------- */

  // Tên tự đặt (nếu có), không thì "Khách N"
  function tenKhach(k) {
    return (k.ten && String(k.ten).trim()) || 'Khách ' + k.so;
  }

  // Đổi tên khách; để trống thì quay về "Khách N"
  function doiTenKhach(st, id, ten) {
    const sach = String(ten == null ? '' : ten).replace(/\s+/g, ' ').trim().slice(0, 24);
    return Object.assign({}, st, {
      khach: st.khach.map(function (k) { return k.id === id ? Object.assign({}, k, { ten: sach || null }) : k; }),
    });
  }

  // Đổi số lượng 1 món (không ghi lịch sử). Về 0 thì xóa dòng.
  function doiSoLuong(khach, monId, delta) {
    const dong = khach.dong.slice();
    const i = dong.findIndex(function (d) { return d.monId === monId; });
    if (i < 0) {
      if (delta > 0) dong.push({ monId: monId, soLuong: delta, ghiChu: null });
    } else {
      const sl = dong[i].soLuong + delta;
      if (sl <= 0) dong.splice(i, 1);
      else dong[i] = Object.assign({}, dong[i], { soLuong: sl });
    }
    return Object.assign({}, khach, { dong: dong });
  }

  function ghiLichSu(khach, buoc) {
    const ls = (khach.lichSu || []).concat([buoc]);
    if (ls.length > MAX_LICH_SU) ls.splice(0, ls.length - MAX_LICH_SU);
    return Object.assign({}, khach, { lichSu: ls });
  }

  // +1 ly (chạm ô món)
  function themMon(khach, monId) {
    return ghiLichSu(doiSoLuong(khach, monId, 1), { loai: '+', monId: monId });
  }

  // −1 ly (nút − trong Danh sách)
  function botMon(khach, monId) {
    if (soLuongMon(khach, monId) <= 0) return khach;
    return ghiLichSu(doiSoLuong(khach, monId, -1), { loai: '-', monId: monId });
  }

  // Hoàn tác bước gần nhất của khách
  function hoanTac(khach) {
    const ls = (khach.lichSu || []).slice();
    const buoc = ls.pop();
    if (!buoc) return khach;
    const k = doiSoLuong(khach, buoc.monId, buoc.loai === '+' ? -1 : 1);
    return Object.assign({}, k, { lichSu: ls });
  }

  function coTheHoanTac(khach) {
    return !!(khach && khach.lichSu && khach.lichSu.length);
  }

  function soLuongMon(khach, monId) {
    const d = khach.dong.find(function (x) { return x.monId === monId; });
    return d ? d.soLuong : 0;
  }

  function soLy(khach) {
    return khach.dong.reduce(function (s, d) { return s + d.soLuong; }, 0);
  }

  function tongTien(khach, menu) {
    return khach.dong.reduce(function (s, d) {
      const m = timMon(menu, d.monId);
      return s + (m ? m.gia * d.soLuong : 0);
    }, 0);
  }

  // "2 Latte · 1 Egg Coffee"
  function tomTat(khach, menu) {
    return khach.dong.map(function (d) {
      const m = timMon(menu, d.monId);
      return d.soLuong + ' ' + (m ? m.ten : 'Món đã xóa');
    }).join(' · ');
  }

  /* ---------- Thanh toán ---------- */

  // Chỉ các mệnh giá LỚN HƠN tổng
  function menhGiaGoiY(tong) {
    return MENH_GIA.filter(function (m) { return m > tong; });
  }

  // Bấm thêm 1 tờ: cộng dồn (50k + 50k = 100k)
  function congMenhGia(dangCo, menhGia) {
    return (dangCo || 0) + menhGia;
  }

  // Tiền thối lại (âm = khách đưa thiếu)
  function tienThua(tong, khachDua) {
    return khachDua - tong;
  }

  // Ô nhập tay: số nhỏ hơn 1000 hiểu là nghìn ("600" → 600.000đ)
  function hieuSoTien(chuoi) {
    const n = Number(String(chuoi).replace(/[^\d]/g, ''));
    if (!n) return 0;
    return n < 1000 ? n * 1000 : n;
  }

  /* ---------- Ngày & khách ---------- */

  // Ngày kinh doanh theo giờ VN, đổi ngày lúc 04:00. Trả "YYYY-MM-DD".
  function ngayKinhDoanh(ms) {
    return new Date(ms + (LECH_GIO_VN - GIO_DOI_NGAY) * 3600000).toISOString().slice(0, 10);
  }

  function timKhach(st, id) {
    return st.khach.find(function (k) { return k.id === id; }) || null;
  }

  // Thêm "Khách N" mới (N tăng dần trong ngày, không trùng khách đang có) và chọn khách đó
  function taoKhach(st, now) {
    const ngay = ngayKinhDoanh(now);
    let dem = st.ngay === ngay ? (st.demKhach || 0) : 0;
    const dangDung = new Set(st.khach.map(function (k) { return k.so; }));
    do { dem++; } while (dangDung.has(dem));
    const k = { id: 'k' + now.toString(36) + '_' + dem, so: dem, dong: [], lichSu: [], nhanBan: null };
    return Object.assign({}, st, { ngay: ngay, demKhach: dem, khach: st.khach.concat([k]), dangChon: k.id });
  }

  function chonKhach(st, id) {
    if (!timKhach(st, id)) return st;
    return Object.assign({}, st, { dangChon: id });
  }

  // Thay 1 khách bằng phiên bản mới (sau khi thêm/bớt món)
  function capNhatKhach(st, khachMoi) {
    return Object.assign({}, st, {
      khach: st.khach.map(function (k) { return k.id === khachMoi.id ? khachMoi : k; }),
    });
  }

  // "Xong": xóa khách, chuyển sang khách đứng sau (hoặc trước); hết khách thì tạo khách mới.
  // Trả { st, banGhi } — banGhi dùng cho "Hoàn lại".
  function xongKhach(st, khachId, now) {
    const viTri = st.khach.findIndex(function (k) { return k.id === khachId; });
    if (viTri < 0) return { st: st, banGhi: null };
    const khach = st.khach[viTri];
    const conLai = st.khach.filter(function (k) { return k.id !== khachId; });
    let moi = Object.assign({}, st, { khach: conLai });
    let khachMoiId = null;
    if (!conLai.length) {
      moi = taoKhach(moi, now);
      khachMoiId = moi.dangChon;
    } else if (st.dangChon === khachId) {
      const ke = conLai[viTri] || conLai[viTri - 1];
      moi.dangChon = ke.id;
    }
    return { st: moi, banGhi: { khach: khach, viTri: viTri, khachMoiId: khachMoiId, dangChonTruoc: st.dangChon } };
  }

  // Khôi phục khách vừa "Xong" nhầm
  function hoanLaiXong(st, banGhi) {
    if (!banGhi || timKhach(st, banGhi.khach.id)) return st;
    let ds = st.khach.slice();
    if (banGhi.khachMoiId) {
      const kMoi = ds.find(function (k) { return k.id === banGhi.khachMoiId; });
      if (kMoi && !kMoi.dong.length) ds = ds.filter(function (k) { return k.id !== banGhi.khachMoiId; });
    }
    const viTri = Math.min(banGhi.viTri, ds.length);
    ds.splice(viTri, 0, banGhi.khach);
    return Object.assign({}, st, { khach: ds, dangChon: banGhi.khach.id });
  }

  /* ---------- Trạng thái app & chuyển đổi phiên bản ---------- */

  function saoMenu(menu) {
    return JSON.parse(JSON.stringify({ nhom: menu.nhom, thuTuNhom: menu.thuTuNhom, mon: menu.mon }));
  }

  function trangThaiMoi(menuMacDinh, now) {
    return {
      phienBan: PHIEN_BAN_DU_LIEU,
      menu: saoMenu(menuMacDinh),
      khach: [],
      dangChon: null,
      ngay: ngayKinhDoanh(now),
      demKhach: 0,
      giaoDien: 'tu-dong',
      ngayBatDau: now,
      lanSaoLuu: null,
      lanNhacSaoLuu: null,
    };
  }

  // Nâng dữ liệu cũ lên phiên bản hiện tại (thêm bước mới ở đây khi đổi cấu trúc).
  function chuyenDoi(raw, menuMacDinh, now) {
    if (!raw || typeof raw !== 'object' || !raw.menu) return trangThaiMoi(menuMacDinh, now);
    const st = JSON.parse(JSON.stringify(raw));
    if (!st.phienBan) st.phienBan = 1;
    // Ví dụ sau này: if (st.phienBan < 2) { ...đổi cấu trúc...; st.phienBan = 2; }
    const macDinh = trangThaiMoi(menuMacDinh, now);
    Object.keys(macDinh).forEach(function (k) { if (st[k] === undefined) st[k] = macDinh[k]; });
    if (!Array.isArray(st.khach)) st.khach = [];
    st.khach = st.khach.map(function (k) {
      return Object.assign({ dong: [], lichSu: [], nhanBan: null }, k);
    });
    if (!Array.isArray(st.menu.thuTuNhom)) st.menu.thuTuNhom = st.menu.nhom.map(function (n) { return n.id; });
    return st;
  }

  // Mở app: chuyển đổi, sang ngày mới thì bỏ khách trống, luôn có ít nhất 1 khách.
  function khoiTao(raw, menuMacDinh, now) {
    let st = chuyenDoi(raw, menuMacDinh, now);
    const homNay = ngayKinhDoanh(now);
    if (st.ngay !== homNay) {
      st = Object.assign({}, st, {
        ngay: homNay,
        demKhach: 0,
        khach: st.khach.filter(function (k) { return k.dong.length > 0; }),
      });
    }
    if (!st.khach.length) st = taoKhach(st, now);
    if (!timKhach(st, st.dangChon)) st = Object.assign({}, st, { dangChon: st.khach[0].id });
    return st;
  }

  /* ---------- Tìm kiếm không dấu ---------- */

  // "Cà Phê Đá" → "ca phe da"
  function boDau(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Lọc công thức theo chữ (tên + nguyên liệu) và nhóm
  function timCongThuc(ds, tuKhoa, nhomId) {
    const tu = boDau(tuKhoa).split(' ').filter(Boolean);
    return ds.filter(function (ct) {
      if (nhomId && ct.nhom !== nhomId) return false;
      if (!tu.length) return true;
      const chu = boDau([ct.ten].concat((ct.nguyenLieu || []).map(function (n) { return n.ten; })).join(' '));
      return tu.every(function (t) { return chu.indexOf(t) >= 0; });
    });
  }

  /* ---------- Nhắc sao lưu ---------- */

  const NGAY_NHAC_SAO_LUU = 14;

  function canNhacSaoLuu(st, now) {
    const moc = st.lanSaoLuu || st.ngayBatDau || now;
    return now - moc >= NGAY_NHAC_SAO_LUU * 86400000;
  }

  // Kiểm tra file sao lưu có đúng định dạng không
  function kiemTraSaoLuu(d) {
    if (!d || d.ung !== 'quan-order') return 'File không phải bản sao lưu của app';
    if (!d.menu || !Array.isArray(d.menu.mon) || !Array.isArray(d.menu.nhom)) return 'File thiếu menu';
    if (!Array.isArray(d.congThuc)) return 'File thiếu công thức';
    if (!Array.isArray(d.anh)) return 'File thiếu ảnh';
    return null;
  }

  return {
    PHIEN_BAN_DU_LIEU: PHIEN_BAN_DU_LIEU, MENH_GIA: MENH_GIA, MENH_GIA_BANG: MENH_GIA_BANG, MAX_LICH_SU: MAX_LICH_SU,
    dinhDangSo: dinhDangSo, dinhDangTien: dinhDangTien, dinhDangK: dinhDangK,
    timMon: timMon, nhomVaMon: nhomVaMon, taoIdMoi: taoIdMoi,
    doSang: doSang, tuongPhan: tuongPhan, mauChu: mauChu,
    tenKhach: tenKhach, doiTenKhach: doiTenKhach, themMon: themMon, botMon: botMon, hoanTac: hoanTac, coTheHoanTac: coTheHoanTac,
    soLuongMon: soLuongMon, soLy: soLy, tongTien: tongTien, tomTat: tomTat,
    menhGiaGoiY: menhGiaGoiY, congMenhGia: congMenhGia, tienThua: tienThua, hieuSoTien: hieuSoTien,
    ngayKinhDoanh: ngayKinhDoanh, timKhach: timKhach, taoKhach: taoKhach, chonKhach: chonKhach,
    capNhatKhach: capNhatKhach, xongKhach: xongKhach, hoanLaiXong: hoanLaiXong,
    saoMenu: saoMenu, trangThaiMoi: trangThaiMoi, chuyenDoi: chuyenDoi, khoiTao: khoiTao,
    boDau: boDau, timCongThuc: timCongThuc,
    canNhacSaoLuu: canNhacSaoLuu, kiemTraSaoLuu: kiemTraSaoLuu,
  };
});
