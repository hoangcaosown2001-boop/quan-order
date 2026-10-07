// Kiểm tra giao diện + kịch bản thật bằng Playwright.
// Chạy: node tests/e2e.mjs   (ảnh chụp lưu ở tests/anh-chup/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANH = path.join(GOC, 'tests', 'anh-chup');
fs.mkdirSync(ANH, { recursive: true });

// Máy chủ tĩnh đơn giản
const KIEU = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const mayChu = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(GOC, p);
  if (!f.startsWith(GOC) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': KIEU[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => mayChu.listen(0, ok));
const URL_APP = `http://localhost:${mayChu.address().port}/`;

let soLoi = 0;
const ketQua = [];
function kiem(dk, ten, chiTiet = '') {
  ketQua.push(`${dk ? '✔' : '✘'} ${ten}${chiTiet ? ' — ' + chiTiet : ''}`);
  if (!dk) soLoi++;
}

const MAY = [
  { ten: 'iphone15', w: 393, h: 852 },
  { ten: 'promax', w: 430, h: 932 },
];

const trinh = await chromium.launch();

async function moApp(may) {
  const ctx = await trinh.newContext({
    viewport: { width: may.w, height: may.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh',
  });
  const p = await ctx.newPage();
  p.loiTrang = [];
  p.on('pageerror', (e) => p.loiTrang.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto(URL_APP);
  await p.waitForSelector('.o-mon');
  return { ctx, p };
}

const cham = (p, mon) => p.tap(`[data-mon="${mon}"]`);
const soLuong = (p) => p.evaluate(() => window.__quan.trangThai().khach.map((k) => k.dong.reduce((s, d) => s + d.soLuong, 0)));
const chipChon = (p) => p.textContent('.chip.chon');

// Ảnh thử (vẽ bằng canvas) để thêm công thức
async function taoAnhThu(p) {
  const du = await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1200;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 1600, 1200); gr.addColorStop(0, '#f7d9a0'); gr.addColorStop(1, '#8a5a3b');
    g.fillStyle = gr; g.fillRect(0, 0, 1600, 1200);
    g.fillStyle = '#fff8e8'; g.beginPath(); g.ellipse(800, 640, 330, 330, 0, 0, 7); g.fill();
    g.fillStyle = '#f1c34f'; g.beginPath(); g.ellipse(800, 600, 250, 120, 0, 0, 7); g.fill();
    g.fillStyle = '#5a3418'; g.font = 'bold 120px sans-serif'; g.textAlign = 'center'; g.fillText('Egg Coffee', 800, 1100);
    return c.toDataURL('image/jpeg', 0.9);
  });
  return Buffer.from(du.split(',')[1], 'base64');
}

async function themCongThuc(p, anh) {
  await p.tap('.tab[data-tab="congthuc"]');
  await p.tap('#nutThemCT');
  await p.setInputFiles('#bmFileAnh', { name: 'egg.jpg', mimeType: 'image/jpeg', buffer: anh });
  await p.waitForSelector('.bm-anh .o-anh img');
  await p.waitForFunction(() => !document.querySelector('.dang-xu-ly'));
  await p.fill('#bmTen', 'Egg Coffee');
  await p.dispatchEvent('#bmTen', 'change');
  await p.fill('#bmLy', 'Ly sứ 200ml');
  await p.fill('#bmDa', 'Không đá');
  const nl = await p.$$('.bm-hang.nl');
  const dien = async (hang, a, b, c) => {
    const o = await hang.$$('input');
    await o[0].fill(a); await o[1].fill(b); await o[2].fill(c);
  };
  await dien(nl[0], 'Cà phê espresso', '30', 'ml');
  await dien(nl[1], 'Lòng đỏ trứng', '2', 'trái');
  await p.click('text=+ Nguyên liệu');
  await dien((await p.$$('.bm-hang.nl'))[2], 'Sữa đặc', '20', 'ml');
  await p.fill('.bm-hang.buoc textarea', 'Đánh lòng đỏ với sữa đặc đến khi bông mịn.');
  await p.click('text=+ Bước');
  await (await p.$$('.bm-hang.buoc textarea'))[1].fill('Rót espresso nóng vào tách, phủ kem trứng lên trên.');
  await p.tap('#nutLuuCT');
  await p.waitForSelector('.ct-ten');
}

