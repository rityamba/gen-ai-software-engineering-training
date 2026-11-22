---
name: branch-review
description: Staff/principal-level code review of everything a branch changes compared to its base, producing a single structured report that another agent can execute as a fix list. Use whenever the user asks to review a branch, a PR, a diff, uncommitted changes, "check my changes before merge", "do a code review", "is this ready to ship", "audit what I did", or asks for an HTTP/REST API compliance review of changed endpoints. Also use when the user wants a report to hand off to a fixing agent. This skill is audit-only — it never edits code.
---

# Branch Review

Review the changes on a branch the way a senior engineer who will own this system for years would: trace what the code actually does, judge it against the project's own standards plus real engineering standards, and write up only the problems that matter.

The output is **one Markdown report file**. Its main consumer is another agent that will apply the fixes, so every finding has to be locatable, unambiguous and verifiable without the reviewer being in the room.

## Hard constraints

- **Audit only.** Do not edit, fix, refactor, format, stage, commit, push or rebase anything. The only file this skill creates is the report.
- **No invented locations.** Never cite a file or line you have not opened and read.
- **No unverifiable claims stated as fact.** If something could not be confirmed, label it `unverified` and say what would confirm it.

## Step 1 — Establish the scope

```bash
git rev-parse --abbrev-ref HEAD
git status --porcelain          # uncommitted + staged work counts as part of the review
git remote show origin | sed -n '/HEAD branch/p'   # usual base
git log --oneline --no-decorate "$BASE"..HEAD
git diff --stat "$(git merge-base "$BASE" HEAD)"...HEAD
git diff "$(git merge-base "$BASE" HEAD)"...HEAD
git diff            # unstaged
git diff --staged   # staged
```

Use the three-dot form against the merge base so that commits that landed on the base branch afterwards are not attributed to this branch.

If the base branch is ambiguous (no `origin/HEAD`, several long-lived branches like `main`, `develop`, `release/*`), ask once which base to diff against instead of guessing. If there is no git repository, ask what to review.

State the resolved scope at the top of the report: base, head, commit count, file count, and whether uncommitted work is included.

**Large diffs.** If the change set is too large to read properly, do not skim everything evenly. Order files by blast radius (auth, money, data migrations, public API, shared utilities, then the rest) and review in that order. Say explicitly in the report which files were reviewed in depth and which were not.

## Step 2 — Learn the project's standards before judging anything

Read, when present: `AGENTS.md` / `CLAUDE.md`, `README`, `CONTRIBUTING`, `docs/adr/*`, linter and formatter configs (`eslint`, `ruff`, `.editorconfig`, `tsconfig.json`, `.golangci.yml`, `phpstan.neon`, …), CI workflow files, and two or three existing modules similar to the changed ones.

This matters because the project's own conventions outrank personal taste. Code that follows an established house convention is not a finding, even if another convention would be nicer. Code that silently breaks a convention the repo demonstrably follows everywhere else *is* a finding — inconsistency is a real maintenance cost.

## Step 3 — Read the code, not just the diff

A diff hunk hides most real bugs, because the bug is usually in the interaction between the new lines and the code around them. For every meaningful change:

- Open the whole file, not only the changed hunk.
- Follow the call graph in both directions: who calls this, what does it call, what happens on the error path.
- Grep for every other use of a changed function, endpoint, type, column, config key or constant — a signature or semantics change that was only applied in one place is a classic branch defect.
- Check what *should* have changed alongside it and did not: migrations, seed data, API docs, OpenAPI/schema files, client code, feature flags, env var documentation, tests.
- Trace the things that break quietly: transaction boundaries, error propagation, authorization checks, retries, null/empty handling, concurrency, resource cleanup.

## Step 4 — Review passes

Run these passes over the changed surface. For each one, the question is "what breaks, leaks, or becomes unmaintainable in production", not "what deviates from an ideal".

