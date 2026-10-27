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