for (const may of MAY) {
  const nhan = `${may.w}×${may.h}`;
  const { ctx, p } = await moApp(may);
  const la15 = may.ten === 'iphone15';

  // --- Kiểm tra bố cục màn đầu ---
  const bocuc = await p.evaluate(() => {
    const luoi = document.getElementById('luoiMenu');
    const r = luoi.getBoundingClientRect();
    const ca = [...document.querySelectorAll('[data-nhom="cpviet"] .o-mon, [data-nhom="signature"] .o-mon, [data-nhom="cpy"] .o-mon')];
    const tatCa = [...document.querySelectorAll('.o-mon')];
    const kt = (e) => e.getBoundingClientRect();
    const thuong = tatCa.filter((e) => !e.classList.contains('ban-chay')).map((e) => kt(e).width * kt(e).height);
    const banChay = tatCa.filter((e) => e.classList.contains('ban-chay'));
    return {
      scrollTop: luoi.scrollTop,
      soCaPhe: ca.length,
      caPheHien: ca.filter((e) => kt(e).top >= r.top - 0.5 && kt(e).bottom <= r.bottom + 0.5).length,
      dayCaPhe: Math.max(...ca.map((e) => kt(e).bottom)) - r.top,
      caoLuoi: r.height,
      tongO: tatCa.length,
      caoMin: Math.min(...tatCa.map((e) => kt(e).height)),
      banChay: banChay.map((e) => e.querySelector('.ten').textContent),
      dtBanChayMin: Math.min(...banChay.map((e) => kt(e).width * kt(e).height)),
      dtThuongMax: Math.max(...thuong),
      chuBanChay: parseFloat(getComputedStyle(banChay[0].querySelector('.ten')).fontSize),
      chuThuong: parseFloat(getComputedStyle(tatCa.find((e) => !e.classList.contains('ban-chay')).querySelector('.ten')).fontSize),
      mau: [...document.querySelectorAll('.nhom-khoi')].map((s) => ({ nhom: s.querySelector('.nhom-tieu-de').textContent, mau: getComputedStyle(s.querySelector('.o-mon')).backgroundColor })),
    };
  });
  kiem(bocuc.tongO === 49, `[${nhan}] đủ 49 món`, `${bocuc.tongO}`);
  if (la15) {
    kiem(bocuc.soCaPhe === 21 && bocuc.caPheHien === 21, `[${nhan}] 3 nhóm cà phê (21 món) hiện đủ màn đầu, không cuộn`,
      `${bocuc.caPheHien}/21 món, cao ${Math.round(bocuc.dayCaPhe)}px trong lưới ${Math.round(bocuc.caoLuoi)}px`);
    // Khi cài ra màn hình chính iPhone 15 mất thêm 59px (tai thỏ) + 34px (thanh home)
    kiem(bocuc.dayCaPhe <= bocuc.caoLuoi - 93, `[${nhan}] vẫn đủ khi trừ vùng an toàn iPhone (93px)`, `${Math.round(bocuc.dayCaPhe)} ≤ ${Math.round(bocuc.caoLuoi - 93)}`);
  } else {
    kiem(bocuc.caPheHien === 21, `[${nhan}] 21 món cà phê hiện đủ màn đầu`, `${bocuc.caPheHien}/21`);
  }
  kiem(bocuc.caoMin >= 52, `[${nhan}] mọi ô cao ≥ 52px`, `thấp nhất ${Math.round(bocuc.caoMin)}px`);
  kiem(bocuc.banChay.length === 3 && bocuc.dtBanChayMin > bocuc.dtThuongMax * 1.8 && bocuc.chuBanChay > bocuc.chuThuong,
    `[${nhan}] 3 món bán chạy to hơn ô thường`, `${bocuc.banChay.join(', ')}; diện tích ×${(bocuc.dtBanChayMin / bocuc.dtThuongMax).toFixed(1)}, chữ ${bocuc.chuBanChay}px vs ${bocuc.chuThuong}px`);
  const rgb = bocuc.mau.map((m) => m.mau.match(/\d+/g).slice(0, 3).map(Number));
  let kcMin = Infinity, cap = '';
  for (let i = 0; i < rgb.length; i++) for (let j = i + 1; j < rgb.length; j++) {
    const kc = Math.hypot(...rgb[i].map((v, k) => v - rgb[j][k]));
    if (kc < kcMin) { kcMin = kc; cap = `${bocuc.mau[i].nhom} / ${bocuc.mau[j].nhom}`; }
  }
  kiem(new Set(bocuc.mau.map((m) => m.mau)).size === 8 && kcMin > 60, `[${nhan}] 8 nhóm khác màu rõ`, `cặp gần nhất ${cap}: khoảng cách ${Math.round(kcMin)}`);

  // --- Chạm nhanh liên tiếp: mỗi lần +1, cập nhật < 50ms ---
  const toc = await p.evaluate(() => {
    const o = document.querySelector('[data-mon="vn-den"]');
    const t0 = performance.now();
    o.click();
    const xong = document.getElementById('soTong').textContent;
    const t = performance.now() - t0;
    o.click(); o.click();
    return { t, xong, sl: o.querySelector('.sl').textContent };
  });
  kiem(toc.t < 50 && toc.sl === '×3', `[${nhan}] chạm → cập nhật số & tổng < 50ms, chạm nhanh 3 lần = ×3`, `${toc.t.toFixed(1)}ms, ${toc.sl}`);
  await p.tap('#nutHoanTac'); await p.tap('#nutHoanTac'); await p.tap('#nutHoanTac');

  // --- Cuộn bằng chạm KHÔNG cộng món ---
  const truoc = await soLuong(p);
  const cdp = await ctx.newCDPSession(p);
  const o = await (await p.$('[data-mon="latte"]')).boundingBox();
  const x = o.x + o.width / 2, y0 = o.y + o.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - i * 25 }] });
    await p.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(400);
  const sau = await soLuong(p);
  const daCuon = await p.$eval('#luoiMenu', (e) => e.scrollTop);
  kiem(daCuon > 50 && JSON.stringify(truoc) === JSON.stringify(sau), `[${nhan}] kéo cuộn lưới bằng ngón tay không làm tăng món`, `cuộn ${Math.round(daCuon)}px, số ly ${JSON.stringify(truoc)} → ${JSON.stringify(sau)}`);

  // --- Phần cố định đứng yên + cuộn xuống thấy đủ nhóm ---
  await p.$eval('#luoiMenu', (e) => { e.scrollTop = 0; });
  const viTri = () => p.evaluate(() => ['#nutTong', '.dai-khach', '.thanh-duoi'].map((s) => JSON.stringify(document.querySelector(s).getBoundingClientRect())).join('|'));
  const vt0 = await viTri();
  const thayNhom = await p.evaluate(async () => {
    const luoi = document.getElementById('luoiMenu');
    const r = luoi.getBoundingClientRect();
    const thay = new Set();
    for (let s = 0; s <= luoi.scrollHeight; s += 80) {
      luoi.scrollTop = s;
      await new Promise((ok) => requestAnimationFrame(ok));
      document.querySelectorAll('.nhom-khoi').forEach((k) => {
        const kr = k.querySelector('.o-mon:last-child').getBoundingClientRect();
        if (kr.top >= r.top && kr.bottom <= r.bottom) thay.add(k.dataset.nhom);
      });
    }
    return [...thay];
  });
  const vt1 = await viTri();
  kiem(vt0 === vt1, `[${nhan}] tổng tiền, dải khách, thanh dưới đứng yên khi cuộn lưới`);
  kiem(['nuocep', 'kem', 'tea', 'matcha', 'smoothie'].every((n) => thayNhom.includes(n)), `[${nhan}] cuộn xuống thấy đủ 5 nhóm còn lại`, thayNhom.join(', '));
  if (la15) await p.screenshot({ path: path.join(ANH, `0-order-cuon-xuong-${may.ten}.png`) });
  await p.$eval('#luoiMenu', (e) => { e.scrollTop = 0; });

  // --- Dữ liệu cho ảnh chụp: 3 khách, 6+ món ---
  for (const m of ['vn-sua', 'vn-sua', 'latte', 'egg-coffee', 'vn-den', 'vn-den']) await cham(p, m);
  await p.tap('#nutThemKhach');
  for (const m of ['saigon-milk-coffee', 'mocha']) await cham(p, m);
  await p.tap('#nutThemKhach');
  for (const m of ['cappuccino', 'cam-orange', 'salted-coffee']) await cham(p, m);
  await p.tap('.chip >> nth=0');
  await p.$eval('#luoiMenu', (e) => { e.scrollTop = 0; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(ANH, `1-order-${may.ten}.png`) });

  await p.tap('#nutDanhSach');
  await p.waitForSelector('.dong-ds');
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(ANH, `2-danh-sach-${may.ten}.png`) });
  await p.tap('#nenSheet', { position: { x: 30, y: 40 } });
  kiem(await p.isHidden('#sheet'), `[${nhan}] chạm ra ngoài đóng Danh sách`);

  await p.tap('#nutTong');
  await p.waitForSelector('.menh-gia');
  const mg = await p.$$eval('.menh-gia button', (b) => b.map((x) => x.textContent));
  kiem(JSON.stringify(mg) === JSON.stringify(['50k', '100k', '200k', '500k']), `[${nhan}] bảng mệnh giá 50k-100k-200k-500k`, mg.join(', '));
  const thoi = () => p.textContent('#tienThoi');
  const dua = () => p.inputValue('#oKhachDua');
  await p.tap('.menh-gia [data-mg="50000"]');
  await p.tap('.menh-gia [data-mg="50000"]');
  kiem((await dua()) === '100.000' && (await thoi()) === 'Còn thiếu: 93.000đ' && (await p.textContent('[data-mg="50000"] .lan')) === '×2',
    `[${nhan}] bấm 2 lần 50k → khách đưa 100k (cộng dồn)`, `${await dua()} · ${await thoi()}`);
  await p.tap('.menh-gia [data-mg="100000"]');
  await p.tap('.menh-gia [data-mg="100000"]');
  kiem((await dua()) === '300.000' && (await thoi()) === 'Thối lại: 107.000đ', `[${nhan}] thêm 2 lần 100k → 300k, thối 107.000đ`, `${await dua()} · ${await thoi()}`);
  await p.fill('#oKhachDua', '250');
  kiem((await thoi()) === 'Thối lại: 57.000đ' && !(await p.$('.menh-gia .chon')), `[${nhan}] tự nhập 250 → 250.000đ, thối 57.000đ`, await thoi());
  await p.tap('#nutNhapLai');
  kiem((await dua()) === '' && (await thoi()) === 'Chọn hoặc nhập tiền khách đưa', `[${nhan}] nút ↺ nhập lại về 0`);
  await p.tap('[data-mg="dung"]');
  kiem((await thoi()) === 'Không thối', `[${nhan}] Đúng tiền → Không thối`);
  await p.tap('#nutNhapLai');
  await p.tap('.menh-gia [data-mg="100000"]');
  await p.tap('.menh-gia [data-mg="100000"]');
  kiem((await thoi()) === 'Thối lại: 7.000đ', `[${nhan}] 2 lần 100k = 200k → thối 7.000đ`, await thoi());
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(ANH, `3-thanh-toan-${may.ten}.png`) });
  await p.tap('text=Đóng');

  // --- Công thức ---
  const anh = await taoAnhThu(p);
  await themCongThuc(p, anh);
  await p.waitForFunction(() => document.querySelector('.ct-anh-bia') && document.querySelector('.ct-anh-bia').naturalWidth > 0);
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(ANH, `5-chi-tiet-cong-thuc-${may.ten}.png`) });
  await p.tap('text=‹ Quay lại');
  await p.fill('#oTim', 'ca phe');
  await p.waitForFunction(() => [...document.querySelectorAll('.the-ct img')].every((i) => i.naturalWidth > 0));
  const thay = await p.$$eval('.the-ct .ten-the', (e) => e.map((x) => x.textContent));
  kiem(thay.length === 2 && thay.includes('Egg Coffee'), `[${nhan}] tìm "ca phe" ra công thức có "Cà phê" (tên/nguyên liệu)`, thay.join(', '));
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(ANH, `4-cong-thuc-tim-kiem-${may.ten}.png`) });

  kiem(p.loiTrang.length === 0, `[${nhan}] không có lỗi JavaScript`, p.loiTrang.join(' | '));
  await ctx.close();
}

