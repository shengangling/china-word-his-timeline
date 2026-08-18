/* 中外历史对照时间轴 · 离线缓存
   改动页面内容后，把 VERSION 加一位，用户下次联网打开即可拿到新版本。 */
const VERSION = 'v1';
const CACHE = 'timeline-' + VERSION;

/* 应用外壳：全部为同目录静态文件，装好后即可完全离线运行 */
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      /* 逐个添加：任一图标缺失也不至于让整个安装失败 */
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 页面导航：优先网络（联网时能及时拿到新版），超时或断网则回落到缓存 */
function networkFirst(req){
  return new Promise(resolve => {
    let settled = false;
    const done = r => { if(!settled){ settled = true; resolve(r); } };
    const fallback = () => caches.match(req, {ignoreSearch:true})
      .then(hit => hit || caches.match('./index.html') || caches.match('./'))
      .then(hit => done(hit || new Response(
        '<meta charset="utf-8"><p style="font:16px system-ui;padding:24px">离线且尚未缓存，请联网打开一次。</p>',
        {headers:{'Content-Type':'text/html; charset=utf-8'}}
      )));
    const timer = setTimeout(fallback, 3500);
    fetch(req).then(res => {
      clearTimeout(timer);
      if(res && res.ok){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(()=>{});
      }
      done(res);
    }).catch(() => { clearTimeout(timer); fallback(); });
  });
}

/* 静态资源：缓存优先，后台顺带刷新 */
function cacheFirst(req){
  return caches.match(req, {ignoreSearch:true}).then(hit => {
    const net = fetch(req).then(res => {
      if(res && res.ok){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      }
      return res;
    }).catch(() => hit);
    return hit || net;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   /* 不接管跨域请求 */

  if(req.mode === 'navigate'){
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(cacheFirst(req));
  }
});

/* 页面可主动要求立即启用新版本 */
self.addEventListener('message', e => {
  if(e.data === 'skipWaiting') self.skipWaiting();
});
