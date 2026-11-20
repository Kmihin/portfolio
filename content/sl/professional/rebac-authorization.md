---
title: Varnost, vloge in pravice za B2B platformo
label: Pravice dostopa
slug: rebac-authorization
type: professional
year: 2025-2026
summary: "Zasnoval in razvil sem varnostni model B2B platforme: kdo lahko vidi in spreminja katere vire, glede na vloge, pravice in odnose med podjetji in uporabniki."
stack: [C#, .NET, ASP.NET Core, SQL Server, REST]
role: Zasnova in izvedba
featured: false
---

## Izziv
Podjetja na B2B platformi so potrebovala natančen dostop do skupnih virov (poštnih predalov za sporočila) v testnem in produkcijskem okolju. Prvi model je mešal identiteto, pravice in podatke storitev in ga je bilo težko vzdrževati.

## Kaj sem naredil
- Shemo na novo zasnoval kot čisti nadzor dostopa na podlagi odnosov (ReBAC): viri, naročnine (uporabniki) in pravice, brez podatkov posameznih storitev.
- En sistem za dodeljevanje za obe okolji; okolje določa uporabnik, viri so od okolja neodvisni.
- Dodeljevanje virov premaknil za API prehoda; sistem za dodeljevanje nima dostopa do baze prehoda.
- Za vsak repozitorij napisal samostojne specifikacije, da se je delo lahko razdelilo med razvijalce in agente za programiranje.

## Rezultat
Splošen model, ki ga je mogoče uporabiti za prihodnje storitve; jasna ločitev med dodeljevanjem in prehodom; obstoječa izmenjava sporočil nespremenjena.
