import { ShieldAlert } from "lucide-react";
import { SignInButton } from "@/components/sign-in-button";

export const dynamic = "force-static";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const params = await searchParams;
  const errorCode = params.error;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
              <ShieldAlert className="h-6 w-6" />
            </span>
          </div>

          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Sign in</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Internal dashboard — BrowserStack Google account required.
            </p>
          </div>

          <SignInButton from={params.from ?? "/"} />

          {errorCode === "AccessDenied" && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              Access denied. Only @browserstack.com accounts can sign in.
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          BrowserStack · Deal Desk Engineering
        </p>
      </div>
    </div>
  );
}
