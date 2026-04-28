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
