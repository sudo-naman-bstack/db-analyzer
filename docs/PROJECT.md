# Dealblocker Dashboard — Project Reference

Comprehensive reference for the BrowserStack Test Management dealblocker dashboard. Use this document to onboard, resume work, or hand off to another AI/human collaborator.

---

## Table of Contents

1. [What This Is](#what-this-is)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Database Schema](#database-schema)
5. [Authentication](#authentication)
6. [Core Data Flow](#core-data-flow)
7. [Jira Integration](#jira-integration)
8. [Customer Extraction Pipeline](#customer-extraction-pipeline)
9. [LLM Integration (Gemini)](#llm-integration-gemini)
10. [API Routes](#api-routes)
11. [Dashboard Pages](#dashboard-pages)
12. [Components](#components)
13. [Key Queries & Risk Scoring](#key-queries--risk-scoring)
14. [ETA Change Tracking](#eta-change-tracking)
15. [Bulk Actions](#bulk-actions)
16. [Scripts](#scripts)
17. [Testing](#testing)
18. [Configuration & Environment Variables](#configuration--environment-variables)
19. [Deployment (Vercel)](#deployment-vercel)
20. [Git & Subtree Setup](#git--subtree-setup)
21. [Planned / Parked Features](#planned--parked-features)
22. [Gotchas & Lessons Learned](#gotchas--lessons-learned)

---

## What This Is

An internal dashboard that tracks "dealblocker" Jira tickets in BrowserStack's Test Management project. These are customer-facing issues that block contract renewals or expansion deals.

**Who uses it:** PMs and engineering leads on the TM team.

**What it does:**
- Syncs dealblocker tickets from Jira daily (and on-demand)
- Extracts customer names automatically (regex + LLM fallback)
- Scores tickets by risk (ARR weight + age + ETA + staleness)
- Tracks ETA volatility — how often and how much Promised ETAs change
- Enables bulk Jira actions (e.g., requesting updates on stale tickets)
- Generates AI-powered ticket status summaries

**Live URL:** https://db-analyzer-seven.vercel.app

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.4 |
| Runtime | React (RSC + Client) | 19.2.4 |
| Language | TypeScript | 5.x |
| ORM | Drizzle ORM | 0.45.2 |
| Database | PostgreSQL (Neon, via Vercel Postgres) | — |
| Auth | Auth.js (NextAuth v5 beta) | 5.0.0-beta.31 |
| LLM | Google Gemini (@google/genai) | 1.50.1 |
| Charts | Recharts | 3.8.1 |
| Icons | Lucide React | 1.11.0 |
| Styling | Tailwind CSS v4 | 4.x |
| UI Kit | shadcn/ui | 4.5.0 |
| Testing | Vitest + MSW | 4.1.5 / 2.13.6 |
| Hosting | Vercel (Hobby plan) | — |

---

## Directory Structure

```
db-analyzer/
├── app/
│   ├── layout.tsx                          # Root layout, top nav bar
│   ├── globals.css                         # Tailwind imports
│   ├── login/page.tsx                      # Google OAuth login
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts     # Auth.js route handlers
│   │   ├── refresh/route.ts                # Jira sync endpoint (cron + manual)
│   │   ├── override/route.ts               # Set customer override
│   │   ├── jira/comment/route.ts           # Bulk comment posting
│   │   └── ticket/[key]/summary/route.ts   # AI ticket summary
│   └── (dashboard)/
│       ├── page.tsx                        # Overview (KPIs, triage, risk, aging)
│       ├── customers/page.tsx              # Customer leaderboard
│       ├── customers/[customer]/page.tsx   # Per-customer detail
│       ├── tickets/page.tsx                # Filtered ticket list + bulk actions
│       ├── closures/page.tsx               # Closure metrics & histogram
│       ├── risk/page.tsx                   # Top risk tickets
│       ├── eta-tracking/page.tsx           # ETA change analysis
│       └── admin/needs-review/page.tsx     # Unknown customer review
├── lib/
│   ├── db/
│   │   ├── schema.ts                       # Drizzle table definitions (6 tables)
│   │   ├── client.ts                       # Pooled Postgres connection
│   │   ├── queries.ts                      # All SELECT queries
│   │   └── upserts.ts                      # All INSERT/UPDATE operations
│   ├── jira/
│   │   ├── client.ts                       # Jira REST API (search, fetch, comment)
│   │   ├── parse.ts                        # Raw Jira → typed ParsedIssue
│   │   ├── changelog.ts                    # Extract status + ETA changes
│   │   ├── category.ts                     # Status → category mapping
│   │   └── fields.ts                       # Jira custom field ID registry
│   ├── extract/
│   │   ├── orchestrator.ts                 # Customer resolution pipeline
│   │   └── regex.ts                        # Pattern-based customer extraction
│   ├── llm/
│   │   └── gemini.ts                       # Gemini API with model cascade
│   ├── refresh.ts                          # Main refresh orchestration
│   ├── status.ts                           # Derive doneAt from transitions
│   ├── format.ts                           # fmtDate, fmtCurrency, daysBetween
│   └── utils.ts                            # cn() class merge utility
├── components/
│   ├── ui/                                 # shadcn primitives
│   ├── bulk-action-table.tsx               # Selectable table + comment posting
│   ├── kpi-card.tsx                        # Metric cards
│   ├── status-badge.tsx                    # Jira status display
│   ├── eta-badge.tsx                       # ETA indicator
│   ├── refresh-button.tsx                  # Manual refresh trigger
│   ├── aging-breakdown.tsx                 # Age distribution bars
│   ├── closure-histogram.tsx               # Recharts histogram
│   ├── show-latest-status.tsx              # AI summary fetcher
│   ├── override-form.tsx                   # Customer override dialog
│   └── [other components...]
├── scripts/
│   ├── backfill-customers.ts               # Backfill unknown customers via LLM
│   └── list-gemini-models.ts               # List available Gemini models
├── tests/                                  # Vitest test suite
├── drizzle/                                # Migration files & snapshots
├── auth.ts                                 # NextAuth config (Google, @browserstack.com)
├── proxy.ts                                # Auth middleware
├── drizzle.config.ts                       # Drizzle ORM config
├── next.config.ts                          # Next.js config
├── vercel.json                             # Vercel cron schedule
├── package.json                            # Dependencies & scripts
└── tsconfig.json                           # TypeScript config
```

---

## Database Schema

Six PostgreSQL tables managed by Drizzle ORM. Schema defined in `lib/db/schema.ts`.

### `tickets` (primary table)

| Column | Type | Notes |
|--------|------|-------|
| `key` | TEXT PK | Jira issue key, e.g. `TM-4521` |
| `summary` | TEXT | Issue title |
| `status` | TEXT | Current Jira status string |
| `status_category` | TEXT | Category: `new`, `indeterminate`, `done` |
| `assignee` | TEXT | Display name |
| `created` | TIMESTAMPTZ | Jira creation time |
| `updated` | TIMESTAMPTZ | Last Jira update |
| `done_at` | TIMESTAMPTZ | Derived from status changelog (last transition to done) |
| `promised_eta` | DATE | Custom field `customfield_10110` |
| `customer_expected_eta` | TEXT | Custom field `customfield_17291` |
| `baseline_arr` | NUMERIC | ARR at risk |
| `incremental_acv` | NUMERIC | Incremental ACV at risk |
| `ce_name` | TEXT | Customer Engineer name |
| `db_category` | TEXT | Dealblocker category |
| `db_product` | TEXT | Affected product |
| `sfdc_link` | TEXT | Salesforce link |
| `customer_stage` | TEXT | Customer lifecycle stage |
| `description_raw` | TEXT | Full description in ADF JSON |
| `customer` | TEXT | Extracted customer name |
| `customer_source` | TEXT | One of: `override`, `regex_title`, `regex_desc`, `llm`, `unknown` |
| `last_refreshed_at` | TIMESTAMPTZ | When this row was last synced |

### `status_history`

Tracks every status transition from Jira changelogs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGSERIAL PK | |
| `issue_key` | TEXT FK→tickets | CASCADE delete |
| `from_status` | TEXT | Previous status (null for initial) |
| `to_status` | TEXT | New status |
| `to_category` | TEXT | Category of new status |
| `changed_at` | TIMESTAMPTZ | When the transition happened |
| `author` | TEXT | Who made the change |

Unique index: `(issue_key, changed_at, to_status)`

### `eta_changes`

Tracks Promised ETA modifications from Jira changelogs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGSERIAL PK | |
| `issue_key` | TEXT FK→tickets | CASCADE delete |
| `changed_at` | TIMESTAMPTZ | When the ETA was changed |
| `from_eta` | DATE | Previous ETA value |
| `to_eta` | DATE | New ETA value |
| `author` | TEXT | Who changed it |

Unique index: `(issue_key, changed_at)`

### `extraction_cache`

Caches LLM customer extraction results to avoid redundant API calls.

| Column | Type | Notes |
|--------|------|-------|
| `issue_key` | TEXT PK | |
| `content_hash` | TEXT | SHA hash of title + description |
| `customer` | TEXT | Extracted name |
| `source` | TEXT | Extraction method used |
| `model_used` | TEXT | Gemini model ID (if LLM) |
| `extracted_at` | TIMESTAMPTZ | |

### `customer_overrides`

Manual customer assignments set by PMs.

| Column | Type | Notes |
|--------|------|-------|
| `issue_key` | TEXT PK | |
| `customer` | TEXT | Manually set customer |
| `note` | TEXT | Reason for override |
| `created_at` | TIMESTAMPTZ | |

### `refresh_runs`

Audit trail for every sync run.

| Column | Type | Notes |
|--------|------|-------|
| `id` | BIGSERIAL PK | |
| `started_at` | TIMESTAMPTZ | |
| `finished_at` | TIMESTAMPTZ | |
| `ticket_count` | INTEGER | Total tickets processed |
| `new_or_changed` | INTEGER | Tickets with changes |
| `llm_calls` | INTEGER | Gemini API calls made |
| `errors` | INTEGER | Error count |
| `error_summary` | TEXT | Error details |
| `trigger` | TEXT | `cron` or `manual` |

### SQL to create `eta_changes` table manually

If this table doesn't exist in production, run in Neon console:

```sql
CREATE TABLE IF NOT EXISTS eta_changes (
  id BIGSERIAL PRIMARY KEY,
  issue_key TEXT NOT NULL REFERENCES tickets(key) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL,
  from_eta DATE,
  to_eta DATE,
  author TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS eta_changes_uniq ON eta_changes (issue_key, changed_at);
CREATE INDEX IF NOT EXISTS eta_changes_issue_idx ON eta_changes (issue_key);
```

---

## Authentication

- **Provider:** Google OAuth via Auth.js (NextAuth v5 beta)
- **Domain restriction:** Only `@browserstack.com` accounts (enforced in `signIn` callback in `auth.ts`)
- **Session strategy:** JWT (no database sessions)
- **Middleware:** `proxy.ts` protects all routes except `/login`, `/api/auth/*`, `/api/refresh`
- **Config:** `trustHost: true` is set for Vercel deployment

---

## Core Data Flow

```
Jira Cloud (TM project)
        │
        ▼
/api/refresh (POST)
  ├── fetchAllDealblockerIssues()     ← JQL search with pagination
  ├── For each ticket:
  │   ├── parseIssue()                ← Raw API → typed ParsedIssue
  │   ├── extractStatusTransitions()  ← Changelog → StatusTransition[]
  │   ├── extractEtaChanges()         ← Changelog → EtaChange[]
  │   ├── deriveDoneAt()              ← Status history → done_at timestamp
  │   ├── resolveCustomer()           ← Override → Cache → Regex → LLM → Unknown
  │   └── Upsert all to DB
  └── recordRefreshRun()              ← Audit metrics
        │
        ▼
PostgreSQL (6 tables)
        │
        ▼
Dashboard Pages (Server Components)
  ├── getOverviewKpis()
  ├── getTopRisk()
  ├── getTicketsByFilter()
  ├── getEtaTrackingData()
  └── ... (all read from DB via Drizzle)
```

### Refresh details

- **Trigger:** Vercel cron at 2:30 UTC daily, or manual via UI button
- **Incremental:** Only fetches tickets updated since last successful refresh (with 6-hour buffer), unless `?force=1`
- **Wall-clock budget:** 45 seconds per iteration to stay under Vercel's 60s function timeout
- **LLM budget:** Max 5 Gemini calls per refresh run
- **Client loop:** Browser POSTs repeatedly until `hasMore === false`, showing progress
- **HWM (High Water Mark):** Stored as `finishedAt` of last successful refresh run

---

## Jira Integration

### Custom Field IDs (`lib/jira/fields.ts`)

| Field | Custom Field ID |
|-------|----------------|
| Promised ETA | `customfield_10110` |
| Customer Expected ETA | `customfield_17291` |
| Baseline ARR | `customfield_10693` |
| Incremental ACV | `customfield_10694` |
| CE Name | `customfield_10746` |
| DB Category | `customfield_11081` |
| DB Product | `customfield_10493` |
| SFDC Link | `customfield_10204` |
| Customer Stage | `customfield_10147` |

### Key functions (`lib/jira/client.ts`)

- `fetchAllDealblockerIssues(since?)` — JQL: issues reported by configured reporter in TM project, paginated at 100/page
- `fetchSingleIssue(key)` — Full issue details including comments, linked issues, renderedFields
- `postComment(key, body)` — Posts comment in Atlassian Document Format (ADF) via REST API v3

### Changelog parsing (`lib/jira/changelog.ts`)

- `extractStatusTransitions(changelog)` — Returns `StatusTransition[]` (from/to status, category, timestamp, author)
- `extractEtaChanges(changelog)` — Returns `EtaChange[]` matching on `fieldId === customfield_10110` or field name containing "promised eta"

### ADF format for comments

Jira v3 API requires comments in Atlassian Document Format:
```json
{
  "body": {
    "version": 1,
    "type": "doc",
    "content": [{
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Comment text here" }]
    }]
  }
}
```

---

## Customer Extraction Pipeline

Defined in `lib/extract/orchestrator.ts`. Runs for every ticket during refresh.

**Priority order (first match wins):**

1. **Manual override** — Check `customer_overrides` table
2. **Cache hit** — Check `extraction_cache` where content hash matches (title + description unchanged)
3. **Regex: title** — Match `[DB][CUSTOMER]` or `[CUSTOMER]` patterns in issue title
4. **Regex: description** — Match "Opportunity Info" or "Name of the account/group" in description body
5. **LLM (Gemini)** — Send title + description to Gemini, ask for customer name as JSON response
6. **Unknown** — Mark as `customer_source = "unknown"` for manual review at `/admin/needs-review`

Regex filters out generic tags like `[DB]`, `[BUG]`, `[P0]` etc. to avoid false positives.

---

## LLM Integration (Gemini)

**File:** `lib/llm/gemini.ts`

### Model cascade

Tries models in order, cascading on 5xx or network errors:
1. `gemini-3.1-flash-lite-preview`
2. `gemini-2.5-flash-lite`
3. `gemma-3-27b-it`

### Retry behavior

- **429 (rate limit):** Retries with exponential backoff (5s base)
- **5xx / network error:** Cascades to next model
- **Budget:** Max 5 LLM calls per refresh run

### Used for

1. **Customer extraction** — System prompt asks to extract customer company name from ticket title and description, return as JSON
2. **Ticket summary** — System prompt asks to summarize ticket status, recent comments, linked issues into structured output (summary, lastActivity, nextAction, customerImpactNote)

---

## API Routes

### `POST /api/refresh`

Syncs tickets from Jira. Also responds to `GET` for Vercel cron.

| Param | Notes |
|-------|-------|
| `?trigger=manual\|cron` | Source identifier |
| `?force=1` | Skip HWM, refresh all tickets |

**Auth:** Bearer token (`CRON_SECRET`) for cron, session auth for manual.

**Response:** `{ ticketCount, newOrChanged, llmCalls, errors, hasMore, remainingLlm }`

### `POST /api/jira/comment`

Posts a comment to multiple Jira tickets.

**Body:** `{ keys: string[], comment: string }` (max 50 keys)

**Auth:** Requires session.

**Response:** `{ succeeded: number, failed: number, results: Array<{ key, ok, error? }> }`

### `POST /api/override`

Sets a manual customer override.

**Body:** `{ key: string, customer: string, note?: string }`

### `POST /api/ticket/[key]/summary`

Generates an AI summary for a ticket.

**Response:** `{ summary, lastActivity, nextAction, customerImpactNote, modelUsed, commentCount, linkedCount, slackUrls, linkedIssues }`

### `GET|POST /api/auth/[...nextauth]`

Auth.js route handlers (Google OAuth sign in/out/callback).

---

## Dashboard Pages

### Overview (`/`)
- KPI cards: open count, ARR exposed, iACV at risk, past-ETA count, median closure time
- Triage alerts: tickets needing ETA, unassigned, stale (no update in 14+ days), unknown customer
- Top-risk action card (link to `/risk`)
- Age breakdown bar chart (0-7d, 8-14d, 15-30d, 31-60d, 60d+)
- Customer leaderboard with ticket counts and ARR

### Tickets (`/tickets?filter=<filter>`)
Filters: `open`, `past-eta`, `done`, `no-eta`, `unassigned`, `stale`, `all`

For **stale** and **no-eta** filters: renders `BulkActionTable` with checkbox selection and bulk comment posting.
For all others: renders a read-only table.

### Customers (`/customers`)
Leaderboard: customers ranked by ticket count, showing open/closed counts, total ARR, total iACV.

### Customer Detail (`/customers/[customer]`)
All tickets for one customer. Summary stats. Slack thread links extracted from descriptions.

### Risk (`/risk`)
Top 50 open tickets ranked by composite risk score (0-100). Visual score bar per ticket.

### Closures (`/closures`)
Time-range picker (30d, 90d, 365d). Histogram of closure durations. Median, P90, mean stats. Table of closed tickets.

### ETA Tracking (`/eta-tracking`)
Summary KPIs: total changes (7d/30d/60d), tickets changed, avg changes/ticket, net shift direction.
Per-ticket table with change counts, avg/net shift in days, directional indicators.

### Ticket Detail (`/ticket/[key]`)
Full ticket view: metadata, freshness stripe (active/quiet/stale), Slack links, AI summary, status timeline.

### Admin: Needs Review (`/admin/needs-review`)
Tickets where `customer_source = "unknown"`. Allows manual customer assignment via override form.

### Login (`/login`)
Google OAuth sign-in. Redirects to referrer page after auth.

---

## Components

### Key custom components

| Component | File | Description |
|-----------|------|-------------|
| `BulkActionTable` | `components/bulk-action-table.tsx` | Client component. Checkbox selection, floating action bar, pre-filled comment templates, POSTs to `/api/jira/comment` |
| `KpiCard` | `components/kpi-card.tsx` | Metric display card with icon and color variant |
| `RefreshButton` | `components/refresh-button.tsx` | Manual refresh trigger with loading state and progress |
| `StatusBadge` | `components/status-badge.tsx` | Color-coded Jira status pill |
| `EtaBadge` | `components/eta-badge.tsx` | ETA indicator (on-track / past / no-eta) |
| `AgingBreakdown` | `components/aging-breakdown.tsx` | Bar chart of open ticket age distribution |
| `ClosureHistogram` | `components/closure-histogram.tsx` | Recharts histogram of closure times |
| `ShowLatestStatus` | `components/show-latest-status.tsx` | Fetches and renders AI-generated ticket summary |
| `OverrideForm` | `components/override-form.tsx` | Form for manual customer override |
| `CustomersTable` | `components/customers-table.tsx` | Sortable customer list |

### UI primitives (shadcn)

Located in `components/ui/`: `button`, `badge`, `card`, `table`, `separator`, `skeleton`.

---

## Key Queries & Risk Scoring

All queries in `lib/db/queries.ts`.

### Risk score formula (`getTopRisk`)

Composite score 0-100, weighted:

| Factor | Weight | Calculation |
|--------|--------|-------------|
| ARR exposure | 40% | `min(baselineArr / 500000, 1) * 40` |
| Age | 20% | `min(daysOpen / 90, 1) * 20` |
| Past ETA | 20% | `20` if ETA is past due, else `0` |
| Staleness | 20% | `min(daysSinceUpdate / 30, 1) * 20` |

### Other key queries

- `getOverviewKpis()` — Open count, total ARR exposed, total iACV at risk, past-ETA count, median closure time
- `getTicketsByFilter(filter)` — Smart filtering with age-based sort (open tickets: oldest first, done: newest first)
- `getCustomerLeaderboard()` — Customers by ticket count, with ARR/iACV sums
- `getAgingBuckets()` — Open ticket age distribution
- `getClosureMetrics(range)` — Closed tickets with duration, histogram buckets, percentiles
- `getTriageCounts()` — Counts for no-eta, unassigned, stale, needs-review
- `getLastRefreshRun()` — Last refresh metadata for UI display

---

## ETA Change Tracking

### How it works

1. During refresh, `extractEtaChanges()` scans each ticket's Jira changelog for changes to `customfield_10110` (Promised ETA)
2. Each change is stored in `eta_changes` table with old/new ETA values and timestamp
3. The `/eta-tracking` page queries aggregate metrics:
   - **Change frequency:** How many ETA changes per ticket in 7d, 30d, 60d windows
   - **Average shift:** Mean days shifted per change
   - **Net shift:** Total cumulative shift direction (positive = pushing out, negative = pulling in)
4. Color coding: red for pushing out, green for pulling in, intensity for high-frequency changers

### First-time setup

After deploying, the `eta_changes` table must exist (see SQL above). Then trigger a **force refresh** (`?force=1`) to backfill ETA history from all ticket changelogs.

---

## Bulk Actions

### Comment posting flow

1. PM visits `/tickets?filter=stale` or `/tickets?filter=no-eta`
2. `BulkActionTable` renders with checkboxes, pre-filled comment template
3. PM selects tickets, optionally edits comment, clicks "Post Comment"
4. Client POSTs to `/api/jira/comment` with `{ keys, comment }`
5. Server posts comment to each Jira ticket via REST API v3 (ADF format)
6. Success/failure shown per ticket. Failed tickets remain selected for retry.

### Comment templates

- **Stale tickets:** "Hi team — this dealblocker hasn't been updated in a while. Could you share the latest status and next steps?"
- **No-ETA tickets:** "Hi team — this dealblocker is missing a Promised ETA. Could you add one so we can track delivery timelines?"

---

## Scripts

### `npm run backfill`

Runs `scripts/backfill-customers.ts`. Finds tickets with `customer_source = "unknown"`, runs the extraction pipeline (regex then LLM), updates tickets and cache.

### `npm run gemini-models`

Runs `scripts/list-gemini-models.ts`. Lists available Gemini models for the configured API key.

---

## Testing

**Framework:** Vitest with MSW for API mocking.

**Run:** `npm test` (single run) or `npm run test:watch` (watch mode)

### Test files

| Test | Coverage |
|------|----------|
| `tests/sanity.test.ts` | Basic smoke tests |
| `tests/refresh.test.ts` | Refresh pipeline orchestration |
| `tests/status.test.ts` | doneAt derivation from status transitions |
| `tests/jira/client.test.ts` | Jira API calls with MSW mocks |
| `tests/jira/parse.test.ts` | Jira response → ParsedIssue mapping |
| `tests/jira/changelog.test.ts` | Status + ETA change extraction |
| `tests/jira/category.test.ts` | Status category mapping |
| `tests/extract/regex.test.ts` | Customer regex patterns |
| `tests/extract/orchestrator.test.ts` | Full extraction pipeline |
| `tests/llm/gemini.test.ts` | Gemini API with model cascade |

**Fixtures:** `tests/fixtures/jira-search.json` — sample Jira search API response.

---

## Configuration & Environment Variables

### Required env vars

| Variable | Description |
|----------|-------------|
| `JIRA_BASE_URL` | `https://browserstack.atlassian.net` |
| `JIRA_EMAIL` | Jira account email for API auth |
| `JIRA_API_TOKEN` | Jira API token (https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_REPORTER_ACCOUNT_ID` | Jira account ID of the dealblocker reporter: `5efb524c3404690bae83acd1` |
| `JIRA_PROJECT_KEY` | `TM` |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `CRON_SECRET` | Bearer token for cron auth (any random string) |
| `AUTH_SECRET` | NextAuth signing secret (`openssl rand -base64 33`) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `NEXTAUTH_URL` | Deployment URL (e.g. `https://db-analyzer-seven.vercel.app`) |
| `POSTGRES_URL` | Auto-injected by Vercel; for local dev use Neon/Supabase free tier |
| `TIMEZONE` | Display timezone, default `Asia/Kolkata` |

### Config files

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript config. `@/` path alias. `incremental: false` (prevents Vercel cache issues). |
| `drizzle.config.ts` | Drizzle ORM: schema at `lib/db/schema.ts`, dialect postgresql, migrations in `drizzle/`. |
| `next.config.ts` | Minimal Next.js config. |
| `vercel.json` | Cron: `/api/refresh` at `30 2 * * *` (2:30 UTC = 8:00 AM IST). |
| `vitest.config.ts` | Test config with path alias resolution. |

---

## Deployment (Vercel)

Full steps in `DEPLOY.md`. Key points:

1. **GitHub repo:** https://github.com/sudo-naman-bstack/db-analyzer
2. **Vercel project:** Linked to the GitHub repo, auto-deploys on push to `main`
3. **Database:** Vercel Postgres (backed by Neon). `POSTGRES_URL` is auto-injected
4. **Cron:** Hobby plan allows 1 cron/day. Set to 2:30 UTC
5. **Schema push:** After first deploy, apply schema via `drizzle-kit push` or paste SQL in Neon console
6. **OAuth:** Google Cloud project with OAuth consent screen + credentials. Redirect URI: `https://db-analyzer-seven.vercel.app/api/auth/callback/google`

### npm scripts

| Script | Command |
|--------|---------|
| `dev` | `next dev` |
| `build` | `next build` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `db:generate` | `drizzle-kit generate` |
| `db:push` | `drizzle-kit push` |
| `db:studio` | `drizzle-kit studio` |
| `backfill` | `tsx scripts/backfill-customers.ts` |
| `gemini-models` | `tsx scripts/list-gemini-models.ts` |

---

## Git & Subtree Setup

**Important:** This repo uses `git subtree`. Understanding this is critical to avoid deployment disasters.

### Structure

- **Parent repo:** `/Users/namanchaturvedi/Repo/` — contains `db-analyzer/` as a subdirectory among other projects
- **GitHub repo:** `sudo-naman-bstack/db-analyzer` — only contains the contents of `db-analyzer/` (files at root level, no `db-analyzer/` prefix)

### Pushing changes

From the parent directory (`/Users/namanchaturvedi/Repo/`):

```bash
git subtree push --prefix=db-analyzer origin main
```

Or from within `db-analyzer/`, use `git push` if the subtree split has already been done.

### Critical warnings

1. **Never run `git pull --rebase` from the parent directory** — this creates duplicate file trees (files at both root AND `db-analyzer/` prefix), which breaks Vercel builds
2. **If the tree gets corrupted** (duplicate files), fix with `git commit-tree`:
   ```bash
   TREE=$(git rev-parse HEAD:db-analyzer)
   COMMIT=$(git commit-tree $TREE -p $(git rev-parse origin/main) -m "fix: clean tree")
   git push origin $COMMIT:main
   ```
3. **`incremental: false`** in `tsconfig.json` prevents Vercel's TypeScript cache from using stale module exports
4. **Vercel "Redeploy"** redeploys the same commit — it does NOT pick up new pushes. Push a new commit to trigger a fresh build.

---

## Planned / Parked Features

Approved but deferred (in priority order):

1. **Set/Update Promised ETA from dashboard** — Inline date picker on no-ETA tickets, writes directly to Jira `customfield_10110`. Avoids opening Jira.
2. **One-click "Assign to Me"** — Button on unassigned tickets, uses logged-in user's Jira account ID (derivable from Google email via Jira user search API).
3. **Slack thread integration** — Pull context from Slack threads linked in tickets, surface in dashboard. Important for future — gives PMs full context without leaving the dashboard.

**Context:** Manager directive to make dashboard actionable for PMs. Bulk comment posting was implemented first. These are next.

---

## Gotchas & Lessons Learned

1. **Vercel TypeScript cache:** Vercel restores `.tsbuildinfo` between deploys. If you add a new export to an existing module, the cached type info may not include it, causing "module has no exported member" errors. Fix: set `incremental: false` in `tsconfig.json`.

2. **Git subtree duplication:** Running `git pull --rebase` from the parent repo can create a tree where files exist at both `lib/db/queries.ts` AND `db-analyzer/lib/db/queries.ts`. TypeScript resolves the root-level stale copy. The only fix is reconstructing the tree with `git commit-tree`.

3. **Jira ADF format:** Jira REST API v3 requires comments in Atlassian Document Format (JSON), not plain text. Using plain text silently fails or returns 400.

4. **Jira changelog `fieldId`:** Custom fields have both `field` (display name, varies by locale) and `fieldId` (stable, e.g., `customfield_10110`). Always match on `fieldId` for reliability.

5. **Vercel function timeout:** 60s max on Hobby plan. The refresh uses a 45s wall-clock budget and returns `hasMore: true` so the client can call again for remaining tickets.

6. **`eta_changes` table must be created manually** if you bypass Drizzle migrations (e.g., when adding it after initial schema push). See the SQL in the Database Schema section.

7. **Vercel Redeploy vs. new push:** "Redeploy" in the Vercel dashboard re-runs the build for the same commit. It will NOT pick up new code. Push a new commit (even empty: `git commit --allow-empty -m "trigger deploy"`) to get a fresh build.
