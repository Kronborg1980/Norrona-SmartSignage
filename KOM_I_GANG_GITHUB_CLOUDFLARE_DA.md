# Norröna SmartSignage – GitHub + Cloudflare (browsertest)

**Eksisterende projekt: GitHub og Cloudflare Workers med D1/R2 er allerede deployet ifølge brugeren. Trin 1–5 nedenfor er en installationsreference til nye miljøer. Genbrug de eksisterende ressourcer og secrets; begynd ved trin 6 for browsertest. Automatiske lokale tests beskrives i [docs/BROWSER_TEST_DA.md](docs/BROWSER_TEST_DA.md).**

> Dette er et pilotprojekt. Det er ikke installeret på jeres Samsung-skærme. 100 skærme er et mål, ikke en allerede godkendt kapacitet.

## 1. Upload projektet til GitHub

1. Opret et **privat** GitHub-repository, fx `Norrona-SmartSignage`.
2. Pak ZIP-filen ud på din computer.
3. Læg **indholdet** af mappen `Norrona-SmartSignage` i roden af repository'et, så `package.json`, `wrangler.toml`, `public/`, `src/`, og `migrations/` ligger direkte i GitHub-repository'et (ikke kun ZIP-filen).
4. Behold `.dev.vars` / adgangskoder **uden for GitHub**. `.dev.vars.example` er kun et eksempel.
5. Du kan bruge GitHub Desktop til at publicere repoet, eller uploade filerne og mapperne via GitHub.

## 2. Opret ressourcer i Cloudflare

Du skal bruge en Cloudflare-konto med adgang til Workers, D1 og R2. I Cloudflare-dashboardet:

- Opret en **D1 database** med navnet `signage-db`.
- Opret en **R2 bucket** med navnet `norrona-signage-media`.
- Åbn D1-databasens detaljer, kopier **Database ID**.
- I GitHub, rediger `wrangler.toml`: erstat `00000000-0000-0000-0000-000000000000` med det rigtige Database ID, og commit filen.
- Hvis du bruger andre navne end eksemplerne, skal `database_name` / `bucket_name` også opdateres i `wrangler.toml`.

## 3. Opret tabeller i databasen

**Før første login** skal migrationerne køres. På en computer med Node.js 22+:

```sh
npm install
npx wrangler login
npm run db:remote
```

Kør dette fra projektmappen efter at `wrangler.toml` indeholder den korrekte D1 database ID. Alternativt kan du bruge D1's SQL-konsol i Cloudflare og køre indholdet af `migrations/0001_initial.sql` og derefter `migrations/0002_media_hash.sql`.

**OBS:** Cloudflare Workers Builds kører **ikke** D1-databasemigrationerne automatisk i vores projekt. Du skal gøre dette separat.

## 4. Tilknyt GitHub til Cloudflare Workers

1. Cloudflare: **Workers & Pages → Create application → Connect GitHub** (navne i dashboardet kan variere).
2. Vælg dit repository og branch `main`.
3. Sæt **Root directory** til repository-roden (projektfilerne ligger dér).
4. Sæt **Deploy command** til `npx wrangler deploy` (default er ofte korrekt). Der er ingen separat frontend build-kommando i denne version.
5. Publicer. Cloudflare giver dig en `.workers.dev`-adresse.
6. Workerens første deployment kan gå igennem, før hemmelighederne er oprettet, men login vil ikke fungere før trin 5.

## 5. Tilføj administratoradgang som Cloudflare secrets

Cloudflare: åbn den nyoprettede Worker → **Settings → Variables and Secrets** (navne kan variere) og opret følgende som **Secret**, ikke almindelig offentlig variabel:

- `ADMIN_PASSWORD`: En stærk, unik adgangskode.
- `ADMIN_SESSION_SECRET`: En **anden**, lang, tilfældig hemmelighed (mindst 32 tilfældige bytes anbefales).

**Del aldrig disse værdier i ChatGPT, offentlige screenshots eller GitHub.**

Tilføj secrets til den **samme Worker**, der hoster programmet. Gem/deploy de ændrede indstillinger efter Cloudflares anvisning.

## 6. Test i to browserfaner

Brug den adresse, Cloudflare har tildelt. Eksempler nedenfor er **ikke** aktive URL'er:

- Admin: `https://<dit-worker-navn>.<din-subdomain>.workers.dev/`
- Testskærm: `https://<dit-worker-navn>.<din-subdomain>.workers.dev/player.html?debug=1`

**Test:**

1. Åbn admin og log ind med `ADMIN_PASSWORD`.
2. Opret et layout med tekst og ur i Layout Studio. Gem det.
3. Åbn `player.html?debug=1` i en anden fane eller på en anden computer.
4. Afspilleren viser en parringkode. Gå til **Screens → Pair display**, og indtast koden.
5. Tildel skærmen dit layout, og gem. Indholdet bør dukke op efter næste synkronisering (typisk inden for ca. ét minut).
6. Upload derefter et lille JPG/PNG-billede; tilføj det til layoutet og gentag testen.
7. Eksperimentér med tidsplaner (bemærk: alle tidsplaner er i **UTC** indtil videre).

## 7. Hvad må vi ikke forvente endnu?

- Skærminstallation på Samsung Tizen via Custom App-URL er **ikke klar**.
- Den aktive Cloudflare-udrulning er oplyst af brugeren; denne udviklingsrunde tester lokalt og ændrer ikke deployment.
- Avancerede widgets, dansk ?-hjælp ved hver funktion, fuld dokumentkonvertering og multi-user mangler. Lokal test med 100 virtuelle HTTP-players erstatter ikke realistisk belastningstest med store medier og fysisk hardware.
- Det offline-player-understøttelse som findes er **best-effort** og afhænger af browserens cache/storage, ikke garanteret 24/7-skibsdrift.
- Brug testindhold, ikke fortrolige eller operationelle data, indtil adgangskontrol og driftssikkerhed er gennemgået yderligere.

## Fejlfind hurtigt

- **503 på login:** `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` mangler på Workeren.
- **500 efter login eller ved pairing:** D1 migrationer eller databinding mangler; kontrollér Worker-logs.
- **Fejl ved medieupload:** Kontrollér at R2 bucket hedder det samme som `bucket_name` i `wrangler.toml`.
- **Skærmen er tom:** Kontrollér at layoutet er gemt, at parring er fuldført, og at skærmen har fået tildelt layoutet.
- **404 på /player.html:** Kontrollér at hele `public/` ligger i repository-roden, og at `[assets] directory = "./public"` er bevaret.

## Teknik

Én Cloudflare Worker serverer både frontendfilerne fra `public/` og API-endepunkter fra `src/worker.js`. **Du skal ikke oprette et separat Cloudflare Pages-projekt eller GitHub Pages-site.**

Dette dokument beskriver manual setup; deployment er ikke gennemført automatisk.
