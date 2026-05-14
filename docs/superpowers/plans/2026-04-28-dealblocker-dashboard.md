# Dealblocker Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vercel-hosted Next.js dashboard that pulls dealblocker tickets from BrowserStack's Jira TM project, extracts customer names (regex first, Gemini fallback), and surfaces grouped lists, ARR exposure, ETA hygiene, and closure-time stats.

**Architecture:** Next.js 15 App Router on Vercel. Vercel Postgres (Drizzle ORM) for ticket snapshots, status changelog, and extraction cache. Vercel Cron triggers `/api/refresh` every 30 minutes; the refresh handler full-fetches via Jira REST, diffs into Postgres, resolves customers via override → cache → regex → Gemini cascade. Server components render dashboards from the DB.

**Tech Stack:** TypeScript, Next.js 15, Tailwind, shadcn/ui, Recharts, Drizzle ORM, Vercel Postgres, `@google/genai`, Vitest, MSW (HTTP mocking).

**Deferred from spec (v2):** Spec §7.2 mentions persistent global filters (status / category / product / past-ETA) in the URL. v1 ships per-page tables and the by-customer accordion without a unified filter bar. Adding a `<Filters>` component is straightforward but not on the critical path for the director's first look.

---

## Spec Reference

The companion design spec is at `docs/superpowers/specs/2026-04-28-dealblocker-dashboard-design.md`. Read it before starting Task 1.

## File Structure (locked in)

```
db-analyzer/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                        # Overview
│   │   ├── customers/page.tsx              # By customer
│   │   ├── closures/page.tsx               # Closure metrics
│   │   ├── ticket/[key]/page.tsx           # Drilldown
│   │   └── admin/needs-review/page.tsx     # Customer override admin
│   ├── api/
│   │   └── refresh/route.ts                # Refresh handler
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                                 # shadcn primitives
│   ├── kpi-card.tsx
│   ├── customer-row.tsx
│   ├── closure-histogram.tsx
│   ├── refresh-button.tsx
│   └── filters.tsx
├── lib/
│   ├── jira/
│   │   ├── client.ts                       # paginated /search/jql + expand=changelog
│   │   ├── fields.ts                       # custom field IDs
│   │   ├── parse.ts                        # raw → typed
│   │   └── changelog.ts                    # changelog → status transitions
│   ├── llm/
│   │   └── gemini.ts                       # cascade client
│   ├── extract/
│   │   ├── regex.ts                        # title + Opportunity Info regexes
│   │   └── orchestrator.ts                 # override > cache > regex > LLM
│   ├── db/
│   │   ├── schema.ts                       # Drizzle tables
│   │   ├── client.ts                       # Drizzle client
│   │   ├── queries.ts                      # read helpers for UI
│   │   └── upserts.ts                      # write helpers for refresh
│   ├── status.ts                           # done_at derivation
│   ├── refresh.ts                          # orchestrator
│   └── format.ts                           # date/currency formatting
├── tests/
│   ├── fixtures/
│   │   ├── tm-21858.xml                    # raw sample
│   │   └── jira-search.json                # synthesized API response
│   ├── jira/
│   │   ├── parse.test.ts
│   │   └── changelog.test.ts
│   ├── extract/
│   │   ├── regex.test.ts
│   │   └── orchestrator.test.ts
│   ├── llm/
│   │   └── gemini.test.ts
│   ├── status.test.ts
│   └── refresh.test.ts
├── drizzle/
│   ├── 0001_init.sql                       # generated migration
│   └── meta/
├── drizzle.config.ts
├── vercel.json                             # cron config
├── vitest.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/(dashboard)/page.tsx`, `.gitignore`
- Note: working directory is `/Users/namanchaturvedi/Repo/db-analyzer`. The `git init` was done implicitly by an earlier commit; `git status` should already be on `main`.

- [ ] **Step 1: Run create-next-app**

```bash
cd /Users/namanchaturvedi/Repo/db-analyzer
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --turbopack --import-alias "@/*" --use-npm --skip-install
```

When prompted whether to overwrite or merge, answer `merge` so the existing `docs/` directory is preserved.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install drizzle-orm @vercel/postgres pg @google/genai zod date-fns recharts clsx tailwind-merge class-variance-authority lucide-react
npm install -D drizzle-kit vitest @vitest/ui @types/pg msw tsx
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000 with default Next.js page. Press Ctrl+C to stop.

- [ ] **Step 4: Confirm `.gitignore` includes the right entries**

Open `.gitignore` and ensure these lines are present (create-next-app provides most):

```
node_modules
.next
.env*.local
.DS_Store
drizzle/.snapshot.json
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js project with Tailwind and core deps"
```

---

## Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/sanity.test.ts`
- Modify: `package.json` (add `test` scripts)

- [ ] **Step 1: Write the config**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 2: Add test scripts to package.json**

In `package.json`, add inside `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write a sanity test**

`tests/sanity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run it**

```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json tests/sanity.test.ts
git commit -m "chore: add vitest setup with sanity test"
```

---

## Task 3: Add `.env.example` and document required env vars

**Files:**
- Create: `.env.example`, `README.md`

- [ ] **Step 1: Write `.env.example`**

```bash
# Jira
JIRA_BASE_URL=https://browserstack.atlassian.net
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_REPORTER_ACCOUNT_ID=5efb524c3404690bae83acd1
JIRA_PROJECT_KEY=TM

# Gemini
GEMINI_API_KEY=

# Cron
CRON_SECRET=

# Postgres (auto-injected on Vercel; for local dev use a Neon/Supabase free DB)
POSTGRES_URL=

# Display
TIMEZONE=Asia/Kolkata
```

- [ ] **Step 2: Write a minimal README**

`README.md`:

````markdown
# Dealblocker Dashboard

Internal dashboard for BrowserStack Test Management dealblocker tickets.

## Local dev

1. `cp .env.example .env.local` and fill in values.
2. `npm run dev`
3. Visit http://localhost:3000

## Deploy

Vercel project. Postgres + Cron + password protection configured in Vercel dashboard.

See `docs/superpowers/specs/2026-04-28-dealblocker-dashboard-design.md` for full design.
````

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: add env template and minimal README"
```

---

## Task 4: Define Drizzle schema

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/client.ts`, `drizzle.config.ts`

- [ ] **Step 1: Write the schema**

`lib/db/schema.ts`:

```ts
import {
  pgTable,
  text,
  timestamp,
  date,
  numeric,
  integer,
  bigserial,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const tickets = pgTable("tickets", {
  key: text("key").primaryKey(),
  summary: text("summary").notNull(),
  status: text("status").notNull(),
  statusCategory: text("status_category").notNull(),
  assignee: text("assignee"),
  created: timestamp("created", { withTimezone: true }).notNull(),
  updated: timestamp("updated", { withTimezone: true }).notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  promisedEta: date("promised_eta"),
  customerExpectedEta: text("customer_expected_eta"),
  baselineArr: numeric("baseline_arr"),
  incrementalAcv: numeric("incremental_acv"),
  ceName: text("ce_name"),
  dbCategory: text("db_category"),
  dbProduct: text("db_product"),
  sfdcLink: text("sfdc_link"),
  customerStage: text("customer_stage"),
  descriptionRaw: text("description_raw"),
  customer: text("customer"),
  customerSource: text("customer_source"),
  lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }).notNull(),
});

export const statusHistory = pgTable(
  "status_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    issueKey: text("issue_key")
      .notNull()
      .references(() => tickets.key, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    toCategory: text("to_category").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
    author: text("author"),
  },
  (t) => ({
    uniq: uniqueIndex("status_history_uniq").on(t.issueKey, t.changedAt, t.toStatus),
    idx: index("status_history_issue_changed_idx").on(t.issueKey, t.changedAt),
  }),
);

export const extractionCache = pgTable("extraction_cache", {
  issueKey: text("issue_key").primaryKey(),
  contentHash: text("content_hash").notNull(),
  customer: text("customer").notNull(),
  source: text("source").notNull(),
  modelUsed: text("model_used"),
  extractedAt: timestamp("extracted_at", { withTimezone: true }).notNull(),
});

export const customerOverrides = pgTable("customer_overrides", {
  issueKey: text("issue_key").primaryKey(),
  customer: text("customer").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const refreshRuns = pgTable("refresh_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ticketCount: integer("ticket_count"),
  newOrChanged: integer("new_or_changed"),
  llmCalls: integer("llm_calls"),
  errors: integer("errors"),
  errorSummary: text("error_summary"),
  trigger: text("trigger").notNull(),
});

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type StatusHistoryRow = typeof statusHistory.$inferSelect;
export type NewStatusHistoryRow = typeof statusHistory.$inferInsert;
```

- [ ] **Step 2: Write the Drizzle client**

`lib/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL not set");
}

const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
export { schema };
```

- [ ] **Step 3: Write `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? "",
  },
});
```

- [ ] **Step 4: Add migration scripts to package.json**

In `"scripts"`:

