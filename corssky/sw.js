/* The app moved to ../crossky/. This takes the place of the old offline worker of this address: it deletes the old
   caches, removes itself and reloads open pages, which then follow the redirect in index.html. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('corssky-')) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
