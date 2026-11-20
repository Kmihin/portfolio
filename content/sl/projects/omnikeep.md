---
title: Omnikeep
label: Omnikeep
tagline: Vaši papirji, zaklenjeni samo za vas.
slug: omnikeep
type: project
year: 2026
summary: Zasebna spletna aplikacija (PWA) za dokumente, gesla, plačilne liste in denar na enem mestu, šifrirane na uporabnikovi napravi. Pove vam, kaj potrebuje pozornost.
stack: [Angular 21, ASP.NET Core 10, C#, PostgreSQL, EF Core, Backblaze B2, Docker, Render, GitHub Actions]
role: Zasnoval in razvil sam (full stack)
links:
  live: https://homekeep-wt02.onrender.com/sl/welcome
  liveLabel: Demo
  liveNote: lahko se zbuja do minute
featured: true
cover:
  src: /projects/omnikeep/documents.webp
  alt: "Stran z dokumenti: kategorije in seznam dokumentov z datumi poteka"
  width: 2200
  height: 1375
features:
  - text: "Dokumenti: osebne izkaznice, zavarovanja, registracije in garancije, z e-poštnim opomnikom 30 dni pred potekom."
    image:
      src: /projects/omnikeep/document-details.webp
      alt: "Podrobnosti potnega lista: datum poteka v rdečem in e-poštni opomnik 30 dni prej"
      width: 1176
      height: 912
  - text: "Plačilne liste: uvoz PDF-ja ali fotografije; branje na napravi (pdf.js, OCR s Tesseract.js), preverjeni seštevki, vsak mesec primerjan s prejšnjimi."
    image:
      src: /projects/omnikeep/pay-month.webp
      alt: "Plačilna lista za september: bruto, prispevki, dohodnina, neto in dodatki"
      width: 1176
      height: 718
  - text: "Gesla in PIN-i: prikazani šele, ko potrdite, da ste to vi; kopirana vrednost se po 30 sekundah izbriše."
    image:
      src: /projects/omnikeep/secrets.webp
      alt: "Stran s skrivnostmi: geslo, PIN, kartica in prijava, vrednosti skrite"
      width: 1600
      height: 717
  - text: "Denar: uvoz bančnega izpiska, razvrščanje po lastnih pravilih, s plačo iz plačilnih list; jasne ugotovitve pokažejo, kaj se je spremenilo in kje lahko privarčujete."
    image:
      src: /projects/omnikeep/money-findings.webp
      alt: "Ugotovitve za mesec: kaj je ostalo, kje varčevati, hrana nad povprečjem, naročnine"
      width: 1600
      height: 774
  - text: "Delovni koledar: pisarna, delo od doma, dopust in službene poti s prehrano, potnimi stroški in dnevnicami, preverjeno s plačilno listo."
    image:
      src: /projects/omnikeep/calendar.webp
      alt: "Delovni mesec: dnevi v pisarni in doma, dva dneva dopusta in mesečni seštevki"
      width: 1600
      height: 1057
  - text: "Avto: stroški, prevoženi kilometri in dokumenti za vsako vozilo, povezani z bančnimi transakcijami."
  - text: "Družina: izbrane zbirke delite z največ 5 družinskimi člani; ostalo ostane zasebno."
featuresNote: Vsi posnetki zaslona uporabljajo izmišljene testne podatke.
---

## Kaj je
Zasebna spletna aplikacija (PWA) za dokumente, gesla, plačilne liste in denar na enem mestu, šifrirane na uporabnikovi napravi. Pove vam, kaj potrebuje pozornost.

## Varnost
- Šifriranje AES-256-GCM v brskalniku (WebCrypto), preden se karkoli naloži; ključi so oviti za vsak trezor in vsakega družinskega člana in napravo nikoli ne zapustijo nešifrirani.
- Prijava s passkeyi (WebAuthn s PRF), brez gesel; obnova prek druge naprave, organizatorja družine ali obnovitvenega ključa.
- Strežnik ne more prebrati datotek ali njihovih imen: hrani samo šifrirane podatke in ovite ključe.
- Strogi varnostni glavniki (CSP brez unsafe-inline), omejitve zahtevkov, kvote shrambe in pravila hrambe podatkov; zapisan seznam za zunanji varnostni pregled.
- Gostovanje v EU.

## Tehnologije
- Angular 21: samostojne komponente, signali, brez zone.js, v angleščini in slovenščini.
- ASP.NET Core 10 (C#), EF Core s PostgreSQL (Neon, EU).
- Shramba, združljiva s S3 (Backblaze B2, EU).
- Docker na Renderju, CI/CD z GitHub Actions.

## Testiranje
- Približno 500 testov API-ja z xUnit na pravem Postgresu in shrambi S3 (Testcontainers).
- Približno 1.000 enotskih testov Vitest, med njimi branje plačilnih list na pravih vzorčnih dokumentih.
- 45 testov od začetka do konca s Playwrightom in navideznim avtentikatorjem passkey.
