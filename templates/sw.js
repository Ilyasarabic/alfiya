// templates/sw.js
const CACHE_NAME = 'alfiya-pwa-v2.1.0';
const urlsToCache = [
  '/',
  '/app/',
  '/dashboard/',
  '/static/css/style.css',
  '/manifest.json'
  // УБРАЛИ проблемные URL - они вызывают ошибки
];

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('🔧 Service Worker: Caching files');
        // Кэшируем по одному чтобы избежать ошибок
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => {
              console.log(`❌ Failed to cache ${url}:`, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('🔧 Service Worker: Activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache.startsWith('alfiya-pwa-') && cache !== CACHE_NAME) {
            console.log('🔧 Service Worker: Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then((fetchResponse) => {
            if (!fetchResponse || fetchResponse.status !== 200) {
              return fetchResponse;
            }

            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return fetchResponse;
          })
          .catch(() => {
            if (event.request.destination === 'document') {
              return caches.match('/app/');
            }
          });
      })
  );
});
