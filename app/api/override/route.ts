import { NextResponse } from "next/server";
import { setOverride } from "@/lib/db/queries";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.key !== "string" || typeof body.customer !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  await setOverride(body.key, body.customer.trim(), body.note ?? null);
  return NextResponse.json({ ok: true });
}
