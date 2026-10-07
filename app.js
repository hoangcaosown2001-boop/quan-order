/*
 * app.js — giao diện: Order, Thanh toán, Công thức, Cài đặt.
 * Logic tính toán nằm ở core.js; menu mặc định ở menu.js.
 */
(function () {
  'use strict';

  const C = window.Core;
  const PHIEN_BAN_APP = '1.1.0';
  const KHOA = 'quanOrder.trangThai';
  const KHOA_CT = 'quanOrder.congThuc';
  const BANG_MAU = ['#1F6FD1', '#8A5A3B', '#F3E5C8', '#F4B400', '#F48FB1', '#C43D22',
    '#3F7A2E', '#B8A1E8', '#0E7C86', '#5B4BB7', '#9BD3F5', '#3A3A3A'];

  const $ = (s, r) => (r || document).querySelector(s);

  // Tạo phần tử nhanh: el('div', {class:'a', text:'..', onclick: fn}, con...)
  function el(tag, thuocTinh, ...con) {
    const e = document.createElement(tag);
    if (thuocTinh) {
      for (const k in thuocTinh) {
        const v = thuocTinh[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k === 'value') e.value = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of con) if (c != null && c !== false) e.append(c);
    return e;
  }

  /* ================= LƯU TRỮ ================= */

  let st; // trạng thái order + menu (localStorage)
  let ct; // công thức (localStorage, ảnh ở IndexedDB)

  function docJSON(khoa) {
    try { return JSON.parse(localStorage.getItem(khoa)); } catch (e) { return null; }
  }

  function ghi(khoa, giaTri) {
    try {
      localStorage.setItem(khoa, JSON.stringify(giaTri));
      if (dangCanhBaoLuu) { dangCanhBaoLuu = false; $('#canhBao').hidden = true; }
      return true;
    } catch (e) {
      dangCanhBaoLuu = true;
      const cb = $('#canhBao');
      cb.textContent = '⚠ Bộ nhớ đầy, KHÔNG lưu được! Vào ⚙ để sao lưu rồi xóa bớt ảnh/công thức.';
      cb.hidden = false;
      return false;
    }
  }
  let dangCanhBaoLuu = false;

  // Cập nhật giao diện trước, lưu ngay sau đó (gộp các lần chạm liên tiếp)
  let henLuu = 0;
  function luuSau() {
    if (!henLuu) henLuu = setTimeout(luuNgay, 30);
  }
  function luuNgay() {
    clearTimeout(henLuu);
    henLuu = 0;
    ghi(KHOA, st);
  }
  function luuCT() { ghi(KHOA_CT, ct); }

  // IndexedDB cho ảnh: { id, anh: Blob, nho: Blob }
  const Kho = (function () {
    let hua = null;
    function mo() {
      if (!hua) {
        hua = new Promise(function (ok, loi) {
          const r = indexedDB.open('quanOrder', 1);
          r.onupgradeneeded = function () { r.result.createObjectStore('anh', { keyPath: 'id' }); };
          r.onsuccess = function () { ok(r.result); };
          r.onerror = function () { loi(r.error); };
        });
      }
      return hua;
    }
    async function giaoDich(cheDo, viec) {
      const db = await mo();
      return new Promise(function (ok, loi) {
        const t = db.transaction('anh', cheDo);
        const yc = viec(t.objectStore('anh'));
        t.oncomplete = function () { ok(yc ? yc.result : undefined); };
        t.onerror = function () { loi(t.error); };
        t.onabort = function () { loi(t.error || new Error('Hủy ghi ảnh')); };
      });
    }
    return {
      lay: (id) => giaoDich('readonly', (s) => s.get(id)),
      tatCa: () => giaoDich('readonly', (s) => s.getAll()),
      luu: (ban) => giaoDich('readwrite', (s) => { s.put(ban); }),
      luuNhieu: (ds) => giaoDich('readwrite', (s) => { ds.forEach((b) => s.put(b)); }),
      xoa: (ids) => giaoDich('readwrite', (s) => { [].concat(ids).forEach((id) => s.delete(id)); }),
      xoaHet: () => giaoDich('readwrite', (s) => { s.clear(); }),
    };
  })();

  // Lấy URL ảnh (có bộ nhớ đệm). kieu: 'nho' (thumbnail) | 'anh' (ảnh lớn)
  const urlDem = new Map();
  async function urlAnh(id, kieu) {
    const khoa = id + ':' + kieu;
    if (urlDem.has(khoa)) return urlDem.get(khoa);
    const ban = await Kho.lay(id);
    if (!ban || !ban[kieu]) return '';
    const u = URL.createObjectURL(ban[kieu]);
    urlDem.set(khoa, u);
    return u;
  }
  function boUrl(id) {
    ['nho', 'anh'].forEach(function (k) {
      const u = urlDem.get(id + ':' + k);
      if (u) { URL.revokeObjectURL(u); urlDem.delete(id + ':' + k); }
    });
  }
  function datAnh(img, id, kieu) {
    urlAnh(id, kieu).then(function (u) { if (u) img.src = u; }).catch(function () {});
  }

  /* ================= XỬ LÝ ẢNH ================= */

  // Thu nhỏ ảnh về cạnh dài tối đa, xuất JPEG
  function veLai(nguon, canhMax, chatLuong) {
    const w = nguon.naturalWidth || nguon.width;
    const h = nguon.naturalHeight || nguon.height;
    const tl = Math.min(1, canhMax / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * tl));
    c.height = Math.max(1, Math.round(h * tl));
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(nguon, 0, 0, c.width, c.height);
    return new Promise(function (ok, loi) {
      c.toBlob(function (b) { b ? ok(b) : loi(new Error('Không tạo được ảnh')); }, 'image/jpeg', chatLuong);
    });
  }

  // Giải mã ảnh, giữ đúng chiều theo EXIF (trình duyệt hiện đại tự xoay khi vẽ <img>)
  async function giaiMa(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return { nguon: img, xong: () => URL.revokeObjectURL(url) };
    } catch (e) {
      URL.revokeObjectURL(url);
      const bm = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { nguon: bm, xong: () => bm.close && bm.close() };
    }
  }

  function idAnhMoi() {
    return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function xuLyAnh(file) {
    const gm = await giaiMa(file);
    try {
      const anh = await veLai(gm.nguon, 1200, 0.8);
      const nho = await veLai(gm.nguon, 400, 0.75);
      return { id: idAnhMoi(), anh: anh, nho: nho };
    } finally { gm.xong(); }
  }

  /* ================= TIỆN ÍCH GIAO DIỆN ================= */

  function khachHienTai() { return C.timKhach(st, st.dangChon); }
  function nhomTheoId(id) { return st.menu.nhom.find((n) => n.id === id) || null; }

  // Thông báo nhỏ phía trên thanh dưới (1 cái mỗi lúc)
  let henThongBao = 0;
  function thongBao(chu, nhanNut, hanhDong, ms) {
    const vung = $('#vungThongBao');
    vung.textContent = '';
    clearTimeout(henThongBao);
    const tb = el('div', { class: 'thong-bao', role: 'status' }, el('span', { text: chu }));
    if (nhanNut) {
      tb.append(el('button', {
        type: 'button', text: nhanNut,
        onclick: function () { vung.textContent = ''; clearTimeout(henThongBao); hanhDong(); },
      }));
    }
    vung.append(tb);
    henThongBao = setTimeout(function () { vung.textContent = ''; }, ms || 3000);
  }

  // Ô món nháy nhẹ khi được chạm
  function nhay(o) {
    if (o.animate) {
      o.animate([{ filter: 'brightness(1.45)', transform: 'scale(.95)' }, { filter: 'none', transform: 'none' }],
        { duration: 220, easing: 'ease-out' });
    }
  }

  /* ---------- Bottom sheet ---------- */

  let sheetDangMo = null; // { ve, khiDong }
  function moSheet(ve, khiDong) {
    sheetDangMo = { ve: ve, khiDong: khiDong };
    const nd = $('#noiDungSheet');
    nd.textContent = '';
    $('#nenSheet').hidden = false;
    $('#sheet').hidden = false;
    $('#sheet').style.transform = '';
    nd.scrollTop = 0;
    ve(nd); // vẽ sau khi hiện để ô nhập focus được (bật bàn phím ngay)
  }
  // Vừa đóng sheet: bỏ qua chạm trong 0,35 giây để chạm đúp vào "Xong" không rơi xuống nút bên dưới
  let henChan = 0;
  function chanChamXuyen() {
    document.body.classList.add('chan-cham');
    clearTimeout(henChan);
    henChan = setTimeout(() => document.body.classList.remove('chan-cham'), 350);
  }

  function veLaiSheet() {
    if (!sheetDangMo) return;
    const nd = $('#noiDungSheet');
    const cuon = nd.scrollTop;
    nd.textContent = '';
    sheetDangMo.ve(nd);
    nd.scrollTop = cuon;
  }
  function dongSheet() {
    if (!sheetDangMo) return;
    const kd = sheetDangMo.khiDong;
    sheetDangMo = null;
    $('#nenSheet').hidden = true;
    $('#sheet').hidden = true;
    $('#noiDungSheet').textContent = '';
    chanChamXuyen();
    if (kd) kd();
  }

  // Vuốt xuống để đóng sheet
  (function ganVuotSheet() {
    const sh = $('#sheet');
    let y0 = null, dy = 0, keo = false;
    sh.addEventListener('touchstart', function (e) {
      const nd = $('#noiDungSheet');
      const tuTayKeo = e.target.closest('.tay-keo');
      if (!tuTayKeo && nd.scrollTop > 0) { y0 = null; return; }
      if (e.target.closest('input, textarea, select')) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0; keo = false;
    }, { passive: true });
    sh.addEventListener('touchmove', function (e) {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 8) keo = true;
      if (keo) {
        sh.style.transition = 'none';
        sh.style.transform = 'translateY(' + Math.max(0, dy) + 'px)';
      }
    }, { passive: true });
    sh.addEventListener('touchend', function () {
      if (y0 == null) return;
      sh.style.transition = '';
      if (keo && dy > 90) dongSheet();
      else sh.style.transform = '';
      y0 = null;
    });
    $('#nenSheet').addEventListener('click', dongSheet);
  })();

  /* ================= MÀN ORDER ================= */

  const oTheoMon = new Map(); // monId → ô món
  let canCanChu = false;

  // Vẽ lại toàn bộ lưới menu (khi mở app hoặc sửa menu)
  function veLuoi() {
    const luoi = $('#luoiMenu');
    luoi.textContent = '';
    oTheoMon.clear();
    const frag = document.createDocumentFragment();
    C.nhomVaMon(st.menu).forEach(function (nhom) {
      if (!nhom.mon.length) return;
      const chu = C.mauChu(nhom.mau);
      const luoiNhom = el('div', { class: 'nhom-luoi' });
      nhom.mon.forEach(function (m) {
        const o = el('button', {
          type: 'button', class: 'o-mon' + (m.banChay ? ' ban-chay' : ''), 'data-mon': m.id,
          style: 'background:' + nhom.mau + ';color:' + chu,
        },
        el('span', { class: 'ten', text: m.ten }),
        el('span', { class: 'gia', text: C.dinhDangK(m.gia) + (m.banChay ? '  ★' : '') }));
        luoiNhom.append(o);
        oTheoMon.set(m.id, o);
      });
      frag.append(el('section', { class: 'nhom-khoi', 'data-nhom': nhom.id },
        el('div', { class: 'nhom-tieu-de' }, el('i', { style: 'background:' + nhom.mau }), nhom.ten),
        luoiNhom));
    });
    luoi.append(frag);
    canCanChu = true;
    canChuTen();
    capNhatHuyHieu();
  }

  // Tên dài quá 2 dòng thì thu nhỏ chữ (đo 1 lần sau khi vẽ)
  function canChuTen() {
    if (!canCanChu || !$('#manOrder').classList.contains('hien')) return;
    canCanChu = false;
    oTheoMon.forEach(function (o) {
      if (o.classList.contains('ban-chay')) return;
      const t = o.firstChild;
      const tran = () => t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1;
      if (!tran()) return;
      t.classList.add('nho1');
      if (!tran()) return;
      t.classList.replace('nho1', 'nho2');
      if (tran()) t.classList.add('ngat');
    });
  }

  // Huy hiệu trên ô: "×2" (Ice) và "🔥1" (Hot) riêng
  function datHuyHieu(o, slDa, slNong) {
    let hh = o.querySelector('.hh');
    if (slDa + slNong > 0) {
      if (!hh) { hh = el('span', { class: 'hh' }); o.append(hh); }
      hh.textContent = '';
      if (slNong) hh.append(el('span', { class: 'sl sl-nong', text: '🔥' + slNong }));
      if (slDa) hh.append(el('span', { class: 'sl', text: '×' + slDa }));
      hh.classList.toggle('hai', !!(slDa && slNong));
      o.classList.add('co');
    } else if (hh) {
      hh.remove();
      o.classList.remove('co');
    }
  }
  function huyHieuMon(o, k, id) {
    const nong = C.soLuongDong(k, id, 'hot');
    datHuyHieu(o, C.soLuongMon(k, id) - nong, nong);
  }

  // Huy hiệu số lượng của khách đang chọn trên mọi ô
  function capNhatHuyHieu() {
    const k = khachHienTai();
    oTheoMon.forEach(function (o, id) { huyHieuMon(o, k, id); });
  }

  // Nút gạt Ice / Hot ở đầu trang: áp cho các món chạm sau đó
  function veKieu() {
    document.querySelectorAll('#chonKieu button').forEach(function (b) {
      const chon = b.dataset.kieu === st.kieu;
      b.classList.toggle('chon', chon);
      b.setAttribute('aria-checked', chon ? 'true' : 'false');
    });
    document.body.classList.toggle('dang-hot', st.kieu === 'hot');
  }
  $('#chonKieu').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b || b.dataset.kieu === st.kieu) return;
    st = Object.assign({}, st, { kieu: b.dataset.kieu });
    veKieu();
    luuSau();
  });

  // Tổng tiền + tóm tắt + nút Hoàn tác/Danh sách
  function veTong() {
    const k = khachHienTai();
    const tong = C.tongTien(k, st.menu);
    const oTong = $('#soTong');
    oTong.textContent = C.dinhDangTien(tong);
    oTong.classList.toggle('dai', tong >= 1000000);
    $('#tomTat').textContent = k.dong.length ? C.tomTat(k, st.menu) : C.tenKhach(k) + ' · chạm món để thêm';
    $('#nutTong').classList.toggle('trong', !k.dong.length);
    $('#soLyDS').textContent = C.soLy(k);
    $('#nutHoanTac').disabled = !C.coTheHoanTac(k);
  }

  // Dải khách
  function veDaiKhach(cuonToi) {
    const ds = $('#dsKhach');
    ds.textContent = '';
    st.khach.forEach(function (k) {
      const chon = k.id === st.dangChon;
      const chip = el('button', {
        type: 'button', class: 'chip' + (chon ? ' chon' : ''), 'data-id': k.id, role: 'tab',
        'aria-selected': chon ? 'true' : 'false',
      }, el('span', { class: 'ten-chip', text: C.tenKhach(k) }), el('span', { text: '·' }),
      el('span', { class: 'tien-chip', text: C.dinhDangK(C.tongTien(k, st.menu)) }));
      if (chon && coNutXoa(k)) {
        chip.append(el('span', { class: 'xoa-chip', 'data-xoa': k.id, 'aria-label': 'Xóa khách', text: '✕' }));
      }
      ds.append(chip);
    });
    if (cuonToi) {
      const c = ds.querySelector('.chip.chon');
      if (c) c.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }

  // ✕ luôn có trên chip đang chọn (trừ khi chỉ còn 1 khách trống — xóa cũng như không)
  function coNutXoa(k) {
    return k.dong.length > 0 || st.khach.length > 1;
  }

  // Chỉ cập nhật chip của khách đang chọn (nhanh khi chạm món)
  function veChipHienTai() {
    const k = khachHienTai();
    const chip = $('#dsKhach').querySelector('.chip.chon');
    if (!chip) return veDaiKhach();
    chip.querySelector('.tien-chip').textContent = C.dinhDangK(C.tongTien(k, st.menu));
    const coX = !!chip.querySelector('.xoa-chip');
    if (coX !== coNutXoa(k)) veDaiKhach();
  }

  function veOrder(cuonChip) {
    veDaiKhach(cuonChip);
    capNhatHuyHieu();
    veTong();
  }

  // Chạm ô món = +1 ly (dùng click để cuộn lưới không cộng nhầm)
  $('#luoiMenu').addEventListener('click', function (e) {
    const o = e.target.closest('.o-mon');
    if (!o) return;
    const id = o.dataset.mon;
    const k = C.themMon(khachHienTai(), id, st.kieu);
    st = C.capNhatKhach(st, k);
    huyHieuMon(o, k, id);
    veTong();
    veChipHienTai();
    nhay(o);
    luuSau();
  });

  $('#dsKhach').addEventListener('click', function (e) {
    const x = e.target.closest('[data-xoa]');
    if (x) { xongKhach(x.dataset.xoa, 'Đã xóa'); return; }
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (chip.dataset.id === st.dangChon) { suaTenKhach(chip.dataset.id); return; }
    st = C.chonKhach(st, chip.dataset.id);
    veOrder(true);
    luuSau();
  });

  // Chạm chip khách đang chọn → bảng nhãn A1–D10, chạm 1 ô là đặt tên luôn
  const COT_NHAN = ['A', 'B', 'C', 'D'];
  function suaTenKhach(id) {
    const k = C.timKhach(st, id);
    if (!k) return;
    const datTen = function (ten) {
      st = C.doiTenKhach(st, id, ten);
      dongSheet();
      veOrder(true);
      luuSau();
    };
    moSheet(function (nd) {
      const dangDung = new Set(st.khach.filter((x) => x.id !== id).map((x) => x.ten).filter(Boolean));
      const bang = el('div', { class: 'bang-nhan' });
      const oNhan = function (nhan, lop) {
        bang.append(el('button', {
          type: 'button', 'data-nhan': nhan, text: nhan,
          class: (lop || '') + (k.ten === nhan ? ' chon' : '') + (dangDung.has(nhan) ? ' dang-dung' : ''),
          onclick: () => datTen(nhan),
        }));
      };
      for (let dong = 1; dong <= 10; dong++) COT_NHAN.forEach((cot) => oNhan(cot + dong));
      // Hàng cuối: khách mang đi
      for (let i = 1; i <= 4; i++) oNhan('Take away ' + i, 'mang-di');
      nd.append(el('h2', { text: 'Chọn tên cho ' + C.tenKhach(k) }), bang,
        el('div', { class: 'sheet-chan' },
          el('button', { type: 'button', class: 'nut rong', text: 'Đóng', onclick: dongSheet }),
          el('button', { type: 'button', class: 'nut rong', id: 'nutBoTen', text: 'Bỏ tên', disabled: !k.ten, onclick: () => datTen('') })));
    });
  }

  $('#nutThemKhach').addEventListener('click', function () {
    st = C.taoKhach(st, Date.now());
    veOrder(true);
    luuSau();
  });

  $('#nutHoanTac').addEventListener('click', function () {
    const k = khachHienTai();
    const buoc = k.lichSu[k.lichSu.length - 1];
    if (!buoc) return;
    st = C.capNhatKhach(st, C.hoanTac(k));
    capNhatHuyHieu();
    veTong();
    veChipHienTai();
    const o = oTheoMon.get(buoc.monId);
    if (o) nhay(o);
    luuSau();
  });

  /* ---------- Danh sách món của khách ---------- */

  function moDanhSach() {
    moSheet(function (nd) {
      const k = khachHienTai();
      nd.append(el('h2', { text: C.tenKhach(k) + ' · ' + C.soLy(k) + ' ly' }));
      if (!k.dong.length) {
        nd.append(el('div', { class: 'trong-rong', text: 'Chưa có món nào' }));
        return;
      }
      k.dong.forEach(function (d) {
        const m = C.timMon(st.menu, d.monId);
        const gia = m ? m.gia : 0;
        nd.append(el('div', { class: 'dong-ds' },
          el('div', { class: 'ten' }, m ? m.ten : 'Món đã xóa',
            d.kieu ? el('span', { class: 'tag-kieu ' + d.kieu, text: d.kieu === 'hot' ? '🔥 Hot' : '🧊 Ice' }) : null,
            el('small', { text: C.dinhDangTien(gia) })),
          el('button', { type: 'button', class: 'nut-tron', 'aria-label': 'Bớt', text: '−', onclick: () => doiDong(d.monId, d.kieu, -1) }),
          el('span', { class: 'sl', text: d.soLuong }),
          el('button', { type: 'button', class: 'nut-tron', 'aria-label': 'Thêm', text: '+', onclick: () => doiDong(d.monId, d.kieu, 1) }),
          el('span', { class: 'thanh-tien', text: C.dinhDangTien(gia * d.soLuong) })));
      });
      nd.append(el('div', { class: 'tong-ds' }, el('span', { text: 'Tổng' }), el('span', { text: C.dinhDangTien(C.tongTien(k, st.menu)) })));
      nd.append(el('div', { class: 'sheet-chan' },
        el('button', { type: 'button', class: 'nut rong', text: 'Đóng', onclick: dongSheet }),
        el('button', { type: 'button', class: 'nut chinh rong', text: 'Thu tiền', onclick: () => { dongSheet(); moThanhToan(); } })));
    });
  }

  function doiDong(monId, kieu, delta) {
    const k = khachHienTai();
    st = C.capNhatKhach(st, delta > 0 ? C.themMon(k, monId, kieu) : C.botMon(k, monId, kieu));
    capNhatHuyHieu();
    veTong();
    veChipHienTai();
    veLaiSheet();
    luuSau();
  }

  $('#nutDanhSach').addEventListener('click', moDanhSach);

  /* ---------- Thanh toán ---------- */

  // Thanh toán: bấm mệnh giá để cộng dồn (2 lần 50k = 100k) hoặc tự gõ số tiền khách đưa
  function moThanhToan() {
    const k = khachHienTai();
    if (!k.dong.length) return;
    const tong = C.tongTien(k, st.menu);
    let khachDua = 0;
    const soLan = new Map(); // mệnh giá → số lần bấm

    moSheet(function (nd) {
      const oThoi = el('div', { class: 'tien-thoi cho', id: 'tienThoi', text: 'Chọn hoặc nhập tiền khách đưa' });
      const oNhap = el('input', {
        class: 'o-nhap-tien', id: 'oKhachDua', inputmode: 'numeric', pattern: '[0-9.]*', autocomplete: 'off',
        placeholder: 'Tự nhập (150 = 150.000đ)', maxlength: 13, 'aria-label': 'Tiền khách đưa', enterkeyhint: 'done',
      });
      const nutMG = new Map();

      function hienThoi() {
        nutMG.forEach(function (b, mg) {
          const n = soLan.get(mg) || 0;
          b.classList.toggle('chon', n > 0);
          b.querySelector('.lan').textContent = n > 1 ? '×' + n : '';
        });
        if (!khachDua) { oThoi.className = 'tien-thoi cho'; oThoi.textContent = 'Chọn hoặc nhập tiền khách đưa'; return; }
        const thoi = C.tienThua(tong, khachDua);
        if (thoi === 0) { oThoi.className = 'tien-thoi'; oThoi.textContent = 'Không thối'; }
        else if (thoi > 0) { oThoi.className = 'tien-thoi'; oThoi.textContent = 'Thối lại: ' + C.dinhDangTien(thoi); }
        else { oThoi.className = 'tien-thoi thieu'; oThoi.textContent = 'Còn thiếu: ' + C.dinhDangTien(-thoi); }
      }
      function datTuNut(soTien) {
        khachDua = soTien;
        oNhap.value = soTien ? C.dinhDangSo(soTien) : '';
        hienThoi();
      }

      nd.append(el('div', { class: 'tt-dau' },
        el('span', { class: 'tt-ten', text: C.tenKhach(k) + ' · ' + C.soLy(k) + ' ly' }),
        el('span', { class: 'tt-tong', text: C.dinhDangTien(tong) })));

      const luoi = el('div', { class: 'menh-gia' });
      C.MENH_GIA_BANG.forEach(function (mg) {
        const b = el('button', { type: 'button', 'data-mg': mg }, el('span', { text: C.dinhDangK(mg) }), el('span', { class: 'lan' }));
        b.addEventListener('click', function () {
          soLan.set(mg, (soLan.get(mg) || 0) + 1);
          datTuNut(C.congMenhGia(khachDua, mg));
        });
        nutMG.set(mg, b);
        luoi.append(b);
      });
      nd.append(luoi);

      oNhap.addEventListener('input', function () {
        soLan.clear();
        khachDua = C.hieuSoTien(oNhap.value);
        hienThoi();
      });
      oNhap.addEventListener('keydown', (e) => { if (e.key === 'Enter') oNhap.blur(); });

      nd.append(el('div', { class: 'hang-nhap-tien' },
        oNhap,
        el('button', { type: 'button', class: 'nut nho', 'data-mg': 'dung', text: 'Đúng tiền', onclick: () => { soLan.clear(); datTuNut(tong); } }),
        el('button', { type: 'button', class: 'nut nho', id: 'nutNhapLai', 'aria-label': 'Nhập lại', text: '↺', onclick: () => { soLan.clear(); datTuNut(0); } })));

      nd.append(oThoi);
      nd.append(el('div', { class: 'sheet-chan' },
        el('button', { type: 'button', class: 'nut rong', text: 'Đóng', onclick: dongSheet }),
        el('button', { type: 'button', class: 'nut xanh rong', id: 'nutXong', text: '✓ Xong', onclick: () => { dongSheet(); xongKhach(k.id); } })));
    });
  }

  // Xong khách: xóa khỏi dải, chuyển khách kế tiếp, cho "Hoàn lại" trong 8 giây
  function xongKhach(id, chu) {
    const k = C.timKhach(st, id);
    if (!k) return;
    const kq = C.xongKhach(st, id, Date.now());
    st = kq.st;
    veOrder(true);
    luuSau();
    thongBao((chu || 'Đã xong') + ' ' + C.tenKhach(k), 'Hoàn lại', function () {
      st = C.hoanLaiXong(st, kq.banGhi);
      veOrder(true);
      luuSau();
    }, 8000);
  }

  $('#nutTong').addEventListener('click', moThanhToan);

  /* ================= ĐIỀU HƯỚNG ================= */

  let tabHienTai = 'order';
  function chuyenTab(ten) {
    tabHienTai = ten;
    document.querySelectorAll('.man').forEach((m) => m.classList.toggle('hien', m.dataset.man === ten));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('dang-mo', t.dataset.tab === ten));
    document.body.classList.toggle('o-order', ten === 'order');
    $('#vungThongBao').textContent = '';
    if (ten === 'order') { canChuTen(); veOrder(); }
    if (ten === 'congthuc') { veLocNhom(); veDanhSachCT(); }
    if (ten === 'caidat') veCaiDat();
  }
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', () => chuyenTab(t.dataset.tab));
  });

  /* ================= CÔNG THỨC ================= */

  let locNhom = '';

  function veLocNhom() {
    const vung = $('#locNhom');
    vung.textContent = '';
    vung.append(el('button', {
      type: 'button', class: 'tat-ca' + (!locNhom ? ' chon' : ''), text: 'Tất cả',
      onclick: () => { locNhom = ''; veLocNhom(); veDanhSachCT(); },
    }));
    C.nhomVaMon(st.menu).forEach(function (n) {
      vung.append(el('button', {
        type: 'button', class: locNhom === n.id ? 'chon' : '', text: n.ten, 'data-nhom': n.id,
        style: 'background:' + n.mau + ';color:' + C.mauChu(n.mau),
        onclick: () => { locNhom = locNhom === n.id ? '' : n.id; veLocNhom(); veDanhSachCT(); },
      }));
    });
  }

  function veDanhSachCT() {
    const luoi = $('#luoiCongThuc');
    luoi.textContent = '';
    const ds = C.timCongThuc(ct.ds, $('#oTim').value, locNhom)
      .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
    if (!ds.length) {
      luoi.append(el('div', {
        class: 'trong-rong', style: 'grid-column:1/-1',
        text: ct.ds.length ? 'Không tìm thấy công thức' : 'Chưa có công thức. Bấm + để thêm bằng ảnh.',
      }));
      return;
    }
    ds.forEach(function (c) {
      const n = nhomTheoId(c.nhom);
      const img = el('img', { class: 'anh-the', alt: '', loading: 'lazy' });
      if (c.anh[0]) datAnh(img, c.anh[0], 'nho');
      luoi.append(el('button', { type: 'button', class: 'the-ct', 'data-id': c.id, onclick: () => moChiTiet(c.id) },
        img,
        c.mau ? el('span', { class: 'nhan-mau', text: 'MẪU' }) : null,
        el('span', { class: 'ten-the' }, n ? el('i', { style: 'background:' + n.mau }) : null, c.ten)));
    });
  }

  $('#oTim').addEventListener('input', veDanhSachCT);
  $('#nutThemCT').addEventListener('click', () => moSua(null));

  /* ---------- Trang phủ + giữ sáng màn hình ---------- */

  let khoaSang = null;
  async function giuSang() {
    try { if ('wakeLock' in navigator && !khoaSang) khoaSang = await navigator.wakeLock.request('screen'); } catch (e) { khoaSang = null; }
    if (khoaSang) khoaSang.addEventListener('release', () => { khoaSang = null; });
  }
  function boGiuSang() {
    if (khoaSang) { khoaSang.release().catch(() => {}); khoaSang = null; }
  }

  let trangDangMo = null; // 'chitiet' | 'sua'
  function moTrang(loai, noiDung) {
    const tp = $('#trangPhu');
    tp.textContent = '';
    tp.append(...noiDung);
    tp.hidden = false;
    trangDangMo = loai;
    if (loai === 'chitiet') giuSang(); else boGiuSang();
  }
  function dongTrang() {
    $('#vungThongBao').textContent = '';
    $('#trangPhu').hidden = true;
    $('#trangPhu').textContent = '';
    trangDangMo = null;
    boGiuSang();
  }

  /* ---------- Chi tiết công thức ---------- */

  function moChiTiet(id) {
    const c = ct.ds.find((x) => x.id === id);
    if (!c) return;
    const n = nhomTheoId(c.nhom);
    const than = el('div', { class: 'tp-than' });

    if (c.anh.length) {
      const bia = el('img', { class: 'ct-anh-bia', alt: c.ten, onclick: () => xemAnh(c.anh, 0) });
      datAnh(bia, c.anh[0], 'anh');
      than.append(bia);
      if (c.anh.length > 1) {
        const phu = el('div', { class: 'ct-anh-phu' });
        c.anh.slice(1).forEach(function (a, i) {
          const im = el('img', { alt: '', onclick: () => xemAnh(c.anh, i + 1) });
          datAnh(im, a, 'nho');
          phu.append(im);
        });
        than.append(phu);
      }
    }
    than.append(el('div', { class: 'ct-ten', text: c.ten }));
    if (n) than.append(el('span', { class: 'ct-nhom', style: 'background:' + n.mau + ';color:' + C.mauChu(n.mau), text: n.ten }));
    if (c.mau) than.append(el('span', { class: 'nhan-mau', style: 'position:static;margin-left:6px', text: 'MẪU' }));

    if (c.ly || c.da) {
      than.append(el('div', { class: 'ct-the' },
        el('div', null, el('small', { text: 'Ly' }), el('b', { text: c.ly || '—' })),
        el('div', null, el('small', { text: 'Đá' }), el('b', { text: c.da || '—' }))));
    }
    if (c.nguyenLieu.length) {
      than.append(el('h3', { class: 'ct-muc', text: 'Nguyên liệu' }));
      const bang = el('table', { class: 'ct-nl' });
      c.nguyenLieu.forEach(function (nl) {
        bang.append(el('tr', null, el('td', { text: nl.ten }), el('td', { text: [nl.luong, nl.donVi].filter(Boolean).join(' ') })));
      });
      than.append(bang);
    }
    if (c.buoc.length) {
      than.append(el('h3', { class: 'ct-muc', text: 'Các bước' }));
      const ol = el('ol', { class: 'ct-buoc' });
      c.buoc.forEach((b) => ol.append(el('li', null, el('span', { text: b }))));
      than.append(ol);
    }
    if (c.ghiChu) {
      than.append(el('h3', { class: 'ct-muc', text: 'Ghi chú' }));
      than.append(el('div', { class: 'ct-ghi-chu', text: c.ghiChu }));
    }
    than.append(el('div', { style: 'margin-top:28px' },
      el('button', { type: 'button', class: 'nut do rong', style: 'width:100%', text: 'Xóa công thức', onclick: () => xoaCongThuc(c.id) })));

    moTrang('chitiet', [
      el('div', { class: 'tp-dau' },
        el('button', { type: 'button', text: '‹ Lại', onclick: dongTrang }),
        el('h1', { text: c.ten }),
        el('button', { type: 'button', text: 'Sửa', onclick: () => moSua(c.id) })),
      than,
      el('div', { class: 'tp-chan' },
        el('button', { type: 'button', class: 'nut rong', text: '‹ Quay lại', onclick: dongTrang }),
        el('button', { type: 'button', class: 'nut chinh rong', text: '✎ Sửa', onclick: () => moSua(c.id) })),
    ]);
  }

  async function xoaCongThuc(id) {
    const c = ct.ds.find((x) => x.id === id);
    if (!c || !confirm('Xóa công thức "' + c.ten + '"? Không lấy lại được.')) return;
    ct.ds = ct.ds.filter((x) => x.id !== id);
    luuCT();
    c.anh.forEach(boUrl);
    try { await Kho.xoa(c.anh); } catch (e) { /* ảnh thừa không ảnh hưởng */ }
    dongTrang();
    veDanhSachCT();
    thongBao('Đã xóa công thức');
  }

  /* ---------- Thêm / sửa công thức ---------- */

  function moSua(id) {
    const cu = id ? ct.ds.find((x) => x.id === id) : null;
    // Ảnh trong form: { id, moi: bool, ban?: {id, anh, nho}, url }
    const anhForm = cu ? cu.anh.map((a) => ({ id: a, moi: false })) : [];
    let dangXuLy = 0;
    let daDoi = false;

    const nhomDS = C.nhomVaMon(st.menu);
    const oTen = el('input', { class: 'bm-o', value: cu ? cu.ten : '', placeholder: 'Ví dụ: Egg Coffee', list: 'goiYTen', autocomplete: 'off', id: 'bmTen' });
    const chonNhom = el('select', { class: 'bm-chon', id: 'bmNhom' });
    nhomDS.forEach((n) => chonNhom.append(el('option', { value: n.id, text: n.ten })));
    chonNhom.value = cu ? cu.nhom : (locNhom || (nhomDS[0] && nhomDS[0].id) || '');
    oTen.addEventListener('change', function () {
      const m = st.menu.mon.find((x) => C.boDau(x.ten) === C.boDau(oTen.value));
      if (m) chonNhom.value = m.nhom;
    });
    const oLy = el('input', { class: 'bm-o', value: cu ? cu.ly : '', placeholder: 'Ví dụ: Ly 500ml', list: 'goiYLy', id: 'bmLy' });
    const oDa = el('input', { class: 'bm-o', value: cu ? cu.da : '', placeholder: 'Ví dụ: Đá viên đầy ly', list: 'goiYDa', id: 'bmDa' });
    const oGhiChu = el('textarea', { class: 'bm-vung', placeholder: 'Ghi chú thêm (không bắt buộc)', id: 'bmGhiChu' });
    oGhiChu.value = cu ? cu.ghiChu || '' : '';

    const goiY = el('div', null,
      el('datalist', { id: 'goiYTen' }, ...st.menu.mon.map((m) => el('option', { value: m.ten }))),
      el('datalist', { id: 'goiYLy' }, ...['Ly 360ml', 'Ly 500ml', 'Ly 700ml', 'Ly sứ', 'Ly thủy tinh', 'Tách nhỏ'].map((v) => el('option', { value: v }))),
      el('datalist', { id: 'goiYDa' }, ...['Đá viên đầy ly', 'Nửa ly đá', 'Ít đá', 'Đá bào', 'Không đá'].map((v) => el('option', { value: v }))),
      el('datalist', { id: 'goiYDonVi' }, ...['ml', 'g', 'shot', 'muỗng', 'thìa', 'giọt', 'lát', 'trái', 'viên'].map((v) => el('option', { value: v }))));

    // Ảnh
    const vungAnh = el('div', { class: 'bm-anh' });
    const chonFile = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, id: 'bmFileAnh' });
    chonFile.addEventListener('change', async function () {
      const files = Array.from(chonFile.files || []);
      chonFile.value = '';
      for (const f of files) {
        const tam = { id: 'dang', moi: true, dang: true };
        anhForm.push(tam);
        dangXuLy++;
        veAnh();
        try {
          const ban = await xuLyAnh(f);
          Object.assign(tam, { id: ban.id, ban: ban, url: URL.createObjectURL(ban.nho), dang: false });
          daDoi = true;
        } catch (e) {
          anhForm.splice(anhForm.indexOf(tam), 1);
          thongBao('Không đọc được ảnh này');
        }
        dangXuLy--;
        veAnh();
      }
    });
    function veAnh() {
      vungAnh.textContent = '';
      anhForm.forEach(function (a, i) {
        if (a.dang) { vungAnh.append(el('div', { class: 'o-anh dang-xu-ly', text: 'Đang xử lý…' })); return; }
        const img = el('img', { alt: '' });
        if (a.url) img.src = a.url; else datAnh(img, a.id, 'nho');
        vungAnh.append(el('div', { class: 'o-anh' }, img,
          el('button', { type: 'button', class: 'xoa-anh', 'aria-label': 'Bỏ ảnh', text: '✕', onclick: () => { anhForm.splice(i, 1); daDoi = true; veAnh(); } }),
          i === 0 ? el('span', { class: 'la-bia', text: 'Bìa' })
            : el('button', { type: 'button', class: 'bia-anh', text: 'Làm bìa', onclick: () => { anhForm.unshift(anhForm.splice(i, 1)[0]); daDoi = true; veAnh(); } })));
      });
      vungAnh.append(el('button', { type: 'button', class: 'them-anh', onclick: () => chonFile.click() }, el('b', { text: '+' }), 'Ảnh'));
    }
    veAnh();

    // Nguyên liệu
    const vungNL = el('div');
    function themDongNL(nl) {
      const hang = el('div', { class: 'bm-hang nl' },
        el('input', { class: 'bm-o', style: 'flex:2.2', placeholder: 'Nguyên liệu', value: nl ? nl.ten : '', 'data-f': 'ten' }),
        el('input', { class: 'bm-o', style: 'flex:1', placeholder: 'Lượng', inputmode: 'decimal', value: nl ? nl.luong : '', 'data-f': 'luong' }),
        el('input', { class: 'bm-o', style: 'flex:1', placeholder: 'Đ.vị', list: 'goiYDonVi', value: nl ? nl.donVi : '', 'data-f': 'donVi' }));
      hang.append(el('button', { type: 'button', class: 'nut-tron', 'aria-label': 'Xóa dòng', text: '✕', onclick: () => hang.remove() }));
      vungNL.append(hang);
      return hang;
    }
    (cu && cu.nguyenLieu.length ? cu.nguyenLieu : [null, null]).forEach(themDongNL);

    // Các bước
    const vungBuoc = el('div');
    function danhSo() { vungBuoc.querySelectorAll('.so-buoc').forEach((s, i) => { s.textContent = i + 1; }); }
    function themBuoc(chu) {
      const vb = el('textarea', { class: 'bm-o', rows: 2, placeholder: 'Bước làm…', style: 'flex:1;padding:10px 12px;min-height:48px;resize:vertical' });
      vb.value = chu || '';
      const hang = el('div', { class: 'bm-hang buoc' }, el('span', { class: 'so-buoc' }), vb,
        el('button', { type: 'button', class: 'nut-tron', 'aria-label': 'Xóa bước', text: '✕', onclick: () => { hang.remove(); danhSo(); } }));
      vungBuoc.append(hang);
      danhSo();
      return hang;
    }
    (cu && cu.buoc.length ? cu.buoc : ['']).forEach(themBuoc);

    const than = el('div', { class: 'tp-than' },
      goiY,
      el('label', { class: 'bm-nhan', text: 'Ảnh (ảnh đầu là ảnh bìa)' }), vungAnh, chonFile,
      el('label', { class: 'bm-nhan', for: 'bmTen', text: 'Tên món' }), oTen,
      el('label', { class: 'bm-nhan', for: 'bmNhom', text: 'Nhóm' }), chonNhom,
      el('div', { style: 'display:flex;gap:8px' },
        el('div', { style: 'flex:1' }, el('label', { class: 'bm-nhan', for: 'bmLy', text: 'Loại ly' }), oLy),
        el('div', { style: 'flex:1' }, el('label', { class: 'bm-nhan', for: 'bmDa', text: 'Đá' }), oDa)),
      el('label', { class: 'bm-nhan', text: 'Nguyên liệu · lượng · đơn vị' }), vungNL,
      el('button', { type: 'button', class: 'nut nho', text: '+ Nguyên liệu', onclick: () => themDongNL(null).querySelector('input').focus() }),
      el('label', { class: 'bm-nhan', text: 'Các bước' }), vungBuoc,
      el('button', { type: 'button', class: 'nut nho', text: '+ Bước', onclick: () => themBuoc('').querySelector('textarea').focus() }),
      el('label', { class: 'bm-nhan', for: 'bmGhiChu', text: 'Ghi chú' }), oGhiChu);
    than.addEventListener('input', () => { daDoi = true; });

    function huy() {
      if (daDoi && !confirm('Bỏ các thay đổi chưa lưu?')) return;
      anhForm.forEach((a) => a.url && URL.revokeObjectURL(a.url));
      if (cu) moChiTiet(cu.id); else dongTrang();
    }

    async function luu() {
      if (dangXuLy) { thongBao('Đợi xử lý ảnh xong…'); return; }
      const ten = oTen.value.trim();
      if (!ten) { thongBao('Nhập tên món'); oTen.focus(); return; }
      const nutLuu = $('#nutLuuCT');
      nutLuu.disabled = true;
      try {
        const moi = anhForm.filter((a) => a.moi && a.ban);
        if (moi.length) await Kho.luuNhieu(moi.map((a) => a.ban));
        const giuLai = new Set(anhForm.map((a) => a.id));
        const boDi = cu ? cu.anh.filter((a) => !giuLai.has(a)) : [];
        const banGhi = {
          id: cu ? cu.id : 'ct' + Date.now().toString(36),
          ten: ten,
          nhom: chonNhom.value,
          anh: anhForm.map((a) => a.id),
          ly: oLy.value.trim(),
          da: oDa.value.trim(),
          nguyenLieu: Array.from(vungNL.querySelectorAll('.nl')).map(function (h) {
            const lay = (f) => h.querySelector('[data-f="' + f + '"]').value.trim();
            return { ten: lay('ten'), luong: lay('luong'), donVi: lay('donVi') };
          }).filter((nl) => nl.ten || nl.luong),
          buoc: Array.from(vungBuoc.querySelectorAll('textarea')).map((t) => t.value.trim()).filter(Boolean),
          ghiChu: oGhiChu.value.trim(),
          giaVon: cu ? cu.giaVon : null,
          mau: cu ? !!cu.mau : false,
          taoLuc: cu ? cu.taoLuc : Date.now(),
          suaLuc: Date.now(),
        };
        if (cu) ct.ds = ct.ds.map((x) => (x.id === cu.id ? banGhi : x));
        else ct.ds = ct.ds.concat([banGhi]);
        if (!ghi(KHOA_CT, ct)) throw new Error('đầy');
        if (boDi.length) { boDi.forEach(boUrl); Kho.xoa(boDi).catch(() => {}); }
        anhForm.forEach((a) => a.url && URL.revokeObjectURL(a.url));
        veDanhSachCT();
        moChiTiet(banGhi.id);
        thongBao('Đã lưu công thức');
      } catch (e) {
        nutLuu.disabled = false;
        thongBao('Không lưu được (bộ nhớ đầy?)', null, null, 5000);
      }
    }

    moTrang('sua', [
      el('div', { class: 'tp-dau' },
        el('button', { type: 'button', text: 'Hủy', onclick: huy }),
        el('h1', { text: cu ? 'Sửa công thức' : 'Thêm công thức' }),
        el('span', { style: 'min-width:64px' })),
      than,
      el('div', { class: 'tp-chan' },
        el('button', { type: 'button', class: 'nut rong', text: 'Hủy', onclick: huy }),
        el('button', { type: 'button', class: 'nut chinh rong', id: 'nutLuuCT', text: '✓ Lưu', onclick: luu })),
    ]);
  }

  /* ---------- Xem ảnh toàn màn (chụm 2 ngón / chạm đúp để phóng to) ---------- */

  function xemAnh(ids, viTri) {
    const v = $('#xemAnh');
    let i = viTri;
    let s = 1, x = 0, y = 0;
    const img = el('img', { alt: '' });
    const dem = el('div', { class: 'dem-anh' });
    function ap() { img.style.transform = 'translate(-50%,-50%) translate(' + x + 'px,' + y + 'px) scale(' + s + ')'; }
    function hien() {
      s = 1; x = 0; y = 0; ap();
      img.removeAttribute('src');
      datAnh(img, ids[i], 'anh');
      dem.textContent = ids.length > 1 ? (i + 1) + ' / ' + ids.length : '';
    }
    function dong() { v.hidden = true; v.textContent = ''; }
    v.textContent = '';
    v.append(img, dem, el('button', { type: 'button', class: 'dong-xem', 'aria-label': 'Đóng', text: '✕', onclick: dong }));
    if (ids.length > 1) {
      v.append(el('button', { type: 'button', class: 'chuyen truoc', text: '‹', onclick: () => { i = (i - 1 + ids.length) % ids.length; hien(); } }),
        el('button', { type: 'button', class: 'chuyen sau', text: '›', onclick: () => { i = (i + 1) % ids.length; hien(); } }));
    }
    hien();
    v.hidden = false;

    const ngon = new Map();
    let batDau = null, lanCham = 0;
    v.onpointerdown = function (e) {
      if (e.target.closest('button')) return;
      v.setPointerCapture(e.pointerId);
      ngon.set(e.pointerId, { x: e.clientX, y: e.clientY });
      batDau = { s: s, x: x, y: y, ngon: new Map(ngon) };
    };
    v.onpointermove = function (e) {
      if (!ngon.has(e.pointerId) || !batDau) return;
      ngon.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const dsNgon = Array.from(ngon.values());
      const goc = Array.from(batDau.ngon.values());
      if (dsNgon.length >= 2 && goc.length >= 2) {
        const kc = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        s = Math.min(6, Math.max(1, batDau.s * kc(dsNgon[0], dsNgon[1]) / (kc(goc[0], goc[1]) || 1)));
      } else if (s > 1 && goc.length) {
        const g = batDau.ngon.get(e.pointerId);
        if (g) { x = batDau.x + e.clientX - g.x; y = batDau.y + e.clientY - g.y; }
      }
      ap();
    };
    v.onpointerup = v.onpointercancel = function (e) {
      const g = batDau && batDau.ngon.get(e.pointerId);
      ngon.delete(e.pointerId);
      batDau = ngon.size ? { s: s, x: x, y: y, ngon: new Map(ngon) } : null;
      if (s <= 1) { s = 1; x = 0; y = 0; ap(); }
      // chạm đúp: phóng to/thu nhỏ; vuốt ngang khi chưa phóng: đổi ảnh
      if (g && !ngon.size) {
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
          const bay = Date.now();
          if (bay - lanCham < 320) { s = s > 1 ? 1 : 2.5; x = 0; y = 0; ap(); lanCham = 0; } else lanCham = bay;
        } else if (s === 1 && ids.length > 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
          i = (i + (dx < 0 ? 1 : -1) + ids.length) % ids.length; hien();
        }
      }
    };
  }

  /* ---------- Công thức MẪU ---------- */

  // Vẽ ảnh minh họa ly cà phê (không dùng ảnh thật)
  function veAnhMau() {
    const c = document.createElement('canvas');
    c.width = 900; c.height = 900;
    const g = c.getContext('2d');
    const nen = g.createLinearGradient(0, 0, 0, 900);
    nen.addColorStop(0, '#f6ead2'); nen.addColorStop(1, '#d9b48a');
    g.fillStyle = nen; g.fillRect(0, 0, 900, 900);
    g.fillStyle = '#7a4e2d'; g.fillRect(0, 700, 900, 200);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(450, 728, 170, 22, 0, 0, Math.PI * 2); g.fill();
    // thân ly
    g.save();
    g.beginPath(); g.moveTo(290, 230); g.lineTo(610, 230); g.lineTo(570, 720); g.lineTo(330, 720); g.closePath();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); g.clip();
    const cafe = g.createLinearGradient(0, 330, 0, 720);
    cafe.addColorStop(0, '#5a3418'); cafe.addColorStop(.7, '#8b5a32'); cafe.addColorStop(1, '#e9d3a8');
    g.fillStyle = cafe; g.fillRect(250, 330, 400, 400);
    g.fillStyle = 'rgba(255,255,255,.55)';
    [[350, 300, 0.2], [460, 360, -0.3], [400, 440, 0.4], [520, 470, 0.1], [370, 540, -0.2]].forEach(function (d) {
      g.save(); g.translate(d[0], d[1]); g.rotate(d[2]);
      g.beginPath(); g.roundRect ? g.roundRect(-45, -45, 90, 90, 14) : g.rect(-45, -45, 90, 90); g.fill(); g.restore();
    });
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(290, 230); g.lineTo(330, 720); g.lineTo(570, 720); g.lineTo(610, 230); g.stroke();
    // ống hút
    g.strokeStyle = '#1F6FD1'; g.lineWidth = 22; g.lineCap = 'round';
    g.beginPath(); g.moveTo(520, 640); g.lineTo(560, 160); g.lineTo(640, 110); g.stroke();
    // nhãn MẪU
    g.fillStyle = '#b3261e';
    g.beginPath(); g.roundRect ? g.roundRect(40, 40, 250, 110, 24) : g.rect(40, 40, 250, 110); g.fill();
    g.fillStyle = '#fff'; g.font = '900 76px -apple-system, Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText('MẪU', 70, 98);
    return c;
  }

  async function taoMauNeuCan() {
    if (ct.daTaoMau) return;
    ct.daTaoMau = true;
    try {
      const c = veAnhMau();
      const ban = { id: 'mau-anh-1', anh: await veLai(c, 1200, 0.8), nho: await veLai(c, 400, 0.75) };
      await Kho.luu(ban);
      ct.ds.push({
        id: 'mau-1', ten: 'MẪU – Cà phê sữa đá', nhom: 'cpviet', anh: [ban.id],
        ly: 'Ly 500ml', da: 'Đá viên đầy ly',
        nguyenLieu: [
          { ten: 'Cà phê phin', luong: '40', donVi: 'ml' },
          { ten: 'Sữa đặc', luong: '25', donVi: 'ml' },
          { ten: 'Sữa tươi', luong: '20', donVi: 'ml' },
        ],
        buoc: ['Cho sữa đặc và sữa tươi vào ly.', 'Rót cà phê phin vào, khuấy đều.', 'Thêm đá đầy ly, khuấy nhẹ rồi phục vụ.'],
        ghiChu: 'Đây là công thức MẪU để xem giao diện. Xóa trong ⚙ Cài đặt → Xóa dữ liệu mẫu.',
        giaVon: null, mau: true, taoLuc: Date.now(), suaLuc: Date.now(),
      });
    } catch (e) { /* không tạo được mẫu cũng không sao */ }
    luuCT();
    if (tabHienTai === 'congthuc') veDanhSachCT();
  }

  /* ================= CÀI ĐẶT ================= */

  function apGiaoDien() {
    const r = document.documentElement;
    if (st.giaoDien === 'sang') r.dataset.theme = 'light';
    else if (st.giaoDien === 'toi') r.dataset.theme = 'dark';
    else delete r.dataset.theme;
  }

  // Sửa menu: áp thay đổi rồi vẽ lại mọi nơi
  function doiMenu(sua) {
    const menu = C.saoMenu(st.menu);
    sua(menu);
    st = Object.assign({}, st, { menu: menu });
    luuNgay();
    veLuoi();
    veOrder();
    veCaiDat();
  }

  function veCaiDat() {
    const nd = $('#noiDungCaiDat');
    const cuon = nd.scrollTop;
    nd.textContent = '';

    if (C.canNhacSaoLuu(st, Date.now())) {
      nd.append(el('div', { class: 'banner-sao-luu', style: 'margin:6px 0 0' },
        el('span', { text: 'Đã lâu chưa sao lưu. Dữ liệu chỉ nằm trên máy này.' })));
    }

    // Giao diện
    const doan = el('div', { class: 'chon-doan' });
    [['tu-dong', 'Tự động'], ['sang', '☀ Sáng'], ['toi', '☾ Tối']].forEach(function (g) {
      doan.append(el('button', {
        type: 'button', class: st.giaoDien === g[0] ? 'chon' : '', text: g[1],
        onclick: () => { st = Object.assign({}, st, { giaoDien: g[0] }); apGiaoDien(); luuNgay(); veCaiDat(); },
      }));
    });
    nd.append(el('h2', { text: 'Giao diện' }), el('div', { class: 'khoi' }, doan));

    // Sao lưu
    const chonFile = el('input', { type: 'file', accept: '.json,application/json,text/plain', hidden: true, id: 'fileKhoiPhuc' });
    chonFile.addEventListener('change', function () {
      const f = chonFile.files && chonFile.files[0];
      chonFile.value = '';
      if (f) khoiPhuc(f);
    });
    nd.append(el('h2', { text: 'Sao lưu' }), el('div', { class: 'khoi' },
      el('p', { text: st.lanSaoLuu ? 'Lần cuối: ' + new Date(st.lanSaoLuu).toLocaleDateString('vi-VN') : 'Chưa sao lưu lần nào. Nên sao lưu mỗi 2 tuần.' }),
      el('div', { class: 'hang-nut' },
        el('button', { type: 'button', class: 'nut chinh', id: 'nutXuat', text: '⬇ Sao lưu ra file', onclick: xuatSaoLuu }),
        el('button', { type: 'button', class: 'nut', text: '⬆ Khôi phục', onclick: () => chonFile.click() })),
      chonFile));

    // Menu
    nd.append(el('h2', { text: 'Menu' }));
    const nhomDS = C.nhomVaMon(st.menu);
    nhomDS.forEach(function (n, i) {
      const chu = C.mauChu(n.mau);
      const khoi = el('div', { class: 'nhom-cd', 'data-nhom': n.id },
        el('div', { class: 'nhom-cd-dau', style: 'background:' + n.mau + ';color:' + chu },
          el('button', { type: 'button', class: 'ten-nhom-cd', text: n.ten + '  ✎', onclick: () => suaNhom(n.id) }),
          el('button', { type: 'button', class: 'nut-tron', 'aria-label': 'Lên', text: '↑', disabled: i === 0, onclick: () => doiThuTu(n.id, -1) }),
          el('button', { type: 'button', class: 'nut-tron', 'aria-label': 'Xuống', text: '↓', disabled: i === nhomDS.length - 1, onclick: () => doiThuTu(n.id, 1) })));
      n.mon.forEach(function (m) {
        khoi.append(el('button', { type: 'button', class: 'mon-cd', onclick: () => suaMon(m.id) },
          el('span', { class: 'ten', text: m.ten + (m.banChay ? '  ★' : '') }),
          el('span', { class: 'gia', text: C.dinhDangTien(m.gia) })));
      });
      khoi.append(el('button', { type: 'button', class: 'mon-cd them-mon-cd', text: '+ Thêm món', onclick: () => suaMon(null, n.id) }));
      nd.append(khoi);
    });
    nd.append(el('div', { class: 'hang-nut' },
      el('button', { type: 'button', class: 'nut', text: '+ Thêm nhóm', onclick: () => suaNhom(null) }),
      el('button', {
        type: 'button', class: 'nut', text: '↺ Menu gốc',
        onclick: () => {
          if (confirm('Đưa menu về như ban đầu? Các món bạn đã sửa/thêm sẽ mất.')) doiMenu((m) => Object.assign(m, C.saoMenu(window.MENU_MAC_DINH)));
        },
      })));

    // Dữ liệu mẫu
    const coMau = ct.ds.some((c) => c.mau);
    nd.append(el('h2', { text: 'Dữ liệu mẫu' }), el('div', { class: 'khoi' },
      el('p', { text: coMau ? 'Có 1 công thức MẪU để xem giao diện.' : 'Đã xóa dữ liệu mẫu.' }),
      el('button', { type: 'button', class: 'nut do', style: 'width:100%', text: 'Xóa dữ liệu mẫu', disabled: !coMau, onclick: xoaMau })));

    const pb = el('div', { class: 'phien-ban', text: 'Phiên bản ' + PHIEN_BAN_APP + ' · dữ liệu v' + C.PHIEN_BAN_DU_LIEU });
    nd.append(pb);
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then((ok) => { pb.textContent += ok ? ' · bộ nhớ bền' : ''; }).catch(() => {});
    }
    nd.scrollTop = cuon;
  }

  function doiThuTu(id, huong) {
    doiMenu(function (m) {
      const tt = C.nhomVaMon(m).map((n) => n.id);
      const i = tt.indexOf(id), j = i + huong;
      if (j < 0 || j >= tt.length) return;
      tt.splice(j, 0, tt.splice(i, 1)[0]);
      m.thuTuNhom = tt;
    });
  }

  // Sheet sửa / thêm món
  function suaMon(id, nhomMoi) {
    const cu = id ? C.timMon(st.menu, id) : null;
    moSheet(function (nd) {
      const oTen = el('input', { class: 'bm-o', value: cu ? cu.ten : '', placeholder: 'Tên món', id: 'smTen' });
      const oGia = el('input', { class: 'bm-o', value: cu ? String(cu.gia) : '', inputmode: 'numeric', pattern: '[0-9]*', placeholder: 'Ví dụ: 35 = 35.000đ', id: 'smGia' });
      const goiY = el('div', { class: 'goi-y-nhap' });
      const capGoiY = () => { const g = C.hieuSoTien(oGia.value); goiY.textContent = g ? '= ' + C.dinhDangTien(g) : ''; };
      oGia.addEventListener('input', capGoiY); capGoiY();
      const chonNhom = el('select', { class: 'bm-chon', id: 'smNhom' });
      C.nhomVaMon(st.menu).forEach((n) => chonNhom.append(el('option', { value: n.id, text: n.ten })));
      chonNhom.value = cu ? cu.nhom : nhomMoi;
      const oBanChay = el('input', { type: 'checkbox', id: 'smBanChay' });
      oBanChay.checked = cu ? !!cu.banChay : false;

      nd.append(el('h2', { text: cu ? 'Sửa món' : 'Thêm món' }),
        el('label', { class: 'bm-nhan', for: 'smTen', text: 'Tên' }), oTen,
        el('label', { class: 'bm-nhan', for: 'smGia', text: 'Giá' }), oGia, goiY,
        el('label', { class: 'bm-nhan', for: 'smNhom', text: 'Nhóm' }), chonNhom,
        el('label', { class: 'cong-tac', for: 'smBanChay' }, el('span', { text: '★ Bán chạy (ô to, lên đầu nhóm)' }), oBanChay),
        el('div', { class: 'sheet-chan' },
          cu ? el('button', {
            type: 'button', class: 'nut do', text: 'Xóa',
            onclick: () => {
              const dangDung = st.khach.some((k) => C.soLuongMon(k, cu.id) > 0);
              if (!confirm('Xóa món "' + cu.ten + '" khỏi menu?' + (dangDung ? ' Món này đang có trong order.' : ''))) return;
              dongSheet();
              doiMenu((m) => { m.mon = m.mon.filter((x) => x.id !== cu.id); });
            },
          }) : null,
          el('button', {
            type: 'button', class: 'nut chinh rong', id: 'smLuu', text: '✓ Lưu',
            onclick: () => {
              const ten = oTen.value.trim();
              const gia = C.hieuSoTien(oGia.value);
              if (!ten) { oTen.focus(); return; }
              if (!gia) { oGia.focus(); return; }
              dongSheet();
              doiMenu(function (m) {
                const ban = { id: cu ? cu.id : C.taoIdMoi('m', m.mon.map((x) => x.id)), nhom: chonNhom.value, ten: ten, gia: gia, banChay: oBanChay.checked };
                if (cu) m.mon = m.mon.map((x) => (x.id === cu.id ? ban : x));
                else m.mon.push(ban);
              });
            },
          })));
    });
  }

  // Sheet sửa / thêm nhóm (tên + màu)
  function suaNhom(id) {
    const cu = id ? nhomTheoId(id) : null;
    let mau = cu ? cu.mau : BANG_MAU[8];
    moSheet(function (nd) {
      const oTen = el('input', { class: 'bm-o', value: cu ? cu.ten : '', placeholder: 'Tên nhóm', id: 'snTen' });
      const xem = el('div', { class: 'nut', style: 'margin-top:12px;width:100%;pointer-events:none' });
      const capXem = () => { xem.style.background = mau; xem.style.color = C.mauChu(mau); xem.textContent = oTen.value || 'Xem trước'; };
      oTen.addEventListener('input', capXem);
      const bang = el('div', { class: 'bang-mau' });
      function veBang() {
        bang.textContent = '';
        BANG_MAU.forEach(function (m) {
          bang.append(el('button', { type: 'button', class: m.toLowerCase() === mau.toLowerCase() ? 'chon' : '', style: 'background:' + m, 'aria-label': m, onclick: () => { mau = m; oMau.value = m; veBang(); capXem(); } }));
        });
      }
      const oMau = el('input', { type: 'color', value: mau, style: 'width:100%;height:48px;border:0;background:none;margin-top:8px' });
      oMau.addEventListener('input', () => { mau = oMau.value; veBang(); capXem(); });
      veBang(); capXem();
      const soMon = cu ? st.menu.mon.filter((m) => m.nhom === cu.id).length : 0;
      nd.append(el('h2', { text: cu ? 'Sửa nhóm' : 'Thêm nhóm' }),
        el('label', { class: 'bm-nhan', for: 'snTen', text: 'Tên nhóm' }), oTen,
        el('label', { class: 'bm-nhan', text: 'Màu' }), bang, oMau, xem,
        el('div', { class: 'sheet-chan' },
          cu ? el('button', {
            type: 'button', class: 'nut do', text: 'Xóa', disabled: soMon > 0,
            onclick: () => { if (confirm('Xóa nhóm "' + cu.ten + '"?')) { dongSheet(); doiMenu((m) => { m.nhom = m.nhom.filter((n) => n.id !== cu.id); m.thuTuNhom = m.thuTuNhom.filter((x) => x !== cu.id); }); } },
          }) : null,
          el('button', {
            type: 'button', class: 'nut chinh rong', text: '✓ Lưu',
            onclick: () => {
              const ten = oTen.value.trim();
              if (!ten) { oTen.focus(); return; }
              dongSheet();
              doiMenu(function (m) {
                if (cu) m.nhom = m.nhom.map((n) => (n.id === cu.id ? Object.assign({}, n, { ten: ten, mau: mau }) : n));
                else {
                  const idMoi = C.taoIdMoi('n', m.nhom.map((n) => n.id));
                  m.nhom.push({ id: idMoi, ten: ten, mau: mau });
                  m.thuTuNhom = C.nhomVaMon(m).map((n) => n.id).filter((x) => x !== idMoi).concat([idMoi]);
                }
              });
            },
          })),
        soMon ? el('div', { class: 'goi-y-nhap', text: 'Muốn xóa nhóm: chuyển hoặc xóa hết ' + soMon + ' món trong nhóm trước.' }) : null);
    });
  }

  async function xoaMau() {
    const mau = ct.ds.filter((c) => c.mau);
    if (!mau.length || !confirm('Xóa công thức MẪU?')) return;
    ct.ds = ct.ds.filter((c) => !c.mau);
    luuCT();
    const anh = [].concat(...mau.map((c) => c.anh));
    anh.forEach(boUrl);
    try { await Kho.xoa(anh); } catch (e) { /* bỏ qua */ }
    veCaiDat();
    thongBao('Đã xóa dữ liệu mẫu');
  }

  /* ---------- Sao lưu / khôi phục ---------- */

  function blobSangChuoi(b) {
    return new Promise(function (ok, loi) {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => loi(r.error);
      r.readAsDataURL(b);
    });
  }
  async function chuoiSangBlob(du) {
    const r = await fetch(du);
    return r.blob();
  }

  async function xuatSaoLuu() {
    const nut = $('#nutXuat');
    if (nut) { nut.disabled = true; nut.textContent = 'Đang chuẩn bị…'; }
    try {
      const anh = await Kho.tatCa();
      const anhChuoi = [];
      for (const a of anh) anhChuoi.push({ id: a.id, anh: await blobSangChuoi(a.anh), nho: await blobSangChuoi(a.nho) });
      const du = {
        ung: 'quan-order', phienBan: C.PHIEN_BAN_DU_LIEU, phienBanApp: PHIEN_BAN_APP, ngayXuat: new Date().toISOString(),
        menu: st.menu, giaoDien: st.giaoDien, congThuc: ct.ds, anh: anhChuoi,
      };
      const ten = 'quan-order-sao-luu-' + C.ngayKinhDoanh(Date.now()) + '.json';
      const blob = new Blob([JSON.stringify(du)], { type: 'application/json' });
      let xong = false;
      const file = typeof File === 'function' ? new File([blob], ten, { type: 'application/json' }) : null;
      if (file && navigator.canShare && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: ten }); xong = true; } catch (e) { if (e.name === 'AbortError') return; }
      }
      if (!xong) {
        const a = el('a', { href: URL.createObjectURL(blob), download: ten });
        document.body.append(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
      }
      st = Object.assign({}, st, { lanSaoLuu: Date.now() });
      luuNgay();
      kiemTraNhacSaoLuu();
      thongBao('Đã tạo file sao lưu', null, null, 4000);
    } catch (e) {
      thongBao('Sao lưu lỗi: ' + (e && e.message ? e.message : e), null, null, 5000);
    } finally {
      if (tabHienTai === 'caidat') veCaiDat();
    }
  }

  async function khoiPhuc(file) {
    let du;
    try { du = JSON.parse(await file.text()); } catch (e) { thongBao('File không đọc được', null, null, 4000); return; }
    const loi = C.kiemTraSaoLuu(du);
    if (loi) { thongBao(loi, null, null, 4000); return; }
    if (!confirm('Khôi phục ' + du.congThuc.length + ' công thức, ' + du.anh.length + ' ảnh và menu từ file?\nDữ liệu menu/công thức hiện tại sẽ được thay thế (order đang dở giữ nguyên).')) return;
    try {
      const ban = [];
      for (const a of du.anh) ban.push({ id: a.id, anh: await chuoiSangBlob(a.anh), nho: await chuoiSangBlob(a.nho) });
      await Kho.xoaHet();
      if (ban.length) await Kho.luuNhieu(ban);
      urlDem.forEach((u) => URL.revokeObjectURL(u));
      urlDem.clear();
      ct = { phienBan: 1, daTaoMau: true, ds: du.congThuc };
      luuCT();
      st = C.khoiTao(Object.assign({}, st, { menu: du.menu, giaoDien: du.giaoDien || st.giaoDien }), window.MENU_MAC_DINH, Date.now());
      luuNgay();
      apGiaoDien();
      veLuoi();
      veOrder();
      veCaiDat();
      thongBao('Đã khôi phục xong', null, null, 4000);
    } catch (e) {
      thongBao('Khôi phục lỗi: ' + (e && e.message ? e.message : e), null, null, 5000);
    }
  }

  // Nhắc sao lưu: chấm đỏ ở ⚙ + banner ở Công thức + 1 thông báo/ngày
  function kiemTraNhacSaoLuu(moApp) {
    const can = C.canNhacSaoLuu(st, Date.now());
    $('#chamNhac').hidden = !can;
    const b = $('#bannerSaoLuu1');
    b.hidden = !can;
    if (can) {
      b.textContent = '';
      b.append(el('span', { text: 'Đã lâu chưa sao lưu dữ liệu' }),
        el('button', { type: 'button', class: 'nut nho chinh', text: 'Sao lưu', onclick: () => chuyenTab('caidat') }));
      const homNay = C.ngayKinhDoanh(Date.now());
      if (moApp && st.lanNhacSaoLuu !== homNay) {
        st = Object.assign({}, st, { lanNhacSaoLuu: homNay });
        luuSau();
        thongBao('Đã 14 ngày chưa sao lưu', 'Sao lưu', () => chuyenTab('caidat'), 6000);
      }
    }
  }

  /* ================= KHỞI ĐỘNG ================= */

  // Dữ liệu hỏng: giữ lại bản gốc (không ghi đè) rồi mở app với dữ liệu mới
  let dataHong = false;
  function giuBanHong(khoa) {
    try {
      const tho = localStorage.getItem(khoa);
      if (tho) localStorage.setItem(khoa + '.hong.' + Date.now(), tho);
    } catch (e) { /* bỏ qua */ }
    dataHong = true;
  }

  function khoiDong() {
    try {
      st = C.khoiTao(docJSON(KHOA), window.MENU_MAC_DINH, Date.now());
    } catch (e) {
      giuBanHong(KHOA);
      st = C.khoiTao(null, window.MENU_MAC_DINH, Date.now());
    }
    if (localStorage.getItem(KHOA) && !docJSON(KHOA)) giuBanHong(KHOA);
    ct = docJSON(KHOA_CT);
    if (!ct || typeof ct !== 'object') {
      if (localStorage.getItem(KHOA_CT)) giuBanHong(KHOA_CT);
      ct = { phienBan: 1, daTaoMau: false, ds: [] };
    }
    if (!Array.isArray(ct.ds)) ct.ds = [];
    ct.ds = ct.ds.filter((c) => c && c.id && typeof c.ten === 'string');
    ct.ds = ct.ds.map((c) => Object.assign({ anh: [], nguyenLieu: [], buoc: [], ghiChu: '', ly: '', da: '', giaVon: null }, c));
    apGiaoDien();
    veKieu();
    document.body.classList.add('o-order');
    veLuoi();
    veOrder(true);
    luuNgay();

    if (dataHong) thongBao('Dữ liệu cũ bị lỗi đã được cất riêng, app chạy lại bình thường', null, null, 6000);
    setTimeout(function () {
      taoMauNeuCan();
      kiemTraNhacSaoLuu(true);
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    }, 400);
  }

  // Quay lại app: lưu, kiểm tra đổi ngày (04:00), giữ sáng lại nếu đang xem công thức
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { luuNgay(); return; }
    if (st.ngay !== C.ngayKinhDoanh(Date.now())) {
      st = C.khoiTao(st, window.MENU_MAC_DINH, Date.now());
      luuNgay();
      veOrder(true);
    }
    if (trangDangMo === 'chitiet') giuSang();
  });
  window.addEventListener('pagehide', luuNgay);
  window.addEventListener('storage', function (e) {
    if (e.key === KHOA && e.newValue) { st = C.khoiTao(docJSON(KHOA), window.MENU_MAC_DINH, Date.now()); veLuoi(); veOrder(); }
  });

  // Lỗi bất ngờ: không để app đứng — lưu ngay, báo nhỏ (tối đa 1 lần / 10 giây)
  let lanBaoLoi = 0;
  function baoLoi() {
    try { if (st) luuNgay(); } catch (e) { /* bỏ qua */ }
    if (Date.now() - lanBaoLoi < 10000) return;
    lanBaoLoi = Date.now();
    try { thongBao('Có lỗi nhỏ, đã bỏ qua. Order vẫn an toàn.', null, null, 4000); } catch (e) { /* bỏ qua */ }
  }
  window.addEventListener('error', baoLoi);
  window.addEventListener('unhandledrejection', baoLoi);

  // Chặn phóng to bằng chụm ngón trên iOS (trừ trình xem ảnh tự xử lý)
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // Service worker: chạy offline + tự cập nhật
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    let daCo = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (daCo) thongBao('Đã có bản mới', 'Tải lại', () => { luuNgay(); location.reload(); }, 10000);
      daCo = true;
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  khoiDong();

  // Cho test tự động đọc trạng thái
  window.__quan = { trangThai: () => st, congThuc: () => ct };
})();
