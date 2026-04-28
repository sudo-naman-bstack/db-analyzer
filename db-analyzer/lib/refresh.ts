import { fetchAllDealblockerIssues } from "./jira/client";
import { extractStatusTransitions } from "./jira/changelog";
import { deriveDoneAt } from "./status";
import { resolveCustomer, contentHash, type CacheEntry } from "./extract/orchestrator";
import type { ExtractInput, ExtractResult } from "./llm/gemini";
import { buildCategoryMap, makeCategoryOf } from "./jira/category";

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

  const learnedMap = buildCategoryMap(
    issues.map((i) => ({ status: i.status, statusCategory: i.statusCategory })),
  );
  const categoryOf = (status: string) => {
    const learned = learnedMap[status];
    if (learned) return learned;
    return deps.categoryOf(status);
  };

  for (const issue of issues) {
    try {
      const transitions = extractStatusTransitions(issue.key, issue.rawChangelog).map((t) => ({
        ...t,
        toCategory: categoryOf(t.toStatus),
      }));
      const doneAt = deriveDoneAt(
        transitions.map((t) => ({ toStatus: t.toStatus, changedAt: t.changedAt })),
        categoryOf,
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
