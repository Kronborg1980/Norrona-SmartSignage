# Norröna SmartSignage — projektgrundlag til Codex

**Version:** 0.2 · 27. oktober 2026  
**Formål:** Erstatte eksisterende Smartsign-løsning med et fleksibelt digital signage-system til **30 eksisterende skærme** ombord på M/S Norröna, med driftsmæssig kapacitet til **mindst 100 aktive skærme** uden ombygning.  
**Kildestatus:** Dette dokument er rekonstrueret fra tilgængelig tidligere samtalekontekst. Det er **ikke** et komplet, ordret udtræk af den delte chat. Skeln mellem brugerkrav og tekniske forslag nedenfor.

## 1. Brugerkrav — må ikke overses

### Skærme, templates og visning
- **30 skærme i drift i dag**; dimensionér løsningen til mindst **100 samtidige, aktive skærme**, uden fast øvre begrænsning i datamodel eller UI. Hver skærm kan have individuelt template, layout, rotation, indstillinger og indhold.
- Gruppering af skærme til fælles styring, uden at miste skærmspecifikke overrides.
- Zoner og overlappende lag med justerbar rækkefølge (z-index), position, størrelse, synlighed og gennemsigtighed.
- **Hvert lag skal kunne indeholde widgets**, ikke kun stillbilleder eller videoer.
- Templates skal kunne genbruges og tilpasses per skærm; forskellige skærme skal kunne bruge forskellige templates.
- Skærmorientering: liggende og stående, med responsive koordinater til flere opløsninger.
- Overgange og valgfri lydstyring, uden uønskede sorte frames eller hak mellem afspilninger.

### Medier og widgets
- Billeder: JPEG, PNG, WebP, SVG, GIF.
- Video: MP4 (H.264/H.265 hvor afspilleren understøtter codecs), WebM.
- Dokumenter: PDF, PPTX, DOCX via sikker serverside-konvertering til skærmegnede assets.
- HTML5-indhold fra godkendte ZIP-pakker og eksterne URL'er under eksplicit sikkerhedspolitik.
- Mediebibliotek med mapper, tags, søgning, udløbsdatoer, filhash og understøttelse af passende mediekonvertering (fx FFmpeg).
- Widgets skal kunne vises inde i alle relevante lag. Design et udvideligt widget-interface.
- Billeder og videoer skal kunne tidsstyres; widgets og andre elementer skal kunne vises/skjules efter tidsplan.

### Tidsstyring
- Playlister, kampagner, dagdele (dayparting), skærm-/gruppeplaner, start- og sluttidspunkter.
- Prioriterede meddelelser, eksplicit konflikthåndtering, fallback-indhold og betinget afspilning.
- Mulighed for koordineret/synkron afspilning mellem udvalgte skærme.
- Tydelig preview: hvad spiller på den valgte skærm på en given dato/klokkeslæt?
- Alle regler evalueres konsekvent i defineret tidszone, inklusive sommertid.

### Offshore-/offline-drift
- **Offline-first**: indhold og manifest skal være gemt lokalt, før det aktiveres. Drift må ikke stoppe ved ustabil eller manglende internetforbindelse.
- Checksum-verificerede, inkrementelle opdateringer; atomar aktivering og rollback til senest fungerende version.
- Ingen synlige afbrydelser ved synkronisering; medieafspilning skal fortsætte under download.
- Lokal watchdog, kiosk-tilstand, automatisk genstart ved fejl, passende hardwareacceleration.
- Design til afspilning på forskellige hardwareplatforme, med en afgrænset platformadapter per type.

### Administration og drift
- Nem skærmregistrering (pairing / provisioning) med individuel, tilbagekaldelig identitet.
- Heartbeats, skærmstatus, aktuelt indhold, screenshots hvor understøttet, logs og telemetri.
- Remote handlinger såsom reload, genstart og softwareopdatering, hvor hardware tillader det.
- Rollebaserede rettigheder (RBAC), godkendelsesflow, audit-log, versionshistorik.
- HTTPS/WSS, signerede eller kortlivede asset-URL'er, isolerede enheder og sikker håndtering af nøgler.

## 2. Foreslået arkitektur (tidligere teknisk forslag — ikke endeligt vedtaget)

1. **Backoffice**: Webapplikation til medier, layouts, skærme, tidsplaner, brugere, preview og publicering.
2. **Signage Engine**: Validerer regler, beregner aktiv visning pr. skærm og udgiver versionsstyrede manifests.
3. **Smart Player**: Kioskafspiller som downloader/verificerer indhold, forbereder næste version og spiller offline.

Foreslået hosting: GitHub til kode, Cloudflare Workers til API, Cloudflare D1 til relationsdata, R2 til medier, eventuelt Durable Objects/Queues til realtidsstatus og baggrundsbehandling, Cloudflare Access eller alternativ identitetsløsning til backoffice. Bekræft endelig hosting, hardware og sikkerhedsmodel inden produktion.

