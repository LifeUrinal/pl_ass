# pl_ass – Prosjektlederassistent

En nettapp som hjelper prosjektledere på byggeplasser. Appen har to moduler,
valgt i menylinjen øverst:

- **Fremdriftsplan** – en Gantt-tidslinje for aktiviteter per område og UE.
- **Prosjektøkonomi** – budsjett, S-kurve, avstemming m.m. fra opplastede filer.

## Fremdriftsplan

Planen består av **bygg** (f.eks. «Bygg A – Kontor»), **områder** i hvert
bygg (f.eks. «Plan 1», «Teknisk rom», «Tak»), **firmaer/UE-er** og
**aktiviteter**. Samme områdenavn kan brukes i flere bygg. Hver aktivitet har område, firma,
type (prosjektering, utførelse, testing, befaring, overlevering), start- og
sluttdato, fremdrift i prosent, notat og eventuelle avhengigheter
(aktiviteter som må være ferdige før den kan starte).

- **Grupper** etter bygg → område (to nivåer, standard), bygg, område, firma
  eller aktivitetstype – og **farge** etter bygg, område, firma eller type.
- **Filtrer på bygg** for å se ett bygg om gangen.
- Bygg, områder og firmaer vedlikeholdes i dialogen «Bygg og områder»
  (endre navn, rekkefølge, flytte et område til et annet bygg).
- **Dag / Uke / Måned**-visning med helgeskygge, markerte helligdager og i-dag-linje.
- **Arbeidsdager** regnes som mandag–fredag minus norske helligdager (nyttårsdag,
  skjærtorsdag, langfredag, 2. påskedag, 1. mai, 17. mai, Kristi himmelfartsdag,
  2. pinsedag, 1. og 2. juledag – påskeavhengige dager beregnes for hvert år).
  Detaljpanelet viser hvilke helligdager som er trukket fra.
- **Dra** en stolpe for å flytte den, dra kantene for å endre lengde.
- **Avhengigheter**: dra prikken til høyre på en stolpe over en annen aktivitet,
  eller legg dem til i detaljpanelet. Appen hindrer sirkulære avhengigheter.
- **Konflikter**: aktiviteter som starter før en forgjenger er ferdig markeres
  rødt, med knapper for å flytte aktiviteten eller skyve etterfølgerne. Slå på
  «Skyv avhengige» for å gjøre dette automatisk ved hver endring.
- **Filtre**: søk, «Pågår nå», «Neste to uker», «Forsinket», «Med konflikter».
- **Angre** (Ctrl+Z), **Excel-eksport og -import** (samme kolonneformat begge
  veier; importen kjenner også igjen vanlige varianter som «Fra/Til», «UE»).
- Ved første oppstart lastes en eksempelplan, som kan erstattes via Fil-menyen.

Planen lagres lokalt i nettleseren (IndexedDB), akkurat som økonomidelen.
Koden ligger i `src/fremdrift/`.

## Prosjektøkonomi

Økonomimodulen hjelper med å holde kontroll på prosjektøkonomien.

Appen er en frittstående klientapplikasjon (ingen server/database) – alle filer
lastes opp og tolkes i nettleseren, og dataene lagres lokalt i nettleseren
(IndexedDB) slik at de ligger klare neste gang du åpner appen på samme maskin.
Ingenting sendes til noen server.

## Kom i gang

```bash
npm install
npm run dev
```

Åpne deretter adressen som vises i terminalen (typisk http://localhost:5173).

For produksjonsbygg:

```bash
npm run build
npm run preview
```

## Slik fungerer appen

Ved oppstart må seks filer lastes opp (Excel `.xlsx`/`.xls` eller `.csv`) før
resten av appen åpnes:

1. **Utskrift av alle fakturaer** – leverandør, prodkode, beløp, dato.
2. **Endringslogg** – endringer mot byggherre, med status og beløp.
3. **Utskrift fra "Prosjektinfo"** – budsjett, produsert verdi, påløpt kost og
   sluttkostprognose per prodkode.
4. **Faktureringsplan mot byggherre** – planlagt fakturering per måned. Kan
   lastes opp enten som én rad per måned, eller som en "bred" plan der hver
   måned er en egen kolonne (vanlig format for S-kurve-planer) – appen
   summerer da alle rader per månedskolonne automatisk.
5. **Beslutningsplan** – avklaringer byggherren må ta stilling til, med frist.
6. **Innkjøpsplan** – når de ulike entreprisene skal kjøpes inn.

Siden filformatet varierer fra prosjekt til prosjekt og mellom systemer,
gjetter appen automatisk hvilke kolonner i regnearket som hører til hvilket
felt (basert på vanlige norske kolonnenavn), og viser deg gjetningen i et
bekreftelsesvindu før dataene importeres. Du kan justere kolonnevalget manuelt
der det trengs.

Når alle seks filene er lastet opp, viser appen en dashbord-oversikt med:

- **Økonomisk oversikt**: opprinnelig budsjett, budsjett + godkjente
  endringer, sluttkostprognose og dekningsgrad.
- **Kvadratmeterpris**: skriv inn BRA-i (bruksareal internt) for å få
  budsjett og sluttkost regnet om til kr/m².
- **S-kurve**: fakturaplanen vist grafisk (kumulativt planlagt), sammenlignet
  med faktisk fakturert sum (fra fakturautskriften) og produsert verdi hittil
  (fra Prosjektinfo).
- **Avstemming per prodkode**: sammenligner budsjett, påløpt kost og
  sluttkostprognose per prodkode. Appen flagger prodkoder der
  sluttkostprognosen overstiger budsjettet, og prodkoder der forbrukstakten
  hittil tilsier at man vil gå over budsjett før prosjektet er ferdig – f.eks.
  at en post har brukt en uforholdsmessig stor andel av budsjettet tidlig i
  prosjektet.
- **Endringer mot byggherre**: antall, status og sum per status.
- **Størst leverandører**: rangert etter fakturert beløp.
- **Beslutnings- og innkjøpsplan**: viser begge planene kronologisk, og
  varsler dersom et innkjøp er planlagt gjennomført før en tilhørende
  avklaring (samme prodkode) har frist i beslutningsplanen.

Trykk "Last opp nye filer" for å nullstille og starte et nytt prosjekt.

## Teknisk

- React + TypeScript + Vite, ingen backend.
- [SheetJS (xlsx)](https://sheetjs.com/) for lesing av Excel/CSV.
- [Recharts](https://recharts.org/) for S-kurve-grafen.
- `idb-keyval` for lokal lagring i nettleseren (IndexedDB).

Kildekoden er organisert slik:

- `src/types.ts` – datamodeller for de seks filtypene og prosjektdatasettet.
- `src/lib/parsers/` – innlesing av regneark, automatisk kolonnegjenkjenning
  og omforming til typede rader.
- `src/lib/calculations.ts` – all utregning (budsjett, S-kurve, avvikssjekk
  per prodkode, leverandørrangering, m.m.).
- `src/lib/storage.ts` – lagring i IndexedDB.
- `src/components/` – opplastingssteg og dashbord-visning.
