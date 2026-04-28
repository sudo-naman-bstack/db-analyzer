import { LoginForm } from "@/components/login-form";

export const dynamic = "force-static";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="mb-2 text-xl font-semibold">Sign in</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Internal dashboard. Enter the shared password.
      </p>
      <LoginForm from={params.from ?? "/"} initialError={params.error === "1"} />
    </div>
  );
}
