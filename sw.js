// 安裝到手機桌面用的 Service Worker。
// 網頁本體（app shell）先用上次存下來的立刻打開，同時在背景抓最新版存起來，下次打開就是新版。
// 後端（Apps Script）與 LINE 都是外部網址，不經過這裡、不會被快取；音樂（audio/）也不經過這裡，點播放才下載。
const CACHE = 'loveletter-v17';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg',
  './icons/favicon-32.png', './icons/apple-touch-icon.png', './icons/maskable-512.png', './img/in-christ.svg', './img/themes/rose.svg', './img/themes/sky.svg', './img/themes/kraft.svg', './img/themes/mint.svg', './img/themes/winter.svg', './img/themes/midautumn.svg', './img/themes/duanwu.svg', './img/themes/chuxi.svg', './img/themes/winterbreak.svg', './img/themes/summer.svg', './img/themes/xmas.svg', './img/themes/newyear.svg', './img/themes/thanks.svg', './img/themes/grad.svg', './img/themes/birthday.svg', './img/themes/gospel.svg', './img/themes/love.svg', './img/themes/shepherd.svg', './img/themes/build.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // LINE 登入、後端等外部請求不經過這裡
  if (/\/audio\//.test(url.pathname)) return; // 背景音樂常用分段下載（Range），交給瀏覽器自己處理
  // 圖示與 logo 幾乎不會變：直接用存好的，省下網路往返
  if (/\/(icons|img)\//.test(url.pathname)) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; })));
    return;
  }
  // 存的時候去掉 ?letter=… 這類參數，同一頁只留一份，不會每封信都多存一份；只存成功的回應
  const key = url.origin + url.pathname;
  const fresh = fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  });
  e.waitUntil(fresh.catch(() => {}));
  e.respondWith(caches.match(key).then(hit => hit || fresh));
});
