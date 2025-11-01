// static/sw.js

// Service Worker для PWA
const CACHE_NAME = 'alfiya-pwa-v1.0.0';

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activated');
    return self.clients.claim();
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
    // Пропускаем запросы к API
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .catch(() => {
                // Fallback для страниц
                if (event.request.destination === 'document') {
                    return caches.match('/');
                }
            })
    );
});