```text
[ Backoffice ] --> [ API / Signage Engine ] --> [ D1: metadata, schedules ]
                       |           |
                       |           +----------> [ R2: originaler + renditions ]
                       |
                       +---------> [ versionsstyret skærm-manifest ]
                                            |
                                      download / verify
                                            |
                     [ Smart Player 1 ... Smart Player 100+ ]
                         | lokal cache + sidste gode manifest
                         + telemetri/heartbeat når online
```

## 2A. Skalering fra 30 til 100+ skærme — bindende designkrav

- **Mål:** 30 enheder i dag; supportér 50–100 aktive enheder og test **mindst 100 samtidige players** med realistiske indholdsstørrelser og netværksafbrydelser. Arkitekturen må ikke afhænge af en hardcoded grænse på 20/30/50/100.
- **Skærmgrupper:** Opret og styr grupper efter område (fx restaurant, reception, fællesarealer), og understøt massehandlinger (tildel template, plan, publicér, rollback) og individuelle overrides. Undgå 100 manuelle gentagelser.
- **Publicering:** Ét logisk indholdselement/asset lagres én gang. Manifests versionsstyres pr. skærm/gruppe; ændringer udsendes inkrementelt. Undgå at uploade eller genbygge samme medie separat for hver skærm.
- **Båndbredde ombord:** Design til periodisk eller ustabil forbindelse og begrænsede eksterne dataforbindelser. Undersøg **lokal cache-/relay-server på skibets LAN** (foretrukket når mange players deler store videofiler), så assets hentes én gang udefra og deles lokalt. Cloud-only direkte downloads til alle skærme må ikke være eneste design.
- **Netværk:** Lokal afspilning må ikke kræve stabil forbindelse til Cloudflare. Brug delta-/checksum-baserede downloads, ETag, backoff og tilfældig spredning af synkronisering, så 100 players ikke kontakter API'et eller downloader samtidig.
- **Status:** Et kompakt heartbeat pr. enhed med konfigurerbart interval, gruppering og mulighed for throttling. Instrumentér statusforsinkelser, fejl og versionsdrift pr. gruppe og enhed.
- **Drift:** Skærmlisten skal kunne søges/filtreres efter område, status, gruppe, skærmmodel og aktiv version. Understøt udvælgelse af mange enheder og sikre massehandlinger, med bekræftelse ved destruktive ændringer.
- **Sikkerhed:** Unik identitet og legitimationsoplysninger for hver player. Rettigheder og skærmtilknytninger skal være skalerbare. Ingen delte nøgler på alle skærme.
- **Måling:** Udarbejd belastningstest med mindst 100 virtuelle players og test både normaldrift, samlet genopstart, gruppepublicering, rollout i bølger og offline → online. Registrér fejl, gennemløbstider, trafik og typiske opdateringsforsinkelser.
- **Ingen gæt:** Hardware, netværkstopologi, realistiske mediestørrelser og acceptabel tidsforsinkelse skal måles/afklares inden produktionsdimensionering.

## 3. Datamodel (udgangspunkt)

- `Screen`: id, navn, gruppe, orientering, opløsning, enhedsstatus, token-version, timezone, overrides.
- `ScreenGroup`: id, navn, standardtemplate, indholdspolitik.
- `Template`: id, navn, canvas, resolution, version, layers.
- `Layer`: id, templateId, zone/rect, zIndex, visibility, style, children/widgets.
- `Widget`: id, layerId, type, config, bindings, schedule, fallback.
- `Asset`: id, mime, codec, hash, duration, dimensions, renditions, expiry, tags.
- `Playlist`: id, items, ordering, timing, transition, audio-policy.
- `Schedule`: id, scope, recurrence, timezone, priority, start/end, rule.
- `Campaign`: id, content/playlist reference, targeting, priority, validity.
- `Manifest`: screenId, manifestVersion, template snapshot, schedule resolution, asset hashes, signatures, generatedAt.
- `User`, `Role`, `AuditEvent`, `DeviceHeartbeat`.

Kræv stabile ID'er, versionshistorik og validering. Alle publiceringsresultater skal være reproducerbare fra gemt konfiguration.

## 4. Prioriteret udviklingsrækkefølge

**Fase 1 — kørende grundsystem**
1. Monorepo med tydelig adskillelse mellem backoffice, API, player og delte kontrakter.
2. Lokal udvikling, testdata og migrations til database.
3. Skærmregistrering og liste over skærme/grupper, med søgning og massehandlinger fra start.
4. Template-editor med lag/zoner og mindst tre widgets: tekst, billede og video.
5. Mediebibliotek og validering af upload.
6. Manifest-generering og player-preview; faktisk offline-cache og versionsskift.
7. Enkel tidsplan pr. skærm, gruppe eller asset, med fallback.

