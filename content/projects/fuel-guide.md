---
title: Fuel Guide — nutrition and workout tracker
slug: fuel-guide
type: project
year: 2026
summary: Mobile-first PWA and native (Capacitor) app for tracking meals, workouts, weight and streaks, with gym leaderboards.
stack: [React, Vite, TypeScript, Tailwind, TanStack Query, Supabase, Capacitor (iOS/Android), Service Worker]
role: Design and implementation
links: { repo: "https://github.com/Kmihin/fuel-guide-app" }
featured: true
---

## Problem
Built for my own fitness journey: existing trackers didn't fit how I wanted to log meals, workouts and progress, so I built one around my needs.

## What I did
- Onboarding (goal, activity level, body data) → daily calorie and macro targets.
- Meal logging with food search, meal plans, workout builder and templates, exercise library.
- Weight log and progress charts, streaks, XP/rank badges, gym and overall leaderboards via Postgres RPCs.
- PWA with custom service worker; packaged for iOS/Android with Capacitor.
- Scaffolded with Lovable, then extended.

## Result
In daily personal use as a PWA and native build. Not published on app stores.
