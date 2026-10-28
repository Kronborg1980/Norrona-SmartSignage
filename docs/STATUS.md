# Implementation status · 28 October 2026

## Latest bug review

**54 Node tests and 26 Chromium tests pass**, including 100 concurrent channel players in local Wrangler D1/R2, the existing 100-player fleet waves, weather request coalescing and corrupt/incomplete-manifest rejection. Syntax and whitespace checks pass. The prior Worker deployment dry-run passed; this update changes browser assets only. The prior dependency audit reported **0 known vulnerabilities** in the installed lockfile.

The review fixed concurrency errors in pairing/login, editor data corruption, offline integrity/state recovery, portrait geometry, schedule-target changes, SQL parameter limits and smaller API/tooling defects. See [the detailed review](REVIEW_2026-10-28.md), which also records unresolved fetch-timeout, cache-cleanup, pairing-persistence and screen-rotation issues. These remain limitations; the system is not certified for shipboard production.

GitHub and Cloudflare Workers/D1/R2 are deployed. Changes are sent to GitHub for the existing Cloudflare build. Validation here uses local emulation; remote D1 changes and physical screen installation are not performed by these tests.

| Capability | Evidence / remaining work |
| --- | --- |
| Worker API, D1, R2 and static browser shells | Local Wrangler functional checks pass |
| Pairing, media, assignment, manifest, ETag, revocation | SQLite integration tests and local API smoke checks |
| Fleet search and status/zone filters | Implemented; name, full ID or zone search |
| Bulk default layout, zone, orientation, enable/disable | Implemented; authenticated, validated, atomic update; no migration |
| 100 concurrent virtual players | Local Worker test covers pairing, sync/heartbeat, 304, update to 50 devices and reconnect; not a physical/remote capacity claim |
| Browser fleet controls and player offline recovery | Playwright suite in `tests/browser/`; see browser test guide for scope |
| Layout Studio | Existing layered editor preserved; full editor interaction coverage still pending |
| Scheduling | Existing UTC rules preserved as fallback; new content/layout/channel bookings support dates, weekdays, times, duration, order and priority |
| Channels and reusable content | Separate menu sections, resizable channel areas, content uploads/links, library widgets and channel/screen preview |
| New D1 schema | Additive migration 0003; explicit authenticated activation available in backoffice for existing deployments |
| Tizen installation and video codecs | Physical model, firmware, signed WGT and long-duration playback still require tests |
| Group inheritance, staged rollout and rollback | Not implemented; zones remain current grouping model |
| Multi-user roles, LAN relay, advanced campaigns/transitions | Not implemented |

The test suite uses real local D1/R2 emulation for browser and concurrency checks; Node tests use SQLite and mocked R2. Neither substitutes for remote quota testing, representative large media, 24–48 hour network interruption tests or hardware validation.

## Earlier fleet feature validation (before the bug review)

