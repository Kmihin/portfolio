---
title: Electronic transport documents (e-CMR) platform
slug: ecmr-platform
type: professional
year: 2022–2026
summary: Designed and built an e-CMR platform from the specification; 10k+ electronic consignment notes per year, used across Europe.
stack: [C#, .NET, ASP.NET, SQL Server, REST APIs, PDF generation, Azure]
role: Lead developer — solution design, backend, integrations
featured: true
---

## Problem
Road transport still runs on paper CMR consignment notes: printed, signed at every handover, scanned and re-typed. The goal was a digital CMR that carriers, senders and consignees can create, sign and exchange electronically, compliant with the e-CMR protocol, and reachable from partner transport-management systems.

## What I did
- Designed the solution from the protocol documentation and functional specification, with brainstorming support from the team.
- Data model and backend for the document lifecycle: creation, multi-party signing (carrier, sender, consignee), status transitions, audit trail.
- Multilingual PDF rendering of the signed consignment note with embedded signatures.
- REST API for partner TMS integrations (document creation, signing flow, roles) and support for partners integrating it.
- Deployment and operations on Azure.

## Result
In production, 10k+ e-CMRs per year, used by companies across Europe; also used in cross-company industry pilots.
