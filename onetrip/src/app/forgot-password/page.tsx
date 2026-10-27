import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/app/auth/auth-shell";
import { textLinkClassName } from "@/app/ui/form-styles";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage({
  searchParams,
}: PageProps<"/forgot-password">) {
  return (
    <AuthShell
      title="Reset your password"
      intro="Enter your account email and we’ll send you a reset link."
      footer={
        <p>
          Remembered it?{" "}
          <Link href="/login" className={textLinkClassName}>
            Back to log in
          </Link>
        </p>
      }
    >
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Form({
  searchParams,
}: {
  searchParams: PageProps<"/forgot-password">["searchParams"];
}) {
  const { error } = await searchParams;
  return (
    <ForgotPasswordForm
      initialError={
        error === "expired"
          ? "That reset link is invalid or has expired. Request a new one."
          : undefined
      }
    />
  );
}
