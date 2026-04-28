import { NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE, expectedToken } from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const submitted = body?.password;
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "auth not configured" }, { status: 500 });
  }
  if (typeof submitted !== "string" || submitted !== expected) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }
  const token = await expectedToken(expected);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
