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
