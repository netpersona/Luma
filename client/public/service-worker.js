const CACHE_NAME = 'luma-v3'; // Updated to force service worker refresh
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  // Don't intercept requests to external storage (uploads, downloads, etc.)
  const url = new URL(event.request.url);
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('storage.googleapis.com') ||
      url.hostname.includes('googleusercontent.com')) {
    // Let these requests pass through without service worker interference
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, icon, tag, url } = data;

    const options = {
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'default',
      data: { url: url || '/' },
      requireInteraction: false,
      vibrate: [200, 100, 200],
    };

    event.waitUntil(
      self.registration.showNotification(title || 'Luma', options)
    );
  } catch (e) {
    console.error('Error showing push notification:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