`npm test`: **13 passed, 0 failed**. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser`: **2 passed, 0 failed** on Node 24.19.0 / Wrangler 4.154.0 with system Chromium.

The browser test exposed and now covers an offline restart defect: Cloudflare redirects `/player.html` to `/player`; the service worker now maps both paths (with query options) to the cached shell and reconstructs redirected cached responses for navigation reloads. A cached image/text layout survives offline reload and accepts a new layout after reconnection.

Local concurrency measurements from the passing run (100 simultaneous requests in each wave):

| Wave | p50 | p95 | Maximum |
| --- | --- | --- | --- |
| Initial sync | 957 ms | 977 ms | 990 ms |
| Unchanged / 304 | 632 ms | 635 ms | 638 ms |
| Update to 50 devices | 638 ms | 731 ms | 753 ms |
| Full manifest on reconnect | 727 ms | 749 ms | 751 ms |

All 400 sync requests returned their expected status; registration and first heartbeats succeeded for all 100 players. Timings include local queueing and Playwright HTTP client overhead. Payloads contain one tiny shared PNG. No production latency, large-video, sustained-load, remote D1 quota or hardware claims follow from these measurements.

## Backoffice display preview

Screens now includes Preview for each display, using the actual player renderer and shared UTC resolver. A Chromium test verifies zone-specific content, portrait placement, a second screen, and no device pairing/storage changes. Preview shows planned content, not a remote screenshot of cached/offline playback.

## Media resizing

Layout Studio supports four corner resize handles, explicit Width/Height, contain/cover scaling, and Fill canvas. New media layers default to contain. Four Chromium tests verify image/video resizing and persistence in landscape/portrait, top-left anchoring, minimum dimensions, and fit mode. Existing saved crop settings are preserved.

## HTML and hosted-page widgets

Layout Studio now supports HTML/CSS/JavaScript code and hosted HTTPS page widgets (including server-rendered PHP). Sandboxed iframes isolate scripts from application storage; inline widgets block external requests. Node tests cover validation and manifest persistence, and Chromium checks code execution, isolation, editor/player preview, hosted-page iframe configuration and offline reload of saved HTML. No PHP runtime or ZIP installer is added; hosted pages require network and permission to embed.

## Typography and media source controls

Added 18 font choices with 8 fonts bundled for offline use (licenses and source versions included), bold/italic/underline, alignment, line height, letter spacing, opacity, corner radius, ticker speed, layer duplication and backward controls. Text formatting applies per layer. Image/video Inspector now allows external links, selection from uploaded library media, or direct upload and assignment. API validation, persistence, preview styles, bundled font loading offline and image/video upload selection are covered by new tests. Native-font availability and physical Tizen rendering still require device checks.

## Large HTML widgets

HTML source now supports 512 KiB UTF-8 per widget; layout POSTs accept up to 1 MiB, with bounded streaming reads and clear errors. Other JSON endpoints keep a 250,000-byte limit. The user-provided 274,999-byte widget saved and round-tripped exactly in an isolated SQLite API check; its source is not copied into the repository. A browser regression exercises a 280 KB layout and explicit external HTTPS permission, while preserving sandbox storage isolation. Live external API access/CORS has not been verified here.

The accepted bookings/channel model (whole-layout or fullscreen content on screens, content bookings inside channels) is now implemented as described in [BOOKING_CHANNEL_MODEL.md](BOOKING_CHANNEL_MODEL.md). The earlier large-HTML update did not include it.

## Map-widget startup fix

Leaflet 1.7.1 JS/CSS/images are bundled with the BSD license and resolved locally from supported unpkg URLs without changing saved source. Known Inter Google Fonts stylesheet references use the local font bundle. Static font/vendor assets permit CORS for opaque sandboxed frames. A generated local bundle is loaded by the parent application and embeds supported library code/CSS/images/fonts into the sandboxed document; this fixes unreliable iframe access to the parent service-worker cache. The bundle is cached for offline player boot and copied to the Tizen source bundle. Live networking remains opt-in; disabled access and failed host/status are visible, with source-checked iframe messages and no credential/URL logging.

The original pasted widget was tested privately (not committed): its map initialized, issued the vessel request, and updated speed/destination/weather using controlled API responses. The final private run reported no browser errors. Four committed browser regressions cover real Leaflet initialization, XHR data, font loading, failure/recovery diagnostics, iframe message source checks and offline map reload. Actual remote ship/weather API reachability and CORS permissions remain unverified from this environment.

## Open-Meteo HTTP 429 recovery

The screenshot confirms live ship/map data while Open-Meteo refuses weather requests with HTTP 429. The original widget polls three weather queries every two minutes per screen and its own localStorage cache cannot operate inside the opaque sandbox.

Network-enabled inline widgets now adapt those three known GET queries to a fixed, read-only Worker weather integration. Fifteen-minute shared caching, a 0.25-degree weather grid, concurrent-request coalescing within an isolate, host-level rate-limit cooldown and labelled stale results reduce repeated requests without modifying saved HTML or weakening iframe isolation. The endpoint accepts only validated coordinates and a fixed profile; responses have an eight-second timeout/128 KiB bound and redirects are rejected. It adds no migration/binding.

Tests use controlled upstream responses; real provider quota and Cloudflare caching behavior remain unverified here. Cache API results/cooldowns are local to a data centre and may be evicted. This is not a guarantee of global provider quota compliance, a provider subscription, or persistent per-screen offline weather. Quota/plan suitability still needs verification before fleet rollout.

Weather validation also covers host-wide 429 backoff, numeric/date Retry-After values, stale-result age/expiry, fixed profiles, rejected arbitrary/duplicate query parameters, malformed/oversized responses, an eight-second timeout, sandbox isolation and independent wind/temperature diagnostics. The exact pasted widget passed a private browser run through the new endpoint with controlled ship/weather data and no console/page errors. Live production weather and regional/global Cloudflare cache behavior are not certified by these tests.

## Diagnostic banners are opt-in

Normal player playback, backoffice Preview and the editor canvas no longer cover content with network, HTTP 429, cached-weather or disabled-network diagnostic banners. An explicit `debug=1` query parameter enables those overlays; `debug=10` or a `?debug=1` string embedded inside another parameter does not. Editor Inspector guidance remains available. Network-enabled HTML widgets still use the same isolated renderer, local libraries and shared weather cache/retry transport. Normal-mode widget monitoring does not post diagnostic messages or read diagnostic response headers. The user-provided HTML is not rewritten to hide its own authored elements.

Two additional Chromium regressions cover clean disabled-network playback and normal-mode 429/stale responses without losing shared weather transport. Existing debug-mode tests still verify failure/recovery messages, source checks, isolation and independent weather diagnostics. Use `/player.html` without `?debug=1` for normal display links. The shell cache version is updated to refresh browser assets.
