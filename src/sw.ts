/**
 * UnivLabs CCP Surgical Portal - Service Worker Registration
 */

export function registerServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = '/sw.js';
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) {
              return;
            }
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New clinical shell update available
                  console.info('[UnivLabs PWA] New version available. Refresh to update.');
                  window.dispatchEvent(new CustomEvent('pwa:update-available'));
                } else {
                  console.info('[UnivLabs PWA] Surgical Offline Shell cached and active.');
                  window.dispatchEvent(new CustomEvent('pwa:installed'));
                }
              }
            };
          };
        })
        .catch((error) => {
          console.error('[UnivLabs PWA] Service worker registration error:', error);
        });
    });
  }
}

export function unregisterServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
