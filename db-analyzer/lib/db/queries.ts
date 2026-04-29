import { desc, eq, sql, count, and, isNotNull, lt } from "drizzle-orm";
import { db } from "./client";
import { tickets, statusHistory, customerOverrides, extractionCache, refreshRuns } from "./schema";

export async function getOverviewKpis() {
  const [openCount] = await db
    .select({ n: count() })
    .from(tickets)
    .where(sql`${tickets.statusCategory} <> 'done'`);

  // ARR exposed: each customer's ARR counted ONCE (baseline_arr is the
  // customer's overall BrowserStack ARR, repeated on every ticket).
  const arrResult = await db.execute<{ total: string | number | null }>(sql`
    WITH per_customer AS (
      SELECT customer, MAX(baseline_arr) AS arr
      FROM tickets
      WHERE status_category <> 'done'
      GROUP BY customer
    )
    SELECT COALESCE(SUM(arr), 0) AS total FROM per_customer
  `);
  const arrTotal = arrResult.rows[0]?.total ?? 0;

  // iACV at risk: per-ticket incremental ACV summed across open dealblockers.
  const [iacv] = await db
    .select({ total: sql<string>`COALESCE(SUM(${tickets.incrementalAcv}), 0)` })
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

  const medianResult = await db.execute<{ median_days: number | null }>(sql`
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (done_at - created)) / 86400
    ) AS median_days
    FROM tickets
    WHERE done_at IS NOT NULL
      AND done_at >= NOW() - INTERVAL '90 days'
  `);
  const median = medianResult.rows[0];

  return {
    openCount: openCount?.n ?? 0,
    arrExposed: Number(arrTotal),
    iacvAtRisk: Number(iacv?.total ?? 0),
    pastEtaCount: pastEta?.n ?? 0,
    medianClosureDays: median?.median_days ?? null,
  };
}

export async function getCustomerLeaderboard(limit = 50) {
  // ARR is per-customer (same value across all their tickets) — use MAX.
  // iACV is per-ticket — use SUM.
  return db
    .select({
      customer: tickets.customer,
      n: count(),
      arr: sql<string>`COALESCE(MAX(${tickets.baselineArr}), 0)`,
      iacv: sql<string>`COALESCE(SUM(${tickets.incrementalAcv}), 0)`,
    })
    .from(tickets)
    .groupBy(tickets.customer)
    .orderBy(desc(count()), desc(sql`COALESCE(MAX(${tickets.baselineArr}), 0)`))
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

export async function getCustomerAccordionData() {
  const grouped = await db
    .select({
      customer: tickets.customer,
      n: count(),
      openN: sql<number>`COUNT(*) FILTER (WHERE ${tickets.statusCategory} <> 'done')::int`,
      arr: sql<string>`COALESCE(MAX(${tickets.baselineArr}), 0)`,
      iacv: sql<string>`COALESCE(SUM(${tickets.incrementalAcv}), 0)`,
    })
    .from(tickets)
    .groupBy(tickets.customer)
    .orderBy(
      desc(sql`COUNT(*) FILTER (WHERE ${tickets.statusCategory} <> 'done')`),
      desc(count()),
      desc(sql`COALESCE(MAX(${tickets.baselineArr}), 0)`),
    );

  const all = await db.select().from(tickets).orderBy(desc(tickets.updated));
  const byCustomer = new Map<string, typeof all>();
  for (const t of all) {
    const key = t.customer ?? "Unknown";
    if (!byCustomer.has(key)) byCustomer.set(key, []);
    byCustomer.get(key)!.push(t);
  }
  return { grouped, byCustomer };
}

export async function getLastSuccessfulRefreshTime(): Promise<Date | null> {
  const [row] = await db
    .select({ startedAt: refreshRuns.startedAt })
    .from(refreshRuns)
    .where(eq(refreshRuns.errors, 0))
    .orderBy(desc(refreshRuns.startedAt))
    .limit(1);
  return row?.startedAt ?? null;
}

export type TicketFilter = "open" | "past-eta" | "done" | "no-eta" | "unassigned" | "stale" | "all";

export async function getTicketsByFilter(filter: TicketFilter, customer?: string) {
  const conditions: any[] = [];
  if (filter === "open") {
    conditions.push(sql`${tickets.statusCategory} <> 'done'`);
  } else if (filter === "past-eta") {
    conditions.push(
      sql`${tickets.statusCategory} <> 'done'`,
      isNotNull(tickets.promisedEta),
      lt(tickets.promisedEta, sql`CURRENT_DATE`),
    );
  } else if (filter === "done") {
    conditions.push(isNotNull(tickets.doneAt));
  } else if (filter === "no-eta") {
    conditions.push(
      sql`${tickets.statusCategory} <> 'done'`,
      sql`${tickets.promisedEta} IS NULL`,
    );
  } else if (filter === "unassigned") {
    conditions.push(
      sql`${tickets.statusCategory} <> 'done'`,
      sql`${tickets.assignee} IS NULL`,
    );
  } else if (filter === "stale") {
    conditions.push(
      sql`${tickets.statusCategory} <> 'done'`,
      sql`${tickets.updated} <= NOW() - INTERVAL '14 days'`,
    );
  }
  if (customer) {
    conditions.push(eq(tickets.customer, customer));
  }
  // Triage filters (no-eta, unassigned, past-eta, stale) sort by oldest-first
  // since age is the actionable signal. Other views show most-recently
  // updated first.
  const orderBy =
    filter === "no-eta" || filter === "unassigned" || filter === "past-eta" || filter === "stale"
      ? tickets.created
      : desc(tickets.updated);
  return db
    .select()
    .from(tickets)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy);
}

