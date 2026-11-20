---
title: Partner data import and transformation
label: Data import
slug: data-import
type: professional
year: 2026
summary: Automated daily import of a partner's data files (fixed-width TXT and JSON) into a legacy system with rule-based code mapping and per-record error logging.
stack: [C#, .NET, SQL Server]
role: Developer
featured: false
---

## Problem
A partner delivers daily data files in two formats. The legacy system expects single-character codes and a fixed schema that could not change.

## What I did
- Parallel import paths (TXT and JSON) into a staging table, run as batches and compared against each other.
- Explicit lookup-table mapping of the partner's codes onto the legacy code scheme at the transformation layer; fallbacks in the rule engine for missing data.
- Per-record, event-level error log exportable by operations.

## Result
Manual re-keying removed; discrepancies between formats visible and traceable per record.
