# Dealblocker Dashboard — Design Spec

**Date:** 2026-04-28
**Owner:** Naman Chaturvedi
**Audience:** Naman + Director (BrowserStack TM)

## 1. Goal

A web dashboard that pulls all open and closed dealblocker (DB) tickets from the Test Management (TM) Jira project, groups them by customer/account, and surfaces stats relevant to triage and reporting:

- List of dealblockers per customer with status, ETA, and ARR.
- Customer leaderboard ordered by ticket count (desc), with ARR as secondary.
- Closure-time analytics: time from ticket creation to status entering Jira's `done` category.
- ETA hygiene: tickets past Promised ETA, tickets missing ETA.

## 2. Source data

### 2.1 JQL

```
reporter = 5efb524c3404690bae83acd1
AND project = "TM"
ORDER BY status ASC, created DESC
```

The reporter `5efb524c3404690bae83acd1` is the **SFDC Integration** account, which auto-creates dealblocker tickets from Salesforce. Every ticket from this reporter is by definition a dealblocker — no further filter is needed.

### 2.2 Fields used

**Standard fields:**
- `key`, `summary`, `status`, `statusCategory` (`new` | `indeterminate` | `done`), `assignee`, `created`, `updated`, `description`.

**Custom fields (confirmed by sample XML):**
- `customfield_10110` — **Promised ETA** (date) — primary ETA.
- `customfield_17291` — **Customer Expected ETA** (text, e.g., "Current Quarter") — secondary signal.
- `customfield_10693` — **Baseline ARR** (number).
- `customfield_10694` — **Incremental ACV** (number).
- `customfield_10746` — **CE Name** (text).
- `customfield_11081` — **Deal Blocker Category** (e.g., "Adhoc Feature Request").
- `customfield_10493` — **Deal Blocker Product Name** (e.g., "Test Management").
- `customfield_10747` — **dealblocker creation date** (datetime).
- `customfield_10204` — **Sales Blocker Link** (URL to Salesforce).
- `customfield_10147` — **Customer Stage** (e.g., "Renewals").

Custom field IDs are pinned in a single config module (`lib/jira/fields.ts`) so they're easy to update if Atlassian renumbers.

### 2.3 Customer name extraction

The customer is **not** in a single dedicated field. Two strong structured signals exist:

1. **Title prefix** — most tickets follow `[DB][CUSTOMER]<rest>` (e.g., `[DB][HBF]Restrict Public Link…`).
2. **Description "Opportunity Info" block** — typically:
   ```
   Opportunity Info
   Name: HBF - TM - Ent. 10 U
   Link: https://browserstack.my.salesforce.com/lightning/r/Opportunity/<id>/view
   ```

Strategy (cascading, cheapest first):
1. **Regex** on title: `^\[DB\]\[([^\]]+)\]`.
2. **Regex** on description "Opportunity Info > Name:" line. Take the segment before the first ` - `.
3. **LLM fallback** — only when both regexes fail. Uses Gemini cascade (see §4.3).

Extractions are cached by `hash(title + description)` so unchanged tickets never re-trigger extraction.

A **manual override** path is supported: a small admin page lets Naman correct a customer name; the override wins over regex and LLM.

### 2.4 Closure time

Jira does not directly expose "when did this enter Done?" in the issue payload. The fix:

- Fetch the issue with `expand=changelog`.
- Walk the changelog for `field == "status"` transitions.
- Record each `(from, to, author, created)` into `status_history`.
- "Done time" = first `created` where the new status's category is `done`.

