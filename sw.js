/* Service worker: lưu sẵn toàn bộ app để chạy khi mất mạng.
 * Mỗi lần sửa app, tăng PHIEN_BAN để điện thoại tải bản mới.
 * Dữ liệu (order, menu, công thức, ảnh) nằm ở localStorage/IndexedDB nên không bị mất khi cập nhật. */
const PHIEN_BAN = 'quan-order-v1.0.4';
const TEP = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './core.js',
  './menu.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(PHIEN_BAN).then(function (c) {
    return c.addAll(TEP.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ds) {
    return Promise.all(ds.filter(function (k) { return k !== PHIEN_BAN; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Ưu tiên bản đã lưu (mở nhanh, chạy offline); không có thì tải mạng rồi lưu lại
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then(function (r) { return r || fetch(req); }));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || fetch(req).then(function (res) {
      if (res.ok) {
        const ban = res.clone();
        caches.open(PHIEN_BAN).then(function (c) { c.put(req, ban); });
      }
      return res;
    });
  }));
});
