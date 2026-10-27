# Browser-pilot: Testplan

Kør efter fuldført Cloudflare-deployment.

- [ ] Admin kan logge ind på `/`
- [ ] Layout Studio kan oprette og gemme et layout
- [ ] En browser på `/player.html?debug=1` genererer en ny parringkode
- [ ] Admin kan parre skærmen
- [ ] Admin kan tildele layout, som vises på afspilleren
- [ ] JPG eller PNG kan uploades og indlæses i layoutet
- [ ] MP4 under 25 MB kan afspilles i browseren
- [ ] Ændring af layout opdateres efter næste synkronisering
- [ ] Tidsplan i UTC overstyrer standardlayout på det forventede tidspunkt
- [ ] Efter online-sync kan afspilleren fortsætte kortvarigt ved tab af forbindelse (browser-afhængigt)
- [ ] Når forbindelsen kommer igen, genoptages synkronisering
- [ ] En tilbagekaldt/disabled skærm kan ikke længere synkronisere

**Vigtigt:** Browser/offline-test må ikke bruges som dokumentation for at det fungerer efter strømafbrydelse på Tizen, eller at 100 skærme kan køre samtidigt.
