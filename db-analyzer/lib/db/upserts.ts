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
