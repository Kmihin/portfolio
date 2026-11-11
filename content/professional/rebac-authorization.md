---
title: Security, roles and rights for a B2B platform
label: Access control
slug: rebac-authorization
type: professional
year: 2025-2026
summary: "Designed and built the security model behind a B2B platform: who can see and change which resources, based on roles, rights and the relationships between companies and users."
stack: [C#, .NET, ASP.NET Core, SQL Server, REST]
role: Designer and implementer
featured: false
---

## Problem
Companies using a B2B platform needed fine-grained access to shared resources (message mailboxes) across test and production environments. The first model mixed identity, permissions and service data and was hard to maintain.

## What I did
- Redesigned the schema as pure relationship-based access control (ReBAC): resources, subscriptions (users) and permission items, with no service-specific data.
- One provisioning system for both environments; the user determines the environment, resources stay environment-agnostic.
- Moved resource provisioning behind the gateway API; the provisioning system holds no gateway database access.
- Wrote self-contained implementation specs for each repository so the work could be split across developers and coding agents.

## Result
Generic model reusable for future services; clear separation between provisioning and the gateway; existing message-exchange runtime untouched.
