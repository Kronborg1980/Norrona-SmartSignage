/* Cache application shell on Tizen browsers which support service workers.
   The player itself controls atomic media/manifest activation. */
var CACHE='signage-shell-20261028-3';
var SHELL=['/player.html','/player.css','/player.js','/shared.js','/player-config.js'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL);}));self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k.indexOf('signage-shell-')===0&&k!==CACHE;}).map(function(k){return caches.delete(k);}));}));self.clients.claim();});
self.addEventListener('fetch',function(e){
 var u=new URL(e.request.url);if(u.origin!==self.location.origin||e.request.method!=='GET')return;
 // Cloudflare assets redirect /player.html to /player. Both routes and debug
 // query options must use the same cached shell during an offline restart.
 var shellPath=u.pathname==='/player'?'/player.html':u.pathname;
 if(SHELL.indexOf(shellPath)!==-1)e.respondWith(caches.open(CACHE).then(function(c){return c.match(shellPath);}).then(function(cached){
  // Cache.addAll follows the .html redirect. Navigation reloads use redirect
  // mode "manual", which rejects a stored response with redirected=true.
  if(cached&&cached.redirected)return new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers:cached.headers});
  return cached||fetch(e.request);
 }));
 if(u.pathname.indexOf('/media/')===0)e.respondWith(caches.open('signage-media-v1').then(function(c){return c.match(e.request).then(function(found){return found||fetch(e.request);});}));
});
