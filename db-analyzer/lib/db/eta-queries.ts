import { eq, sql } from "drizzle-orm";
import { db } from "./client";
import { etaChanges } from "./schema";

export async function getEtaTrackingData() {
  const result = await db.execute<{
    key: string;
    summary: string;
    customer: string | null;
    status: string;
    status_category: string;
    assignee: string | null;
    current_eta: string | null;
    baseline_arr: string | null;
    total_changes: number;
    changes_7d: number;
    changes_30d: number;
    changes_60d: number;
    avg_shift_days: number | null;
    last_changed_at: string | null;
    net_shift_days: number | null;
  }>(sql`
    WITH change_stats AS (
      SELECT
        e.issue_key,
        COUNT(*)::int AS total_changes,
        COUNT(*) FILTER (WHERE e.changed_at >= NOW() - INTERVAL '7 days')::int AS changes_7d,
        COUNT(*) FILTER (WHERE e.changed_at >= NOW() - INTERVAL '30 days')::int AS changes_30d,
        COUNT(*) FILTER (WHERE e.changed_at >= NOW() - INTERVAL '60 days')::int AS changes_60d,
        AVG(
          CASE WHEN e.from_eta IS NOT NULL AND e.to_eta IS NOT NULL
          THEN ABS(e.to_eta::date - e.from_eta::date)
          END
        )::numeric(10,1) AS avg_shift_days,
        MAX(e.changed_at) AS last_changed_at,
        SUM(
          CASE WHEN e.from_eta IS NOT NULL AND e.to_eta IS NOT NULL
          THEN e.to_eta::date - e.from_eta::date
          ELSE 0 END
        )::int AS net_shift_days
      FROM eta_changes e
      GROUP BY e.issue_key
    )
    SELECT
      t.key, t.summary, t.customer, t.status, t.status_category,
      t.assignee, t.promised_eta AS current_eta, t.baseline_arr,
      cs.total_changes, cs.changes_7d, cs.changes_30d, cs.changes_60d,
      cs.avg_shift_days, cs.last_changed_at::text, cs.net_shift_days
    FROM change_stats cs
    JOIN tickets t ON t.key = cs.issue_key
    WHERE t.status_category <> 'done'
    ORDER BY cs.total_changes DESC, cs.changes_7d DESC
  `);

  return result.rows.map((r) => ({
    key: r.key,
    summary: r.summary,
    customer: r.customer,
    status: r.status,
    statusCategory: r.status_category,
    assignee: r.assignee,
    currentEta: r.current_eta,
    baselineArr: r.baseline_arr,
    totalChanges: Number(r.total_changes),
    changes7d: Number(r.changes_7d),
    changes30d: Number(r.changes_30d),
    changes60d: Number(r.changes_60d),
    avgShiftDays: r.avg_shift_days != null ? Number(r.avg_shift_days) : null,
    lastChangedAt: r.last_changed_at,
    netShiftDays: r.net_shift_days != null ? Number(r.net_shift_days) : null,
  }));
}

export async function getEtaChangeSummary() {
  const result = await db.execute<{
    total_changes_7d: number;
    total_changes_30d: number;
    total_changes_60d: number;
    tickets_changed_7d: number;
    tickets_changed_30d: number;
    avg_changes_per_ticket: number | null;
    net_shift_30d: number | null;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE changed_at >= NOW() - INTERVAL '7 days')::int AS total_changes_7d,
      COUNT(*) FILTER (WHERE changed_at >= NOW() - INTERVAL '30 days')::int AS total_changes_30d,
      COUNT(*) FILTER (WHERE changed_at >= NOW() - INTERVAL '60 days')::int AS total_changes_60d,
      COUNT(DISTINCT issue_key) FILTER (WHERE changed_at >= NOW() - INTERVAL '7 days')::int AS tickets_changed_7d,
      COUNT(DISTINCT issue_key) FILTER (WHERE changed_at >= NOW() - INTERVAL '30 days')::int AS tickets_changed_30d,
      CASE WHEN COUNT(DISTINCT issue_key) > 0
        THEN (COUNT(*)::numeric / COUNT(DISTINCT issue_key))::numeric(10,1)
        ELSE NULL END AS avg_changes_per_ticket,
      SUM(
        CASE WHEN from_eta IS NOT NULL AND to_eta IS NOT NULL
          AND changed_at >= NOW() - INTERVAL '30 days'
        THEN to_eta::date - from_eta::date ELSE 0 END
      )::int AS net_shift_30d
    FROM eta_changes
  `);
  const r = result.rows[0];
  return {
    totalChanges7d: Number(r?.total_changes_7d ?? 0),
    totalChanges30d: Number(r?.total_changes_30d ?? 0),
    totalChanges60d: Number(r?.total_changes_60d ?? 0),
    ticketsChanged7d: Number(r?.tickets_changed_7d ?? 0),
    ticketsChanged30d: Number(r?.tickets_changed_30d ?? 0),
    avgChangesPerTicket: r?.avg_changes_per_ticket != null ? Number(r.avg_changes_per_ticket) : null,
    netShift30d: r?.net_shift_30d != null ? Number(r.net_shift_30d) : null,
  };
}

export async function getEtaHistoryForTicket(key: string) {
  return db
    .select()
    .from(etaChanges)
    .where(eq(etaChanges.issueKey, key))
    .orderBy(etaChanges.changedAt);
}
