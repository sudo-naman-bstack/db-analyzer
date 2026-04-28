import { LoginForm } from "@/components/login-form";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-static";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
              <ShieldAlert className="h-6 w-6" />
            </span>
          </div>

          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Sign in
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Internal dashboard — enter the shared password.
            </p>
          </div>

          <LoginForm from={params.from ?? "/"} initialError={params.error === "1"} />
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          BrowserStack · Deal Desk Engineering
        </p>
      </div>
    </div>
  );
}
