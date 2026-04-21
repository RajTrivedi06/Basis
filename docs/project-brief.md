---
title: Project Brief
tags: [area:overview, audience:all, status:active]
owner: Raj
last_updated: 2026-04-20
---

# Project Brief

## Overview

Basis is a public-data study that quantifies **GPU compute fungibility** across cloud providers. It collects quoted GPU prices from five (now four, after dropping Lambda Labs) provider sources, normalizes them into a canonical schema, and decomposes observed price dispersion into observable factors (region, commitment type, bundled resources, provider identity) vs. **residual basis risk**.

It is a research study with an interactive dashboard. It is explicitly not a SaaS product, a price aggregator, or a derivatives pricing engine.

## The Problem

There is no transparent benchmark for GPU compute. An H100 rents for $0.45/hr on one marketplace and $6.88/hr on AWS Spot — the same nominal hardware, a 15× spread. Financial infrastructure (indexes, futures, swaps) for AI compute is only useful if the underlying commodity is fungible enough to benchmark. Whether it is remains an open empirical question.

Ornn AI (now on the Bloomberg Terminal) is building exactly this infrastructure and has to answer the same question from the other side. Basis measures the phenomenon — **how much of the spread is explained and how much is genuinely residual** — from public data.

## What This System Does

1. **Collects** quoted prices twice daily from Vast.ai, RunPod, AWS EC2 Spot, and TensorDock.
2. **Normalizes** provider-specific GPU names, commitment types, regions, and bundled resources into a canonical schema — rule-based, conservative, interpretable.
3. **Decomposes** price variance per (GPU SKU, day) into region / commitment / provider / bundle / residual components.
4. **Visualizes** dispersion and decomposition through an interactive dashboard.
5. **Publishes** an 800–1500 word analytical writeup that turns the data into a findings piece.

## Positioning

This is a study based on **public quoted prices, not executed transactions**. Transaction-based benchmarks (e.g., Ornn's OCPI) require enterprise subscriptions. The limitation is honest — it mirrors the real market reality that transaction-based pricing is inaccessible, which is itself the problem financial infrastructure exists to solve.

## Architecture (four layers)

1. **Collectors** — one file per provider, inheriting `BaseCollector`. Write immutable JSONB snapshots to `raw_observations`.
2. **Normalization** — rule-based mapping of GPU names, commitments, regions, bundles to canonical schema. Writes to `canonical_offers`.
3. **Analytics** — dispersion metrics and variance decomposition. Writes to `daily_aggregates` and `basis_decomposition`. (Phase 3, not yet implemented.)
4. **API + Frontend** — FastAPI backend reading aggregates, Next.js dashboard for the narrative.

## Current State (summary)

- **Phase 0 (scaffold) — complete.**
- **Phase 1 (collection) — complete** with 4/5 providers. Lambda Labs dropped (ADR 0003).
- **Phase 2 (normalization) — complete.** 9,979 canonical offers across 97 SKUs.
- **Phase 3 (analytics) — next.**
- **Phase 4–6 (API, frontend, writeup) — planned.**

Detailed status: [TASKS/README.md](TASKS/README.md). Phase roadmap: [roadmap.md](roadmap.md).

## Scope Boundary

The following are **explicitly out of scope** and should be refused if suggested:

- User accounts, auth, multi-tenancy.
- Transaction simulation or derivatives pricing.
- ML-based normalization.
- Deployment / hosting until the app is feature-complete.
- Observability / APM frameworks beyond stdlib logging.
- Paid data sources.

See [../AGENTS.md](../AGENTS.md) "What NOT to Do" for the full list.
