# Claude Code Instructions

## What this file is for

Guidance for how Claude Code should work in the Basis repository. This complements `AGENTS.md` (which is the generic entry point for any AI coding agent) with Claude-specific workflow preferences.

## When to read/use this

- At the start of any Claude Code session on Basis.
- When unsure about workflow, where to look first, or where to put temporary files.
- Whenever Raj asks about doc maintenance, end-of-day routine, or "where should this go?"

## How Claude should work in this repo

- **Default to conservative changes.** Do not refactor surrounding code when making a fix. Do not add abstractions unless there are 3+ concrete call sites.
- **Ask before destructive operations.** Never drop tables, force-push, or delete canonical data without confirmation. Raw observations are immutable — treat them like append-only logs.
- **Use UTC for all timestamps, USD/GPU/hour for all prices.** Convert at normalization time, not at query time.
- **Read the planning doc before design decisions.** `Basis_Project_Proposal.md` is the source of truth for project scope. The Basis thesis (measuring unexplained residual variance) overrides engineering aesthetics.
- **Prefer explicit rules to ML.** Normalization should be lookup tables and clear conditionals — anything else undermines the project's interpretability claim.

## Preferred workflow

1. Read `docs/project-status.md` first — it tells you what phase we're in.
2. Check `docs/05-llm/DOC_MAP.md` for task-to-doc routing.
3. For code changes, read the matching context pack in `docs/05-llm/context-packs/`.
4. Make the change. Run the relevant script (e.g., `uv run python run_collect.py <source>`) to verify.
5. If the change affects documented behavior (new collector, schema change, new phase complete), flag it — do not silently update docs.

## Where to look first

- **Current phase & progress:** [docs/project-status.md](docs/project-status.md)
- **Quickstart:** [docs/00-start-here/quickstart.md](docs/00-start-here/quickstart.md)
- **Architecture:** [docs/01-architecture/system-overview.md](docs/01-architecture/system-overview.md)
- **Routing table for agents:** [docs/05-llm/DOC_MAP.md](docs/05-llm/DOC_MAP.md)
- **Doc index:** [docs/INDEX.md](docs/INDEX.md)

## Temporary Documentation

- For update reports, investigation notes, one-off analyses: create `temp-doc/` at repo root.
- Do **not** put these in `docs/`. Long-term docs stay clean; temp work goes in `temp-doc/` and can be cleaned up periodically.
- `temp-doc/` should be in `.gitignore` (or committed as a dated scratch folder — Raj's call).

## Documentation Maintenance

- **Do not silently update `docs/`.** At end of day or when Raj signals a stopping point, proactively ask: "Want me to update the documentation before we stop?"
- When approved, the main doc to update is `docs/project-status.md` (phase, data volumes, what's next). Other docs update when their domain genuinely changes — don't touch them for cosmetic reasons.
- When a new collector ships: update `docs/02-reference/data-sources.md` and `docs/project-status.md`.
- When a new phase begins: update `docs/project-status.md` and any affected guide.
- When schema changes: update `docs/02-reference/database.md`.

## Non-negotiables (inherited from AGENTS.md)

- Don't modify `raw_observations` after insert.
- Don't bypass `BaseCollector`.
- Don't add user accounts, auth, or multi-tenancy.
- Don't add ML-based normalization.
- Don't add top-level directories beyond `backend/`, `frontend/`, `docs/`, `specs/` (if created), `temp-doc/` (if created), plus root config files.
