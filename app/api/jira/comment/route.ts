import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { postComment } from "@/lib/jira/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_KEYS = 50;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (
    !body ||
    !Array.isArray(body.keys) ||
    body.keys.length === 0 ||
    typeof body.comment !== "string" ||
    body.comment.trim().length === 0
  ) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const keys: string[] = body.keys.slice(0, MAX_KEYS);
  const comment: string = body.comment.trim();
  const results: { key: string; ok: boolean; error?: string }[] = [];

  for (const key of keys) {
    try {
      await postComment(key, comment);
      results.push({ key, ok: true });
    } catch (err) {
      results.push({ key, ok: false, error: (err as Error).message });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({ succeeded, failed, results });
}