1. **Correctness** — does it do what the commit messages and surrounding code claim? Off-by-one, wrong operator precedence, wrong branch of a condition, wrong default, timezone and locale handling, floating point for money, truncation, encoding.
2. **Edge cases and failure modes** — empty collections, null/undefined, missing optional fields, duplicate input, very large input, external call failing, external call timing out, external call returning a 200 with garbage, partial writes, rollback behaviour, cleanup on the error path.
3. **Error handling** — swallowed exceptions, `catch` blocks that log and continue in a state the caller cannot detect, errors converted to a success value, errors handled at the wrong layer, user-facing messages that leak stack traces, internal paths, SQL or secrets.
4. **Security** — authentication and authorization on every new entry point (including object-level: can user A act on user B's resource?), injection (SQL, command, template, path), SSRF on any outbound URL built from input, unsafe deserialization, secrets in code or logs, missing rate limits on expensive or auth-related endpoints, CSRF for cookie-authenticated state changes, CORS configuration, file upload handling. Frontend validation is never a control.
5. **Concurrency and reliability** — races on shared state, check-then-act without a lock or a conditional write, lost updates, non-idempotent handlers that will be retried, missing timeouts on network and DB calls, unbounded retries, retrying non-idempotent operations, deadlock-prone lock ordering.
6. **Data and performance** — N+1 queries, queries inside loops, missing index for a new query pattern, missing `LIMIT`/pagination on a growing table, loading an unbounded result set into memory, a migration that locks a large table, unbounded caches or queues. Only report a bottleneck you can point at — not speculative micro-optimization.
7. **HTTP and API contract** — if the diff touches HTTP handlers, routes, clients, middleware or API schemas, read `references/http-api-review.md` and work through it. That file also defines how to classify deviations so the report doesn't inflate style preferences into protocol violations.
8. **Tests** — do the new tests actually assert behaviour, or just that the code ran? Are the failure and authorization paths covered? Are the tests deterministic and isolated? Is anything so heavily mocked that it would pass even if the real integration were broken? Name specific missing scenarios, not "coverage is low".
9. **Architecture and maintainability** — responsibility boundaries, dependency direction (does domain logic now import infrastructure?), duplicated business rules, leaked implementation details across module boundaries, magic values, hidden coupling, anything that makes the next change in this area harder.
10. **Operability** — can an on-call engineer debug this at 3am? Logging at the right level with correlation context and no sensitive data, metrics for new failure modes, config and secrets handling, backwards compatibility during deploy (old code + new schema, and new code + old clients), rollback story.

## Step 5 — Verify rather than speculate

Prefer verification by reading the actual code paths. Where the project provides them and they are cheap and safe, running the existing type checker, linter or test suite is a legitimate way to confirm a finding — these are read-only with respect to the source.

Ask first before running anything that mutates data, touches a real database, calls an external service, installs dependencies, or costs money. Never run anything against production.

Anything left unconfirmed gets `Confidence: unverified` plus one line on exactly what would settle it ("needs a check of whether `orders.user_id` has a unique index").

## Step 6 — Calibrate: what makes the report good

This is the part that separates a useful review from noise. Standards and best practices apply **in proportion to the risk** — the goal is a system that works and stays maintainable, not a system that satisfies every rule.

Include a finding only if you can name a concrete consequence: a scenario where it produces a wrong result, a vulnerability, data loss, an outage, a silent failure, a contract break for a consumer, or materially more work for whoever changes this code next.

Drop a finding when:

- The justification is "the pattern says so" with no concrete payoff. No new layer, interface, abstraction or dependency injection just for purity — only where there is real duplication, a real seam needed for testing, or a real second implementation.
- It is a style preference with no linter rule, config or repo-wide convention behind it.
- It is a performance worry with no evidence of scale or hot path.
- It is already correctly handled somewhere else in the path (check before claiming it isn't).
- It is pre-existing code untouched by this branch — unless the branch makes it actively dangerous, in which case flag it as pre-existing and say so.
- It would be a rewrite. Recommend the smallest change that removes the risk. Propose redesign only with a concrete, substantial reason, and mark it `Needs decision`.

Deduplicate: one root cause is one finding listing all affected locations. If the same mistake repeats more than about five times, write one finding with the pattern plus the full location list.

Severity, used honestly and never inflated:

| Severity | Means |
|---|---|
| **Critical** | Exploitable vulnerability, data loss or corruption, or a failure that takes the system down. Merge is blocked. |
| **High** | Significant functional, security or reliability defect with a plausible real trigger; or an architectural decision that will be expensive to undo. |
| **Medium** | Real correctness, consistency or maintainability problem with limited blast radius. |
| **Low** | Minor improvement, narrow impact. |
| **Informational** | Observation, context, or a suggestion worth knowing but not acting on now. |

Before writing each finding, apply one self-check: *if the author pushes back, can I point at the code path that proves it?* If not, downgrade it, mark it unverified, or drop it.

## Step 7 — Write findings that a fixing agent can execute

The next reader is an agent with no memory of this analysis. Each finding must be self-contained:

- **Stable ID** — `BR-001`, `BR-002`, … referenced everywhere else in the report.
- **Location** — `path/to/file.ts:142-151`, plus a short **anchor snippet** of the actual current code. Line numbers shift once earlier fixes land; the anchor lets the agent re-find the spot.
- **One problem per finding.** If a function has three unrelated defects, that is three findings.
- **A concrete fix**, not a direction to think about. Say what the code should do, and include a small snippet when it removes ambiguity. Don't write the whole patch — the fixing agent writes the code — but leave no interpretation gaps.
- **Acceptance criteria** — the observable condition that proves the fix worked ("`DELETE /orders/{id}` on an already-deleted order returns 204 and does not emit a second `order.deleted` event"). This is what the fixing agent and its tests aim at.
- **Dependencies** — if one fix must land before another, say so by ID.
- **`Needs decision`** — use it for anything requiring a product, security or architectural call, or where two valid approaches have different trade-offs. The fixing agent must stop and ask rather than pick.

Never write "consider", "maybe", "it might be better to". Either it's a finding with a fix, or it's `Needs decision`, or it doesn't belong in the report.

## Step 8 — Produce the report

Use the structure in `references/report-template.md` exactly — the fixing agent relies on the section order and the field names.

Save it as `branch-review-<branch>-<YYYY-MM-DD>.md`. Put it in the repo's existing reviews/docs directory if one exists, otherwise the repo root (or `/mnt/user-data/outputs/` when that is how files reach the user). Ask where to put it if unclear. Do not create any other file.

Write the report in the language the user is using, keeping identifiers, status codes, headers and standard terminology in English.

If the user asks for machine-readable handoff, additionally emit `branch-review-<branch>-<date>.json` with one object per finding using the same IDs and fields.

## Step 9 — Hand off in chat

Finish with a short message, not a copy of the report: the counts per severity, the two or three things that actually block the merge, the path to the report file, and anything you could not verify or need a decision on. Offer to go deeper on any finding.
