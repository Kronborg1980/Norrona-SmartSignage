/* Shared layout & scheduling contract, ES5-compatible entry for Tizen. */
(function (root) {
  'use strict';
  function activeSchedule(s, screen, at) {
    var d = at instanceof Date ? at : new Date(at);
    if (isNaN(d.getTime()) || !s.enabled) return false;
    if (s.scope === 'screen' && s.target !== screen.id) return false;
    if (s.scope === 'zone' && s.target !== screen.zone) return false;
    if (s.scope !== 'all' && s.scope !== 'zone' && s.scope !== 'screen') return false;
    if (s.start_utc && d.getTime() < Date.parse(s.start_utc)) return false;
    if (s.end_utc && d.getTime() > Date.parse(s.end_utc)) return false;
    var days = Array.isArray(s.days) ? s.days : [];
    var day = d.getUTCDay();
    var mins = d.getUTCHours() * 60 + d.getUTCMinutes();
    var partsA = String(s.start_time || '00:00').split(':');
    var partsB = String(s.end_time || '23:59').split(':');
    var begin = Number(partsA[0]) * 60 + Number(partsA[1]);
    var end = Number(partsB[0]) * 60 + Number(partsB[1]);
    if (!isFinite(begin) || !isFinite(end)) return false;
    if (begin <= end) return days.indexOf(day) !== -1 && mins >= begin && mins <= end;
    // Overnight window: after start on selected day, or before end next day.
    return (days.indexOf(day) !== -1 && mins >= begin) ||
      (days.indexOf((day + 6) % 7) !== -1 && mins <= end);
  }
  function resolveLayout(manifest, at) {
    if (!manifest || !manifest.screen) return null;
    var booking = pickBooking(manifest, 'screen', manifest.screen.id, at);
    if (booking) {
      if (booking.item_type === 'layout') {
        var bookedLayouts = manifest.layouts || [];
        for (var bi = 0; bi < bookedLayouts.length; bi++) if (bookedLayouts[bi].id === booking.item_id) return bookedLayouts[bi];
      } else {
        var item = findContent(manifest, booking.item_id);
        if (item) {
          var portrait = manifest.screen.orientation === 'portrait';
          return {id:'booking:' + booking.id + ':' + item.version,orientation:portrait ? 'portrait' : 'landscape',background:'#071220',widgets:[Object.assign({}, item.widget, {id:'fullscreen:' + booking.id,x:0,y:0,w:portrait ? 1080 : 1920,h:portrait ? 1920 : 1080,z:0})]};
        }
      }
    }
    var active = (manifest.schedules || []).filter(function (s) {
      return activeSchedule(s, manifest.screen, at);
    });
    active.sort(function (a, b) { return Number(b.priority) - Number(a.priority) || a.id.localeCompare(b.id); });
    var id = active.length ? active[0].layout_id : manifest.screen.layout_id;
    var layouts = manifest.layouts || [];
    for (var i = 0; i < layouts.length; i++) if (layouts[i].id === id) return layouts[i];
    return null;
  }
  // Date/weekday belongs to the start of an overnight window. The end minute
  // is inclusive, as in the existing UTC schedule contract.
  function bookingWindow(b, at) {
    var d = new Date(at), ms = d.getTime();
    if (!b.enabled || !isFinite(ms)) return null;
    var a = String(b.start_time || '00:00').split(':'), z = String(b.end_time || '23:59').split(':');
    var begin = Number(a[0]) * 60 + Number(a[1]), end = Number(z[0]) * 60 + Number(z[1]);
    var mins = d.getUTCHours() * 60 + d.getUTCMinutes(), day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (begin <= end) { if (mins < begin || mins > end) return null; }
    else if (mins <= end) day -= 86400000;
    else if (mins < begin) return null;
    var anchor = new Date(day), date = anchor.toISOString().slice(0,10);
    if ((b.days || []).indexOf(anchor.getUTCDay()) < 0 || b.start_date && date < b.start_date || b.end_date && date > b.end_date) return null;
    return day + begin * 60000;
  }
  function findContent(manifest, id) {
    var items = manifest.content || [];
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }
  function pickBooking(manifest, scope, target, at) {
    var screen = manifest.screen || {}, instant = new Date(at).getTime();
    var pool = (manifest.bookings || []).filter(function(b) {
      if (scope === 'channel' ? b.scope !== 'channel' || b.target !== target : !(b.scope === 'all' || b.scope === 'screen' && b.target === screen.id || b.scope === 'zone' && b.target === screen.zone)) return false;
      return bookingWindow(b, at) !== null;
    });
    if (!pool.length) return null;
    function specificity(b) { return b.scope === 'screen' ? 2 : b.scope === 'zone' ? 1 : 0; }
    pool.sort(function(a,b) { return b.priority - a.priority || specificity(b) - specificity(a) || a.position - b.position || a.id.localeCompare(b.id); });
    var first = pool[0];pool = pool.filter(function(b) { return b.priority === first.priority && specificity(b) === specificity(first); });
    var anchor = pool.reduce(function(min,b) { return Math.min(min,bookingWindow(b,at)); },Infinity);
    var total = pool.reduce(function(sum,b) { return sum + Math.max(1, Number(b.duration) || 10); },0);
    var cursor = ((instant - anchor) / 1000 % total + total) % total;
    for (var i = 0; i < pool.length; i++) { cursor -= Math.max(1, Number(pool[i].duration) || 10); if (cursor < 0) return pool[i]; }
    return first;
  }
  function resolveWidgets(layout, manifest, at) {
    return (layout.widgets || []).map(function(area) {
      if (area.type !== 'channel') return {key:area.id,widget:area};
      var b = pickBooking(manifest,'channel',area.channel_id,at), item = b && findContent(manifest,b.item_id);
      if (!item) return {key:area.id + ':empty',widget:Object.assign({},area,{type:'empty'})};
      var w = Object.assign({}, item.widget, {id:area.id,x:area.x,y:area.y,w:area.w,h:area.h,z:area.z,radius:area.radius || 0,opacity:(area.opacity == null ? 1 : area.opacity) * (item.widget.opacity == null ? 1 : item.widget.opacity)});
      if (w.background === 'transparent' || !w.background) w.background = area.background || 'transparent';
      return {key:area.id + ':' + b.id + ':' + item.version,widget:w};
    });
  }
  function normalizeWidget(w, orientation) {
    w = w || {};
    var width = orientation === 'portrait' ? 1080 : 1920;
    var height = orientation === 'portrait' ? 1920 : 1080;
    return {
      id: String(w.id || ''), type: String(w.type || 'text'),
      channel_id: String(w.channel_id || ''),
      x: Math.max(0, Math.min(width, Number(w.x) || 0)),
      y: Math.max(0, Math.min(height, Number(w.y) || 0)),
      w: Math.max(20, Math.min(width, Number(w.w) || 400)),
      h: Math.max(20, Math.min(height, Number(w.h) || 150)),
      z: Math.max(0, Math.min(999, Number(w.z) || 0)),
      html: String(w.html || ''), htmlNetwork: w.htmlNetwork === true, text: String(w.text || ''), src: String(w.src || ''),
      color: String(w.color || '#ffffff'), background: String(w.background || 'transparent'),
      fontFamily: String(w.fontFamily || 'Arial'), bold: w.bold === true, italic: w.italic === true, underline: w.underline === true,
      lineHeight: Math.max(0.8, Math.min(3, Number(w.lineHeight) || 1.16)),
      letterSpacing: Math.max(-5, Math.min(30, Number(w.letterSpacing) || 0)),
      verticalAlign: ['top','middle','bottom'].indexOf(w.verticalAlign) >= 0 ? w.verticalAlign : 'middle',
      opacity: w.opacity == null ? 1 : Math.max(0, Math.min(1, Number(w.opacity))),
      fontSize: Math.max(10, Math.min(300, Number(w.fontSize) || 48)),
      align: String(w.align || 'left'), fit: String(w.fit || 'contain'),
      radius: Math.max(0, Math.min(200, Number(w.radius) || 0)),
      speed: Math.max(5, Math.min(180, Number(w.speed) || 40))
    };
  }
  var fonts = ['Arial','Helvetica','Verdana','Tahoma','Trebuchet MS','Times New Roman','Georgia','Courier New','Impact','Comic Sans MS','Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Raleway','Noto Sans'];
  function widgetStyle(w) {
    return {fontFamily: JSON.stringify(fonts.indexOf(w.fontFamily) >= 0 ? w.fontFamily : 'Arial') + ', sans-serif',
      fontWeight: w.bold ? '700' : '400', fontStyle: w.italic ? 'italic' : 'normal', textDecoration: w.underline ? 'underline' : 'none',
      lineHeight: String(w.lineHeight == null ? 1.16 : w.lineHeight), letterSpacing: (w.letterSpacing || 0) + 'px', opacity: String(w.opacity == null ? 1 : w.opacity)};
  }
  var widgetMessagesReady = false;
  function widgetDiagnostics() {
    if (widgetMessagesReady || !root.addEventListener) return;
    widgetMessagesReady = true;
    root.addEventListener('message', function(e) {
      var data = e.data;
      if (!data || data.type !== 'signage-widget-network' || typeof data.host !== 'string' || !/^[a-z0-9.:-]{1,160}$/i.test(data.host)) return;
      var frames = document.querySelectorAll('iframe[data-signage-widget]');
      for (var i = 0; i < frames.length; i++) {
        if (frames[i].contentWindow !== e.source) continue;
        var box = frames[i].parentElement, note = box.querySelector('.widget-runtime-hint');
        var kind = ['weather','wind','marine'].indexOf(data.kind) >= 0 ? data.kind : '';
        var key = data.host + '/' + kind, problems = frames[i]._signageProblems || (frames[i]._signageProblems = {});
        if (data.ok === true && data.stale !== true) delete problems[key]; else problems[key] = data;
        var keys = Object.keys(problems);
        if (!keys.length) { if (note) note.remove(); return; }
        data = problems[keys[0]];
        if (!note) {
          note = document.createElement('div'); note.className = 'widget-runtime-hint';
          note.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:8px;background:#600e;font:14px Arial,sans-serif;color:white;z-index:2147483647;pointer-events:none';
          box.appendChild(note);
        }
        note.setAttribute('data-host', data.host);
        var weather = data.host === 'api.open-meteo.com' || data.host === 'marine-api.open-meteo.com';
        note.style.background = weather ? '#674500ee' : '#600e';
        if (weather && data.stale === true) {
          var age = Number(data.age);
          note.textContent = 'Weather temporarily unavailable. Showing cached weather' + (isFinite(age) && age >= 0 ? ' from ' + Math.ceil(age / 60) + ' min ago.' : '.') + ' Ship data continues.';
        } else if (weather && data.status === 429) note.textContent = 'Weather service is busy (HTTP 429). Retrying later; ship data continues.';
        else note.textContent = 'Widget connection failed: ' + data.host + (Number.isInteger(data.status) && data.status >= 400 && data.status <= 599 ? ' (HTTP ' + data.status + ')' : ' (network or CORS).');
        return;
      }
    });
  }
  // Runs inside the opaque sandbox. Only host/status is reported, never URLs,
  // request headers, credentials or response bodies. Known weather GETs use the
  // fixed shared cache endpoint; other requests retain their existing behavior.
  function widgetMonitor(weatherEndpoint) {
    function weatherRequest(url, method) {
      try {
        var u = new URL(typeof url === 'string' ? url : url.url, document.baseURI), p = u.searchParams;
        if (String(method || 'GET').toUpperCase() !== 'GET' || u.protocol !== 'https:' || u.username || u.password || u.port) return null;
        // Only the three known public queries are adapted. API keys, custom
        // fields/units and other integrations continue directly as authored.
        var allowed = ['latitude','longitude','current','temperature_unit','timezone','wind_speed_unit','_'];
        var valid = true; p.forEach(function(value,key) { if (allowed.indexOf(key) < 0 || p.getAll(key).length !== 1) valid = false; });
        if (!valid) return null;
        var fields = String(p.get('current') || '').split(',').sort().join(','), kind;
        if (u.hostname === 'api.open-meteo.com' && u.pathname === '/v1/forecast') {
          if (fields === 'temperature_2m,weathercode' && p.get('temperature_unit') === 'celsius' && p.get('timezone') === 'auto' && !p.has('wind_speed_unit')) kind = 'weather';
          if (fields === 'wind_direction_10m,wind_speed_10m' && p.get('wind_speed_unit') === 'ms' && !p.has('temperature_unit') && !p.has('timezone')) kind = 'wind';
        } else if (u.hostname === 'marine-api.open-meteo.com' && u.pathname === '/v1/marine' && fields === 'wave_direction,wave_height' && !p.has('temperature_unit') && !p.has('timezone') && !p.has('wind_speed_unit')) kind = 'marine';
        if (!kind) return null;
        var target = new URL(weatherEndpoint); target.search = 'kind=' + kind + '&latitude=' + encodeURIComponent(p.get('latitude') || '') + '&longitude=' + encodeURIComponent(p.get('longitude') || '');
        return {url:target.href,kind:kind};
      } catch(e) { return null; }
    }
    function report(url, ok, status, weather, getHeader) {
      try {
        var host = new URL(typeof url === 'string' ? url : url.url, document.baseURI).host;
        if (host) parent.postMessage({type:'signage-widget-network',host:host,ok:ok,status:status,kind:weather && weather.kind,stale:!!(weather && getHeader && getHeader('X-Signage-Weather-Stale') === '1'),age:weather && getHeader ? Number(getHeader('X-Signage-Weather-Age')) : null}, '*');
      } catch(e) {}
    }
    var open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
      var url = arguments[1], weather = weatherRequest(url, arguments[0]), args = Array.prototype.slice.call(arguments);
      if (weather) args[1] = weather.url;
      var result = open.apply(this, args);
      if (this._signageNetworkListener) this.removeEventListener('loadend', this._signageNetworkListener);
      this._signageNetworkListener = function() { var xhr = this; report(url, xhr.status >= 200 && xhr.status < 400, xhr.status, weather, function(name) { return xhr.getResponseHeader(name); }); };
      this.addEventListener('loadend', this._signageNetworkListener);
      return result;
    };
    if (window.fetch) {
      var fetch = window.fetch;
      window.fetch = function() {
        var url = arguments[0], options = arguments[1], weather = weatherRequest(url, options && options.method || url && url.method), args = arguments;
        if (weather) args = [weather.url, {method:'GET',credentials:'omit',signal:options && options.signal || url && url.signal}];
        return fetch.apply(this, args).then(function(r) { report(url, r.ok, r.status, weather, function(name) { return r.headers.get(name); }); return r; }, function(e) { report(url, false, 0, weather); throw e; });
      };
    }
    window.addEventListener('error', function(e) { if (e.target && (e.target.src || e.target.href)) report(e.target.src || e.target.href, false, 0); }, true);
  }
  function webWidget(w) {
    var frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('title', w.type === 'html' ? 'Custom HTML widget' : 'Hosted web page widget');
    frame.style.width = '100%'; frame.style.height = '100%'; frame.style.border = '0';
    if (w.type === 'html') {
      if (w.htmlNetwork === true) { frame.setAttribute('data-signage-widget', ''); widgetDiagnostics(); }
      var https = w.htmlNetwork === true ? ' https:' : '';
      // Keep supported library references local, including during offline boot.
      // The saved source is unchanged; only this isolated document is adapted.
      var vendor = new URL('./vendor/leaflet-1.7.1/', location.href).href;
      var source = String(w.html || '').replace(/https:\/\/unpkg\.com\/leaflet@1\.7\.1\/dist\/(leaflet\.(?:js|css))/g, function(_, file) { return vendor + file; });
      var fonts = new URL('./fonts.css', location.href).href;
      source = source.replace(/https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:[^"'<>]+/g, fonts);
      var built = root.SmartSignageWidgetAssets;
      if (built) {
        var inlineJs = built.leafletJs.replace(/<\/script/gi, '<\\/script');
        source = source.replace(/<script\b[^>]*\bsrc\s*=\s*["']([^"']*\/vendor\/leaflet-1\.7\.1\/leaflet\.js)["'][^>]*>\s*<\/script\s*>/gi, function() { return '<script>' + inlineJs + '</script>'; });
        source = source.replace(/<link\b[^>]*\bhref\s*=\s*["'][^"']*\/vendor\/leaflet-1\.7\.1\/leaflet\.css["'][^>]*>/gi, function() { return '<style>' + built.leafletCss + '</style>'; });
        source = source.replace(/<link\b[^>]*\bhref\s*=\s*["'][^"']*\/fonts\.css["'][^>]*>/gi, function() { return '<style>' + built.interCss + '</style>'; });
      }
      var fontFiles = new URL('./fonts/', location.href).href;
      var weatherEndpoint = new URL('/api/widget/weather', root.SMARTSIGNAGE_SERVER_URL || location.href).href;
      var policy = "default-src 'none'; script-src 'unsafe-inline' " + vendor + "leaflet.js" + https + "; style-src 'unsafe-inline' " + vendor + "leaflet.css " + fonts + https + "; img-src data: " + vendor + "images/" + https + "; font-src data: " + fontFiles + https + "; media-src data:" + https + "; connect-src " + (https ? 'https: ' + weatherEndpoint : "'none'") + "; frame-src 'none'; base-uri 'none'; form-action 'none'";
      frame.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + policy + '"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style>' + (w.htmlNetwork === true ? '<script>(' + widgetMonitor.toString() + ')(' + JSON.stringify(weatherEndpoint).replace(/</g, '\\u003c') + ');</script>' : '') + source;
    } else {
      try { var url = new URL(w.src); if (url.protocol === 'https:' && !url.username && !url.password) frame.src = url.href; } catch (e) {}
    }
    return frame;
  }
  function widgetNetworkHint(w) {
    return w.type === 'html' && !w.htmlNetwork && /https:\/\//i.test(w.html || '') ? 'External HTTPS is disabled. Enable it in Layout Studio and save to load live data.' : '';
  }
  function screenStatus(screen, at) {
    if (!screen.enabled) return 'Disabled';
    var age = Number(at) - Date.parse(screen.last_seen);
    return age >= 0 && age <= 180000 ? 'Online' : 'Offline';
  }
  function filterScreens(screens, filters, at) {
    var query = String(filters.query || '').trim().toLowerCase();
    return screens.filter(function (s) {
      return (!filters.zone || s.zone === filters.zone) &&
        (!filters.status || screenStatus(s, at) === filters.status) &&
        (!query || [s.name, s.id, s.zone].join(' ').toLowerCase().indexOf(query) !== -1);
    });
  }
  var core = { activeSchedule: activeSchedule, resolveLayout: resolveLayout, normalizeWidget: normalizeWidget,
    bookingWindow: bookingWindow, pickBooking: pickBooking, resolveWidgets: resolveWidgets,
    fonts: fonts, widgetStyle: widgetStyle, webWidget: webWidget, widgetNetworkHint: widgetNetworkHint, screenStatus: screenStatus, filterScreens: filterScreens };
  root.SmartSignageCore = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);
