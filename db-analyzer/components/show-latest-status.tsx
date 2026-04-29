"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ExternalLink, MessageSquare, Loader2 } from "lucide-react";

interface SummaryResponse {
  summary: string;
  lastActivity: string;
  nextAction: string;
  customerImpactNote: string;
  modelUsed: string;
  commentCount: number;
  linkedCount: number;
  slackUrls: string[];
  linkedIssues: Array<{ key: string; summary: string; relationship: string }>;
}

export function ShowLatestStatus({ ticketKey }: { ticketKey: string }) {
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    setData(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/ticket/${encodeURIComponent(ticketKey)}/summary`, {
          method: "POST",
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error ?? `Failed (${res.status})`);
        }
        setData(await res.json());
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Latest status</h3>
        <Button onClick={onClick} disabled={pending} className="gap-2 bg-violet-600 hover:bg-violet-700">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {pending ? "Summarising…" : data ? "Re-summarise" : "Show latest status"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {data && (
        <div className="space-y-3 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50 p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Summary</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">{data.summary}</p>
          </div>

          {data.lastActivity && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Last activity</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">{data.lastActivity}</p>
            </div>
          )}

          {data.nextAction && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Next action</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">{data.nextAction}</p>
            </div>
          )}

          {data.customerImpactNote && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Customer comms</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-800">{data.customerImpactNote}</p>
            </div>
          )}

          {(data.slackUrls.length > 0 || data.linkedIssues.length > 0) && (
            <div className="border-t border-violet-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Relevant links</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.slackUrls.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Slack {data.slackUrls.length > 1 ? i + 1 : "thread"}
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                ))}
                {data.linkedIssues.map((l) => (
                  <span
                    key={l.key}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                    title={l.summary}
                  >
                    <span className="text-slate-400">{l.relationship}</span>
                    <span className="font-mono">{l.key}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="border-t border-violet-200 pt-2 text-[11px] text-slate-500">
            Generated from {data.commentCount} comments and {data.linkedCount} linked issues via {data.modelUsed}. Always verify against Jira before sending external comms.
          </p>
        </div>
      )}
    </section>
  );
}
