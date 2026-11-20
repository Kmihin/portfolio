---
title: "Project Hub: vse, kar poganjam, na eni strani"
label: Project Hub
tagline: Vse, kar poganjam, na eni strani.
slug: project-hub
type: project
year: 2026
summary: Zasebna nadzorna plošča za vse moje projekte. Pokaže, kaj teče kje, na katerem računu, kje je shranjena vsaka skrivnost in ali je ta trenutek vse v redu, z enim klikom do prave konzole.
stack: [ASP.NET Core 10, C#, Angular 21, three.js, GitHub OAuth, Docker, Render, GitHub Actions]
role: Zasnoval in razvil sam (full stack)
featured: true
---

## Izziv
Moji projekti tečejo na ducatu brezplačnih storitev: GitHub, Render, Neon, Supabase, Cloudflare Pages in Workers, Backblaze B2, Resend. Vsaka ima svojo konzolo in svoj račun, pregled vseh pa je pomenil pol ure zavihkov. Kje je shranjena katera skrivnost ali s katerim e-naslovom je bila storitev ustvarjena, sem imel v glavi.

## Kaj sem naredil
- Ena konfiguracijska datoteka opiše vsak projekt kot seznam storitev: identifikatorje, ki jih potrebuje ponudnik, s katerim računom in na katerem paketu je bila ustvarjena, in kje je shranjena vsaka skrivnost (samo imena, nikoli vrednosti).
- API bere GitHub Actions, Render, Cloudflare, Neon, Supabase, Backblaze B2 in Resend prek njihovih API-jev in vsakega pretvori v eno stanje: v redu, potrebuje pozornost, napaka ali neznano.
- Do vseh storitev samo bere. Ponudnik, ki ne odgovori ali je počasen, postane ploščica »neznano«, stran pa deluje naprej: 10 sekund na ploščico, rezultati shranjeni za minuto.
- Najprej je seznam »potrebuje pozornost«; vrstice porabe pokažejo, kako blizu so e-pošta in shramba omejitvam brezplačnih paketov.
- Spletne strani preveri samo na zahtevo, zato sama nikoli ne zbudi speče brezplačne storitve.
- Prijava z GitHubom (OAuth) za en dovoljen račun; varen piškotek, omejitve zahtevkov in strogi varnostni glavniki z nonceom CSP.
- Angular stran, narejena najprej za telefon, s prizorom three.js, v katerem projekti krožijo okoli središča, obarvani po stanju.
- Brez baze in brez paketov zunaj ogrodja: vse, kar API potrebuje, je že v ASP.NET Core.

## Tehnologije
- ASP.NET Core 10 (C#): odjemalci za vsakega ponudnika, predpomnilnik v pomnilniku, avtentikacija OAuth in s piškotkom.
- Angular 21: samostojne komponente, signali, brez zone.js; three.js za prizor; ročno narisani SVG stolpci.
- Docker na Renderju, namestitve z GitHub Actions; testi xUnit in Vitest (približno 130).

## Rezultat
Teče na Renderju in ga uporabljam s telefona in računalnika: en pogled pokaže, ali kaj potrebuje mojo pozornost, vsaka konzola pa je en klik stran.
