import Link from "next/link";
import { Suspense } from "react";
import { login } from "@/app/auth/actions";
import { AuthForm } from "@/app/auth/auth-form";
import { AuthShell } from "@/app/auth/auth-shell";
import { textLinkClassName } from "@/app/ui/form-styles";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell
      title="Log in"
      intro="Your requests and briefs are waiting."
      footer={
        <>
          <Link href="/forgot-password" className={textLinkClassName}>
            Forgot your password?
          </Link>
          <p>
            New here?{" "}
            <Link href="/signup" className={textLinkClassName}>
              Create an account
            </Link>
          </p>
        </>
      }
    >
      <Suspense>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { error } = await searchParams;
  return (
    <AuthForm
      action={login}
      submitLabel="Log in"
      pendingLabel="Logging in…"
      passwordAutoComplete="current-password"
      initialError={
        error === "confirmation"
          ? "That confirmation link is invalid or has expired. Try logging in, or sign up again."
          : undefined
      }
    />
  );
}
