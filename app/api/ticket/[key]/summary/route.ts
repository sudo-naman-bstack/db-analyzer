import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchSingleIssue } from "@/lib/jira/client";
import { GoogleGenAI } from "@google/genai";
import { COOKIE_NAME, verifyAuthCookie } from "@/lib/auth";
import { MODEL_CASCADE } from "@/lib/llm/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUMMARY_PROMPT = `You are summarising a Jira dealblocker ticket for an internal customer-facing engineer. Given the ticket title, description, status, and most recent comments, produce a concise status update.

Output as JSON with this exact shape (no other text):
{
  "summary": "2-3 sentences plain-English summary of the LATEST state of this ticket. Mention the most recent activity, current blocker, and ETA if available.",
  "lastActivity": "1 sentence on what was the most recent change/comment and who did it",
  "nextAction": "1 sentence on the recommended next step",
  "customerImpactNote": "1 sentence on what to communicate to the customer right now (or empty string if no comms needed)"
}

Be factual. Don't speculate. If information is missing, say so.`;

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const c = await cookies();
  if (!(await verifyAuthCookie(c.get(COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  const issue = await fetchSingleIssue(key);
  if (!issue) {
    return NextResponse.json({ error: "ticket not found" }, { status: 404 });
  }

  const recentComments = issue.comments
    .slice(-8)
    .map((c) => `[${c.author} on ${new Date(c.createdAt).toISOString().slice(0, 10)}] ${c.body}`)
    .join("\n\n");

  const linkedSection =
    issue.linkedIssues.length > 0
      ? "\n\nLinked issues:\n" + issue.linkedIssues.map((l) => `- ${l.relationship} ${l.key}: ${l.summary}`).join("\n")
      : "";

  const userText =
    `Title: ${issue.summary}\n` +
    `Status: ${issue.status}\n` +
    `Promised ETA: ${issue.promisedEta ?? "none"}\n` +
    `CE: ${issue.ceName ?? "unknown"}\n\n` +
    `Description (truncated):\n${issue.description.slice(0, 4000)}\n\n` +
    `Recent comments:\n${recentComments || "(no comments)"}` +
    linkedSection;

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  let lastErr: unknown;
  for (const model of MODEL_CASCADE) {
    try {
      const res = await (client as any).models.generateContent({
        model,
        contents: [
          { role: "user", parts: [{ text: SUMMARY_PROMPT }] },
          { role: "user", parts: [{ text: userText }] },
        ],
        config: { temperature: 0 },
      });
      const cleaned = (res.text ?? "").replace(/```json\s*|\s*```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({
        summary: parsed.summary ?? "",
        lastActivity: parsed.lastActivity ?? "",
        nextAction: parsed.nextAction ?? "",
        customerImpactNote: parsed.customerImpactNote ?? "",
        modelUsed: model,
        commentCount: issue.comments.length,
        linkedCount: issue.linkedIssues.length,
        slackUrls: extractSlackUrlsFromIssue(issue),
        linkedIssues: issue.linkedIssues,
      });
    } catch (err) {
      lastErr = err;
      continue;
    }
  }
  return NextResponse.json(
    { error: "summary generation failed", detail: String(lastErr) },
    { status: 500 },
  );
}

function extractSlackUrlsFromIssue(issue: { description: string; comments: Array<{ body: string }> }): string[] {
  const re = /https?:\/\/[\w-]*\.?slack\.com\/[^\s<>"']+/gi;
  const urls = new Set<string>();
  for (const m of issue.description.match(re) ?? []) urls.add(m);
  for (const c of issue.comments) {
    for (const m of c.body.match(re) ?? []) urls.add(m);
  }
  return Array.from(urls);
}
