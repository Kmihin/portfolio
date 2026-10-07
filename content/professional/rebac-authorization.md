---
title: Relationship-based authorization for a B2B gateway
slug: rebac-authorization
type: professional
year: 2025–2026
summary: Designed and implemented a generic ReBAC authorization model between a CRM provisioning system and an API gateway.
stack: [C#, .NET, ASP.NET Core, SQL Server, REST]
role: Designer and implementer
featured: false
---

## Problem
Customers of a B2B gateway needed fine-grained access to shared resources (message mailboxes) across test and production environments. The first model mixed identity, permissions and service data and was hard to maintain.

## What I did
- Redesigned the schema as pure authorization: resources, subscriptions (users) and permission items, with no service-specific data.
- One provisioning system (CRM) for both environments; the user determines the environment, resources stay environment-agnostic.
- Moved resource provisioning behind the gateway API; CRM holds no gateway database access.
- Wrote self-contained implementation specs for each repository so the work could be split across developers and coding agents.

## Result
Generic model reusable for future services; clear separation between CRM and gateway; existing message-exchange runtime untouched.
