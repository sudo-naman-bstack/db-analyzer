import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { runRefresh } from "@/lib/refresh";
import {
  upsertTicket,
  insertStatusTransitionsIfNew,
  upsertExtractionCache,
  recordRefreshRun,
} from "@/lib/db/upserts";
import { getOverride, getCachedExtraction } from "@/lib/db/queries";
import { extractCustomerWithLLM } from "@/lib/llm/gemini";
import { COOKIE_NAME, verifyAuthCookie } from "@/lib/auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function bearerAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

async function cookieAuthorized(): Promise<boolean> {
  const c = await cookies();
  return verifyAuthCookie(c.get(COOKIE_NAME)?.value);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const trigger = url.searchParams.get("trigger") === "manual" ? "manual" : "cron";

  if (trigger === "cron") {
    if (!bearerAuthorized(req)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    // manual: require either a valid session cookie OR Bearer (for external schedulers)
    if (!bearerAuthorized(req) && !(await cookieAuthorized())) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
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
