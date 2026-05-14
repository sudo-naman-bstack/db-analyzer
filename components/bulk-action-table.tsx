"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Send, CheckSquare, Square, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EtaBadge } from "@/components/eta-badge";

type TicketRow = {
  key: string;
  summary: string;
  customer: string | null;
  status: string;
  statusCategory: string;
  assignee: string | null;
  ceName: string | null;
  created: Date | string;
  updated: Date | string;
  promisedEta: string | null;
  baselineArr: number | string | null;
};

type ActionFilter = "stale" | "no-eta";

const COMMENT_TEMPLATES: Record<ActionFilter, string> = {
  stale: "Hi — this dealblocker has not been updated recently. Could you please provide a status update and share any blockers so we can help unblock?",
  "no-eta":
    "Hi — this dealblocker does not have a Promised ETA set. Could you please review and share an expected resolution date?",
};

const ACTION_LABELS: Record<ActionFilter, string> = {
  stale: "Request Update",
  "no-eta": "Request ETA",
};

function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function fmtCurrency(n: number | string | null): string {
  if (n == null) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

type PostResult = { succeeded: number; failed: number; results: { key: string; ok: boolean; error?: string }[] };

export function BulkActionTable({
  rows,
  filter,
}: {
  rows: TicketRow[];
  filter: ActionFilter;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState(COMMENT_TEMPLATES[filter]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<PostResult | null>(null);
  const [showBar, setShowBar] = useState(false);

  const allKeys = useMemo(() => rows.map((r) => r.key), [rows]);
  const allSelected = selected.size === rows.length && rows.length > 0;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setResult(null);
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allKeys));
    }
    setResult(null);
  }

  async function send() {
    if (selected.size === 0 || !comment.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/jira/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: Array.from(selected), comment: comment.trim() }),
      });
      const data: PostResult = await res.json();
      setResult(data);
      if (data.succeeded > 0) {
        const failedKeys = new Set(data.results.filter((r) => !r.ok).map((r) => r.key));
        setSelected(failedKeys);
      }
    } catch {
      setResult({ succeeded: 0, failed: selected.size, results: [] });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative">
      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="w-10 px-3 py-3">
                  <button
                    onClick={toggleAll}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                    aria-label={allSelected ? "Deselect all" : "Select all"}
                  >
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Summary</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">CE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Age</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Promised ETA</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">ARR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((t, i) => {
                const age = daysBetween(t.created, new Date());
                const ageColor =
                  age > 60 && t.statusCategory !== "done"
                    ? "text-red-700 font-semibold"
                    : age > 30 && t.statusCategory !== "done"
                      ? "text-amber-700 font-medium"
                      : "text-slate-600";
                const isSelected = selected.has(t.key);
                const wasSuccessful = result?.results.find((r) => r.key === t.key)?.ok;

                return (
                  <tr
                    key={t.key}
                    className={`group transition-colors ${
                      isSelected
                        ? "bg-blue-50/60"
                        : wasSuccessful
                          ? "bg-green-50/40"
                          : i % 2 === 1
                            ? "bg-slate-50/40"
                            : "bg-white"
                    } hover:bg-blue-50/40`}
                  >
                    <td className="w-10 px-3 py-3">
                      <button
                        onClick={() => toggle(t.key)}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : wasSuccessful ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/ticket/${t.key}`}
                        className="font-mono text-xs font-medium text-blue-600 hover:underline"
                      >
                        {t.key}
                      </Link>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <span className="line-clamp-2 text-slate-700">{t.summary}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{t.customer ?? "Unknown"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.assignee ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{t.ceName ?? <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{fmtDate(t.created)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${ageColor}`}>{age}d</td>
                    <td className="px-4 py-3">
                      <EtaBadge
                        eta={t.promisedEta as unknown as string | null}
                        statusCategory={t.statusCategory}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                      {fmtCurrency(t.baselineArr)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating action bar */}
      {(selected.size > 0 || result) && (
        <div className="sticky bottom-4 z-10 mt-4">
          <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm">
            <div className="p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                    {selected.size} selected
                  </span>
                  {result && (
                    <span className="text-xs text-slate-500">
                      {result.succeeded > 0 && (
                        <span className="text-green-600">{result.succeeded} sent</span>
                      )}
                      {result.failed > 0 && (
                        <span className="text-red-600 ml-2">{result.failed} failed</span>
                      )}
                    </span>
                  )}
                </div>
                {!showBar && !result && (
                  <button
                    onClick={() => setShowBar(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {ACTION_LABELS[filter]}
                  </button>
                )}
              </div>

              {/* Compose area */}
              {(showBar || result) && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">
                    Comment to post on {selected.size} ticket{selected.size === 1 ? "" : "s"}:
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    disabled={sending}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setShowBar(false);
                        setResult(null);
                      }}
                      className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={send}
                      disabled={sending || selected.size === 0 || !comment.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Posting to {selected.size} ticket{selected.size === 1 ? "" : "s"}…
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          Send Comment
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