// ===== Kịch bản thật (iPhone 15) =====
{
  const { ctx, p } = await moApp(MAY[0]);
  kiem((await chipChon(p)).startsWith('Khách 1'), 'Mở app có sẵn Khách 1');
  await cham(p, 'vn-sua'); await cham(p, 'latte'); await cham(p, 'egg-coffee');
  await p.tap('#nutThemKhach');
  kiem((await chipChon(p)).startsWith('Khách 2'), '+ Khách tạo và chuyển sang Khách 2');
  await cham(p, 'vn-den'); await cham(p, 'mocha');
  await p.tap('.chip >> text=Khách 1');
  kiem((await p.textContent('#soTong')) === '118.000đ', 'Chuyển lại Khách 1: tổng 118.000đ', await p.textContent('#soTong'));
  await p.tap('#nutHoanTac');
  kiem((await p.textContent('#soTong')) === '63.000đ' && (await p.$('[data-mon="egg-coffee"] .sl')) === null, 'Hoàn tác xóa đúng món vừa bấm (Egg Coffee)', await p.textContent('#soTong'));
  await p.tap('#nutTong');
  await p.tap('.menh-gia [data-mg="50000"]');
  await p.tap('.menh-gia [data-mg="50000"]');
  kiem((await p.textContent('#tienThoi')) === 'Thối lại: 37.000đ', 'Bấm 2 lần 50k → Thối lại 37.000đ', await p.textContent('#tienThoi'));
  await p.tap('#nutXong');
  const chip = await chipChon(p);
  kiem(chip.startsWith('Khách 2') && (await p.$$('.chip')).length === 1, 'Xong → đang ở Khách 2, Khách 1 đã xóa', chip);
  kiem((await p.textContent('.thong-bao')).includes('Đã xong Khách 1'), 'Có thông báo "Đã xong Khách 1 · Hoàn lại"');
  const truocTai = await p.evaluate(() => JSON.stringify(window.__quan.trangThai().khach.map((k) => k.dong)));
  await p.reload();
  await p.waitForSelector('.o-mon');
  const sauTai = await p.evaluate(() => JSON.stringify(window.__quan.trangThai().khach.map((k) => k.dong)));
  kiem(truocTai === sauTai && (await chipChon(p)).startsWith('Khách 2') && (await p.textContent('#soTong')) === '65.000đ', 'Tải lại trang → order còn nguyên', `${await chipChon(p)} ${await p.textContent('#soTong')}`);

  // Chạm chip khách đang chọn → bảng nhãn A1–D10; chạm 1 ô là đặt tên
  await p.tap('.chip.chon');
  await p.waitForSelector('.bang-nhan');
  const nhan = await p.$$eval('.bang-nhan button', (b) => b.map((x) => x.textContent));
  kiem(nhan.length === 44 && nhan.slice(0, 4).join() === 'A1,B1,C1,D1' && nhan[39] === 'D10' && nhan.slice(40).join() === 'Take away 1,Take away 2,Take away 3,Take away 4',
    'Chạm chip khách → 4 cột A–D × 10 dòng + hàng Take away 1–4', `${nhan.length} ô: ${nhan.slice(0, 4).join(' ')} … ${nhan[39]} | ${nhan.slice(40).join(', ')}`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(ANH, '8-chon-ten-khach-iphone15.png') });
  await p.tap('.bang-nhan [data-nhan="B3"]');
  kiem((await p.textContent('.chip.chon .ten-chip')) === 'B3' && await p.isHidden('#sheet'), 'Chạm "B3" → khách thành B3 ngay (1 chạm)', await p.textContent('.chip.chon'));
  await p.reload();
  await p.waitForSelector('.o-mon');
  kiem((await p.textContent('.chip.chon .ten-chip')) === 'B3', 'Tên khách còn sau khi tải lại');
  await p.tap('.chip.chon');
  await p.tap('.bang-nhan [data-nhan="Take away 2"]');
  kiem((await p.textContent('.chip.chon .ten-chip')) === 'Take away 2', 'Chạm "Take away 2" → khách thành Take away 2');
  await p.tap('.chip.chon');
  await p.tap('#nutBoTen');
  kiem((await p.textContent('.chip.chon .ten-chip')) === 'Khách 2', '"Bỏ tên" → về "Khách 2"');

  // Nút ✕ trên chip đang chọn: xóa luôn cả khi có món, có Hoàn lại
  kiem(await p.isVisible('.chip.chon .xoa-chip'), 'Chip khách đang có món vẫn có nút ✕');
  await p.tap('.chip.chon .xoa-chip');
  kiem((await p.textContent('.thong-bao')).includes('Đã xóa Khách 2') && (await p.textContent('#soTong')) === '0đ', 'Bấm ✕ → xóa khách ngay (không cần hoàn tác trước)', await p.textContent('.thong-bao'));
  await p.tap('.thong-bao button');
  kiem((await chipChon(p)).startsWith('Khách 2') && (await p.textContent('#soTong')) === '65.000đ' && (await p.$$('.chip')).length === 1, 'Bấm "Hoàn lại" sau ✕ → khách quay lại đủ món');

  // Hoàn lại sau khi Xong nhầm
  await p.tap('#nutTong');
  await p.tap('#nutXong');
  await p.tap('.thong-bao button');
  kiem((await chipChon(p)).startsWith('Khách 2') && (await p.textContent('#soTong')) === '65.000đ', 'Bấm "Hoàn lại" khôi phục khách vừa Xong');

  // Công thức kèm ảnh, tải lại vẫn còn
  const anh = await taoAnhThu(p);
  await themCongThuc(p, anh);
  await p.reload();
  await p.waitForSelector('.o-mon');
  await p.tap('.tab[data-tab="congthuc"]');
  await p.waitForSelector('.the-ct[data-id^="ct"]');
  await p.tap('.the-ct[data-id^="ct"]');
  await p.waitForFunction(() => document.querySelector('.ct-anh-bia') && document.querySelector('.ct-anh-bia').naturalWidth > 0, null, { timeout: 5000 });
  const ctSau = await p.evaluate(() => ({ ten: document.querySelector('.ct-ten').textContent, w: document.querySelector('.ct-anh-bia').naturalWidth, h: document.querySelector('.ct-anh-bia').naturalHeight, nl: document.querySelectorAll('.ct-nl tr').length, buoc: document.querySelectorAll('.ct-buoc li').length }));
  kiem(ctSau.ten === 'Egg Coffee' && ctSau.nl === 3 && ctSau.buoc === 2 && ctSau.w === 1200 && ctSau.h === 900, 'Thêm công thức kèm ảnh → tải lại → ảnh và công thức còn nguyên (ảnh thu về 1200px)', JSON.stringify(ctSau));

  // Xem ảnh toàn màn
  await p.tap('.ct-anh-bia');
  kiem(await p.isVisible('#xemAnh img'), 'Chạm ảnh → xem toàn màn hình');
  await p.tap('.dong-xem');

  // Offline: tắt mạng vẫn mở được
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(500);
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForSelector('.o-mon', { timeout: 5000 });
  kiem((await p.textContent('#soTong')) === '65.000đ', 'Tắt mạng → app vẫn mở, dữ liệu còn');
  await ctx.setOffline(false);
  kiem(p.loiTrang.length === 0, 'Kịch bản không có lỗi JavaScript', p.loiTrang.join(' | '));
  await ctx.close();
}

