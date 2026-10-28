# SmartSignage — 30 skærme nu, kapacitet til mindst 100

**Status (27. oktober 2026):** Brugeren har præciseret, at der allerede er 30 skærme ombord. Målet er at kunne styre 50–100 skærme uden at skifte platform. Dette erstatter tidligere antagelse om ca. 20 skærme.

## Produktkrav

- Understøt mindst 100 aktive skærme, deres individuelle layouts, playlister, tidsplaner, status og offline-cache.
- Indbyg grupper, smart-filtre og masseudrulning, så betjeningen ikke vokser lineært med antallet af skærme.
- Skærm- og gruppe-templates med arv og eksplicitte per-skærm-overrides.
- Versionsstyring og rollback for både én enhed og hele grupper.

## Teknisk princip

```
Backoffice -> API/manifest + R2-assets
                  |
          internet/satellit
                  |
         [Valgfri LAN-relay]
             /   |    \
        player player ... x100
         (lokal cache hver)
```

Spillerne beholder lokal, verificeret version, mens opdateringer hentes i baggrunden. Prioritér genbrug af assets på tværs af skærme og lokal distribution på LAN, hvis skibets forbindelser gør dette relevant.

## Kvalitet før produktionsdrift

Simulér 100 aktive players med realistiske heartbeats, opdateringer og afbrydelser. Test gruppepublicering, samlet genstart, downloadspidser, offline/online og rollback. Mål faktisk belastning og justér intervaller og kapacitet, før en reel udrulning.

**Åbne forhold:** Skærmenes player-hardware, netværkets struktur, plads til LAN-cache, frekvens/størrelse af nye medier, krav til synkronisering og acceptabel opdateringsforsinkelse er endnu ikke verificeret.

## Implementeret og testet 28. oktober 2026

Skærmoversigten har nu søgning, kombinerede zone/statusfiltre, flervalg og masseændringer. Zoneinddelingen genbruges som grupper; arv og separat gruppemedlemskab er fortsat udestående. API'et anvender en JSON-liste af ID'er i én atomar opdatering, så 100+ ID'er ikke kræver én SQL-parameter per skærm. Mangler et ID, ændres ingen af de valgte skærme.

Den lokale automatiske test kører 100 samtidige virtuelle HTTP-players gennem registrering, synkronisering, 304, layoutændring på 50 udvalgte skærme og genforbindelse. Browserafspilleren testes separat med cached billede/tekst, offline-genindlæsning og efterfølgende opdatering. Se `STATUS.md` for målinger og begrænsninger. LAN-relay, realistisk videobelastning, staged rollout, rollback og fysisk Tizen-validering mangler stadig.
