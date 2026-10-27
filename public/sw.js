/* Cache application shell on Tizen browsers which support service workers.
   The player itself controls atomic media/manifest activation. */
var CACHE='signage-shell-20261027-1';
var SHELL=['/player.html','/player.css','/player.js','/shared.js','/player-config.js'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL);}));self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k.indexOf('signage-shell-')===0&&k!==CACHE;}).map(function(k){return caches.delete(k);}));}));self.clients.claim();});
self.addEventListener('fetch',function(e){
 var u=new URL(e.request.url);if(u.origin!==self.location.origin||e.request.method!=='GET')return;
 if(SHELL.indexOf(u.pathname)!==-1)e.respondWith(caches.match(e.request).then(function(cached){return cached||fetch(e.request);}));
 if(u.pathname.indexOf('/media/')===0)e.respondWith(caches.open('signage-media-v1').then(function(c){return c.match(e.request).then(function(found){return found||fetch(e.request);});}));
});