// ===== Chịu tải: 25 khách, 600 lần chạm dồn dập, số tiền hiển thị luôn đúng =====
{
  const { ctx, p } = await moApp(MAY[0]);
  const kq = await p.evaluate(async () => {
    const gia = new Map(window.MENU_MAC_DINH.mon.map((m) => [m.id, m.gia]));
    const ids = [...gia.keys()];
    const tuTinh = new Map(); // id khách → tổng tiền tự tính độc lập
    let hat = 12345;
    const r = () => { hat = (hat * 1664525 + 1013904223) >>> 0; return hat / 4294967296; };
    const dinhDang = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
    for (let i = 0; i < 24; i++) document.getElementById('nutThemKhach').click();
    let lauNhat = 0, sai = 0;
    for (let i = 0; i < 600; i++) {
      if (r() < 0.08) {
        const chips = document.querySelectorAll('.chip:not(.chon)');
        chips[Math.floor(r() * chips.length)].click();
      }
      const id = ids[Math.floor(r() * ids.length)];
      const kId = window.__quan.trangThai().dangChon;
      const t0 = performance.now();
      document.querySelector(`[data-mon="${id}"]`).click();
      lauNhat = Math.max(lauNhat, performance.now() - t0);
      tuTinh.set(kId, (tuTinh.get(kId) || 0) + gia.get(id));
      if (document.getElementById('soTong').textContent !== dinhDang(tuTinh.get(kId))) sai++;
      if (i % 50 === 0) await new Promise((ok) => setTimeout(ok, 0));
    }
    const st = window.__quan.trangThai();
    const lechChip = [...document.querySelectorAll('.chip')].filter((c) => {
      const t = tuTinh.get(c.dataset.id) || 0;
      const k = t / 1000;
      return c.querySelector('.tien-chip').textContent !== (t ? (Number.isInteger(k) ? String(k).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'k' : '') : '0đ');
    }).length;
    return { khach: st.khach.length, lauNhat, sai, lechChip, tongLy: st.khach.reduce((s, k) => s + k.dong.reduce((a, d) => a + d.soLuong, 0), 0), tuTinh: [...tuTinh] };
  });
  kiem(kq.khach === 25 && kq.tongLy === 600, 'Chịu tải: 25 khách cùng lúc, 600 lần chạm đều được tính', `${kq.khach} khách, ${kq.tongLy} ly`);
  kiem(kq.sai === 0 && kq.lechChip === 0, 'Chịu tải: số tổng và tiền trên từng chip khớp 100% với cách tính độc lập', `sai ${kq.sai}/600, chip lệch ${kq.lechChip}`);
  kiem(kq.lauNhat < 50, 'Chịu tải: lần chạm chậm nhất vẫn < 50ms', `${kq.lauNhat.toFixed(1)}ms`);
  await p.reload();
  await p.waitForSelector('.o-mon');
  const sauTai = await p.evaluate((ds) => {
    const st = window.__quan.trangThai();
    const gia = new Map(st.menu.mon.map((m) => [m.id, m.gia]));
    return ds.every(([id, t]) => st.khach.find((k) => k.id === id).dong.reduce((s, d) => s + gia.get(d.monId) * d.soLuong, 0) === t);
  }, kq.tuTinh);
  kiem(sauTai, 'Chịu tải: tải lại trang → tiền của cả 25 khách còn nguyên');
  kiem(p.loiTrang.length === 0, 'Chịu tải: không có lỗi JavaScript', p.loiTrang.join(' | '));

  // Dữ liệu trên máy bị hỏng → app vẫn mở, bản hỏng được cất riêng (không ghi đè mất)
  // Ghi dữ liệu hỏng rồi chặn app tự lưu đè trước khi tải lại (giống máy tắt đột ngột lúc đang ghi)
  await p.evaluate(() => {
    localStorage.setItem('quanOrder.trangThai', '{hỏng');
    Storage.prototype.setItem = function () {};
  });
  await p.reload();
  await p.waitForSelector('.o-mon');
  const hong = await p.evaluate(() => ({
    cat: Object.keys(localStorage).filter((k) => k.startsWith('quanOrder.trangThai.hong.')).map((k) => localStorage.getItem(k)),
    chip: document.querySelector('.chip.chon').textContent,
  }));
  kiem(hong.cat.includes('{hỏng') && hong.chip.startsWith('Khách 1'), 'Dữ liệu bị hỏng → app vẫn mở bình thường, bản cũ được cất riêng', hong.chip);
  await ctx.close();
}