```json
"db:generate": "drizzle-kit generate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

- [ ] **Step 5: Generate the initial migration**

```bash
npm run db:generate
```

Expected: a SQL file appears under `drizzle/`.

- [ ] **Step 6: Commit**

```bash
git add lib/db drizzle.config.ts drizzle package.json package-lock.json
git commit -m "feat(db): define Drizzle schema for tickets, status_history, extraction_cache, overrides, refresh_runs"
```

---

## Task 5: Save Jira fixture and add Jira fields config

**Files:**
- Create: `tests/fixtures/tm-21858.xml`, `tests/fixtures/jira-search.json`, `lib/jira/fields.ts`

- [ ] **Step 1: Save the raw XML fixture**

Save the full XML payload from the design spec's TM-21858 sample (the one provided during brainstorming) to `tests/fixtures/tm-21858.xml`. This is for human reference during development.

- [ ] **Step 2: Create the JSON fixture (mirrors what `/rest/api/3/search/jql` returns)**

`tests/fixtures/jira-search.json`:

```json
{
  "issues": [
    {
      "key": "TM-21858",
      "fields": {
        "summary": "[DB][HBF]Restrict Public Link Functionality to Product Admin and Product User role in TM",
        "status": {
          "name": "New Item",
          "statusCategory": { "key": "new" }
        },
        "assignee": { "displayName": "Naman Chaturvedi" },
        "created": "2026-03-03T13:52:05.000+0000",
        "updated": "2026-04-21T05:26:18.000+0000",
        "description": "Opportunity Info\nName: HBF - TM - Ent. 10 U\nLink: https://browserstack.my.salesforce.com/lightning/r/Opportunity/006OW000003o0eKYAQ/view",
        "customfield_10110": "2026-04-30",
        "customfield_17291": "Current Quarter",
        "customfield_10693": 265021.64,
        "customfield_10694": 0,
        "customfield_10746": "Parth Dandekar",
        "customfield_11081": [{ "value": "Adhoc Feature Request" }],
        "customfield_10493": "Test Management",
        "customfield_10204": "https://browserstack.my.salesforce.com/lightning/r/Case/500OW00000iFOk7YAG/view",
        "customfield_10147": { "value": "Renewals" }
      },
      "changelog": {
        "histories": [
          {
            "created": "2026-03-04T10:00:00.000+0000",
            "author": { "displayName": "Naman Chaturvedi" },
            "items": [
              {
                "field": "status",
                "fromString": "Open",
                "toString": "In Progress"
              }
            ]
          }
        ]
      }
    },
    {
      "key": "TM-99999",
      "fields": {
        "summary": "[DB][ACME]Sample done ticket",
        "status": {
          "name": "Done",
          "statusCategory": { "key": "done" }
        },
        "assignee": null,
        "created": "2026-01-10T10:00:00.000+0000",
        "updated": "2026-02-15T10:00:00.000+0000",
        "description": "Opportunity Info\nName: ACME Corp - TM\nLink: https://example.com",
        "customfield_10110": null,
        "customfield_17291": null,
        "customfield_10693": 50000,
        "customfield_10694": null,
        "customfield_10746": null,
        "customfield_11081": null,
        "customfield_10493": "Test Management",
        "customfield_10204": null,
        "customfield_10147": null
      },
      "changelog": {
        "histories": [
          {
            "created": "2026-02-15T08:00:00.000+0000",
            "author": { "displayName": "QA Bot" },
            "items": [
              {
                "field": "status",
                "fromString": "In Progress",
                "toString": "Done"
              }
            ]
          }
        ]
      }
    }
  ],
  "isLast": true,
  "nextPageToken": null
}
```

- [ ] **Step 3: Write the field config module**

`lib/jira/fields.ts`:

```ts
export const JIRA_FIELDS = {
  promisedEta: "customfield_10110",
  customerExpectedEta: "customfield_17291",
  baselineArr: "customfield_10693",
  incrementalAcv: "customfield_10694",
  ceName: "customfield_10746",
  dbCategory: "customfield_11081",
  dbProduct: "customfield_10493",
  sfdcLink: "customfield_10204",
  customerStage: "customfield_10147",
} as const;

export const ISSUE_FIELDS_TO_REQUEST: string[] = [
  "summary",
  "status",
  "assignee",
  "created",
  "updated",
  "description",
  ...Object.values(JIRA_FIELDS),
];
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures lib/jira/fields.ts
git commit -m "feat(jira): add fixture and custom field ID config"
```

---

## Task 6: Parse Jira issue payload (TDD)

**Files:**
- Create: `lib/jira/parse.ts`, `tests/jira/parse.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/jira/parse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/jira-search.json";
import { parseIssue } from "@/lib/jira/parse";

