---
title: "Fuel Guide: sledenje prehrani in treningom"
label: Fuel Guide
slug: fuel-guide
type: project
year: 2026
summary: Mobilna PWA in aplikacija (Capacitor) za beleženje obrokov, treningov, teže in nizov, z lestvicami za fitnese.
stack: [React, Vite, TypeScript, Tailwind, TanStack Query, Supabase, Capacitor (iOS/Android), Service Worker]
role: Zasnova in izvedba
links: { repo: "https://github.com/Kmihin/fuel-guide-app" }
featured: true
---

## Izziv
Narejena za mojo lastno fitnes pot: obstoječe aplikacije niso ustrezale temu, kako sem želel beležiti obroke, treninge in napredek, zato sem si jo naredil po svojih potrebah.

## Kaj sem naredil
- Uvodni koraki (cilj, raven aktivnosti, telesni podatki), iz katerih se izračunajo dnevni cilji kalorij in makrohranil.
- Beleženje obrokov z iskanjem živil, jedilniki, sestavljanje treningov s predlogami, knjižnica vaj.
- Dnevnik teže in grafi napredka, nizi, značke XP in rangov, lestvice za fitnese in skupna lestvica prek funkcij Postgres.
- PWA z lastnim service workerjem; zapakirana za iOS in Android s Capacitorjem.
- Ogrodje narejeno z Lovable, nato razširjeno.

## Rezultat
Vsak dan jo uporabljam kot PWA in kot nameščeno aplikacijo. Ni objavljena v trgovinah z aplikacijami.
