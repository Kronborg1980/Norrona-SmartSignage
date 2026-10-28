# NORRÖNA SMARTSIGNAGE

**Browser pilot · Fleet management update · 28 October 2026**

**Vil du blot teste i browser via GitHub og Cloudflare? Læs [KOM_I_GANG_GITHUB_CLOUDFLARE_DA.md](KOM_I_GANG_GITHUB_CLOUDFLARE_DA.md) først.**

A bespoke digital signage management system for Samsung Smart Signage / Tizen displays aboard M/S Norröna. Designed for an existing fleet of **30 screens** and at least **100 players**. Local tests exercise 100 concurrent virtual players; deployed Cloudflare capacity and actual Samsung models still require field tests.

This repository contains runnable application code, not just a specification. It is an **early pilot**, not a replacement for Smartsign in live operations yet.

## Included in this version

- Cloudflare Worker REST API; D1 migrations; R2 media objects.
- Password-protected admin with 8-hour HMAC sessions and per-IP login throttling.
- Screen provisioning via 12-character pairing code; unique 256-bit device tokens (SHA-256 token hash stored in D1), revocation/disable.
- Dashboard and device fleet with online status (heartbeat, 3-minute grace), name, zone, orientation and default layout. Search by name/ID/zone, filter by zone/status, and bulk assign layouts, move zones, rotate or enable/disable selected displays.
- Layout Studio: move independently layered **text, clock, image, muted video and ticker** elements, portrait/landscape, colours, sizes, z-index. One video per layout by design for conservative Tizen compatibility.
- Image and short MP4 upload to R2. Hosted assets have SHA-256 digests.
- UTC schedules targeting all screens / a zone / a device, weekdays, overnight time windows, priority overrides.
- Player fetches only layouts referenced by its device/schedules; sync every ~60 seconds, 304 for unchanged manifests, heartbeat no more than every ~115 seconds.
- Player verifies media hashes before switching to a new manifest. Keeps the last saved manifest and cache for network outages **within the limits of device storage/cache eviction**. Service worker supports offline web shell in compatible hosted browsers; the packaged Tizen app carries its own shell.
- Shared schedule resolver in editor/player with automated tests.

## Requirements

- Node.js 22+ and npm; Cloudflare account with Workers, D1 and R2 available.
- A GitHub repository is optional; no new repository has been created automatically.
- For device installation: Tizen Studio with Samsung TV/Signage tooling, an appropriate signing certificate and one **test** Samsung screen. The exact Samsung model and firmware still need verification.

## Start locally

Run in project root:

```sh
npm ci
cp .dev.vars.example .dev.vars
# Edit .dev.vars: strong unique ADMIN_PASSWORD and ADMIN_SESSION_SECRET
npm run db:local
npm run dev
```

- Open the Wrangler URL (normally `http://localhost:8787/`) for **Control Center**.
- Open `/player.html?debug=1` on a second browser/device. It will show a 12-character pairing code.
- In the Control Center, go to **Screens → Pair display**, enter that code, assign its layout.
- In **Layout Studio**, create and save a layout (text/clock first). Use **Screens** to assign it.
- In **Schedules**, add a UTC-based rule if desired.
- Disconnect network after a successful sync to check offline operation. Tests using local development hosting only validate limited browser-side behaviour, not power-cycle/offline boot on a real Tizen panel.

Run automated tests:

```sh
npm test
```

## Custom HTML and hosted web widgets

In Layout Studio choose **HTML code**, paste HTML with inline CSS/JavaScript in Inspector, and click **Update code preview**. Resize/move it like other layers, then **Save layout**. Up to 20,000 code characters per widget are supported within the layout request limit. Self-contained code is stored with the manifest and works offline after a successful sync. Embedded data images/fonts/media are supported; external requests, scripts, stylesheets, nested frames and forms are blocked by the HTML widget policy. Widget scripts cannot access backoffice/player storage or navigate the top-level page.

