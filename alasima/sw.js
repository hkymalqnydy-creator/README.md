/* «متجر العاصمة» is now PITLANE (../pitlane/). A phone that saved the old app gets this worker on its next visit:
   it clears the old offline copy, takes the open pages, steps aside, and opens them at the new address. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('alasima-')) await caches.delete(k);
  await self.clients.claim();
  const pages = await self.clients.matchAll({ type: 'window' });
  await self.registration.unregister();
  const to = new URL('../pitlane/', self.location).href;
  await Promise.all(pages.map(p => p.navigate(to).catch(() => {})));
})()));
