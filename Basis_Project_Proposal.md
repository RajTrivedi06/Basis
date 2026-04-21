# Basis — Project Proposal & Planning Document

> **Purpose of this document:** This is a self-contained briefing document for **Basis**, a public-data study of GPU compute fungibility. It contains all the context, motivation, technical design, and execution plan needed to work on this project. It can be shared with a fresh LLM chat, a collaborator, or revisited later without losing context.

> **About the name:** In commodity derivatives, "basis" is the gap between a benchmark price and the price a specific buyer actually transacts at — the irreducible mismatch that hedgers worry about. The project is named Basis because that gap is exactly what it measures for GPU compute: how much of the observed price dispersion across providers is explained by observable factors, and how much remains as genuine basis risk that a financial benchmark would have to either absorb or externalize.

---

## 1. Background & Motivation

### 1.1 Who This Project Is For

This project is being built by Raj, a Computer Science and Data Science senior at UW-Madison graduating May 2026, as a portfolio piece to demonstrate domain expertise in the GPU compute pricing and financial infrastructure space. The specific target audience is Kush Bavaria, CEO and co-founder of Ornn AI (ornn.com), a New York-based seed-stage startup building financial infrastructure for the GPU compute market.

The goal is **not** to build a production system or replicate Ornn's product. The goal is to demonstrate that Raj understands the domain deeply enough to identify a meaningful analytical question, execute on it using public data, and arrive at insights that lead to a substantive technical conversation with a founder in the space.

### 1.2 The Company Being Targeted (Ornn AI)

Ornn is a 6-person, $5.7M seed-funded startup building financial infrastructure for the compute economy. Their core thesis is that GPU compute is becoming the most important commodity of the AI era, but unlike oil, natural gas, or electricity, it has no transparent pricing benchmarks, no standardized derivatives, and no liquid forward curve. Without these, the $4-7 trillion projected to flow into AI data center infrastructure through 2030 cannot be efficiently financed.

Ornn's product stack consists of:

- **OCPI (Ornn Compute Price Index)** — A daily benchmark tracking real transaction prices for H100, H200, B200, A100, and RTX-class GPUs across cloud and on-premise markets. Now live on the Bloomberg Terminal (ticker "ORNNH100") as of April 2, 2026.
- **Compute Swaps** — Cash-settled OTC contracts agreeing on a fixed GPU hourly rate for a future period, settling against OCPI. First swap executed December 11, 2025.
- **Compute Futures** — Standardized versions of swaps, live on Kalshi and Robinhood, with exchange-traded perpetuals launching through a partnership with Architect Financial Technologies (run by former FTX US president Brett Harrison).
- **Residual Value Swaps** — GPU depreciation protection for data center operators and lenders.
- **Memory Futures** — Expanding benchmark coverage to HBM/DRAM pricing.

Ornn operates under the CFTC's de minimis exemption (up to $8B notional swap volume) and is pursuing a Designated Contract Market license.

### 1.3 The Core Problem Being Studied

Ornn publicly states that "GPUs are not perfectly fungible, much like individual mortgages. Configuration, provider, and location all affect pricing." Industry reports show H100 rental prices vary by up to 5x across providers ($2.50 to $12.00 per hour) for the same nominal hardware. This price dispersion is the central challenge to building a tradeable compute commodity — the same problem that structured-product benchmarks solved for mortgages and that standardization solved for crude oil.

**The fundamental question this project answers:** How fungible is an H100, really, when measured from public data? After controlling for all observable factors (region, commitment type, bundled resources, verification status, etc.), how much unexplained price variance remains? And what does that unexplained variance represent?

This is not an academic question. It's the same question Ornn must answer internally to decide what belongs *inside* their benchmark versus what should remain *outside* as basis risk. A benchmark that tries to normalize away too much becomes disconnected from what traders actually hedge against. A benchmark that normalizes away too little becomes noisy and hard to settle against.

### 1.4 Why This Project Is Differentiated

