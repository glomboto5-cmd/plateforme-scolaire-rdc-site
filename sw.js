// Glody School · fonctionnement hors connexion et notifications.
const CACHE = 'glody-school-v2';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
// Toucher une notification ouvre (ou ramène) l'application.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
// Prêt pour les notifications envoyées par le serveur (Web Push).
self.addEventListener('push', e => {
  let d = { titre: 'Glody School', texte: 'Nouvelle information de l’école.' };
  try { d = { ...d, ...e.data.json() }; } catch { /* message texte */ }
  e.waitUntil(self.registration.showNotification(d.titre, { body: d.texte, icon: 'icon-192.png', badge: 'icon-192.png' }));
});
