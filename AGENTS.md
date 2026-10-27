# Codex-instruktioner — Norröna SmartSignage

Læs altid `SmartSignage_PROJECT_BRIEF.md` før ændringer.

## Prioriteter
1. Stabil offline-afspilning og sikker, atomar manifestaktivering.
2. Fleksibel og skalerbar struktur: 30 aktuelle skærme, mindst 100 samtidige players → skærm/grupper → template → lag → widgets.
3. Per-skærm-indstillinger og pålidelig tidsstyring.
4. Gennemsigtigt backoffice med forhåndsvisning.
5. Sikkerhed, testbarhed og vedligeholdelighed.

## Arbejdsmåde
- Gennemgå eksisterende filer, afhængigheder og tests først.
- Lav en plan og implementér vertikale, kørende bidder.
- Dokumentér kodeændringer, migrations, testresultater og udeståender.
- Foretag ikke direkte produktionsudrulning til skærme uden eksplicit tilladelse.
- Opfind ikke hardwaredetaljer, auth-data eller integrationsendpoints.
- Bevar designbeslutninger, eksisterende funktioner og URL'er uden ChatGPT-tracking.
- Undgå udokumenterede kodek-antagelser og usikre offentlige API-rettigheder.

## Skalering og maritim drift
- Udvikl og test til 100 samtidige player-forbindelser som minimum. Implementér ingen vilkårlige numeriske begrænsninger.
- Behandl båndbredde til/fra skibet som knap ressource: planlæg lokal LAN-relay/cache og delte, hash-adresserede assets, ingen gentagne store downloads pr. player.
- Skærmoversigt skal understøtte søgning, filtre, grupper og massehandlinger.
- Afprøv offline/online recovery og gradvis udrulning til mange skærme inden produktion.
