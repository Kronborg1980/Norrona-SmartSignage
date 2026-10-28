# Implementation status · 28 October 2026

## Latest bug review

**30 Node tests and 11 Chromium tests pass**, including 100 concurrent virtual players and rejection/recovery of corrupt media updates. `npm audit` reports **0 known vulnerabilities** in the installed lockfile. Syntax and whitespace checks pass.

The review fixed concurrency errors in pairing/login, editor data corruption, offline integrity/state recovery, portrait geometry, schedule-target changes, SQL parameter limits and smaller API/tooling defects. See [the detailed review](REVIEW_2026-10-28.md), which also records unresolved fetch-timeout, cache-cleanup, pairing-persistence and screen-rotation issues. These remain limitations; the system is not certified for shipboard production.

GitHub and Cloudflare Workers/D1/R2 are already deployed according to the user. This development session uses local emulation and does not change that deployment or operational screens.

| Capability | Evidence / remaining work |
| --- | --- |
| Worker API, D1, R2 and static browser shells | Local Wrangler functional checks pass |
| Pairing, media, assignment, manifest, ETag, revocation | SQLite integration tests and local API smoke checks |
| Fleet search and status/zone filters | Implemented; name, full ID or zone search |
| Bulk default layout, zone, orientation, enable/disable | Implemented; authenticated, validated, atomic update; no migration |
| 100 concurrent virtual players | Local Worker test covers pairing, sync/heartbeat, 304, update to 50 devices and reconnect; not a physical/remote capacity claim |
| Browser fleet controls and player offline recovery | Playwright suite in `tests/browser/`; see browser test guide for scope |
| Layout Studio | Existing layered editor preserved; full editor interaction coverage still pending |
| Scheduling | Existing UTC resolver and regression tests preserved |
| Tizen installation and video codecs | Physical model, firmware, signed WGT and long-duration playback still require tests |
| Group inheritance, staged rollout and rollback | Not implemented; zones remain current grouping model |
| Multi-user roles, LAN relay, advanced widgets/playlists | Not implemented |

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
