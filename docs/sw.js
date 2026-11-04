// 서비스 워커: 앱 파일과 SQL 실행기(sql.js)를 폰에 저장해 두고 인터넷 없이도 쓰게 한다.
// 내용을 고치면 VERSION 숫자를 올려야 폰에서 새 버전을 받는다 (tools/build_app.py --bump).
const VERSION = 'sqld-v2';
const PY_CACHE = 'sqld-sqljs';                 // SQL 실행기는 버전이 바뀌어도 다시 받지 않게 따로 보관
const FILES = ['./', 'index.html', 'app.js', 'content.js', 'manifest.json', 'install-helper.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== PY_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // sql.js(SQL 실행기): 한 번 받으면 저장해 두고 계속 사용
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/sql.js@')) {
    e.respondWith(caches.open(PY_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // 화면·내용 파일은 인터넷을 먼저 시도해 최신으로, 안 되면 저장본
  if (req.mode === 'navigate' || /\.(js|html)$/.test(url.pathname)) {
    e.respondWith(fetch(req)
      .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req.mode === 'navigate' ? './' : req, copy)); return res; })
      .catch(() => caches.match(req.mode === 'navigate' ? './' : req)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
