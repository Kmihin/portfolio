---
title: "MojBeach: beach volleyball court booking"
label: MojBeach
slug: mojbeach
type: project
year: 2026
summary: Booking platform for beach volleyball courts in Slovenia with pricing engine, recurring bookings and venue admin.
stack: [React 19, TanStack Start, TypeScript, Tailwind, "Supabase (Postgres, Auth, RLS)", Resend, Cloudflare Workers]
role: Design, data model, implementation
links: { repo: "https://github.com/Kmihin/mojbeach-3b22da5a", live: "https://mojbeach.si" }
featured: true
features:
  - text: "Booking without an account: pick a venue, a court, a day and a free slot."
    image: { src: /projects/mojbeach/booking.webp, alt: "A court's page: a calendar for November and the free one-hour slots on a Monday", width: 800, height: 500 }
  - text: "The price follows the duration and the court's price bands before you book."
    image: { src: /projects/mojbeach/price.webp, alt: "The booking form: name, email, phone, consent and a total of 16 euros for two hours", width: 800, height: 500 }
  - text: "Tournaments: teams sign up online and see how many places are left."
    image: { src: /projects/mojbeach/tournaments.webp, alt: "Upcoming tournaments: a test tournament with open registration, 0 of 20 teams, 20 euros", width: 800, height: 500 }
  - text: "Made for phones first, as most bookings are made on the way to the court."
    image: { src: /projects/mojbeach/phone.webp, alt: "The home page on a phone: Sand, sun and your game, with buttons to pick a venue or cancel", width: 750, height: 940 }
  - text: "Venue admin: prices by weekday and time, recurring bookings with a conflict preview, blocking many slots at once, payment status."
  - text: "Cancelling by code: a guest cancels with the booking reference and email, within the venue's rules."
featuresNote: Screenshots from the live site, with test venues.
---

## Problem
Own product idea: beach-volleyball venues in Slovenia handle bookings by phone or messages. MojBeach gives a venue a public booking page and an admin for pricing, recurring bookings and blocking, with no account needed for players.

## What I did
- Data model: venues, courts, opening hours, bookings, blocked slots, price bands, recurring groups, tournaments (12 tables, 29 migrations).
- Business logic in about 25 Postgres functions: `create_booking`, `calc_booking_price`, `preview_recurring_conflicts`, `create_bulk_blocks` and more; RLS for public / owner / super-admin.
- Public flow: calendar, slot picker, live price preview, booking without account, cancellation by code, tournament registration.
- Admin: pricing modes (flat vs weekday/weekend time bands), manual and recurring bookings with conflict preview, bulk blocking, payment status, roles.
- Transactional email (Resend) in Slovenian; server-only functions.
- Scaffolded with Lovable, then specified and extended in four phases (additive migrations, RLS everywhere).

## Result
Live on mojbeach.si as a ready-to-use product; not yet adopted by a venue. Presented as a product demo: full booking flow, pricing engine and admin are functional.