For an existing site or server-rendered PHP output, choose **Web page** and enter its hosted **HTTPS URL**. PHP is not executed by a browser or this Worker; PHP source pasted into an HTML widget is rejected with guidance to use a hosted URL. Hosted pages require network access and must permit sandboxed iframe embedding; sites with blocking frame policies or login-dependent functionality may not work. Do not put credentials in widget URLs. Hosted pages are not cached for offline playback.

Both modes use a sandboxed iframe without same-origin access in editor, backoffice Preview and player. No database migration is required. Physical Tizen/browser compatibility still needs device testing; existing packaged players need the updated application files to render the new widget types.

## Resize images and videos

In Layout Studio, select a layer and drag its blue corner handles to resize it, or enter exact **Width** and **Height** values in Inspector. Drag the middle to move it. **Media scaling → Show whole media** preserves the full image/video inside the box; **Fill and crop** fills the box while cropping edges. **Fill canvas** expands the box to the selected landscape/portrait canvas. Click **Save layout** to publish the change to assigned displays.

## Preview a display

Under **Screens**, click **Preview** beside a display. Backoffice embeds the actual player renderer and resolves that display's default layout and UTC schedules. Preview updates when administration data refreshes, shows connection status/last contact, and does not pair or modify device storage. Close it to stop preview media playback.

This is planned content, not a remote screenshot: an offline or disabled screen may still display an earlier cached version.

## Manage 100+ displays

Under **Screens**, combine search with zone and status filters. The header checkbox selects all visible displays. **Update selected** shows the selected names and lets you change default layout (including clearing it), zone, orientation or enabled state. Changing filters clears selection; a periodic refresh retains only still-visible selected IDs. Disabling requires confirmation and stops future sync; previously cached playback continues.

Zones remain the existing grouping model, including zone-based schedules. Moving a screen to another zone changes the schedules it receives. Bulk default assignment does not override a higher-priority schedule. Independent group membership, inherited defaults, staged rollout and rollback are still future work.

The authenticated `PATCH /api/admin/screens/bulk` accepts `{ "ids": ["<screen-id>"], "patch": { "layout_id": "<layout-id>" } }`. Allowed patch fields are `layout_id` (or null), `zone`, `orientation`, and boolean `enabled`. It updates only those fields in one atomic SQL statement; a missing selected screen returns 409 without changing any screen. No schema migration is needed for this update.

## Automated browser and fleet checks

```sh
npm ci
npx playwright install --with-deps chromium
npm run test:browser
```

