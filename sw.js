/* ═══════════════════════════════════════
   ORDEM PARANORMAL — SERVICE WORKER
   Estratégia: Cache-First para assets,
   Network-First para dados dinâmicos
═══════════════════════════════════════ */

const CACHE_NAME   = 'painel-mestre-v1';
const OFFLINE_URL  = '/index.html';

// Arquivos para cache imediato na instalação
const PRECACHE = [
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Share+Tech+Mono&display=swap',
];

// ── INSTALL ─────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests não-GET e chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Fontes do Google — Cache-First
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // App shell (index.html) — Network-First com fallback offline
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Demais assets — Cache-First
  event.respondWith(cacheFirst(request));
});

// ── ESTRATÉGIAS ─────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback para index.html (SPA offline)
    return caches.match(OFFLINE_URL);
  }
}

// ── SYNC em background (futuro) ──────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-campaigns') {
    // Placeholder para sync futuro com backend
    console.log('Background sync: campaigns');
  }
});

// ── PUSH notifications (futuro) ─────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Painel do Mestre RPG', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    data: { url: data.url || '/' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