// ===== Ice / Hot ở đầu trang =====
{
  const { ctx, p } = await moApp(MAY[0]);
  kiem(await p.$eval('#chonKieu [data-kieu="ice"]', (b) => b.classList.contains('chon')), 'Mặc định đang chọn Ice');
  await cham(p, 'latte'); await cham(p, 'latte');
  await p.tap('#chonKieu [data-kieu="hot"]');
  await cham(p, 'latte'); await cham(p, 'americano');
  const hh = await p.evaluate(() => ({
    latte: [...document.querySelectorAll('[data-mon="latte"] .sl')].map((x) => x.textContent).join(' '),
    tomTat: document.getElementById('tomTat').textContent,
    tong: document.getElementById('soTong').textContent,
  }));
  kiem(hh.latte === '🔥1 ×2' && hh.tomTat === '2 Latte🧊 · 1 Latte🔥 · 1 Americano🔥' && hh.tong === '144.000đ',
    'Bật Hot → món chạm sau là Hot, tách riêng với Ice, tổng đúng', JSON.stringify(hh));
  await p.$eval('#luoiMenu', (e) => { e.scrollTop = 0; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(ANH, '9-ice-hot-iphone15.png') });
  await p.tap('#nutHoanTac');
  kiem((await p.textContent('#tomTat')) === '2 Latte🧊 · 1 Latte🔥', 'Hoàn tác bỏ đúng ly Hot vừa bấm');
  await p.tap('#nutDanhSach');
  const ds = await p.$$eval('.dong-ds .ten', (e) => e.map((x) => x.textContent));
  kiem(ds.length === 2 && ds[0].includes('Ice') && ds[1].includes('Hot'), 'Danh sách ghi rõ Ice / Hot từng dòng', ds.join(' | '));
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(ANH, '9b-danh-sach-ice-hot-iphone15.png') });
  await p.tap('.dong-ds:nth-of-type(2) [aria-label="Bớt"]').catch(async () => {
    const nut = await p.$$('.dong-ds [aria-label="Bớt"]'); await nut[1].tap();
  });
  kiem((await p.textContent('#tomTat')) === '2 Latte🧊', 'Nút − trong Danh sách bớt đúng dòng Hot');
  await p.tap('#nenSheet', { position: { x: 30, y: 40 } });
  await p.reload();
  await p.waitForSelector('.o-mon');
  kiem(await p.$eval('#chonKieu [data-kieu="hot"]', (b) => b.classList.contains('chon')) && (await p.textContent('#tomTat')) === '2 Latte🧊',
    'Tải lại: vẫn nhớ đang chọn Hot và order còn nguyên');
  kiem(p.loiTrang.length === 0, 'Ice / Hot không có lỗi JavaScript', p.loiTrang.join(' | '));
  await ctx.close();
}

