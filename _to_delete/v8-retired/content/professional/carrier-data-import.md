---
title: Carrier manifest import and transformation
slug: carrier-data-import
type: professional
year: 2026
summary: Automated daily import of carrier shipment manifests (fixed-width TXT and JSON) into a legacy TMS with rule-based code mapping and per-shipment error logging.
stack: [C#, .NET, SQL Server]
role: Developer
featured: false
---

## Problem
A parcel carrier delivers daily manifests in two formats. The legacy TMS expects single-character product and billing codes and a fixed schema that could not change.

## What I did
- Parallel import paths (TXT and JSON) into a staging table, run as batches and compared against each other.
- Explicit lookup-table mapping of new carrier codes onto the legacy code scheme at the transformation layer; fallbacks in the rule engine for missing customs data.
- Per-shipment, event-level error log exportable by operations.

## Result
Manual re-keying removed; discrepancies between formats visible and traceable per shipment.
