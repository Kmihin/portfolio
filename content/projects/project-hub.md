---
title: "Project Hub: everything I run, on one page"
label: Project Hub
tagline: Everything I run, on one page.
slug: project-hub
type: project
year: 2026
summary: A private dashboard for all my projects. It shows what runs where, on which account, where each secret lives and whether everything is healthy right now, with one click into the right console.
stack: [ASP.NET Core 10, C#, Angular 21, three.js, GitHub OAuth, Docker, Render, GitHub Actions]
role: Designed and built alone (full stack)
featured: true
---

## Problem
My projects run on a dozen free services: GitHub, Render, Neon, Supabase, Cloudflare Pages and Workers, Backblaze B2, Resend. Each has its own console and its own account, and checking all of them meant half an hour of tabs. Where a secret lives, or which email a service was created with, was in my head.

## What I did
- One config file describes each project as a list of services: the ids each provider needs, which account it was created with and on which plan, and where every secret lives (names only, never a value).
- The API reads GitHub Actions, Render, Cloudflare, Neon, Supabase, Backblaze B2 and Resend through their own APIs and turns each into one state: fine, needs attention, failed or unknown.
- Read-only towards every service. A provider that fails or is slow becomes an "unknown" tile instead of breaking the page: 10 seconds per tile, results cached for a minute.
- "Needs attention" comes first; usage bars show how close email and storage are to the free plans' limits.
- Websites are checked only on request, so the hub never wakes a sleeping free service by itself.
- Sign-in with GitHub (OAuth) for one allowed account; a secure cookie, rate limits and strict security headers with a CSP nonce.
- A mobile-first Angular page with a three.js scene of the projects orbiting the hub, coloured by their state.
- No database and no packages beyond the framework: everything the API needs ships with ASP.NET Core.

## Stack
- ASP.NET Core 10 (C#): typed clients per provider, in-memory cache, OAuth and cookie authentication.
- Angular 21: standalone components, signals, zoneless; three.js for the scene; hand-written SVG bars.
- Docker on Render, deployed by GitHub Actions; xUnit and Vitest tests (about 130).

## Result
Running on Render and used from phone and desktop: one look shows whether anything needs me, and every console is one click away.
