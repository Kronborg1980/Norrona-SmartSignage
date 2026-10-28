# Browser- og flådetest

## Automatiske lokale tests

```sh
npm ci
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

Alternativt ved allerede installeret Chromium:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
```

Playwright starter en separat lokal Worker på port 8790, anvender alle migrationer og bruger isoleret D1/R2-testtilstand. Den normale udviklingsdatabase og deployment berøres ikke. Testkonfigurationen i `tests/browser/wrangler.toml` har offentlige testadgangskoder og må aldrig deployes. Port 8790 skal være ledig. Tests afslutter deres server; ved hård afbrydelse kan ignoreret `.wrangler/browser-tests-*` efterlades.

Flådesuitens første test registrerer 100 virtuelle players, tildeler et delt layout, udfører bølger med 100 samtidige synkroniseringer, kontrollerer 304, opdaterer 50 skærme og kontrollerer fuldt manifest ved genforbindelse. Svartider vedhæftes rapporten. Det er HTTP-klienter med en lille delt PNG, ikke 100 browser- eller Tizen-processer. Testen simulerer hverken stor videodistribution eller 100 enheders lokale offline-cache.

Flådesuitens anden test kontrollerer søgning, zone/status, valg af alle synlige, nulstilling af valg ved filterskift, masseorientering, annullering og bekræftelse af deaktivering samt genaktivering. En separat browserkontekst parres via admin, tildeles billed-/tekstlayout og tester lokal afspilning, offline-genindlæsning og opdatering efter genforbindelse. Playerens timere fremrykkes med Playwrights virtuelle ur.

Yderligere Chromium-regressioner med mockede API-svar tester langsom layoutgemning, bevarelse af tidsplanmål i tomme zoner, overlappende dialoger og afvisning af en medieopdatering med forkert SHA-256, efterfulgt af en vellykket genhentning. De sidste tests bruger den rigtige frontend/player, men er ikke backend-belastningstests.

Rapporter: `playwright-report/` og `test-results/`, inklusive traces ved fejl. GitHub Actions kører både Node- og browser/flådetest og gemmer rapporterne.

## Manuel kontrol på deployment

Brug en testskærm og testindhold på den eksisterende Worker-adresse.

- Log ind på `/`, og åbn `/player.html?debug=1` i en anden browser.
- Opret tekst, ur og billedlag i Layout Studio; par testskærmen og tildel layout.
- Under Screens: søg, filtrer zone/status, vælg flere, og kontrollér masseændringer. Kontrollér også, at ikke-valgte skærme bevarer deres indstillinger.
- Flyt testskærmen til en zone med en UTC-tidsplan, og kontrollér korrekt indhold.
- Test en MP4 under 25 MB samt layoutændring efter næste synkronisering.
- Afbryd netværket efter vellykket synkronisering; kontrollér afspilning og genindlæsning. Genetablér forbindelsen og kontrollér opdatering.
- Kontrollér tilbagekaldelse og deaktivering. Deaktivering standser synkronisering; det er ikke en fjernslukning af cached indhold.

Browsertest dokumenterer ikke offline-strømstart eller codec-støtte på en fysisk Samsung-skærm. Test modeller og firmware, 100-enheders realistisk belastning, store medier, lagerkvoter og 24–48 timers drift inden produktionsudrulning.