**Fase 2 — produktionsdrift**
- Heartbeat, online/offline-status, fejllog, watchdog, enhedstokens, rettighedsstyring, audit, transkodning og automatisk rollback.

**Fase 3 — avanceret funktionalitet**
- Kampagner, prioriteret takeover, avancerede recurrence-regler, multi-screen sync, betingede widgets, godkendelsesflow, fjernopdateringer og udvidede integrationer.

Faserne organiserer implementeringen; de er ikke en begrænsning af slutproduktets funktioner. **Skalerbar datamodel og gruppe-/masseadministration er krav fra fase 1**; dokumenteret belastningstest af 100 players kræves inden produktionsudrulning.

## 5. Acceptkriterier for den første brugbare demonstration

1. Opret to skærme med **forskellige templates** og publicer dem uafhængigt.
2. Opret et template med **mindst tre lag**, hvor hvert lag kan have en widget.
3. Skift en video og et billede efter tidsplan uden at påvirke andre skærme.
4. Afbryd internet/API: playeren fortsætter med sidste verificerede manifest.
5. Genetablér forbindelsen: playeren downloader en ny version, kontrollerer hashes og skifter først, når samtlige nødvendige filer er tilgængelige.
6. Demonstrér, at ufuldstændig eller korrupt download ikke ødelægger den aktive visning.
7. Administratoren kan se seneste heartbeat, aktiv manifestversion og fejl.
8. En automatiseret test med **100 samtidige virtuelle skærme** gennemfører registrering, manifestopslag, statusrapportering, gruppepublicering og offline-genopretning; fejl og svartider dokumenteres. Dette er et *testkrav*, ikke en påstand om opnået kapacitet.

## 6. Arbejdsregler til Codex

- Start med at læse dette dokument og inspicere hele eksisterende repository. Antag **ikke**, at der allerede findes et SmartSignage-repository.
- Opret først en forståelig, testbar MVP i stedet for at bygge en stor utestet monolit.
- Bevar eksisterende kode, funktioner og design, medmindre de konkret skal ændres; dokumentér breaking changes.
- Hver ændring skal have relevant test, typecheck/lint og en enkel måde at verificere visuelt.
- Ingen hemmeligheder i frontend, GitHub-kode eller logfiler. Ingen offentlige skrive-endpoints uden autentifikation og autorisation.
- Ingen ChatGPT-branding, `utm_source=chatgpt.com` eller uvedkommende tracking-parametre i brugerrettede URL'er.
- Definér tydelige begrænsninger for codecs og platforme; browserstøtte til H.265 må ikke antages universel.
- Preview og den faktiske player skal anvende samme layout-/schedulemotor, så de ikke divergerer.
- Prioritér forudsigelig offline-adfærd, sømløs afspilning og sporbar publicering højere end visuelle ekstrafunktioner.
- Arbejd på en separat Git-branch, og saml ændringer i en pull request til gennemgang.

## 7. Afklar før hardware-/produktionsudrulning

Disse punkter kan ikke udledes sikkert af tidligere kontekst og **må ikke opfindes**:
- Hvilke konkrete afspillerenheder/operativsystemer sidder på de 30 eksisterende skærme?
- Hvad er forbindelsen til skærmene (LAN/Wi-Fi), hvilke netværksbegrænsninger gælder ombord, og kan en lokal relay/cache-server placeres på skibets netværk?
- Er der et eksisterende repository eller kodebase, som projektet skal bygge videre på?
- Hvilken tidszone skal scheduler bruge til driften ombord, og hvor kommer pålidelige tidsdata fra?
- Er der et eksisterende design, logo eller brandguide, som backoffice skal følge?
- Hvilke kritiske integrationer har højeste prioritet (fx skibsposition, vejr, ankomsttider, restaurantinformation)?

## 8. Første opgave til Codex

> Byg første kørende projektstruktur for Norröna SmartSignage (30 eksisterende skærme; 100+ samtidige players som designmål) ud fra `SmartSignage_PROJECT_BRIEF.md`. Start med en testbar løsning med (1) søgbar skærmliste, grupper og massehandlinger, (2) visuelt template-preview med ubegrænsede ordnede lag og widgets per lag, (3) tekst/billede/video widgets, (4) en enkel tidsstyring, (5) versionsstyret manifest og (6) en player med lokal cache og sikker aktivering af nyt indhold. Brug tydelige moduler og automatiske tests. Udarbejd en oversigt over implementerede og endnu ikke implementerede krav. Dimensionér manifest-, cache- og statusarkitektur til mindst 100 samtidige players og planlæg LAN-relay. Udrul ikke til eksisterende skærme uden særskilt godkendelse.
