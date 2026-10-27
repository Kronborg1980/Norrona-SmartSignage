# Norröna SmartSignage – start her

Dette er **første funktionsdygtige kodeversion**, ikke et færdigt eller installeret skærmsystem. Koden er lavet til Samsung Smart Signage / Tizen (bl.a. 2022) og skal kunne udvides til 100 skærme. Før brug på skibet skal vi teste på rigtige skærme og under ustabilt netværk.

## Hvad er lavet?

- Kontrolcenter med adgangskode
- Skærmregistrering med 12-tegns engangskode
- Skærmliste og grupper/zoner
- Layouteditor med flytbare lag
- Tekst, ur, billeder, video og løbende tekst
- Upload til Cloudflare R2 (op til 25 MB pr. fil i denne version)
- Tidsplaner for alle, zone eller enkelt skærm (UTC)
- Afspiller med cache, kontrol af mediefiler og sidste kendte layout
- Test suite, databasemigrationer og Tizen-kildegenerator

## Første trin på Windows

1. Installér Node.js 22 eller nyere og åbn projektet i VS Code eller Codex.
2. Kør `npm install`.
3. Lav `.dev.vars` ved at kopiere `.dev.vars.example`. Vælg to stærke hemmelige værdier.
4. Kør `npm run db:local`.
5. Kør `npm run dev`.
6. Åbn adressen fra Wrangler-terminalen (typisk `http://localhost:8787/`) og log ind.
7. Åbn `/player.html?debug=1` i en anden browserfane; indtast pairing-koden under Screens.
8. Opret et layout, tildel det til skærmen, og se resultatet i spilleren.

For cloud-opsætning og Tizen-pakning: se `README.md`.

## Hvorfor ikke på alle skærmene nu?

Samsungs Tizen URL Launcher kræver på mange modeller en korrekt signeret Tizen `.wgt`-applikation frem for blot en HTML-adresse. Vi skal kende det præcise modelnummer, Tizen-/firmwareversionen, app-installationsmetode og sikkerhedsopsætning. Offline-genstart og video-codecs skal testes på en skærm først. Vi har **ikke** ændret nogen af jeres eksisterende Smartsign-skærme.

## Hvad vil jeg teste på første skærm?

- Installation med Tizen Studio og korrekt certifikat.
- MP4-afspilning i fuld skærm, rotationsretning og overgang til ny version.
- Fjernet netværkskabel: indholdet fortsætter.
- Genstart mens internetforbindelsen er væk.
- Hent nyt indhold efter at forbindelsen genoprettes.
- 24–48 timers kontinuerlig afspilning.

## Løsningens status

11 Node-tests består, herunder en integrationstest med SQLite + mock-R2. Ingen rigtige Cloudflare-ressourcer er oprettet og ingen fysisk Tizen-skærm er testet endnu. Løsningen må derfor **ikke** erstatte det nuværende system endnu.