Most people exploring this space build one of two things: a price aggregator (scrape GPU prices and display them) or a trading simulator (pretend to trade compute futures). Both are surface-level. This project does something different — it treats GPU fungibility as a quantifiable empirical question and produces an analytical study, not just a tool.

The output is closer to a research paper with an interactive data appendix than a SaaS product. The deliverable has a thesis, a methodology, real findings, and a point of view. That framing is what creates a genuine founder-level conversation rather than a generic "I built a thing" pitch.

---

## 2. Project Specification

### 2.1 Project Name

**Basis**

The name comes from the commodity derivatives term for the gap between a benchmark price and the specific price a buyer transacts at. It is the single word that captures the entire thesis of the project — that GPU compute has a measurable, quantifiable basis across providers, and that understanding it is the foundation of any serious benchmark methodology.

### 2.2 One-Line Pitch

A public-data study quantifying GPU compute fungibility across cloud providers, decomposing price dispersion into observable factors and residual basis risk.

### 2.3 Core Thesis

GPU compute, as currently sold, is not a single economic good. The price dispersion visible in public marketplaces is partially explained by measurable factors (region, commitment, bundle, verification) and partially unexplained — and that unexplained variance is exactly what a financial benchmark must decide whether to absorb or externalize. This project quantifies both components using three weeks of real collected data.

### 2.4 What the Project Is NOT

- Not an OCPI clone or transaction-based index. Public data is quote/listing data, not executed transactions. This must be acknowledged explicitly in the README.
- Not a trading simulator or fake exchange UI.
- Not a tool that requires running GPU benchmarks or spending money on cloud compute.
- Not a general-purpose GPU procurement tool or shopping comparison site.

### 2.5 What the Project IS

- A focused data pipeline ingesting public GPU pricing from 5-6 providers daily.
- A normalization and basis-decomposition analysis engine that quantifies how much of observed price variance is explained by measurable factors.
- A clean web dashboard visualizing price dispersion, basis decomposition, and market maturity indicators over time.
- A written analytical piece (800-1500 words) presenting findings, methodology, and implications for benchmark design.
- A deployed, publicly accessible URL with a well-crafted README framing the project in market-infrastructure language.

---

## 3. Data Sources

All data sources for this project are free and publicly available. Total data cost: $0.

### 3.1 Primary Sources

**Vast.ai** — The richest public dataset. Public API at `/api/v0/bundles/` returns thousands of live GPU offers with pricing, hardware specs, location, reliability score, and verification status. No authentication required for basic queries. This is the anchor data source.

**RunPod** — Public GraphQL API with on-demand, spot, and reserved pricing. Basic queries work without authentication; free API key gives more depth. Cleaner and more curated than Vast.ai, useful for comparison.

**AWS EC2 Spot Price History** — Accessible via boto3 with a free AWS account. Provides up to 90 days of historical spot pricing for every GPU instance type across every region. Critical for hyperscaler comparison and historical baseline.

### 3.2 Secondary Sources

**Lambda Labs** — Public pricing page, scrapeable with Playwright. Simple on-demand and reserved pricing, doesn't change often. Daily scrape is sufficient.

**TensorDock** — Public GPU pricing page, scrapeable. Additional neocloud coverage.

**Google Cloud** — Official pricing API with free account access. Provides on-demand, spot, and committed-use discount pricing.

### 3.3 Optional Cross-Reference

**getdeploying.com** — Aggregator site that tracks pricing across many providers. Useful as a QA cross-check but should not be the primary source since they've already done the aggregation work.

### 3.4 Data Collection Cadence

- Marketplace APIs (Vast.ai, RunPod): twice daily to capture intra-day movement
- Pricing page scrapes (Lambda, TensorDock, CoreWeave): once daily
- AWS Spot History: daily pull of the last 24 hours
- Total expected records: roughly 10,000-50,000 price observations per day across all GPU types

### 3.5 Acknowledgments

