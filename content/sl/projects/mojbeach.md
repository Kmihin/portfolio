---
title: "MojBeach: rezervacije igrišč za odbojko na mivki"
label: MojBeach
slug: mojbeach
type: project
year: 2026
summary: Platforma za rezervacije igrišč za odbojko na mivki v Sloveniji, s cenikom, ponavljajočimi se rezervacijami in upravljanjem za lokacije.
stack: [React 19, TanStack Start, TypeScript, Tailwind, "Supabase (Postgres, Auth, RLS)", Resend, Cloudflare Workers]
role: Zasnova, podatkovni model, izvedba
links: { repo: "https://github.com/Kmihin/mojbeach-3b22da5a", live: "https://mojbeach.si" }
featured: true
features:
  - text: "Rezervacija brez računa: izbereš lokacijo, igrišče, dan in prost termin."
    image: { src: /projects/mojbeach/booking.webp, alt: "Stran igrišča: koledar za november in prosti enourni termini na ponedeljek", width: 800, height: 500 }
  - text: "Cena se sproti prilagaja trajanju in cenovnim pasovom igrišča, še preden rezerviraš."
    image: { src: /projects/mojbeach/price.webp, alt: "Obrazec za rezervacijo: ime, e-pošta, telefon, soglasje in skupaj 16 evrov za dve uri", width: 800, height: 500 }
  - text: "Turnirji: ekipe se prijavijo na spletu in vidijo, koliko mest je še prostih."
    image: { src: /projects/mojbeach/tournaments.webp, alt: "Prihajajoči turnirji: testni turnir z odprtimi prijavami, 0 od 20 ekip, 20 evrov", width: 800, height: 500 }
  - text: "Narejeno najprej za telefone, saj večina rezervacij nastane na poti do igrišča."
    image: { src: /projects/mojbeach/phone.webp, alt: "Domača stran na telefonu: Mivka, sonce in tvoja igra, z gumboma za izbiro lokacije in preklic", width: 750, height: 940 }
  - text: "Upravljanje lokacije: cene po dnevih in urah, ponavljajoče se rezervacije s predogledom prekrivanj, zapiranje več terminov hkrati, stanje plačil."
  - text: "Preklic s kodo: gost prekliče z referenčno številko in e-pošto, v okviru pravil lokacije."
featuresNote: Posnetki zaslona z delujoče strani, s testnimi lokacijami.
---

## Izziv
Lastna ideja za produkt: lokacije z igrišči za odbojko na mivki v Sloveniji rezervacije urejajo po telefonu ali sporočilih. MojBeach lokaciji da javno stran za rezervacije in upravljanje cen, ponavljajočih se rezervacij in zapor, igralci pa za rezervacijo ne potrebujejo računa.

## Kaj sem naredil
- Podatkovni model: lokacije, igrišča, delovni čas, rezervacije, zaprti termini, cenovni pasovi, ponavljajoče se skupine, turnirji (12 tabel, 29 migracij).
- Poslovna logika v približno 25 funkcijah Postgres: `create_booking`, `calc_booking_price`, `preview_recurring_conflicts`, `create_bulk_blocks` in druge; RLS za javnost, lastnike in skrbnike.
- Javni del: koledar, izbira termina, sprotni izračun cene, rezervacija brez računa, odpoved s kodo, prijava na turnir.
- Upravljanje: načini cen (enotna cena ali časovni pasovi za delavnike in vikende), ročne in ponavljajoče se rezervacije s predogledom prekrivanj, zapiranje več terminov hkrati, stanje plačil, vloge.
- Transakcijska e-pošta (Resend) v slovenščini; funkcije samo na strežniku.
- Ogrodje narejeno z Lovable, nato specificirano in razširjeno v štirih fazah (dodajne migracije, RLS povsod).

## Rezultat
Deluje na mojbeach.si kot produkt, pripravljen za uporabo; nobena lokacija ga še ne uporablja. Predstavljen kot demo produkta: celoten potek rezervacije, cenik in upravljanje delujejo.