export async function getTriageCounts() {
  const [noEta] = await db
    .select({ n: count() })
    .from(tickets)
    .where(
      and(
        sql`${tickets.statusCategory} <> 'done'`,
        sql`${tickets.promisedEta} IS NULL`,
      ),
    );
  const [unassigned] = await db
    .select({ n: count() })
    .from(tickets)
    .where(
      and(
        sql`${tickets.statusCategory} <> 'done'`,
        sql`${tickets.assignee} IS NULL`,
      ),
    );
  const [stale] = await db
    .select({ n: count() })
    .from(tickets)
    .where(
      and(
        sql`${tickets.statusCategory} <> 'done'`,
        sql`${tickets.updated} <= NOW() - INTERVAL '14 days'`,
      ),
    );
  return { noEta: noEta?.n ?? 0, unassigned: unassigned?.n ?? 0, stale: stale?.n ?? 0 };
}

export async function getAgingBuckets() {
  const result = await db.execute<{
    b1: number;
    b2: number;
    b3: number;
    b4: number;
    b5: number;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE NOW() - created <= INTERVAL '7 days')::int AS b1,
      COUNT(*) FILTER (WHERE NOW() - created > INTERVAL '7 days' AND NOW() - created <= INTERVAL '14 days')::int AS b2,
      COUNT(*) FILTER (WHERE NOW() - created > INTERVAL '14 days' AND NOW() - created <= INTERVAL '30 days')::int AS b3,
      COUNT(*) FILTER (WHERE NOW() - created > INTERVAL '30 days' AND NOW() - created <= INTERVAL '60 days')::int AS b4,
      COUNT(*) FILTER (WHERE NOW() - created > INTERVAL '60 days')::int AS b5
    FROM tickets
    WHERE status_category <> 'done'
  `);
  const r = result.rows[0];
  return {
    "0-7d": Number(r?.b1 ?? 0),
    "8-14d": Number(r?.b2 ?? 0),
    "15-30d": Number(r?.b3 ?? 0),
    "31-60d": Number(r?.b4 ?? 0),
    "60d+": Number(r?.b5 ?? 0),
  };
}