// ===== Less sugar / Less ice =====
{
  const { ctx, p } = await moApp(MAY[0]);
  await cham(p, 'vn-sua');
  await p.tap('#nutItDuong');
  await cham(p, 'vn-sua');
  await p.tap('#nutItDa');
  await cham(p, 'vn-sua'); await cham(p, 'latte');
  const t1 = await p.textContent('#tomTat');
  kiem(t1 === '1 VN Sữa🧊 · 1 VN Sữa🧊 less sugar · 1 VN Sữa🧊 less sugar, less ice · 1 Latte🧊 less sugar, less ice' && (await p.textContent('#soTong')) === '113.000đ',
    'Bật Less sugar / Less ice → ly chạm sau được ghi kèm, tách dòng riêng, tổng đúng', t1);
  kiem((await p.textContent('[data-mon="vn-sua"] .sl')) === '×3', 'Ô món vẫn đếm tổng số ly (×3)');
  const dauTrang = await p.evaluate(() => ({ tomTat: document.getElementById('tomTat').getBoundingClientRect().height, dau: document.querySelector('.dau-order').getBoundingClientRect().height }));
  kiem(dauTrang.tomTat <= 21 && dauTrang.dau <= 80, 'Tóm tắt dài vẫn 1 dòng (cắt "…"), không đẩy lưới món xuống', JSON.stringify(dauTrang));
  await p.$eval('#luoiMenu', (e) => { e.scrollTop = 0; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(ANH, '10-less-sugar-ice-iphone15.png') });
  await p.tap('#nutDanhSach');
  await p.waitForTimeout(250);
  const ds = await p.$$eval('.dong-ds .ten', (e) => e.map((x) => x.textContent));
  kiem(ds[1].includes('Less sugar') && !ds[1].includes('Less ice') && ds[2].includes('Less sugar') && ds[2].includes('Less ice'), 'Danh sách ghi rõ Less sugar / Less ice từng dòng', ds.join(' | '));
  await p.screenshot({ path: path.join(ANH, '10b-danh-sach-less-iphone15.png') });
  await p.tap('#nenSheet', { position: { x: 30, y: 40 } });
  await p.waitForTimeout(400);
  await p.tap('#nutHoanTac');
  kiem(!(await p.textContent('#tomTat')).includes('Latte'), 'Hoàn tác bỏ đúng ly vừa bấm');
  // Hot → Less ice bị khóa
  await p.tap('#chonKieu [data-kieu="hot"]');
  kiem(await p.$eval('#nutItDa', (b) => b.disabled && !b.classList.contains('bat')), 'Chọn Hot → Less ice tự tắt và bị khóa');
  await cham(p, 'americano');
  kiem((await p.textContent('#tomTat')).endsWith('1 Americano🔥 less sugar'), 'Ly Hot chỉ ghi less sugar');
  await p.tap('#chonKieu [data-kieu="ice"]');
  // Thêm khách → tự tắt
  await p.tap('#nutThemKhach');
  kiem(await p.$eval('#nutItDuong', (b) => !b.classList.contains('bat')), 'Thêm / chuyển khách → Less sugar, Less ice tự tắt');
  await cham(p, 'vn-den');
  kiem((await p.textContent('#tomTat')) === '1 VN Đen🧊', 'Khách mới không bị dính ghi chú của khách trước');
  await p.reload();
  await p.waitForSelector('.o-mon');
  await p.tap('.chip >> text=Khách 1');
  kiem((await p.textContent('#tomTat')).includes('less sugar, less ice'), 'Tải lại: ghi chú vẫn còn');
  kiem(p.loiTrang.length === 0, 'Less sugar / ice không có lỗi JavaScript', p.loiTrang.join(' | '));
  await ctx.close();
}