The README must explicitly state that this is a study based on **public quoted prices**, not executed transactions. Transaction-based benchmarks (like Ornn's OCPI) are only accessible via enterprise subscription. This limitation is honest positioning, and it mirrors the real market reality that transaction-based pricing is inaccessible — which is itself the problem Ornn exists to solve.

---

## 4. Analytical Framework

### 4.1 The Core Question

Given a universe of H100 offers from multiple providers, how much of the observed price variance can be explained by observable factors, and what remains unexplained?

### 4.2 Observable Factors for Normalization

For each price observation, the following factors can be captured from public data:

- **GPU model and variant** — H100 SXM vs. H100 PCIe, H100 80GB vs. other memory configurations
- **Region / location** — at minimum country-level, often city-level
- **Provider** — the marketplace or cloud offering the capacity
- **Commitment type** — on-demand, spot, reserved (1-month, 6-month, 1-year, 3-year)
- **Bundle composition** — attached vCPUs, RAM, storage included in the price
- **Networking disclosure** — where disclosed, interconnect type (InfiniBand, Ethernet speeds)
- **Verification status** — for marketplaces like Vast.ai, whether the host is verified/datacenter-tier
- **Reliability score** — where published by the marketplace
- **Billing granularity** — per-second, per-minute, per-hour minimums

### 4.3 The Decomposition Method

For each H100 offer with price $P$, the analysis decomposes the price relative to a market median:

1. **Raw price variance** — compute the full distribution of H100 prices, identify the median, and measure dispersion (range, interquartile range, coefficient of variation).
2. **Normalized price** — adjust each offer for observable factors using a simple regression or rule-based adjustment model. For the MVP, rule-based adjustment is sufficient and more interpretable than ML approaches.
3. **Residual variance** — after normalization, what's left? This is the "unexplained fungibility gap."
4. **Attribution** — of the variance explained by observable factors, what share comes from each factor (region, commitment, bundle, etc.)?

### 4.4 Key Metrics the Project Produces

- **H100 Dispersion Index** — daily measure of how widely H100 prices are distributed across the market
- **Normalized vs. Raw Spread** — the gap between raw price dispersion and residual dispersion after normalization
- **Provider Basis** — for each provider, average deviation from the normalized market median
- **Regional Basis** — for each region, average deviation from the global normalized median
- **Market Maturity Indicator** — tracks whether dispersion is narrowing (market maturing) or widening over time

### 4.5 The Analytical Insight (What Goes in the Writeup)

After 2-3 weeks of collection, the project's written analysis presents findings like:

- "Raw H100 prices across providers vary by a factor of X. After normalizing for region, commitment type, and bundled resources, residual variance remains at Y — meaning roughly Z% of observed price dispersion is unexplained by publicly disclosed factors."
- "The largest explainable factor is \[commitment type / region / bundle\], accounting for N% of variance."
- "The residual variance likely represents: interconnect quality (often undisclosed), verification/security tier, provider reputation and ecosystem integration, and hardware generation subtleties (H100 SXM5 vs. newer firmware revisions)."
- "For a financial benchmark to be useful, the methodology question is: which of these residual factors should be absorbed into the index (making it more stable but more disconnected from individual buyer experience) vs. externalized as basis risk (leaving the index noisier but more faithful to market reality)?"

This is the thesis. It leads directly to a founder-level conversation.

---

## 5. Technical Design

### 5.1 Architecture Overview

The system has four layers:

1. **Collectors** — scheduled jobs that pull data from each source and write raw observations to the database
2. **Normalization service** — processes raw observations into canonical schema with normalized fields
3. **Analytics API** — FastAPI backend exposing endpoints for dispersion metrics, basis decomposition, and historical views
4. **Frontend dashboard** — Next.js application displaying charts, metrics, and written analysis

### 5.2 Tech Stack

**Backend:**
- Python 3.11+
- FastAPI for the API layer
- PostgreSQL (via Supabase free tier or Railway) for persistence
- Playwright for scraping, httpx for API calls
- APScheduler for job scheduling (simple) or Celery + Redis (if you want to show distributed work)
- Pandas and Polars for data processing
- SQLAlchemy + Alembic for schema management and migrations

**Frontend:**
- Next.js 15 with App Router
- Tailwind CSS for styling
- Recharts or Tremor for charts (Tremor looks more institutional/financial)
- TanStack Query for data fetching

**Deployment:**
- Vercel for the Next.js frontend (free tier sufficient)
- Railway or Render for the Python backend (free tier sufficient)
- Supabase or Railway Postgres for the database (free tier sufficient)

**Total infrastructure cost: $0.** Optional $10-15 for a custom domain if desired.

### 5.3 Database Schema (Key Tables)

**raw_observations** — every price point captured from every source, stored immutably with full metadata. Never modified after insert.

- id, source, collected_at, raw_payload (JSONB), gpu_model_reported, price_hourly, region_reported, commitment_type_reported, provider_metadata (JSONB)

**canonical_offers** — normalized version of raw observations with standardized fields.

- id, raw_observation_id (FK), collected_at, gpu_sku_canonical, gpu_variant (SXM/PCIe), vram_gb, region_canonical (country, region, city), provider, commitment_type (on_demand/spot/reserved_1m/etc.), vcpus_bundled, ram_gb_bundled, storage_gb_bundled, networking_type (if disclosed), verification_tier (if available), price_usd_per_hour, normalized_price_usd_per_hour

**daily_aggregates** — materialized daily snapshots for fast dashboard queries.

- date, gpu_sku, provider, region, observation_count, median_price, p25_price, p75_price, normalized_median_price

**basis_decomposition** — stored decomposition results for the dashboard.

- date, gpu_sku, total_variance, variance_from_region, variance_from_commitment, variance_from_bundle, variance_from_provider, residual_variance

### 5.4 Scope Constraints

To keep the project tight and shippable:

- **Focus on H100 primarily.** Add A100 or H200 only if H100 pipeline is solid.
- **5-6 providers maximum.** Vast.ai, RunPod, Lambda, TensorDock, AWS, and optionally GCP or CoreWeave.
- **No real-time updates on the frontend.** Daily refresh is sufficient and more honest to the data collection cadence.
- **No user accounts, no authentication.** This is a public research tool.
- **No derivatives simulation.** That was a Tier 2 feature and is explicitly out of scope for this narrower version.

---

## 6. Execution Phases

The project is broken into four phases, each with clear deliverables. No fixed timeline, but the overall effort is scoped for roughly 2-3 weeks of focused work.

### Phase 1 — Data Foundation

**Goal:** Reliable data flowing from at least 3 sources into a clean database.

**Deliverables:**
- PostgreSQL database set up with raw_observations and canonical_offers schemas
- Collectors built for Vast.ai, RunPod, and AWS Spot (the three easiest/richest sources)
- Basic normalization logic mapping raw fields to canonical schema
- Scheduled jobs running automatically (APScheduler or cron)
- First 2-3 days of data accumulating cleanly

**This phase should start as early as possible** because the longer data collects, the more interesting the eventual analysis becomes.

### Phase 2 — Analytics Engine

**Goal:** The normalization and basis decomposition logic that produces the project's core insights.

**Deliverables:**
- Rule-based normalization logic for region, commitment, bundle adjustments
- Daily aggregation jobs computing median, percentile, and dispersion metrics
- Basis decomposition logic attributing variance to observable factors
- FastAPI endpoints exposing the metrics for the frontend
- Unit tests for the normalization logic (this is where bugs can invalidate the whole study)
- Additional collectors added for Lambda and TensorDock

### Phase 3 — Frontend & Visualization

**Goal:** A dashboard that tells the story clearly.

**Deliverables:**
- Next.js app with clean financial-dashboard styling (think Tremor, Bloomberg-inspired)
- Hero view: H100 dispersion over time with a prominent "unexplained variance" callout
- Basis decomposition view: for a given date, what percentage of variance comes from each factor
- Provider comparison view: each provider's average deviation from the normalized market median
- Regional view: map or chart showing regional basis
- Clean, minimal design — restraint matters more than flair
- Deployment to Vercel with a production URL

### Phase 4 — Analytical Writeup & Polish

**Goal:** The written analysis that turns the tool into a study.

**Deliverables:**
- An 800-1500 word analytical piece presenting findings from the collected data
- Methodology page explaining data sources, normalization approach, and limitations
- A thorough README framing the project in market-infrastructure language (not "I scraped GPU prices")
- Acknowledgment of data limitations (quoted prices, not transactions)
- Credits and references to Ornn's public materials, the electricity market analogy, and relevant research
- Final polish on the dashboard UX
- Share-ready summary for posts, emails, or resume mentions

---

## 7. Positioning & Framing

### 7.1 The README Must Do Three Things

1. **Frame the problem in market-infrastructure language** — not "I scraped GPU prices" but "a public-data study of GPU compute fungibility, motivated by the question of what belongs inside a compute price index versus what should remain external basis risk."
2. **Be intellectually honest about limitations** — public data is quote-based, not transaction-based; this is a research study, not a commercial benchmark; results are descriptive, not predictive.
3. **Lead with the thesis and the finding** — the top of the README should state what the project discovered, not what it does.

### 7.2 How to Describe It on a Resume

"**Basis** — a public-data study quantifying GPU compute fungibility across 6 cloud providers. Designed ingestion pipeline, canonical schema, and basis decomposition methodology; published analytical findings on the portion of H100 price variance unexplained by observable factors."

### 7.3 How to Reference It in Conversation with Kush

"I spent three weeks trying to quantify GPU fungibility from public data. The thing that surprised me most was \[specific finding from the analysis\]. It made me realize the index methodology question isn't just technical — it's actually a market-design decision about what you want traders to hedge. How does Ornn's team think about which variables to absorb into OCPI versus which to externalize as basis risk?"

This is a founder-level question. It comes from having done the work, not from reading articles.

---

## 8. Risks & Pitfalls

### 8.1 Scope Creep

The biggest risk. Every LLM that contributed to the brainstorming phase proposed more ambitious versions of this project — trading simulators, hedging tools, forward curve estimators, performance benchmarking. All were rejected in favor of keeping this narrow. The discipline is: **the analytical insight is the product, not the engineering surface area.**

### 8.2 Starting Data Collection Too Late

The project's credibility depends on having real data collected over a meaningful window. If the collectors don't start running until week 3, the writeup has nothing substantive to report on. Collectors should start running on day 1 even if nothing else is built yet.

### 8.3 Over-Normalization

The instinct is to normalize away every factor. But if you normalize too aggressively, the residual variance shrinks artificially and the project's main finding loses impact. The methodology should be conservative — only adjust for clearly observable, documented factors. The size of the residual variance is the interesting finding.

### 8.4 Under-Documentation

A beautiful dashboard with no methodology writeup looks like a toy. The written analysis is what transforms it into a study. Budget real time for writing.

### 8.5 Presenting It As an OCPI Clone

Never claim Basis is similar to Ornn's OCPI. It's explicitly a public-data shadow study. Positioning it as a competitor or clone would be both technically wrong (quotes vs. transactions) and strategically bad (it's easier to dismiss). The name "Basis" is deliberately chosen to signal what the project measures, not what it claims to be.

### 8.6 Losing the Thesis

The project should always be answerable in one sentence: "I quantified GPU fungibility from public data and found that X% of price variance is unexplained by observable factors, which has implications for how compute benchmarks should be designed." If you can't say that cleanly at any point, the project has drifted.

---

## 9. Success Criteria

The project succeeds if:

1. It is deployed and publicly accessible at a live URL.
2. It has collected at least 2 weeks of real data from 4+ providers by the time it's shared.
3. The written analysis presents a clear, defensible finding about H100 fungibility from that data.
4. The README frames it in market-infrastructure language and is intellectually honest about limitations.
5. In conversation, it produces substantive technical discussion about benchmark methodology, basis risk, or fungibility — not generic questions about GPU pricing.

The project does NOT need to:

- Be a production-grade system
- Have users or traction
- Cover every provider or every GPU type
- Predict future prices
- Look beautiful beyond clean, minimal styling

---

## 10. Naming Rationale

The project is named **Basis** after the commodity derivatives concept. When a hedger uses Brent crude futures to hedge a refinery in Houston, they're still exposed to "basis" — the gap between Brent's price movement and their local market's price movement. Basis is what makes hedging imperfect. It's the technical concept that separates a clean theoretical benchmark from the messy reality any specific buyer faces.

For GPU compute, basis is enormous. An H100 on one provider is not the same economic product as an H100 on another — different interconnects, different reliability, different bundled resources, different verification. The central methodology question for any compute benchmark is which variables to absorb into the index (making it stable but disconnected from individual experience) versus which to externalize as basis risk (keeping the index faithful but noisier).

The project is named after this question because the project *is* this question, studied empirically from public data.

If asked "why Basis?" in conversation, the short answer is: "Basis is the finance term for the gap between a benchmark and what you actually pay. The project measures that gap for GPUs — so the name is just what it does."

---

## 11. Key References

For anyone (or any future LLM chat) picking up this project, the following references provide essential context:

**Ornn's public materials:**
- ornn.com (product pages)
- ornnai.com/research (their research blog)
- Ornn's Bloomberg Terminal announcement (April 2, 2026)
- PRNewswire: "Ornn Raises $5.7 Million Seed Round" (October 28, 2025)
- PRNewswire: "Architect Partners with Ornn" (January 21, 2026)

**Essential third-party writing:**
- Dave Friedman, "Compute is the Commodity No One Knows How to Price" (Substack, February 4, 2026) — best independent analysis of the electricity market analogy
- Dave Friedman, "How to Control Your AI Compute Budget" (Substack, December 17, 2025) — collaboration with Ornn explaining compute swaps mechanically
- Moyed, "Ornn, How Do We Price Compute?" (Paragraph.com, February 2, 2026) — best independent deep-dive on Ornn's product stack and competitors
- FoundersPress profile of Kush Bavaria (November 11, 2025) — team background and founding story

**Key competitors to understand:**
- Silicon Data (backed by DRW and Jump Trading) — aggregates quoted prices rather than transactions; founded by Carmen Li, ex-Bloomberg
- OneChronos + Auctionomics (Paul Milgrom) — building auction-based GPU marketplace
- GPU spot marketplaces (SF Compute, Vast.ai, RunPod, Compute Exchange) — procurement platforms, not financial infrastructure

**Historical parallel:**
- The 1992 Energy Policy Act and the subsequent maturation of electricity derivatives markets (NYMEX electricity futures launched 1996, full derivatives ecosystem by mid-2000s). This is Ornn's central analogy — compute markets are roughly in the 1990s electricity phase of development.

---

## 12. Notes for Future Context

If this document is shared with a fresh LLM chat to continue work on Basis, the LLM should understand:

1. The project is called **Basis**. Use this name consistently.
2. The user (Raj) is building this as a portfolio project, not a commercial venture. The goal is demonstrating domain expertise, not shipping a startup.
3. The user has explicitly declined to spend money on GPU rentals for benchmarking. All data must be free and public.
4. The project's positioning is "research study" not "SaaS tool." The analytical writeup is at least as important as the code.
5. The narrow focus on H100 fungibility with a specific decomposition methodology was chosen deliberately over broader alternatives (trading simulators, forward curve estimators, portfolio hedging tools) that were considered and rejected.
6. Intellectual honesty about limitations — especially the quote-vs-transaction distinction — is a feature, not a bug. It mirrors the real market problem Ornn is solving.
7. The name "Basis" was chosen deliberately after considering alternatives like ComputeBasis, Residuals, Brent, and others. It should not be changed without good reason.

---

*End of document.*
