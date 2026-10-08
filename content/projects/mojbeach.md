---
title: "MojBeach: beach volleyball court booking"
slug: mojbeach
type: project
year: 2026
summary: Booking platform for beach volleyball courts in Slovenia with pricing engine, recurring bookings and venue admin.
stack: [React 19, TanStack Start, TypeScript, Tailwind, "Supabase (Postgres, Auth, RLS)", Resend, Cloudflare Workers]
role: Design, data model, implementation
links: { repo: "https://github.com/Kmihin/mojbeach-3b22da5a", live: "https://mojbeach.si" }
featured: true
---

## Problem
Own product idea: beach-volleyball venues in Slovenia handle bookings by phone or messages. MojBeach gives a venue a public booking page and an admin for pricing, recurring bookings and blocking, with no account needed for players.

## What I did
- Data model: venues, courts, opening hours, bookings, blocked slots, price bands, recurring groups, tournaments (12 tables, 29 migrations).
- Business logic in Postgres functions: `create_booking`, `calc_booking_price`, `preview_recurring_conflicts`, `create_bulk_blocks`; RLS for public / owner / super-admin.
- Public flow: calendar, slot picker, live price preview, booking without account, cancellation by code, tournament registration.
- Admin: pricing modes (flat vs weekday/weekend time bands), manual and recurring bookings with conflict preview, bulk blocking, payment status, roles.
- Transactional email (Resend) in Slovenian; server-only functions.
- Scaffolded with Lovable, then specified and extended in four phases (additive migrations, RLS everywhere).

## Result
Live on mojbeach.si as a ready-to-use product; not yet adopted by a venue. Presented as a product demo: full booking flow, pricing engine and admin are functional.
