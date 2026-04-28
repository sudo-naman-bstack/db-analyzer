import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyAuthCookie } from "./lib/auth";

const PUBLIC_PREFIXES = [
  "/login",
  "/api/login",
  "/api/logout",
  "/api/refresh", // self-authenticates: Bearer for cron, cookie for manual
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (await verifyAuthCookie(cookie)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
