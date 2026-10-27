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
  function normalizeWidget(w) {
    w = w || {};
    return {
      id: String(w.id || ''), type: String(w.type || 'text'),
      x: Math.max(0, Math.min(1920, Number(w.x) || 0)),
      y: Math.max(0, Math.min(1080, Number(w.y) || 0)),
      w: Math.max(20, Math.min(1920, Number(w.w) || 400)),
      h: Math.max(20, Math.min(1080, Number(w.h) || 150)),
      z: Math.max(0, Math.min(999, Number(w.z) || 0)),
      text: String(w.text || ''), src: String(w.src || ''),
      color: String(w.color || '#ffffff'), background: String(w.background || 'transparent'),
      fontSize: Math.max(10, Math.min(300, Number(w.fontSize) || 48)),
      align: String(w.align || 'left'), fit: String(w.fit || 'contain'),
      radius: Math.max(0, Math.min(200, Number(w.radius) || 0)),
      speed: Math.max(5, Math.min(180, Number(w.speed) || 40))
    };
  }
  var core = { activeSchedule: activeSchedule, resolveLayout: resolveLayout, normalizeWidget: normalizeWidget };
  root.SmartSignageCore = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
})(typeof window !== 'undefined' ? window : globalThis);
