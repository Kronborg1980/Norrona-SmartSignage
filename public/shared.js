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
    var active = (manifest.schedules || []).filter(function (s) {
      return activeSchedule(s, manifest.screen, at);
    });
    active.sort(function (a, b) { return Number(b.priority) - Number(a.priority) || a.id.localeCompare(b.id); });
    var id = active.length ? active[0].layout_id : manifest.screen.layout_id;
    var layouts = manifest.layouts || [];
    for (var i = 0; i < layouts.length; i++) if (layouts[i].id === id) return layouts[i];
    return null;
  }
  function normalizeWidget(w, orientation) {
    w = w || {};
    var width = orientation === 'portrait' ? 1080 : 1920;
    var height = orientation === 'portrait' ? 1920 : 1080;
    return {
      id: String(w.id || ''), type: String(w.type || 'text'),
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
        if (data.ok === true) { if (note && note.getAttribute('data-host') === data.host) note.remove(); return; }
        if (!note) {
          note = document.createElement('div'); note.className = 'widget-runtime-hint';
          note.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:8px;background:#600e;font:14px Arial,sans-serif;color:white;z-index:2147483647;pointer-events:none';
          box.appendChild(note);
        }
        note.setAttribute('data-host', data.host);
        note.textContent = 'Widget connection failed: ' + data.host + (Number.isInteger(data.status) && data.status >= 400 && data.status <= 599 ? ' (HTTP ' + data.status + ')' : ' (network or CORS).');
        return;
      }
    });
  }
  // Runs inside the opaque sandbox. Only host/status is reported, never URLs,
  // request headers, credentials or response bodies. Request behavior is retained.
  function widgetMonitor() {
    function report(url, ok, status) {
      try { var host = new URL(typeof url === 'string' ? url : url.url, document.baseURI).host; if (host) parent.postMessage({type:'signage-widget-network',host:host,ok:ok,status:status}, '*'); } catch(e) {}
    }
    var open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
      var url = arguments[1], result = open.apply(this, arguments);
      this.addEventListener('loadend', function() { report(url, this.status >= 200 && this.status < 400, this.status); });
      return result;
    };
    if (window.fetch) {
      var fetch = window.fetch;
      window.fetch = function() { var url = arguments[0]; return fetch.apply(this, arguments).then(function(r) { report(url, r.ok, r.status); return r; }, function(e) { report(url, false, 0); throw e; }); };
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
      var policy = "default-src 'none'; script-src 'unsafe-inline' " + vendor + "leaflet.js" + https + "; style-src 'unsafe-inline' " + vendor + "leaflet.css " + fonts + https + "; img-src data: " + vendor + "images/" + https + "; font-src data: " + fontFiles + https + "; media-src data:" + https + "; connect-src " + (https ? 'https:' : "'none'") + "; frame-src 'none'; base-uri 'none'; form-action 'none'";
      frame.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + policy + '"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style>' + (w.htmlNetwork === true ? '<script>(' + widgetMonitor.toString() + ')();</script>' : '') + source;
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
    fonts: fonts, widgetStyle: widgetStyle, webWidget: webWidget, widgetNetworkHint: widgetNetworkHint, screenStatus: screenStatus, filterScreens: filterScreens };
  root.SmartSignageCore = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);
