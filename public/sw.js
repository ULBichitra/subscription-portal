/// <reference lib="webworker" />

const CACHE_NAME = 'ccp-portal-static-v1';
const API_CACHE_NAME = 'ccp-portal-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/icon-192.svg',
  '/icon-512.svg',
  '/icon-maskable.svg',
];

// 1. Install: Precache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate: Clean stale caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper: Network with timeout (3s) for API
const fetchWithTimeout = (request, timeoutMs = 3000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Network timeout (3s)'));
    }, timeoutMs);

    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// 3. Fetch routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass 1: Non-GET requests (MUTATIONS must go directly to network)
  if (request.method !== 'GET') {
    return;
  }

  // Bypass 2: WebSocket connections and SSE / real-time streaming feeds
  if (
    url.pathname.startsWith('/ws') ||
    url.pathname.startsWith('/portal/events') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:' ||
    request.headers.get('Upgrade') === 'websocket' ||
    request.headers.get('Accept')?.includes('text/event-stream')
  ) {
    return; // SW bypass: direct network
  }

  // Strategy A: Network-First (3s timeout) for API endpoints (/portal/towers, /portal/dashboard, /portal/recharges, etc.)
  const isApiEndpoint = 
    url.pathname.includes('/portal/towers') ||
    url.pathname.includes('/portal/dashboard') ||
    url.pathname.includes('/portal/recharges') ||
    url.pathname.includes('/portal/requests') ||
    url.pathname.includes('/portal/complaints') ||
    url.pathname.includes('/portal/subscriptions') ||
    url.pathname.includes('/portal/customers') ||
    url.pathname.includes('/portal/balance') ||
    url.pathname.includes('/portal/billing') ||
    url.pathname.includes('/portal/pricing') ||
    url.pathname.includes('/portal/audit') ||
    url.pathname.includes('/portal/logs') ||
    url.pathname.startsWith('/api/');

  if (isApiEndpoint) {
    event.respondWith(
      fetchWithTimeout(request.clone(), 3000)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status >= 200 && networkResponse.status < 300) {
            const responseClone = networkResponse.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Fallback to cached API response
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-Clinical-Offline-Cached', 'true');
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers,
            });
          }
          // If no cache, return JSON offline indicator
          return new Response(
            JSON.stringify({
              offline: true,
              message: 'Clinical Gateway Offline · Telemetry Cached/Unavailable',
              timestamp: new Date().toISOString(),
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // Strategy B: Stale-While-Revalidate for Static UI assets (HTML, CSS, JS, SVG, fonts, etc.)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline and navigating, return root cached page
          if (request.mode === 'navigate') {
            const cachedShell = (await caches.match('/index.html')) || (await caches.match('/'));
            if (cachedShell) {
              return cachedShell;
            }
          }
          return new Response('Service Unavailable or Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });

      return cachedResponse || fetchPromise;
    })
  );
});