// ===== Chạm đúp "Xong" không rơi xuống nút bên dưới =====
{
  const { ctx, p } = await moApp(MAY[0]);
  await cham(p, 'latte');
  await p.tap('#nutTong');
  await p.waitForTimeout(350); // đợi bảng trượt lên xong
  const xong = await (await p.$('#nutXong')).boundingBox();
  await p.touchscreen.tap(xong.x + xong.width / 2, xong.y + xong.height / 2);
  await p.touchscreen.tap(xong.x + xong.width / 2, xong.y + xong.height / 2);
  await p.waitForTimeout(400);
  kiem((await p.$eval('#manOrder', (e) => e.classList.contains('hien'))) && (await p.textContent('#soTong')) === '0đ',
    'Chạm đúp "Xong" → lần chạm thứ 2 không bấm nhầm nút bên dưới');
  await ctx.close();
}

// ===== Cài đặt: sửa menu, sáng/tối, sao lưu & khôi phục (kèm ảnh), xóa mẫu =====
{
  const { ctx, p } = await moApp(MAY[0]);
  await p.waitForFunction(() => window.__quan.congThuc().ds.some((c) => c.mau));
  await p.tap('.tab[data-tab="caidat"]');
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(ANH, '6-cai-dat-iphone15.png') });

  // Sửa giá VN Đá → 27k, bật bán chạy cho Latte
  await p.tap('.mon-cd >> text=VN Đá');
  await p.fill('#smGia', '27');
  await p.tap('#smLuu');
  await p.tap('.mon-cd >> text=Latte');
  await p.check('#smBanChay');
  await p.tap('#smLuu');
  // Đổi thứ tự: đưa Cà phê Ý lên trên Signature
  await p.tap('[data-nhom="cpy"] [aria-label="Lên"]');
  await p.tap('.tab[data-tab="order"]');
  const menuMoi = await p.evaluate(() => ({
    giaVnDa: document.querySelector('[data-mon="vn-da"] .gia').textContent,
    latteTo: document.querySelector('[data-mon="latte"]').classList.contains('ban-chay'),
    thuTu: [...document.querySelectorAll('.nhom-khoi')].slice(0, 3).map((s) => s.dataset.nhom).join(','),
  }));
  kiem(menuMoi.giaVnDa.startsWith('27k') && menuMoi.latteTo && menuMoi.thuTu === 'cpviet,cpy,signature', 'Sửa menu trong app: giá, bán chạy, thứ tự nhóm', JSON.stringify(menuMoi));

  // Thêm món mới
  await p.tap('.tab[data-tab="caidat"]');
  await p.tap('[data-nhom="tea"] .them-mon-cd');
  await p.fill('#smTen', 'Peach Tea');
  await p.fill('#smGia', '39');
  await p.tap('#smLuu');
  kiem(await p.isVisible('.mon-cd >> text=Peach Tea'), 'Thêm món mới vào nhóm Tea');

  // Chế độ tối
  await p.tap('.chon-doan >> text=Tối');
  await p.tap('.tab[data-tab="order"]');
  await p.tap('[data-mon="vn-sua"]'); await p.tap('[data-mon="latte"]');
  await p.waitForTimeout(300);
  const nenToi = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  kiem(nenToi === 'rgb(14, 15, 18)', 'Đổi sang chế độ tối', nenToi);
  await p.screenshot({ path: path.join(ANH, '7-order-che-do-toi-iphone15.png') });

  // Thêm công thức có ảnh rồi sao lưu
  await themCongThuc(p, await taoAnhThu(p));
  await p.tap('text=‹ Quay lại');
  await p.tap('.tab[data-tab="caidat"]');
  const [taiVe] = await Promise.all([p.waitForEvent('download'), p.tap('#nutXuat')]);
  const fileSL = path.join(ANH, '..', 'tam-sao-luu.json');
  await taiVe.saveAs(fileSL);
  const sl = JSON.parse(fs.readFileSync(fileSL, 'utf8'));
  kiem(sl.ung === 'quan-order' && sl.congThuc.length === 2 && sl.anh.length === 2 && sl.anh.every((a) => a.anh.startsWith('data:image/jpeg')) && sl.menu.mon.length === 50,
    'Sao lưu ra 1 file: menu + công thức + ảnh', `${sl.congThuc.length} công thức, ${sl.anh.length} ảnh, ${sl.menu.mon.length} món, ${Math.round(fs.statSync(fileSL).size / 1024)} KB`);

  // Xóa dữ liệu mẫu
  await p.tap('text=Xóa dữ liệu mẫu');
  await p.waitForFunction(() => !window.__quan.congThuc().ds.some((c) => c.mau));
  kiem(true, 'Xóa dữ liệu mẫu');
  kiem(p.loiTrang.length === 0, 'Cài đặt không có lỗi JavaScript', p.loiTrang.join(' | '));
  await ctx.close();

  // Máy "mới" khôi phục từ file
  const moi = await moApp(MAY[0]);
  await moi.p.tap('.tab[data-tab="caidat"]');
  await moi.p.setInputFiles('#fileKhoiPhuc', fileSL);
  await moi.p.waitForFunction(() => window.__quan.congThuc().ds.some((c) => c.ten === 'Egg Coffee'), null, { timeout: 8000 });
  await moi.p.tap('.tab[data-tab="congthuc"]');
  await moi.p.waitForFunction(() => {
    const img = document.querySelector('.the-ct[data-id^="ct"] img');
    return img && img.naturalWidth > 0;
  }, null, { timeout: 8000 });
  const kp = await moi.p.evaluate(() => ({ ct: window.__quan.congThuc().ds.length, mon: window.__quan.trangThai().menu.mon.length, toi: document.documentElement.dataset.theme }));
  kiem(kp.ct === 2 && kp.mon === 50, 'Khôi phục từ file trên máy khác: công thức + ảnh + menu', JSON.stringify(kp));
  fs.unlinkSync(fileSL);
  await moi.ctx.close();
}

await trinh.close();
mayChu.close();
console.log(ketQua.join('\n'));
console.log(`\n${ketQua.length - soLoi}/${ketQua.length} kiểm tra đạt. Ảnh: tests/anh-chup/`);
process.exit(soLoi ? 1 : 0);
