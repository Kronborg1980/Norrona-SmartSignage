# Implementation status · v0.1

| Item | Status |
| --- | --- |
| Worker API & D1 schema | Written, syntax tested; live deployment not tested |
| Dashboard | Written; browser rendering on local runtime still needs E2E |
| Device pairing & token revocation | Written; live D1 integration pending |
| Multiple screens & zones | Written, 100-screen load test pending |
| Layered template studio | Written; drag/inspector functional by design; E2E pending |
| Offline player media verification | Implemented using CacheStorage & SHA-256, physical Tizen checks pending |
| Scheduling, timezone | UTC engine; test cases passing; onboard zone rules pending |
| Tizen packaging | Unsigned source generator; model-specific cert/config pending |
| Multi-user, device command centre, full playlists | Not built |
| Shipboard LAN distribution server | Not built |
| Production deployment | Not performed |

No changes have been made to any existing operational screens or external Cloudflare account.

Integration tests additionally exercise login -> media upload -> layout -> pair -> assignment -> manifest -> HTTP 304 -> token revocation with an in-memory SQLite adapter and mocked R2. These are **not** a substitute for Cloudflare/SSSP hardware tests.