The tests start a fresh local Worker on port 8790 with isolated D1/R2 state and public test-only credentials from `tests/browser/wrangler.toml`. They do not use your deployment, development database or `.dev.vars`. Do not deploy the test configuration. A system Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`.

Tests exercise 100 simultaneous API clients, 304 responses, assignment to 50 selected devices, complete manifests on reconnect, fleet controls, browser pairing, image playback and offline recovery. Timings are attached to the Playwright report; these are local measurements, not a hardware or production capacity certificate. See [browser tests](docs/BROWSER_TEST_DA.md) and [implementation status](docs/STATUS.md).

## Deploy to Cloudflare

The user reports that GitHub, Workers, D1 and R2 are already deployed. The following steps are for a **new installation**; reuse existing resources for this project. The configured D1 ID is already populated. This development update does not deploy or run remote migrations.

1. Log in from the terminal: `npx wrangler login`.
2. Create database: `npx wrangler d1 create signage-db`.
3. Set `database_id` in `wrangler.toml` to the new database ID only for a new installation.
4. Create media bucket: `npx wrangler r2 bucket create norrona-signage-media`.
5. Apply migration: `npm run db:remote`.
6. Set secrets separately (do not put passwords in Git):
   ```sh
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put ADMIN_SESSION_SECRET
   ```
7. Deploy: `npm run deploy`. Use your Worker URL or assign a branded domain.
8. Add network security controls, backups, monitoring and a shipboard connectivity strategy before production.

Remote credentials are configured separately. Local development and the automated test profile do not require a Cloudflare login.

## Tizen player packaging (source only)

After the API is deployed:

```sh
SIGNAGE_SERVER_URL=https://your-worker.example.com npm run prepare:tizen
```

This generates `build/tizen/` with local HTML/CSS/JS, a configured remote API endpoint and a **template** `config.xml`.

**Not a signed WGT.** Use Tizen Studio to create a correct Samsung Signage Web App project, keep its generated unique app/package IDs, import the generated files, set `required_version=6.5` only if all pilot screens support it, sign with a Samsung-approved certificate and run on your 2022 model. Samsung URL Launcher / Custom App installation is model- and firmware-dependent and often needs an `.wgt` and `sssp_config.xml`, not a plain website URL. Do not repoint current production screens until tests pass.

Browser hosting at `/player.html` is for simulation/development and some configurations; **do not assume the Signage URL Launcher accepts that HTML URL directly**.

## Current limitations (important)

See the [28 October code review](docs/REVIEW_2026-10-28.md) for corrected defects and remaining risks, including fetch timeouts, old-media cache cleanup, failed pairing persistence and screen-level rotation.

- Cloudflare deployment is reported by the user; this update is validated locally. No physical Tizen validation or signed `.wgt` is documented.
- Admin is currently single-password, not multi-user RBAC. Production requires identities, role management and audit write coverage.
- Media library only supports JPG/PNG/WebP/GIF and MP4 up to **25 MB**. Larger videos require multipart upload/transcoding and local distribution.
- ZIP widget packages, weather, ship location/speed, PDF/PPTX, campaign playlists, remote screenshot/reboot, and synchronized multi-display playback are **not implemented yet**. Custom inline HTML and hosted web-page widgets are available as described above.
- When offline, only **pre-cached `/media/` assets** are expected to work; external HTTPS images/videos require network. Device CacheStorage may be evicted or have quota limits.
- Scheduling uses **UTC**, not ship-local time. Choosing whether the ship uses Tórshavn, UTC or zone transitions is a separate product decision.
- No LAN mirror or local server aboard yet. A shipboard CDN/distribution node is recommended for 50–100 screens and large videos.
- An offline reboot of an HTML URL Launcher cannot be guaranteed just by a service worker; packaged Tizen app and hardware tests are critical.
- Device clock accuracy matters for scheduling. Verify NTP and recovery from outages.
- For security, media URLs are long random, non-expiring, read-only URLs. Future private media should use access controls or signed URLs.
- Wrangler with local D1 and R2 is integration-tested. Remote Cloudflare quotas, shipboard networking and sustained hardware playback remain unverified.

## Suggested rollout

**Pilot:** one 2022 Tizen device with wired LAN, a short static layout, 24–48 hours of intermittent-network tests, cache/power-cycle tests and an MP4 test.
**Beta:** three to five screens across two model generations and different zones; use real ship network conditions.
**Production:** signed and managed packages, shipboard distribution, monitoring, backups, access controls, operator training, staged rollout and rollback.

## Repository navigation

- `public/index.html`, `style.css`, `admin.js`: admin console.
- `public/player.html`, `player.css`, `player.js`: signage player.
- `public/shared.js`: shared schedule/layout contract.
- `public/sw.js`: best-effort hosted-player shell caching.
- `src/worker.js`: Cloudflare API and media routes.
- `migrations/`: D1 schema.
- `scripts/prepare-tizen.mjs`: unsigned Tizen source bundle preparation.
- `tests/`: Node test runner.
- `docs/`: project brief, Codex instructions, scaling outline.

Security notes: Never commit `.dev.vars`, Cloudflare tokens, Tizen signing keys or admin passwords. Serve public management over HTTPS, with rate limiting and a suitable access policy. Use a separate Git branch when making large code changes.