describe("parseIssue", () => {
  it("normalizes a TM-21858-shaped issue", () => {
    const issue = (fixture as any).issues[0];
    const parsed = parseIssue(issue);
    expect(parsed.key).toBe("TM-21858");
    expect(parsed.summary).toContain("[DB][HBF]");
    expect(parsed.status).toBe("New Item");
    expect(parsed.statusCategory).toBe("new");
    expect(parsed.assignee).toBe("Naman Chaturvedi");
    expect(parsed.promisedEta).toBe("2026-04-30");
    expect(parsed.customerExpectedEta).toBe("Current Quarter");
    expect(parsed.baselineArr).toBe("265021.64");
    expect(parsed.dbCategory).toBe("Adhoc Feature Request");
    expect(parsed.dbProduct).toBe("Test Management");
    expect(parsed.customerStage).toBe("Renewals");
  });

  it("handles null custom fields", () => {
    const issue = (fixture as any).issues[1];
    const parsed = parseIssue(issue);
    expect(parsed.promisedEta).toBeNull();
    expect(parsed.dbCategory).toBeNull();
    expect(parsed.assignee).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npm test -- tests/jira/parse.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `parse.ts`**

`lib/jira/parse.ts`:

```ts
import { JIRA_FIELDS } from "./fields";

export interface ParsedIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee: string | null;
  created: string;
  updated: string;
  description: string;
  promisedEta: string | null;
  customerExpectedEta: string | null;
  baselineArr: string | null;
  incrementalAcv: string | null;
  ceName: string | null;
  dbCategory: string | null;
  dbProduct: string | null;
  sfdcLink: string | null;
  customerStage: string | null;
  rawChangelog: Array<{
    created: string;
    author: string | null;
    items: Array<{ field: string; fromString: string | null; toString: string | null }>;
  }>;
}

function readSelectValue(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const first = v[0] as { value?: string } | undefined;
    return first?.value ?? null;
  }
  if (typeof v === "object" && v !== null && "value" in v) {
    return (v as { value: string }).value ?? null;
  }
  if (typeof v === "string") return v;
  return null;
}

function readNumber(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  return null;
}

export function parseIssue(raw: any): ParsedIssue {
  const f = raw.fields ?? {};
  const histories = raw.changelog?.histories ?? [];
  return {
    key: raw.key,
    summary: f.summary ?? "",
    status: f.status?.name ?? "",
    statusCategory: f.status?.statusCategory?.key ?? "new",
    assignee: f.assignee?.displayName ?? null,
    created: f.created,
    updated: f.updated,
    description: typeof f.description === "string" ? f.description : "",
    promisedEta: f[JIRA_FIELDS.promisedEta] ?? null,
    customerExpectedEta: f[JIRA_FIELDS.customerExpectedEta] ?? null,
    baselineArr: readNumber(f[JIRA_FIELDS.baselineArr]),
    incrementalAcv: readNumber(f[JIRA_FIELDS.incrementalAcv]),
    ceName: f[JIRA_FIELDS.ceName] ?? null,
    dbCategory: readSelectValue(f[JIRA_FIELDS.dbCategory]),
    dbProduct: f[JIRA_FIELDS.dbProduct] ?? null,
    sfdcLink: f[JIRA_FIELDS.sfdcLink] ?? null,
    customerStage: readSelectValue(f[JIRA_FIELDS.customerStage]),
    rawChangelog: histories.map((h: any) => ({
      created: h.created,
      author: h.author?.displayName ?? null,
      items: (h.items ?? []).map((it: any) => ({
        field: it.field,
        fromString: it.fromString ?? null,
        toString: it.toString ?? null,
      })),
    })),
  };
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- tests/jira/parse.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/jira/parse.ts tests/jira/parse.test.ts
git commit -m "feat(jira): parse raw issue payload into typed shape"
```

---

## Task 7: Parse changelog into status transitions (TDD)

**Files:**
- Create: `lib/jira/changelog.ts`, `tests/jira/changelog.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/jira/changelog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractStatusTransitions } from "@/lib/jira/changelog";

describe("extractStatusTransitions", () => {
  it("returns one transition per status item", () => {
    const transitions = extractStatusTransitions("TM-1", [
      {
        created: "2026-01-01T00:00:00.000Z",
        author: "Alice",
        items: [
          { field: "status", fromString: "Open", toString: "In Progress" },
          { field: "summary", fromString: "old", toString: "new" },
        ],
      },
      {
        created: "2026-01-05T00:00:00.000Z",
        author: "Bob",
        items: [{ field: "status", fromString: "In Progress", toString: "Done" }],
      },
    ]);

    expect(transitions).toHaveLength(2);
    expect(transitions[0]).toMatchObject({
      issueKey: "TM-1",
      fromStatus: "Open",
      toStatus: "In Progress",
      author: "Alice",
    });
    expect(transitions[1].toStatus).toBe("Done");
  });

  it("ignores non-status items", () => {
    const transitions = extractStatusTransitions("TM-2", [
      {
        created: "2026-01-01T00:00:00.000Z",
        author: null,
        items: [{ field: "assignee", fromString: "x", toString: "y" }],
      },
    ]);
    expect(transitions).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npm test -- tests/jira/changelog.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

`lib/jira/changelog.ts`:

```ts
import type { ParsedIssue } from "./parse";

export interface StatusTransition {
  issueKey: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  author: string | null;
}

export function extractStatusTransitions(
  issueKey: string,
  histories: ParsedIssue["rawChangelog"],
): StatusTransition[] {
  const out: StatusTransition[] = [];
  for (const h of histories) {
    for (const item of h.items) {
      if (item.field !== "status" || !item.toString) continue;
      out.push({
        issueKey,
        fromStatus: item.fromString,
        toStatus: item.toString,
        changedAt: h.created,
        author: h.author,
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- tests/jira/changelog.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/jira/changelog.ts tests/jira/changelog.test.ts
git commit -m "feat(jira): extract status transitions from changelog"
```

---

## Task 8: Implement Jira HTTP client with pagination

**Files:**
- Create: `lib/jira/client.ts`, `tests/jira/client.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/jira/client.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import fixture from "../fixtures/jira-search.json";
import { fetchAllDealblockerIssues } from "@/lib/jira/client";

const server = setupServer(
  http.get("https://example.atlassian.net/rest/api/3/search/jql", () => {
    return HttpResponse.json(fixture);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("fetchAllDealblockerIssues", () => {
  it("returns all parsed issues", async () => {
    vi.stubEnv("JIRA_BASE_URL", "https://example.atlassian.net");
    vi.stubEnv("JIRA_EMAIL", "test@example.com");
    vi.stubEnv("JIRA_API_TOKEN", "token");
    vi.stubEnv("JIRA_REPORTER_ACCOUNT_ID", "5efb524c3404690bae83acd1");
    vi.stubEnv("JIRA_PROJECT_KEY", "TM");

    const issues = await fetchAllDealblockerIssues();
    expect(issues).toHaveLength(2);
    expect(issues[0].key).toBe("TM-21858");
    expect(issues[0].rawChangelog.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Install MSW (already in deps from Task 1) and run test**

```bash
npm test -- tests/jira/client.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the client**

`lib/jira/client.ts`:

```ts
import { ISSUE_FIELDS_TO_REQUEST } from "./fields";
import { parseIssue, type ParsedIssue } from "./parse";

const JQL_TEMPLATE = (reporter: string, project: string) =>
  `reporter = ${reporter} AND project = "${project}" ORDER BY status ASC, created DESC`;

function authHeader(): string {
  const email = process.env.JIRA_EMAIL ?? "";
  const token = process.env.JIRA_API_TOKEN ?? "";
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

async function fetchWithRetry(url: URL, init: RequestInit, tries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500) {
        lastErr = new Error(`Jira ${res.status}`);
      } else {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("Jira fetch failed");
}

interface SearchResponse {
  issues: any[];
  isLast?: boolean;
  nextPageToken?: string | null;
}

export async function fetchAllDealblockerIssues(): Promise<ParsedIssue[]> {
  const base = process.env.JIRA_BASE_URL;
  const reporter = process.env.JIRA_REPORTER_ACCOUNT_ID;
  const project = process.env.JIRA_PROJECT_KEY;
  if (!base || !reporter || !project) {
    throw new Error("Jira env vars missing");
  }

  const jql = JQL_TEMPLATE(reporter, project);
  const all: ParsedIssue[] = [];
  let nextPageToken: string | null | undefined = undefined;

  do {
    const url = new URL("/rest/api/3/search/jql", base);
    url.searchParams.set("jql", jql);
    url.searchParams.set("fields", ISSUE_FIELDS_TO_REQUEST.join(","));
    url.searchParams.set("expand", "changelog");
    url.searchParams.set("maxResults", "100");
    if (nextPageToken) url.searchParams.set("nextPageToken", nextPageToken);

    const res = await fetchWithRetry(url, {
      headers: {
        Authorization: authHeader(),
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Jira ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as SearchResponse;
    for (const raw of json.issues) all.push(parseIssue(raw));
    nextPageToken = json.isLast ? null : json.nextPageToken;
  } while (nextPageToken);

  return all;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- tests/jira/client.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/jira/client.ts tests/jira/client.test.ts
git commit -m "feat(jira): paginated client for /search/jql with changelog expansion"
```

---

## Task 9: Customer extraction regex (TDD)

**Files:**
- Create: `lib/extract/regex.ts`, `tests/extract/regex.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/extract/regex.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractFromTitle, extractFromOpportunity } from "@/lib/extract/regex";

describe("extractFromTitle", () => {
  it("pulls the customer code from [DB][CUSTOMER] prefix", () => {
    expect(extractFromTitle("[DB][HBF]Restrict Public Link")).toBe("HBF");
  });

  it("returns null when no prefix", () => {
    expect(extractFromTitle("Random title")).toBeNull();
  });

  it("handles whitespace and lowercase prefix", () => {
    expect(extractFromTitle("  [db][ Acme Corp ] Title")).toBe("Acme Corp");
  });
});

describe("extractFromOpportunity", () => {
  it("reads the first segment of Opportunity Info Name", () => {
    const desc = "Opportunity Info\nName: HBF - TM - Ent. 10 U\nLink: https://x";
    expect(extractFromOpportunity(desc)).toBe("HBF");
  });

  it("supports HTML-encoded variants", () => {
    const desc =
      "<h3>Opportunity Info</h3><p>Name: ACME Corp - Live - 5 U</p><p>Link: https://x</p>";
    expect(extractFromOpportunity(desc)).toBe("ACME Corp");
  });

  it("returns null when missing", () => {
    expect(extractFromOpportunity("nothing here")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npm test -- tests/extract/regex.test.ts
```

- [ ] **Step 3: Implement**

`lib/extract/regex.ts`:

```ts
const TITLE_RE = /^\s*\[db\]\[\s*([^\]]+?)\s*\]/i;
const OPPORTUNITY_RE = /Opportunity\s*Info[\s\S]{0,200}?Name:\s*([^\n<]+)/i;

export function extractFromTitle(title: string): string | null {
  const m = title.match(TITLE_RE);
  return m ? m[1].trim() : null;
}

export function extractFromOpportunity(description: string): string | null {
  const m = description.match(OPPORTUNITY_RE);
  if (!m) return null;
  const raw = m[1].trim();
  const segment = raw.split(" - ")[0]?.trim();
  return segment ? segment : null;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- tests/extract/regex.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/extract/regex.ts tests/extract/regex.test.ts
git commit -m "feat(extract): regex for title and Opportunity Info customer extraction"
```

---

## Task 10: Gemini cascade client (TDD)

**Files:**
- Create: `lib/llm/gemini.ts`, `tests/llm/gemini.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/llm/gemini.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractCustomerWithLLM, MODEL_CASCADE } from "@/lib/llm/gemini";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function mockGenerate(impls: Array<() => any>) {
  const calls: string[] = [];
  let i = 0;
  return {
    calls,
    factory: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockImplementation(({ model }: { model: string }) => {
          calls.push(model);
          const impl = impls[i++];
          return impl();
        }),
      },
    })),
  };
}

describe("extractCustomerWithLLM", () => {
  it("returns the customer from the primary model on success", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const m = mockGenerate([() => ({ text: '{"customer":"HBF"}' })]);
    const result = await extractCustomerWithLLM(
      { title: "[DB][HBF]X", description: "x" },
      { clientFactory: m.factory },
    );
    expect(result).toEqual({ customer: "HBF", modelUsed: MODEL_CASCADE[0] });
    expect(m.calls).toEqual([MODEL_CASCADE[0]]);
  });

  it("falls through on rate limit", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const m = mockGenerate([
      () => {
        throw Object.assign(new Error("429"), { status: 429 });
      },
      () => ({ text: '{"customer":"ACME"}' }),
    ]);
    const result = await extractCustomerWithLLM(
      { title: "x", description: "x" },
      { clientFactory: m.factory },
    );
    expect(result).toEqual({ customer: "ACME", modelUsed: MODEL_CASCADE[1] });
    expect(m.calls).toEqual([MODEL_CASCADE[0], MODEL_CASCADE[1]]);
  });

  it("falls through on parse failure", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const m = mockGenerate([
      () => ({ text: "not json" }),
      () => ({ text: '{"customer":"OK"}' }),
    ]);
    const result = await extractCustomerWithLLM(
      { title: "x", description: "x" },
      { clientFactory: m.factory },
    );
    expect(result?.customer).toBe("OK");
  });

  it("returns null when all models fail", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const m = mockGenerate(MODEL_CASCADE.map(() => () => ({ text: "bad" })));
    const result = await extractCustomerWithLLM(
      { title: "x", description: "x" },
      { clientFactory: m.factory },
    );
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npm test -- tests/llm/gemini.test.ts
```

- [ ] **Step 3: Implement**

`lib/llm/gemini.ts`:

```ts
import { GoogleGenAI } from "@google/genai";

export const MODEL_CASCADE = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-2.5-flash-lite",
  "gemma-3-27b-it",
] as const;

export type ModelName = (typeof MODEL_CASCADE)[number];

const SYSTEM_PROMPT = [
  "You are an extractor. Given a Jira ticket title and description, identify the",
  "customer/account name (the company or organization the ticket is about).",
  'Return only JSON of the shape {"customer":"<name>"}. If unsure, return',
  '{"customer":""}. Do not include any other text.',
].join(" ");

export interface ExtractInput {
  title: string;
  description: string;
}

export interface ExtractResult {
  customer: string;
  modelUsed: ModelName;
}

interface GenAIClientLike {
  models: {
    generateContent: (args: {
      model: string;
      contents: any;
      config?: any;
    }) => Promise<{ text?: string }>;
  };
}

export interface ExtractOptions {
  clientFactory?: () => GenAIClientLike;
}

function defaultFactory(): GenAIClientLike {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" }) as unknown as GenAIClientLike;
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429) return true;
  if (status && status >= 500) return true;
  return true; // network/unknown — try next model
}

function parseCustomer(text: string | undefined): string | null {
  if (!text) return null;
  // Strip markdown fences if present
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { customer?: string };
    if (typeof parsed.customer === "string" && parsed.customer.trim().length > 0) {
      return parsed.customer.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function extractCustomerWithLLM(
  input: ExtractInput,
  opts: ExtractOptions = {},
): Promise<ExtractResult | null> {
  const factory = opts.clientFactory ?? defaultFactory;
  const client = factory();
  const userText = `Title: ${input.title}\n\nDescription:\n${input.description.slice(0, 6000)}`;

  for (const model of MODEL_CASCADE) {
    try {
      const res = await client.models.generateContent({
        model,
        contents: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
          { role: "user", parts: [{ text: userText }] },
        ],
        config: { temperature: 0 },
      });
      const customer = parseCustomer(res.text);
      if (customer) return { customer, modelUsed: model };
    } catch (err) {
      if (!isRetryable(err)) throw err;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- tests/llm/gemini.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/llm/gemini.ts tests/llm/gemini.test.ts
git commit -m "feat(llm): Gemini cascade client for customer extraction"
```

---

## Task 11: Extraction orchestrator (TDD)

**Files:**
- Create: `lib/extract/orchestrator.ts`, `tests/extract/orchestrator.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/extract/orchestrator.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { resolveCustomer } from "@/lib/extract/orchestrator";

const noLLM = vi.fn().mockResolvedValue(null);

describe("resolveCustomer", () => {
  it("uses override first", async () => {
    const r = await resolveCustomer({
      title: "[DB][HBF]X",
      description: "Opportunity Info\nName: HBF - TM",
      override: "Manually Set",
      cache: null,
      llm: noLLM,
    });
    expect(r).toEqual({ customer: "Manually Set", source: "override", modelUsed: null });
    expect(noLLM).not.toHaveBeenCalled();
  });

  it("uses cache when content hash matches", async () => {
    const r = await resolveCustomer({
      title: "x",
      description: "y",
      override: null,
      cache: { customer: "Cached", source: "regex_title", contentHash: "match" },
      llm: noLLM,
      currentHash: "match",
    });
    expect(r).toEqual({ customer: "Cached", source: "regex_title", modelUsed: null });
  });

  it("uses regex_title when title matches", async () => {
    const r = await resolveCustomer({
      title: "[DB][HBF]X",
      description: "no opp info",
      override: null,
      cache: null,
      llm: noLLM,
    });
    expect(r.source).toBe("regex_title");
    expect(r.customer).toBe("HBF");
  });

  it("falls through to regex_desc", async () => {
    const r = await resolveCustomer({
      title: "Bad title without prefix",
      description: "Opportunity Info\nName: ACME Corp - X - Y",
      override: null,
      cache: null,
      llm: noLLM,
    });
    expect(r.source).toBe("regex_desc");
    expect(r.customer).toBe("ACME Corp");
  });

  it("falls through to LLM when both regex fail", async () => {
    const llm = vi.fn().mockResolvedValue({ customer: "FromLLM", modelUsed: "gemini-3.1-flash-lite" });
    const r = await resolveCustomer({
      title: "no prefix",
      description: "no opp info",
      override: null,
      cache: null,
      llm,
    });
    expect(r).toEqual({ customer: "FromLLM", source: "llm", modelUsed: "gemini-3.1-flash-lite" });
    expect(llm).toHaveBeenCalledOnce();
  });

  it("returns unknown when LLM also fails", async () => {
    const llm = vi.fn().mockResolvedValue(null);
    const r = await resolveCustomer({
      title: "no",
      description: "no",
      override: null,
      cache: null,
      llm,
    });
    expect(r).toEqual({ customer: "Unknown", source: "unknown", modelUsed: null });
  });

  it("respects llm budget exhaustion", async () => {
    const llm = vi.fn();
    const r = await resolveCustomer({
      title: "no",
      description: "no",
      override: null,
      cache: null,
      llm,
      llmBudgetExhausted: true,
    });
    expect(r).toEqual({ customer: "Unknown", source: "unknown", modelUsed: null });
    expect(llm).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npm test -- tests/extract/orchestrator.test.ts
```

- [ ] **Step 3: Implement**

`lib/extract/orchestrator.ts`:

```ts
import { extractFromTitle, extractFromOpportunity } from "./regex";
import type { ExtractInput, ExtractResult } from "@/lib/llm/gemini";

export type CustomerSource = "override" | "regex_title" | "regex_desc" | "llm" | "unknown";

export interface CacheEntry {
  customer: string;
  source: Exclude<CustomerSource, "override" | "unknown">;
  contentHash: string;
}

export interface ResolveInput {
  title: string;
  description: string;
  override: string | null;
  cache: CacheEntry | null;
  currentHash?: string;
  llm: (input: ExtractInput) => Promise<ExtractResult | null>;
  llmBudgetExhausted?: boolean;
}

export interface ResolveOutput {
  customer: string;
  source: CustomerSource;
  modelUsed: string | null;
}

export async function resolveCustomer(input: ResolveInput): Promise<ResolveOutput> {
  if (input.override) {
    return { customer: input.override, source: "override", modelUsed: null };
  }
  if (input.cache && input.currentHash && input.cache.contentHash === input.currentHash) {
    return { customer: input.cache.customer, source: input.cache.source, modelUsed: null };
  }
  const fromTitle = extractFromTitle(input.title);
  if (fromTitle) {
    return { customer: fromTitle, source: "regex_title", modelUsed: null };
  }
  const fromDesc = extractFromOpportunity(input.description);
  if (fromDesc) {
    return { customer: fromDesc, source: "regex_desc", modelUsed: null };
  }
  if (input.llmBudgetExhausted) {
    return { customer: "Unknown", source: "unknown", modelUsed: null };
  }
  const llmResult = await input.llm({ title: input.title, description: input.description });
  if (llmResult) {
    return { customer: llmResult.customer, source: "llm", modelUsed: llmResult.modelUsed };
  }
  return { customer: "Unknown", source: "unknown", modelUsed: null };
}

export function contentHash(title: string, description: string): string {
  // tiny stable hash; no need for cryptographic strength
  let h = 5381;
  const s = `${title} ${description}`;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- tests/extract/orchestrator.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/extract/orchestrator.ts tests/extract/orchestrator.test.ts
git commit -m "feat(extract): customer resolution cascade (override > cache > regex > llm)"
```

---

## Task 12: Compute done_at from status transitions (TDD)

**Files:**
- Create: `lib/status.ts`, `tests/status.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveDoneAt } from "@/lib/status";

const cat = (status: string) => (status === "Done" ? "done" : status === "In Progress" ? "indeterminate" : "new");

describe("deriveDoneAt", () => {
  it("returns null when never done", () => {
    expect(
      deriveDoneAt(
        [
          { toStatus: "In Progress", changedAt: "2026-01-01T00:00:00Z" },
          { toStatus: "Open", changedAt: "2026-01-02T00:00:00Z" },
        ],
        cat,
      ),
    ).toBeNull();
  });

  it("returns the latest entry into a done category", () => {
    expect(
      deriveDoneAt(
        [
          { toStatus: "Done", changedAt: "2026-01-01T00:00:00Z" },
          { toStatus: "Reopened", changedAt: "2026-01-05T00:00:00Z" },
          { toStatus: "Done", changedAt: "2026-01-10T00:00:00Z" },
        ],
        cat,
      ),
    ).toBe("2026-01-10T00:00:00Z");
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npm test -- tests/status.test.ts
```

- [ ] **Step 3: Implement**

`lib/status.ts`:

```ts
export interface StatusTransitionLite {
  toStatus: string;
  changedAt: string;
}

export function deriveDoneAt(
  transitions: StatusTransitionLite[],
  categoryOf: (status: string) => string,
): string | null {
  let latest: string | null = null;
  for (const t of transitions) {
    if (categoryOf(t.toStatus) === "done") {
      if (!latest || t.changedAt > latest) latest = t.changedAt;
    }
  }
  return latest;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- tests/status.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/status.ts tests/status.test.ts
git commit -m "feat: derive done_at from latest entry into done category"
```

---

## Task 13: DB upserts and queries

**Files:**
- Create: `lib/db/upserts.ts`, `lib/db/queries.ts`

This task is plumbing rather than algorithmic; it has no unit tests of its own but is exercised by the refresh integration test (Task 14). Skip TDD here.

- [ ] **Step 1: Write upserts**

`lib/db/upserts.ts`:

```ts
import { sql } from "drizzle-orm";
import { db } from "./client";
import { tickets, statusHistory, extractionCache, refreshRuns } from "./schema";
import type { NewTicket, NewStatusHistoryRow } from "./schema";

export async function upsertTicket(t: NewTicket) {
  await db
    .insert(tickets)
    .values(t)
    .onConflictDoUpdate({
      target: tickets.key,
      set: {
        summary: t.summary,
        status: t.status,
        statusCategory: t.statusCategory,
        assignee: t.assignee,
        created: t.created,
        updated: t.updated,
        doneAt: t.doneAt,
        promisedEta: t.promisedEta,
        customerExpectedEta: t.customerExpectedEta,
        baselineArr: t.baselineArr,
        incrementalAcv: t.incrementalAcv,
        ceName: t.ceName,
        dbCategory: t.dbCategory,
        dbProduct: t.dbProduct,
        sfdcLink: t.sfdcLink,
        customerStage: t.customerStage,
        descriptionRaw: t.descriptionRaw,
        customer: t.customer,
        customerSource: t.customerSource,
        lastRefreshedAt: t.lastRefreshedAt,
      },
    });
}

export async function insertStatusTransitionsIfNew(rows: NewStatusHistoryRow[]) {
  if (rows.length === 0) return;
  await db.insert(statusHistory).values(rows).onConflictDoNothing();
}

export async function upsertExtractionCache(row: {
  issueKey: string;
  contentHash: string;
  customer: string;
  source: string;
  modelUsed: string | null;
  extractedAt: Date;
}) {
  await db
    .insert(extractionCache)
    .values(row)
    .onConflictDoUpdate({
      target: extractionCache.issueKey,
      set: {
        contentHash: row.contentHash,
        customer: row.customer,
        source: row.source,
        modelUsed: row.modelUsed,
        extractedAt: row.extractedAt,
      },
    });
}

export async function recordRefreshRun(row: {
  startedAt: Date;
  finishedAt: Date;
  ticketCount: number;
  newOrChanged: number;
  llmCalls: number;
  errors: number;
  errorSummary: string | null;
  trigger: string;
}) {
  await db.insert(refreshRuns).values(row);
}
```

- [ ] **Step 2: Write queries**

`lib/db/queries.ts`:

```ts
import { desc, eq, sql, count, and, isNotNull, lt } from "drizzle-orm";
import { db } from "./client";
import { tickets, statusHistory, customerOverrides, extractionCache, refreshRuns } from "./schema";

export async function getOverviewKpis() {
  const [openCount] = await db
    .select({ n: count() })
    .from(tickets)
    .where(sql`${tickets.statusCategory} <> 'done'`);

  const [arr] = await db
    .select({ total: sql<string>`COALESCE(SUM(${tickets.baselineArr}), 0)` })
    .from(tickets)
    .where(sql`${tickets.statusCategory} <> 'done'`);

  const [pastEta] = await db
    .select({ n: count() })
    .from(tickets)
    .where(
      and(
        sql`${tickets.statusCategory} <> 'done'`,
        isNotNull(tickets.promisedEta),
        lt(tickets.promisedEta, sql`CURRENT_DATE`),
      ),
    );

  const [median] = await db.execute<{ median_days: number | null }>(sql`
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (done_at - created)) / 86400
    ) AS median_days
    FROM tickets
    WHERE done_at IS NOT NULL
      AND done_at >= NOW() - INTERVAL '90 days'
  `);

  return {
    openCount: openCount?.n ?? 0,
    arrAtRisk: Number(arr?.total ?? 0),
    pastEtaCount: pastEta?.n ?? 0,
    medianClosureDays: median?.median_days ?? null,
  };
}

export async function getCustomerLeaderboard(limit = 50) {
  return db
    .select({
      customer: tickets.customer,
      n: count(),
      arr: sql<string>`COALESCE(SUM(${tickets.baselineArr}), 0)`,
    })
    .from(tickets)
    .groupBy(tickets.customer)
    .orderBy(desc(count()))
    .limit(limit);
}

export async function getTicketsByCustomer(customer: string) {
  return db.select().from(tickets).where(eq(tickets.customer, customer)).orderBy(desc(tickets.updated));
}

export async function getTicket(key: string) {
  const [t] = await db.select().from(tickets).where(eq(tickets.key, key));
  return t ?? null;
}

export async function getStatusHistory(key: string) {
  return db
    .select()
    .from(statusHistory)
    .where(eq(statusHistory.issueKey, key))
    .orderBy(statusHistory.changedAt);
}

export async function getDoneTickets(sinceDays: number) {
  return db
    .select()
    .from(tickets)
    .where(
      and(isNotNull(tickets.doneAt), sql`${tickets.doneAt} >= NOW() - (${sinceDays} || ' days')::interval`),
    )
    .orderBy(desc(tickets.doneAt));
}

export async function getNeedsReview() {
  return db
    .select()
    .from(tickets)
    .where(eq(tickets.customerSource, "unknown"))
    .orderBy(desc(tickets.updated));
}

export async function getOverride(key: string) {
  const [row] = await db.select().from(customerOverrides).where(eq(customerOverrides.issueKey, key));
  return row?.customer ?? null;
}

export async function setOverride(key: string, customer: string, note: string | null) {
  await db
    .insert(customerOverrides)
    .values({ issueKey: key, customer, note, createdAt: new Date() })
    .onConflictDoUpdate({
      target: customerOverrides.issueKey,
      set: { customer, note, createdAt: new Date() },
    });
}

export async function getCachedExtraction(key: string) {
  const [row] = await db.select().from(extractionCache).where(eq(extractionCache.issueKey, key));
  return row ?? null;
}

export async function getLastRefreshRun() {
  const [row] = await db.select().from(refreshRuns).orderBy(desc(refreshRuns.startedAt)).limit(1);
  return row ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/db/upserts.ts lib/db/queries.ts
git commit -m "feat(db): upsert helpers and read queries"
```

---

## Task 14: Refresh orchestrator with integration test

**Files:**
- Create: `lib/refresh.ts`, `tests/refresh.test.ts`

The integration test mocks Jira (MSW), the LLM, and the DB layer (via dependency injection on `lib/refresh.ts`). The pipeline itself is pure orchestration.

- [ ] **Step 1: Write the failing test**

`tests/refresh.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import fixture from "./fixtures/jira-search.json";
import { runRefresh } from "@/lib/refresh";

const server = setupServer(
  http.get("https://example.atlassian.net/rest/api/3/search/jql", () =>
    HttpResponse.json(fixture),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const baseDeps = () => {
  const upsertTicket = vi.fn().mockResolvedValue(undefined);
  const insertStatusTransitionsIfNew = vi.fn().mockResolvedValue(undefined);
  const upsertExtractionCache = vi.fn().mockResolvedValue(undefined);
  const recordRefreshRun = vi.fn().mockResolvedValue(undefined);
  const getOverride = vi.fn().mockResolvedValue(null);
  const getCachedExtraction = vi.fn().mockResolvedValue(null);
  const llm = vi.fn();
  const categoryOf = (status: string) =>
    status === "Done" ? "done" : status === "In Progress" ? "indeterminate" : "new";
  return {
    upsertTicket,
    insertStatusTransitionsIfNew,
    upsertExtractionCache,
    recordRefreshRun,
    getOverride,
    getCachedExtraction,
    llm,
    categoryOf,
  };
};

describe("runRefresh", () => {
  it("processes fixture issues and records counts", async () => {
    vi.stubEnv("JIRA_BASE_URL", "https://example.atlassian.net");
    vi.stubEnv("JIRA_EMAIL", "x@x");
    vi.stubEnv("JIRA_API_TOKEN", "t");
    vi.stubEnv("JIRA_REPORTER_ACCOUNT_ID", "5efb524c3404690bae83acd1");
    vi.stubEnv("JIRA_PROJECT_KEY", "TM");

    const deps = baseDeps();
    const result = await runRefresh({ trigger: "manual", maxLlmCalls: 10, deps });
    expect(result.ticketCount).toBe(2);
    expect(result.errors).toBe(0);
    expect(deps.upsertTicket).toHaveBeenCalledTimes(2);
    // Both fixture tickets have [DB][CUSTOMER] titles → regex_title, so LLM is never called
    expect(deps.llm).not.toHaveBeenCalled();
  });

  it("falls back to LLM when regex fails and respects budget", async () => {
    vi.stubEnv("JIRA_BASE_URL", "https://example.atlassian.net");
    vi.stubEnv("JIRA_EMAIL", "x@x");
    vi.stubEnv("JIRA_API_TOKEN", "t");
    vi.stubEnv("JIRA_REPORTER_ACCOUNT_ID", "5efb524c3404690bae83acd1");
    vi.stubEnv("JIRA_PROJECT_KEY", "TM");

    server.use(
      http.get("https://example.atlassian.net/rest/api/3/search/jql", () =>
        HttpResponse.json({
          issues: [
            {
              key: "TM-1",
              fields: {
                summary: "no prefix",
                status: { name: "New", statusCategory: { key: "new" } },
                assignee: null,
                created: "2026-01-01T00:00:00Z",
                updated: "2026-01-01T00:00:00Z",
                description: "no opportunity",
              },
              changelog: { histories: [] },
            },
          ],
          isLast: true,
        }),
      ),
    );

    const deps = baseDeps();
    deps.llm.mockResolvedValue({ customer: "Mystery Co", modelUsed: "gemini-3.1-flash-lite" });
    const result = await runRefresh({ trigger: "cron", maxLlmCalls: 10, deps });
    expect(deps.llm).toHaveBeenCalledOnce();
    expect(result.llmCalls).toBe(1);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npm test -- tests/refresh.test.ts
```

- [ ] **Step 3: Implement**

`lib/refresh.ts`:

```ts
import { fetchAllDealblockerIssues } from "./jira/client";
import { extractStatusTransitions } from "./jira/changelog";
import { deriveDoneAt } from "./status";
import { resolveCustomer, contentHash, type CacheEntry } from "./extract/orchestrator";
import type { ExtractInput, ExtractResult } from "./llm/gemini";

export interface RefreshDeps {
  upsertTicket: (t: any) => Promise<void>;
  insertStatusTransitionsIfNew: (rows: any[]) => Promise<void>;
  upsertExtractionCache: (row: any) => Promise<void>;
  recordRefreshRun: (row: any) => Promise<void>;
  getOverride: (key: string) => Promise<string | null>;
  getCachedExtraction: (key: string) => Promise<{
    contentHash: string;
    customer: string;
    source: string;
  } | null>;
  llm: (input: ExtractInput) => Promise<ExtractResult | null>;
  categoryOf: (status: string) => string;
}

export interface RefreshResult {
  ticketCount: number;
  newOrChanged: number;
  llmCalls: number;
  errors: number;
}

export interface RefreshOptions {
  trigger: "cron" | "manual";
  maxLlmCalls: number;
  deps: RefreshDeps;
}

export async function runRefresh(opts: RefreshOptions): Promise<RefreshResult> {
  const startedAt = new Date();
  const { deps } = opts;
  let llmCalls = 0;
  let errors = 0;
  let newOrChanged = 0;
  const errorMessages: string[] = [];

  const issues = await fetchAllDealblockerIssues();

  for (const issue of issues) {
    try {
      const transitions = extractStatusTransitions(issue.key, issue.rawChangelog).map((t) => ({
        ...t,
        toCategory: deps.categoryOf(t.toStatus),
      }));
      const doneAt = deriveDoneAt(
        transitions.map((t) => ({ toStatus: t.toStatus, changedAt: t.changedAt })),
        deps.categoryOf,
      );

      const override = await deps.getOverride(issue.key);
      const cache = await deps.getCachedExtraction(issue.key);
      const hash = contentHash(issue.summary, issue.description);
      const cacheEntry: CacheEntry | null =
        cache && (cache.source === "regex_title" || cache.source === "regex_desc" || cache.source === "llm")
          ? { customer: cache.customer, source: cache.source, contentHash: cache.contentHash }
          : null;

      const llmBudgetExhausted = llmCalls >= opts.maxLlmCalls;
      const wrappedLlm = async (input: ExtractInput): Promise<ExtractResult | null> => {
        llmCalls += 1;
        return deps.llm(input);
      };

      const resolved = await resolveCustomer({
        title: issue.summary,
        description: issue.description,
        override,
        cache: cacheEntry,
        currentHash: hash,
        llm: wrappedLlm,
        llmBudgetExhausted,
      });

      await deps.upsertTicket({
        key: issue.key,
        summary: issue.summary,
        status: issue.status,
        statusCategory: issue.statusCategory,
        assignee: issue.assignee,
        created: new Date(issue.created),
        updated: new Date(issue.updated),
        doneAt: doneAt ? new Date(doneAt) : null,
        promisedEta: issue.promisedEta,
        customerExpectedEta: issue.customerExpectedEta,
        baselineArr: issue.baselineArr,
        incrementalAcv: issue.incrementalAcv,
        ceName: issue.ceName,
        dbCategory: issue.dbCategory,
        dbProduct: issue.dbProduct,
        sfdcLink: issue.sfdcLink,
        customerStage: issue.customerStage,
        descriptionRaw: issue.description,
        customer: resolved.customer,
        customerSource: resolved.source,
        lastRefreshedAt: startedAt,
      });

      if (transitions.length > 0) {
        await deps.insertStatusTransitionsIfNew(transitions);
      }

      if (resolved.source !== "override" && resolved.source !== "unknown") {
        await deps.upsertExtractionCache({
          issueKey: issue.key,
          contentHash: hash,
          customer: resolved.customer,
          source: resolved.source,
          modelUsed: resolved.modelUsed,
          extractedAt: startedAt,
        });
      }

      newOrChanged += 1;
    } catch (err) {
      errors += 1;
      errorMessages.push(`${issue.key}: ${(err as Error).message}`);
    }
  }

  await deps.recordRefreshRun({
    startedAt,
    finishedAt: new Date(),
    ticketCount: issues.length,
    newOrChanged,
    llmCalls,
    errors,
    errorSummary: errorMessages.join("; ") || null,
    trigger: opts.trigger,
  });

  return { ticketCount: issues.length, newOrChanged, llmCalls, errors };
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- tests/refresh.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/refresh.ts tests/refresh.test.ts
git commit -m "feat(refresh): orchestrator pipeline with DI for testability"
```

---

## Task 15: Status category resolver

**Files:**
- Create: `lib/jira/category.ts`, `tests/jira/category.test.ts`

Real Jira tells us the category per status via the issue payload, but only for the *current* status. Historical transitions only carry the status name. We maintain a learned map: each refresh adds `(status → category)` entries from current issues. `categoryOf` reads from this map; unknown statuses default to `indeterminate`.

- [ ] **Step 1: Write the failing test**

`tests/jira/category.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCategoryMap, makeCategoryOf } from "@/lib/jira/category";

describe("buildCategoryMap", () => {
  it("maps each status to its category", () => {
    const m = buildCategoryMap([
      { status: "Done", statusCategory: "done" },
      { status: "In Progress", statusCategory: "indeterminate" },
    ]);
    expect(m).toEqual({ Done: "done", "In Progress": "indeterminate" });
  });
});

describe("makeCategoryOf", () => {
  it("returns mapped category", () => {
    const fn = makeCategoryOf({ Done: "done" });
    expect(fn("Done")).toBe("done");
  });

  it("falls back to indeterminate for unknown", () => {
    const fn = makeCategoryOf({});
    expect(fn("Mystery")).toBe("indeterminate");
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
npm test -- tests/jira/category.test.ts
```

- [ ] **Step 3: Implement**

`lib/jira/category.ts`:

```ts
export function buildCategoryMap(
  issues: Array<{ status: string; statusCategory: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[i.status] = i.statusCategory;
  return out;
}

export function makeCategoryOf(map: Record<string, string>) {
  return (status: string): string => map[status] ?? "indeterminate";
}
```

- [ ] **Step 4: Wire into refresh.ts**

Modify `lib/refresh.ts` so that before the loop, it builds the category map from the fetched issues and uses `makeCategoryOf` to override the placeholder `deps.categoryOf` for transitions whose status isn't in the current snapshot. Update the test stubs accordingly.

Replace the relevant section in `lib/refresh.ts`:

```ts
import { buildCategoryMap, makeCategoryOf } from "./jira/category";

// ...inside runRefresh, after `const issues = ...`
const learnedMap = buildCategoryMap(
  issues.map((i) => ({ status: i.status, statusCategory: i.statusCategory })),
);
const categoryOf = (status: string) =>
  learnedMap[status] ?? deps.categoryOf(status);
```

Then replace usages of `deps.categoryOf(...)` inside the loop with `categoryOf(...)`.

- [ ] **Step 5: Re-run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lib/jira/category.ts tests/jira/category.test.ts lib/refresh.ts
git commit -m "feat(jira): learned status→category map for changelog transitions"
```

---

## Task 16: API route `/api/refresh`

**Files:**
- Create: `app/api/refresh/route.ts`

- [ ] **Step 1: Write the route**

`app/api/refresh/route.ts`:

```ts
import { NextResponse } from "next/server";
import { runRefresh } from "@/lib/refresh";
import {
  upsertTicket,
  insertStatusTransitionsIfNew,
  upsertExtractionCache,
  recordRefreshRun,
} from "@/lib/db/upserts";
import { getOverride, getCachedExtraction } from "@/lib/db/queries";
import { extractCustomerWithLLM } from "@/lib/llm/gemini";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const trigger = url.searchParams.get("trigger") === "manual" ? "manual" : "cron";
  if (trigger === "cron" && !authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runRefresh({
    trigger,
    maxLlmCalls: 10,
    deps: {
      upsertTicket,
      insertStatusTransitionsIfNew,
      upsertExtractionCache,
      recordRefreshRun,
      getOverride,
      getCachedExtraction: async (key: string) => {
        const row = await getCachedExtraction(key);
        if (!row) return null;
        return { contentHash: row.contentHash, customer: row.customer, source: row.source };
      },
      llm: extractCustomerWithLLM,
      categoryOf: () => "indeterminate", // overridden by learned map inside runRefresh
    },
  });

  return NextResponse.json(result);
}

export async function GET(req: Request) {
  // Vercel Cron uses GET. Forward to POST handler.
  return POST(req);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/refresh/route.ts
git commit -m "feat(api): /api/refresh route wiring DB, Jira, and LLM"
```

---

## Task 17: shadcn/ui setup and base layout

**Files:**
- Create: `components.json` (via shadcn init), `components/ui/*` (via shadcn add)
- Modify: `app/layout.tsx`, `app/globals.css`

- [ ] **Step 1: Initialize shadcn**

```bash
npx shadcn@latest init -d
```

When prompted, choose: TypeScript yes, base color slate, CSS variables yes.

- [ ] **Step 2: Add components used by the dashboard**

```bash
npx shadcn@latest add button card table badge separator skeleton
```

- [ ] **Step 3: Update root layout**

`app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dealblocker Dashboard",
  description: "BrowserStack TM dealblocker triage view",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <header className="mb-8 flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Dealblocker Dashboard</h1>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <a href="/" className="hover:text-foreground">Overview</a>
              <a href="/customers" className="hover:text-foreground">Customers</a>
              <a href="/closures" className="hover:text-foreground">Closures</a>
              <a href="/admin/needs-review" className="hover:text-foreground">Needs review</a>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components.json components/ app/layout.tsx app/globals.css package.json package-lock.json
git commit -m "chore(ui): shadcn setup and base layout"
```

---

## Task 18: Format helpers

**Files:**
- Create: `lib/format.ts`

- [ ] **Step 1: Write helpers**

`lib/format.ts`:

```ts
const TZ = process.env.TIMEZONE ?? "Asia/Kolkata";

export function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function fmtCurrency(n: number | string | null): string {
  if (n == null) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}

export function isPastEta(eta: string | null, statusCategory: string): boolean {
  if (!eta || statusCategory === "done") return false;
  return new Date(eta) < new Date();
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/format.ts
git commit -m "feat: date/currency/days formatting helpers"
```

---

## Task 19: Refresh button component

**Files:**
- Create: `components/refresh-button.tsx`

- [ ] **Step 1: Write the component**

`components/refresh-button.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/refresh?trigger=manual", { method: "POST" });
        if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
        router.refresh();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Button onClick={onClick} disabled={pending}>
        {pending ? "Refreshing…" : "Refresh now"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/refresh-button.tsx
git commit -m "feat(ui): refresh-now button"
```

---

## Task 20: Overview page

**Files:**
- Create: `app/(dashboard)/page.tsx`, `components/kpi-card.tsx`

- [ ] **Step 1: KPI card component**

`components/kpi-card.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Overview page**

`app/(dashboard)/page.tsx`:

```tsx
import { getOverviewKpis, getCustomerLeaderboard, getLastRefreshRun, getNeedsReview } from "@/lib/db/queries";
import { KpiCard } from "@/components/kpi-card";
import { RefreshButton } from "@/components/refresh-button";
import { fmtCurrency, fmtDate } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [kpis, leaderboard, lastRun, needsReview] = await Promise.all([
    getOverviewKpis(),
    getCustomerLeaderboard(15),
    getLastRefreshRun(),
    getNeedsReview(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {lastRun
            ? `Last refresh: ${fmtDate(lastRun.startedAt)} • ${lastRun.ticketCount ?? 0} tickets`
            : "No refresh yet"}
        </div>
        <RefreshButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Open dealblockers" value={String(kpis.openCount)} />
        <KpiCard label="ARR at risk" value={fmtCurrency(kpis.arrAtRisk)} />
        <KpiCard label="Past Promised ETA" value={String(kpis.pastEtaCount)} />
        <KpiCard
          label="Median closure (90d)"
          value={kpis.medianClosureDays != null ? `${Math.round(kpis.medianClosureDays)}d` : "—"}
        />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Top customers</h2>
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Tickets</th>
                <th className="px-3 py-2">ARR</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr key={row.customer ?? "unknown"} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/customers#${encodeURIComponent(row.customer ?? "Unknown")}`}
                      className="hover:underline"
                    >
                      {row.customer ?? "Unknown"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.n}</td>
                  <td className="px-3 py-2">{fmtCurrency(row.arr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {needsReview.length > 0 && (
        <section>
          <Link href="/admin/needs-review" className="text-sm text-amber-600 hover:underline">
            {needsReview.length} ticket{needsReview.length === 1 ? "" : "s"} need customer review →
          </Link>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/page.tsx components/kpi-card.tsx
git commit -m "feat(ui): overview page with KPIs and customer leaderboard"
```

---

## Task 21: By-customer page

**Files:**
- Create: `app/(dashboard)/customers/page.tsx`

- [ ] **Step 1: Write the page**

`app/(dashboard)/customers/page.tsx`:

```tsx
import { db } from "@/lib/db/client";
import { tickets } from "@/lib/db/schema";
import { sql, desc, count } from "drizzle-orm";
import { fmtCurrency, fmtDate, isPastEta } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const grouped = await db
    .select({
      customer: tickets.customer,
      n: count(),
      arr: sql<string>`COALESCE(SUM(${tickets.baselineArr}), 0)`,
    })
    .from(tickets)
    .groupBy(tickets.customer)
    .orderBy(desc(count()), desc(sql`COALESCE(SUM(${tickets.baselineArr}), 0)`));

  const all = await db.select().from(tickets).orderBy(desc(tickets.updated));
  const byCustomer = new Map<string, typeof all>();
  for (const t of all) {
    const key = t.customer ?? "Unknown";
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key)!.push(t);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">By customer</h2>
      <div className="space-y-4">
        {grouped.map((g) => {
          const customer = g.customer ?? "Unknown";
          const rows = byCustomer.get(customer) ?? [];
          return (
            <details
              key={customer}
              id={encodeURIComponent(customer)}
              className="rounded-lg border bg-card open:shadow-sm"
            >
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3">
                <div className="font-medium">{customer}</div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{g.n} tickets</span>
                  <span>{fmtCurrency(g.arr)}</span>
                </div>
              </summary>
              <table className="w-full border-t text-sm">
                <thead className="bg-muted/30 text-left">
                  <tr>
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Summary</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Promised ETA</th>
                    <th className="px-3 py-2">ARR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.key} className="border-t">
                      <td className="px-3 py-2">
                        <Link href={`/ticket/${t.key}`} className="hover:underline">
                          {t.key}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{t.summary}</td>
                      <td className="px-3 py-2">{t.status}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            isPastEta(t.promisedEta as unknown as string | null, t.statusCategory)
                              ? "text-destructive"
                              : ""
                          }
                        >
                          {t.promisedEta ? fmtDate(t.promisedEta as unknown as string) : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2">{fmtCurrency(t.baselineArr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/customers/page.tsx
git commit -m "feat(ui): by-customer expandable list"
```

---

## Task 22: Closures page

**Files:**
- Create: `app/(dashboard)/closures/page.tsx`, `components/closure-histogram.tsx`

- [ ] **Step 1: Histogram component**

`components/closure-histogram.tsx`:

```tsx
"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ClosureHistogram({ data }: { data: Array<{ bucket: string; count: number }> }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="bucket" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Closures page**

`app/(dashboard)/closures/page.tsx`:

```tsx
import { getDoneTickets } from "@/lib/db/queries";
import { ClosureHistogram } from "@/components/closure-histogram";
import { fmtDate, daysBetween } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

const BUCKETS: Array<{ label: string; max: number }> = [
  { label: "0–7d", max: 7 },
  { label: "8–14d", max: 14 },
  { label: "15–30d", max: 30 },
  { label: "31–60d", max: 60 },
  { label: "61–120d", max: 120 },
  { label: "120d+", max: Infinity },
];

function bucketOf(days: number): string {
  for (const b of BUCKETS) if (days <= b.max) return b.label;
  return "120d+";
}

export default async function ClosuresPage({
  searchParams,
}: {
  searchParams: Promise<{ since?: string }>;
}) {
  const params = await searchParams;
  const since = Number(params.since ?? 90);
  const tickets = await getDoneTickets(since);

  const durations = tickets
    .filter((t) => t.doneAt && t.created)
    .map((t) => daysBetween(t.created, t.doneAt as Date));

  const histogram = BUCKETS.map((b) => ({
    bucket: b.label,
    count: durations.filter((d) => d <= b.max && (b === BUCKETS[0] || d > BUCKETS[BUCKETS.indexOf(b) - 1].max)).length,
  }));

  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const p90 = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : null;
  const mean = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-medium">Closure metrics</h2>
        <div className="flex gap-2 text-sm">
          {[30, 90, 365].map((d) => (
            <Link
              key={d}
              href={`?since=${d}`}
              className={`rounded border px-2 py-1 ${since === d ? "bg-muted" : ""}`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="rounded-lg border p-3">Median: <b>{median ?? "—"}d</b></div>
        <div className="rounded-lg border p-3">P90: <b>{p90 ?? "—"}d</b></div>
        <div className="rounded-lg border p-3">Mean: <b>{mean ?? "—"}d</b></div>
      </div>

      <ClosureHistogram data={histogram} />

      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left">
          <tr>
            <th className="px-3 py-2">Key</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Done</th>
            <th className="px-3 py-2">Days</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.key} className="border-t">
              <td className="px-3 py-2">
                <Link href={`/ticket/${t.key}`} className="hover:underline">{t.key}</Link>
              </td>
              <td className="px-3 py-2">{t.customer ?? "Unknown"}</td>
              <td className="px-3 py-2">{fmtDate(t.created)}</td>
              <td className="px-3 py-2">{fmtDate(t.doneAt as Date)}</td>
              <td className="px-3 py-2">{daysBetween(t.created, t.doneAt as Date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/closures/page.tsx components/closure-histogram.tsx
git commit -m "feat(ui): closures page with histogram and stats"
```

---

## Task 23: Ticket drilldown page

**Files:**
- Create: `app/(dashboard)/ticket/[key]/page.tsx`

- [ ] **Step 1: Write the page**

`app/(dashboard)/ticket/[key]/page.tsx`:

```tsx
import { getTicket, getStatusHistory } from "@/lib/db/queries";
import { fmtDate, fmtCurrency, daysBetween } from "@/lib/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const ticket = await getTicket(key);
  if (!ticket) notFound();
  const history = await getStatusHistory(key);
  const jiraUrl = `${process.env.JIRA_BASE_URL}/browse/${ticket.key}`;

  return (
    <div className="space-y-6">
      <div>
        <a href={jiraUrl} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:underline">
          {ticket.key} ↗
        </a>
        <h2 className="mt-1 text-xl font-semibold">{ticket.summary}</h2>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm md:grid-cols-3">
        <div><dt className="text-muted-foreground">Status</dt><dd>{ticket.status}</dd></div>
        <div><dt className="text-muted-foreground">Customer</dt><dd>{ticket.customer ?? "Unknown"} <span className="text-xs text-muted-foreground">({ticket.customerSource})</span></dd></div>
        <div><dt className="text-muted-foreground">Assignee</dt><dd>{ticket.assignee ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Created</dt><dd>{fmtDate(ticket.created)}</dd></div>
        <div><dt className="text-muted-foreground">Done</dt><dd>{ticket.doneAt ? fmtDate(ticket.doneAt) : "—"}</dd></div>
        <div><dt className="text-muted-foreground">Days open</dt><dd>{ticket.doneAt ? daysBetween(ticket.created, ticket.doneAt) : daysBetween(ticket.created, new Date())}</dd></div>
        <div><dt className="text-muted-foreground">Promised ETA</dt><dd>{ticket.promisedEta ? fmtDate(ticket.promisedEta as unknown as string) : "—"}</dd></div>
        <div><dt className="text-muted-foreground">Customer Expected</dt><dd>{ticket.customerExpectedEta ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Baseline ARR</dt><dd>{fmtCurrency(ticket.baselineArr)}</dd></div>
        <div><dt className="text-muted-foreground">Category</dt><dd>{ticket.dbCategory ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Product</dt><dd>{ticket.dbProduct ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">CE</dt><dd>{ticket.ceName ?? "—"}</dd></div>
      </dl>

      <section>
        <h3 className="mb-2 font-medium">Status timeline</h3>
        <ul className="space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex gap-3">
              <span className="text-muted-foreground">{fmtDate(h.changedAt)}</span>
              <span>
                <b>{h.fromStatus ?? "—"}</b> → <b>{h.toStatus}</b>
                {h.author && <span className="text-muted-foreground"> by {h.author}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/ticket
git commit -m "feat(ui): ticket drilldown with metadata and status timeline"
```

---

## Task 24: Admin needs-review page with override form

**Files:**
- Create: `app/(dashboard)/admin/needs-review/page.tsx`, `app/api/override/route.ts`

- [ ] **Step 1: Write the API route**

`app/api/override/route.ts`:

```ts
import { NextResponse } from "next/server";
import { setOverride } from "@/lib/db/queries";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.key !== "string" || typeof body.customer !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  await setOverride(body.key, body.customer.trim(), body.note ?? null);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write the page**

`app/(dashboard)/admin/needs-review/page.tsx`:

```tsx
import { getNeedsReview } from "@/lib/db/queries";
import { OverrideForm } from "@/components/override-form";

export const dynamic = "force-dynamic";

export default async function NeedsReviewPage() {
  const tickets = await getNeedsReview();
  if (tickets.length === 0) {
    return <p className="text-muted-foreground">All tickets have a resolved customer. 🎉</p>;
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Tickets needing customer review</h2>
      <div className="rounded-lg border divide-y">
        {tickets.map((t) => (
          <div key={t.key} className="flex items-start justify-between gap-4 p-4">
            <div>
              <div className="text-sm font-medium">{t.key}</div>
              <div className="text-sm text-muted-foreground">{t.summary}</div>
            </div>
            <OverrideForm issueKey={t.key} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Override form component**

`components/override-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function OverrideForm({ issueKey }: { issueKey: string }) {
  const [customer, setCustomer] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    if (!customer.trim()) return;
    startTransition(async () => {
      await fetch("/api/override", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: issueKey, customer }),
      });
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={customer}
        onChange={(e) => setCustomer(e.target.value)}
        placeholder="Customer name"
        className="rounded border px-2 py-1 text-sm"
      />
      <Button size="sm" onClick={submit} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/admin app/api/override components/override-form.tsx
git commit -m "feat(ui): needs-review admin page and customer override form"
```

---

## Task 25: Vercel cron and deploy config

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Write `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/refresh",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "chore(vercel): cron schedule for /api/refresh every 30 minutes"
```

---

## Task 26: Final test sweep and typecheck

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors. If errors surface, fix them before proceeding.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: successful production build.

- [ ] **Step 4: Commit any incidental fixes**

```bash
git add -A
git diff --cached --quiet || git commit -m "chore: clean up types and lint warnings"
```

---

## Task 27: Manual deploy steps (cannot be automated by an agent)

These are not coded; flag them to the user as next steps after the plan executes.

- [ ] Push the repo to GitHub.
- [ ] Create a Vercel project pointing at the repo (Hobby plan).
- [ ] In **Storage** → create a Postgres database; Vercel auto-injects `POSTGRES_URL`.
- [ ] In **Settings → Environment Variables**, add: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_REPORTER_ACCOUNT_ID`, `JIRA_PROJECT_KEY`, `GEMINI_API_KEY`, `CRON_SECRET`, `TIMEZONE`.
- [ ] In **Settings → Deployment Protection**, enable Password Protection and set a shared password.
- [ ] Trigger first deployment.
- [ ] In Vercel CLI or dashboard, run `npm run db:push` against the production DB to create tables (or run the generated SQL via the Postgres console).
- [ ] Hit `POST /api/refresh?trigger=manual` once via the dashboard's Refresh button to populate the DB.
- [ ] Verify cron is firing in Vercel's Cron tab.
- [ ] Share the dashboard URL + password with the director.