If a ticket never re-opened, `done_at - created` is the closure time. If it bounced (done → reopened → done), we use the **latest** entry into `done` (configurable, but latest is the default — a re-opened ticket isn't really "closed" until it stays closed).

## 3. Architecture

### 3.1 Stack

- **Framework:** Next.js 15 (App Router), TypeScript.
- **UI:** Tailwind + shadcn/ui + Recharts.
- **DB:** Vercel Postgres (managed; powered by Neon).
- **Hosting:** Vercel Hobby plan.
- **Cron:** Vercel Cron (`vercel.json`).
- **Access control:** Vercel Password Protection (single shared password).
- **LLM:** Gemini API via `@google/genai`. Cascade defined in §4.3.
- **Jira:** REST API v3, basic auth with email + API token.

### 3.2 High-level flow

```
[Vercel Cron */30 min]   manual "Refresh now" button
        │                          │
        └──────────┬───────────────┘
                   ▼
            POST /api/refresh
                   │
                   ▼
   ┌───────────────────────────────────┐
   │ Refresh pipeline (lib/refresh.ts) │
   │  1. Fetch Jira issues via JQL     │
   │     with expand=changelog         │
   │  2. For each issue:               │
   │     a. Upsert tickets row         │
   │     b. Diff changelog → upsert    │
   │        status_history             │
   │     c. Resolve customer:          │
   │        override > cache > regex   │
   │        > LLM (cascade)            │
   │     d. Update extraction_cache    │
   │  3. Insert refresh_runs row       │
   └───────────────────────────────────┘
                   │
                   ▼
   [Postgres: tickets, status_history,
    extraction_cache, customer_overrides,
    refresh_runs]
                   │
                   ▼
   Next.js server components read from DB
                   │
                   ▼
   Browser (Naman, Director)
```

### 3.3 Module boundaries

- `lib/jira/` — Jira client. One purpose: paginate JQL, normalize response, extract changelog. No business logic. Returns typed objects.
- `lib/jira/fields.ts` — single source of truth for custom field IDs.
- `lib/llm/` — Gemini client with cascade. One purpose: given (title, description), return a customer string. No Jira knowledge.
- `lib/extract/` — customer extraction orchestrator. Order: override → cache → regex → LLM. No HTTP code.
- `lib/db/` — DB schema, query helpers, migrations. Drizzle ORM.
- `lib/refresh.ts` — orchestrates one refresh run. Calls `lib/jira` + `lib/extract` + `lib/db`. No HTTP code.
- `app/api/refresh/route.ts` — thin HTTP handler. Auth-checks the cron secret, calls `lib/refresh`, returns counts.
- `app/(dashboard)/` — pages. Server components query the DB; client components only for interactivity (filters, expand/collapse).

Each module is testable in isolation. Adding a new data source or extraction strategy doesn't touch the UI; UI changes don't touch Jira code.

## 4. Data model (Postgres + Drizzle)

### 4.1 Tables

**`tickets`** — one row per Jira issue.
```
key                TEXT PRIMARY KEY              -- e.g., TM-21858
summary            TEXT NOT NULL
status             TEXT NOT NULL                  -- e.g., "New Item"
status_category    TEXT NOT NULL                  -- new | indeterminate | done
assignee           TEXT
created            TIMESTAMPTZ NOT NULL           -- Jira created
updated            TIMESTAMPTZ NOT NULL           -- Jira updated
done_at            TIMESTAMPTZ                    -- derived from changelog; NULL if not done
promised_eta       DATE                           -- customfield_10110
customer_expected_eta TEXT                        -- customfield_17291
baseline_arr       NUMERIC                        -- customfield_10693
incremental_acv    NUMERIC                        -- customfield_10694
ce_name            TEXT                           -- customfield_10746
db_category        TEXT                           -- customfield_11081
db_product         TEXT                           -- customfield_10493
sfdc_link          TEXT                           -- customfield_10204
customer_stage     TEXT                           -- customfield_10147
description_raw    TEXT                           -- raw HTML/wiki, used for extraction
customer           TEXT                           -- resolved customer name
customer_source    TEXT                           -- override | regex_title | regex_desc | llm | unknown
last_refreshed_at  TIMESTAMPTZ NOT NULL
```

**`status_history`** — one row per status transition.
```
id              BIGSERIAL PRIMARY KEY
issue_key       TEXT NOT NULL REFERENCES tickets(key) ON DELETE CASCADE
from_status     TEXT
to_status       TEXT NOT NULL
to_category     TEXT NOT NULL
changed_at      TIMESTAMPTZ NOT NULL
author          TEXT
UNIQUE (issue_key, changed_at, to_status)
INDEX (issue_key, changed_at)
```

**`extraction_cache`** — keyed by content hash.
```
issue_key      TEXT PRIMARY KEY
content_hash   TEXT NOT NULL                      -- sha256(title + description_raw)
customer       TEXT NOT NULL
source         TEXT NOT NULL                      -- regex_title | regex_desc | llm
model_used     TEXT                                -- when source = llm
extracted_at   TIMESTAMPTZ NOT NULL
```

**`customer_overrides`** — manual corrections.
```
issue_key   TEXT PRIMARY KEY
customer    TEXT NOT NULL
note        TEXT
created_at  TIMESTAMPTZ NOT NULL
```

**`refresh_runs`** — observability.
```
id             BIGSERIAL PRIMARY KEY
started_at     TIMESTAMPTZ NOT NULL
finished_at    TIMESTAMPTZ
ticket_count   INT
new_or_changed INT
llm_calls      INT
errors         INT
error_summary  TEXT
trigger        TEXT NOT NULL                      -- cron | manual
```

### 4.2 Sizing

Expected scale: ~100s of tickets total, ~50 status transitions per ticket worst case → <50K rows total, <5 MB. Comfortably within Vercel Postgres free tier (256 MB).

## 5. Refresh pipeline

### 5.1 Trigger

- **Cron**: `*/30 * * * *` defined in `vercel.json`. Calls `POST /api/refresh` with header `Authorization: Bearer ${CRON_SECRET}`.
- **Manual**: button on Overview hits `POST /api/refresh` with the user's session (password-protected).

### 5.2 Steps

Dealblocker volume is small (<500 lifetime tickets), so we **full-fetch every run** rather than tracking a high-water mark. Simpler, no clock-skew or missed-update bugs.

1. Page through Jira `/rest/api/3/search/jql` with the spec's JQL and `expand=changelog`.
2. For each issue:
    - Upsert into `tickets`.
    - Diff `status_history`: insert any transitions not already present (dedup by `(issue_key, changed_at, to_status)`).
    - Recompute `done_at`: latest `changed_at` where `to_category = 'done'`, else NULL.
    - Resolve customer via cascade (§5.3), respecting the per-run LLM budget (§5.5).
3. After loop: insert `refresh_runs` row with counts.

### 5.3 Customer resolution cascade

Order, short-circuit on first hit:

1. `customer_overrides` row exists → use that, source = `override`.
2. `extraction_cache` row matches current `content_hash` → use cached, preserve original source.
3. Regex on title (`^\[DB\]\[([^\]]+)\]`) succeeds → cache, source = `regex_title`.
4. Regex on description "Opportunity Info > Name:" succeeds → cache, source = `regex_desc`.
5. LLM call (Gemini cascade) → cache, source = `llm`, store `model_used`.
6. All fail → customer = `"Unknown"`, source = `unknown`. Surface these in a "needs review" UI.

### 5.4 Per-run LLM budget

Vercel Hobby caps serverless function duration at 60s. Steady-state cron runs do <10 LLM calls (only new/changed tickets without regex hits), well within budget. To stay safe in pathological cases (e.g., cache wipe, regex breaks):

- Each refresh run has a hard cap: **max 10 LLM calls per run** (≈ 30–50s, leaving headroom under the 60s timeout for Jira fetch + DB writes).
- Tickets that exceed the budget keep `customer = "Unknown"`, source = `unknown` for this run; the next cron run picks them up. Convergence within a few cycles.
- The refresh route declares `export const maxDuration = 60` (Hobby cap). For backlogs larger than a single run can drain, the cron simply works through them over consecutive cycles — no special handling needed.

### 5.5 Error handling

- Jira 4xx → fail the run, record in `refresh_runs.error_summary`, no partial commit. Surface in UI.
- Jira 5xx / network → exponential backoff (3 tries), then fail.
- Per-ticket extraction failures (LLM all-tiers exhausted) → mark customer = `"Unknown"`, source = `unknown`, **continue** the run. Don't kill the whole refresh for one bad ticket.
- Postgres errors → fail loudly, surface in UI.

## 6. LLM cascade

Single client at `lib/llm/gemini.ts`. Tries each model on 429/5xx/timeout:

| Order | Model | RPD | Use |
|---|---|---|---|
| 1 | `gemini-3.1-flash-lite` | 500 | Primary — workhorse |
| 2 | `gemini-3-flash` | 20 | Stronger fallback for hard cases |
| 3 | `gemini-2.5-flash-lite` | 20 | Older lite fallback |
| 4 | `gemma-3-27b-it` | 14.4K | High-availability floor |

Prompt: tightly scoped — return only the customer/account name as JSON. Schema validation enforced. On parse failure, advance to the next model.

Token budget per call: ~1.5K input + 50 output. Each call ~3–5s including network. The per-run budget (§5.4) caps this at 10 calls/run, comfortably under the 60s function timeout once Jira fetch and DB writes are accounted for. Pathological backlogs (e.g., cache wipe across all tickets) converge across multiple cron cycles.

## 7. UI

### 7.1 Pages

- **`/` Overview**
  - KPI cards: total open DBs, total ARR at risk (sum `baseline_arr` for non-`done`), % past Promised ETA, median closure time (last 90d done tickets).
  - Top customers chart: bar chart, ticket count desc, top 15.
  - "Refresh now" button (calls `/api/refresh`, shows last-run timestamp).
  - Last refresh status (success/error, count, time).

- **`/customers` By customer**
  - List of customers, ticket count desc, secondary sort by total ARR.
  - Each row expandable to show that customer's tickets: key, summary, status, Promised ETA, days open, ARR, link to Jira.

- **`/closures` Closure metrics**
  - Table of done tickets with `created`, `done_at`, duration, customer.
  - Histogram of closure days.
  - Stats: median, p90, mean.
  - Filter: last 30 / 90 / 365 days.

- **`/ticket/[key]` Drilldown**
  - Full metadata + status timeline (rendered from `status_history`).
  - Override customer name button.

- **`/admin/needs-review`** (linked from Overview if non-empty)
  - Tickets with `customer_source = unknown`. Inline form to set an override.

### 7.2 Global filters

Status, statusCategory, DB Category, Product, has-ETA, past-ETA. Persisted in URL query string for shareability.

### 7.3 Display rules

- Dates in IST (`Asia/Kolkata`), format `dd MMM yyyy`.
- ARR/ACV: `$X,XXX` no decimals.
- "Days open" = today − created (UTC date).
- Past Promised ETA: red badge if `promised_eta < today` and `status_category != done`.

## 8. Configuration & secrets

Env vars (all set in Vercel):
- `JIRA_BASE_URL` — `https://browserstack.atlassian.net`
- `JIRA_EMAIL` — Naman's email
- `JIRA_API_TOKEN` — Atlassian API token
- `JIRA_REPORTER_ACCOUNT_ID` — `5efb524c3404690bae83acd1` (SFDC bot)
- `JIRA_PROJECT_KEY` — `TM`
- `GEMINI_API_KEY`
- `CRON_SECRET` — random string; cron requests must include this in `Authorization`
- `POSTGRES_URL` — auto-injected by Vercel
- `TIMEZONE` — `Asia/Kolkata`

Local dev uses `.env.local` (gitignored).

## 9. Testing

- **Unit:** regex extractors with the sample XML payload + 5 hand-curated fakes covering edge cases (no `[DB]` prefix, malformed Opportunity block, multi-customer titles).
- **Unit:** Gemini cascade behavior (mock fetch, 429 → falls through, parse fail → falls through).
- **Unit:** changelog → `done_at` derivation, including reopen scenarios.
- **Integration:** the full refresh pipeline against a fixture Jira response (recorded JSON).
- **No E2E browser tests** at v1. Manual smoke after deploy.

## 10. Out of scope (v1)

- Auth beyond Vercel password protection (no SSO, no per-user accounts).
- Editing tickets back to Jira (read-only).
- Slack/email alerts on past-ETA.
- Historical trend charts (open count over time).
- Multi-project support (TM only).

These are easy follow-ups but explicitly punted to keep v1 shippable.

## 11. Repo layout

```
db-analyzer/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                # /
│   │   ├── customers/page.tsx
│   │   ├── closures/page.tsx
│   │   ├── ticket/[key]/page.tsx
│   │   └── admin/needs-review/page.tsx
│   ├── api/
│   │   └── refresh/route.ts
│   └── layout.tsx
├── lib/
│   ├── jira/
│   │   ├── client.ts
│   │   ├── fields.ts
│   │   └── changelog.ts
│   ├── llm/
│   │   └── gemini.ts
│   ├── extract/
│   │   ├── regex.ts
│   │   └── orchestrator.ts
│   ├── db/
│   │   ├── schema.ts               # Drizzle
│   │   ├── client.ts
│   │   └── migrations/
│   └── refresh.ts
├── components/                     # shadcn/ui + custom
├── docs/superpowers/specs/
├── tests/
│   └── fixtures/
│       └── tm-21858.xml
├── drizzle.config.ts
├── vercel.json                     # cron config
├── package.json
└── tsconfig.json
```

## 12. Decision log

- **Framework: Next.js / Vercel**, not Python+FastAPI. Vercel Cron + Postgres + password protection is more turnkey for a dashboard with two users.
- **DB: Vercel Postgres**, not KV or Turso. Structured queries on changelog and durations benefit from SQL.
- **Extraction: regex first, LLM as fallback**, not LLM-first. ~90% of tickets follow `[DB][CUSTOMER]` pattern; LLM cost is wasted otherwise.
- **Drizzle ORM**, not Prisma. Lighter, simpler migrations, fewer cold-start surprises on Vercel.
- **No queue / background jobs**. Refresh runs synchronously inside the cron handler. With <500 tickets and aggressive caching, it fits comfortably in Vercel's function timeout.
- **Vercel Password Protection**, not custom auth. Two known users, no need for individual accounts.
