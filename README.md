# NORRÖNA SMARTSIGNAGE

**v0.1-browser-pilot · Working first implementation · 27 October 2026**

**Vil du blot teste i browser via GitHub og Cloudflare? Læs [KOM_I_GANG_GITHUB_CLOUDFLARE_DA.md](KOM_I_GANG_GITHUB_CLOUDFLARE_DA.md) først.**

A bespoke digital signage management system for Samsung Smart Signage / Tizen displays aboard M/S Norröna. Designed for an existing fleet of **30 screens** and a **100-screen target**, but **100-device performance and actual Samsung models are not yet field-tested**.

This repository contains runnable application code, not just a specification. It is an **early pilot**, not a replacement for Smartsign in live operations yet.

## Included in this version

- Cloudflare Worker REST API; D1 migrations; R2 media objects.
- Password-protected admin with 8-hour HMAC sessions and per-IP login throttling.
- Screen provisioning via 12-character pairing code; unique 256-bit device tokens (SHA-256 token hash stored in D1), revocation/disable.
- Dashboard and device fleet with online status (heartbeat, 3-minute grace), name, zone, orientation and default layout.
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
npm install
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

## Deploy to Cloudflare

1. Log in from the terminal: `npx wrangler login`.
2. Create database: `npx wrangler d1 create signage-db`.
3. Replace `database_id = "00000000-0000-0000-0000-000000000000"` in `wrangler.toml` with the returned real ID.
4. Create media bucket: `npx wrangler r2 bucket create norrona-signage-media`.
5. Apply migration: `npm run db:remote`.
6. Set secrets separately (do not put passwords in Git):
   ```sh
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put ADMIN_SESSION_SECRET
   ```
7. Deploy: `npm run deploy`. Use your Worker URL or assign a branded domain.
8. Add network security controls, backups, monitoring and a shipboard connectivity strategy before production.

**Note:** The `wrangler.toml` UUID is intentionally a placeholder. The project cannot deploy until the actual database has been provisioned. Remote D1/R2 resources and Cloudflare credentials are not included.

## Tizen player packaging (source only)

After the API is deployed:

```sh
SIGNAGE_SERVER_URL=https://your-worker.example.com npm run prepare:tizen
```

This generates `build/tizen/` with local HTML/CSS/JS, a configured remote API endpoint and a **template** `config.xml`.

**Not a signed WGT.** Use Tizen Studio to create a correct Samsung Signage Web App project, keep its generated unique app/package IDs, import the generated files, set `required_version=6.5` only if all pilot screens support it, sign with a Samsung-approved certificate and run on your 2022 model. Samsung URL Launcher / Custom App installation is model- and firmware-dependent and often needs an `.wgt` and `sssp_config.xml`, not a plain website URL. Do not repoint current production screens until tests pass.

Browser hosting at `/player.html` is for simulation/development and some configurations; **do not assume the Signage URL Launcher accepts that HTML URL directly**.

## Current limitations (important)

- No live deployment, no actual Tizen screen tested, no Tizen certificate or installed `.wgt` yet.
- Admin is currently single-password, not multi-user RBAC. Production requires identities, role management and audit write coverage.
- Media library only supports JPG/PNG/WebP/GIF and MP4 up to **25 MB**. Larger videos require multipart upload/transcoding and local distribution.
- HTML5 arbitrary widgets, weather, ship location/speed, PDF/PPTX, campaign playlists, remote screenshot/reboot, and synchronized multi-display playback are **not implemented yet**.
- When offline, only **pre-cached `/media/` assets** are expected to work; external HTTPS images/videos require network. Device CacheStorage may be evicted or have quota limits.
- Scheduling uses **UTC**, not ship-local time. Choosing whether the ship uses Tórshavn, UTC or zone transitions is a separate product decision.
- No LAN mirror or local server aboard yet. A shipboard CDN/distribution node is recommended for 50–100 screens and large videos.
- An offline reboot of an HTML URL Launcher cannot be guaranteed just by a service worker; packaged Tizen app and hardware tests are critical.
- Device clock accuracy matters for scheduling. Verify NTP and recovery from outages.
- For security, media URLs are long random, non-expiring, read-only URLs. Future private media should use access controls or signed URLs.
- Test environment lacks a usable installed Wrangler runtime; source syntax and unit tests were executed, but the **full Worker+D1+R2 deployment workflow is not yet integration-tested**.

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
