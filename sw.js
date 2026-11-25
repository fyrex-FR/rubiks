/* Le mode hors ligne du Grand Tournoi du Cube.
   - Le site (pages, scripts, Three.js, polices) : on prend la version en ligne si possible, sinon celle gardée.
     Les mises à jour arrivent donc toutes seules dès que l'iPad a Internet.
   - Les voix (audio/*.mp3?v=voix) : gardées une fois pour toutes ; toutes sont téléchargées en arrière-plan. */
const SHELL = 'tournoi-site-v2';   // v2: purge les copies périmées gardées par la v1
const AUDIO = 'tournoi-voix-v1';
const THREE = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/speech.js', 'js/voice.js', 'js/cube.js', 'js/cube3d.js', 'js/content.js', 'js/solver.js', 'js/photo.js', 'js/app.js',
  'icons/icon-192.png', 'icons/apple-touch-icon.png', 'audio/manifest.json', THREE,
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== AUDIO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Télécharge toutes les voix qui manquent, et oublie celles qui ne servent plus (ancienne voix)
async function precacheAudio() {
  const r = await fetch('audio/manifest.json', { cache: 'no-cache' });
  if (!r.ok) return;
  const manifest = await r.json();
  const wanted = new Set(Object.values(manifest).map((f) => new URL('audio/' + f, self.registration.scope).href));
  const cache = await caches.open(AUDIO);
  for (const req of await cache.keys()) if (!wanted.has(req.url)) await cache.delete(req);
  const have = new Set((await cache.keys()).map((q) => q.url));
  const todo = [...wanted].filter((u) => !have.has(u));
  const worker = async () => {
    while (todo.length) {
      const url = todo.shift();
      try { const res = await fetch(url); if (res.ok) await cache.put(url, res); } catch (err) { /* plus tard */ }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}
self.addEventListener('message', (e) => {
  if (e.data === 'precache-audio') e.waitUntil(precacheAudio());
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req, { cache: 'no-cache' });   // revalide: ne jamais resservir le cache HTTP du navigateur
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    return hit || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
  }
}
async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (/\/audio\/[^/]+\.mp3$/.test(url.pathname)) e.respondWith(cacheFirst(req, AUDIO));
    else e.respondWith(networkFirst(req));
  } else if (/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(cacheFirst(req, SHELL));
  }
});
