---
title: Omnikeep
label: Omnikeep
tagline: Your life's paperwork, locked to you.
slug: omnikeep
type: project
year: 2026
summary: A private web app (PWA) for documents, passwords, payslips and money in one place, encrypted on the user's device. It tells you what needs attention.
stack: [Angular 21, ASP.NET Core 10, C#, PostgreSQL, EF Core, Backblaze B2, Docker, Render, GitHub Actions]
role: Designed and built alone (full stack)
links:
  live: https://homekeep-wt02.onrender.com/en/welcome
  liveLabel: Live demo
  liveNote: may take a minute to wake up
featured: true
cover:
  src: /projects/omnikeep/documents.webp
  alt: "The Documents page: categories, and a list of documents with their expiry dates"
  width: 2200
  height: 1375
features:
  - text: "Documents: ID cards, insurance, registration and warranties, with an email 30 days before one expires."
    image:
      src: /projects/omnikeep/document-details.webp
      alt: "A passport's details: its expiry date, in red, and an email reminder 30 days before"
      width: 1176
      height: 912
  - text: "Payslips: import a PDF or a photo; read on the device (pdf.js, OCR with Tesseract.js), totals checked, each month compared with the ones before."
    image:
      src: /projects/omnikeep/pay-month.webp
      alt: "A payslip for September: gross, contributions, income tax, net and allowances"
      width: 1176
      height: 718
  - text: "Passwords and PINs: shown only after confirming it's you; a copied value is cleared after 30 seconds."
    image:
      src: /projects/omnikeep/secrets.webp
      alt: "The Secrets page: a password, a PIN, a card and a login, their values hidden"
      width: 1600
      height: 717
  - text: "Money: import a bank statement, categorise it with your own rules, with pay from the payslips; plain findings show what changed and where to cut down."
    image:
      src: /projects/omnikeep/money-findings.webp
      alt: "Findings for a month: what was kept, where to cut, food above average, subscriptions"
      width: 1600
      height: 774
  - text: "Work calendar: office, home, leave and business trips with meal, travel and per diem allowances, checked against the payslip."
    image:
      src: /projects/omnikeep/calendar.webp
      alt: "A work month: office and home days, two days of leave, and the month's totals"
      width: 1600
      height: 1057
  - text: "Family: share chosen collections with up to 5 family members; the rest stays private."
featuresNote: All screenshots use made-up test data.
---

## What it is
A private web app (PWA) for documents, passwords, payslips and money in one place, encrypted on the user's device. It tells you what needs attention.

## Security
- AES-256-GCM encryption in the browser (WebCrypto) before anything is uploaded.
- Sign-in with passkeys (WebAuthn with PRF), no passwords.
- The server cannot read files or their names.
- Hosted in the EU.

## Stack
- Angular 21: standalone components, signals, zoneless, i18n in English and Slovenian.
- ASP.NET Core 10 (C#), EF Core with PostgreSQL (Neon, EU).
- S3-compatible storage (Backblaze B2, EU).
- Docker on Render, GitHub Actions CI/CD.

## Testing
- xUnit API tests against real Postgres and S3 (Testcontainers).
- Vitest unit tests.
- Playwright end-to-end tests with a virtual passkey authenticator.
- About 1,800 tests in total.
