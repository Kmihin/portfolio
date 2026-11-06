---
title: "Omnikeep: zero-knowledge vault for documents, pay and money"
label: Omnikeep
slug: omnikeep
type: project
year: 2026
summary: End-to-end encrypted personal and family vault with passwordless passkey login, payslip analysis, a work calendar that checks the payslip, and money tracking. The server only ever sees ciphertext.
stack: [Angular, ASP.NET Core, C#, PostgreSQL, WebCrypto, WebAuthn passkeys, PWA]
role: Product, architecture, security design and implementation
links: {}
featured: true
---

## Problem
Personal documents, passwords, payslips and bank statements end up spread over email, cloud drives and paper, and every service that stores them can read them. The goal was one place for all of it, shared with the family where it makes sense, where even a full server breach reveals nothing.

## What I did
- Wrote the product and architecture spec and the coding conventions, then built it milestone by milestone (M0 to M9) with an AI coding agent working from that spec; I reviewed and committed every change.
- Zero-knowledge key hierarchy in the browser with WebCrypto: account key, vault keys, per-item keys, AES-256-GCM with context-bound data, ECDH P-256 key wrapping, chunked file encryption in a Web Worker, test vectors and tampering tests.
- No passwords anywhere: passkeys with the PRF extension unlock the keys on the device; new devices are approved from an existing one with a typed code; a recovery key and optional family-organizer recovery cover lost devices.
- Family vault: invites verified out of band, shared collections with per-collection access, member removal with key rotation re-encrypting every item key.
- Pay: payslip PDFs (also locked ones and phone photos through on-device OCR) parsed in the browser into a validated model, with monthly and yearly analysis.
- Work calendar with business trips and daily allowances, and a pay check that compares the calendar and employment rules with the payslip and lists every difference.
- Money: bank statement import, rule-based categories, budgets, a car page and an assessment with its numbers shown. Everything stays encrypted; no AI in the data path.
- ASP.NET Core API with EF Core on PostgreSQL, files through the API to private S3 storage, strict CSP with nonces, rate limits, quotas; one Docker service on free hosting, CI/CD with GitHub Actions.

## Result
Feature complete through hardening and the landing page; in daily use by me. 500+ API tests (xUnit with Testcontainers), Vitest and Playwright end-to-end flows with a virtual passkey authenticator. Public launch follows with its own domain.
