<<<<<<< Updated upstream
/* CIG dashboard update worker 0.1.115 v0.1.115 */
=======
/* CIG dashboard update worker 0.1.96 v0.1.96 */
>>>>>>> Stashed changes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
