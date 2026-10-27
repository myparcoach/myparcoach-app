// MyParCoach Service Worker
// Caches the app for offline use on the golf course

const CACHE_NAME = 'myparcoach-v1';
const SUPABASE_URL = 'https://emqeisfhnkuiuskzokvo.supabase.co';

const CACHE_URLS = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_URLS).catch(err => {
        console.warn('SW: Some cache items failed to load', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.href.includes(SUPABASE_URL) || url.href.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'offline', message: 'No connection — your round will sync when you reconnect.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }
  if (url.href.includes('jsdelivr.net') || url.href.includes('cdn.')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && (
          event.request.destination === 'document' ||
          url.pathname === '/' ||
          url.pathname.endsWith('.html')
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match('/') || caches.match('/index.html');
      });
    })
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-rounds') {
    event.waitUntil(syncPendingRounds());
  }
});

async function syncPendingRounds() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_ROUNDS' });
  });
}
