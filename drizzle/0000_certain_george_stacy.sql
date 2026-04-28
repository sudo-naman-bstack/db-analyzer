CREATE TABLE "customer_overrides" (
	"issue_key" text PRIMARY KEY NOT NULL,
	"customer" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_cache" (
	"issue_key" text PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL,
	"customer" text NOT NULL,
	"source" text NOT NULL,
	"model_used" text,
	"extracted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"ticket_count" integer,
	"new_or_changed" integer,
	"llm_calls" integer,
	"errors" integer,
	"error_summary" text,
	"trigger" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"issue_key" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"to_category" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"author" text
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"key" text PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"status" text NOT NULL,
	"status_category" text NOT NULL,
	"assignee" text,
	"created" timestamp with time zone NOT NULL,
	"updated" timestamp with time zone NOT NULL,
	"done_at" timestamp with time zone,
	"promised_eta" date,
	"customer_expected_eta" text,
	"baseline_arr" numeric,
	"incremental_acv" numeric,
	"ce_name" text,
	"db_category" text,
	"db_product" text,
	"sfdc_link" text,
	"customer_stage" text,
	"description_raw" text,
	"customer" text,
	"customer_source" text,
	"last_refreshed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_issue_key_tickets_key_fk" FOREIGN KEY ("issue_key") REFERENCES "public"."tickets"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "status_history_uniq" ON "status_history" USING btree ("issue_key","changed_at","to_status");--> statement-breakpoint
CREATE INDEX "status_history_issue_changed_idx" ON "status_history" USING btree ("issue_key","changed_at");