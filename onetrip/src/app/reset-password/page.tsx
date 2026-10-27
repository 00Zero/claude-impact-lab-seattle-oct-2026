import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/app/auth/auth-shell";
import { statusClassName, textLinkClassName } from "@/app/ui/form-styles";
import { getOptionalUser } from "@/lib/auth";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      <Suspense>
        <ResetPasswordContent />
      </Suspense>
    </AuthShell>
  );
}

async function ResetPasswordContent() {
  // The emailed reset link signs the user in via /auth/confirm first.
  const user = await getOptionalUser();
  if (!user) {
    return (
      <p role="status" className={statusClassName}>
        This reset link has expired or was already used.{" "}
        <Link href="/forgot-password" className={textLinkClassName}>
          Request a new link
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <p className="text-base leading-7 text-muted">
        Resetting the password for{" "}
        <span className="font-semibold text-ink">{user.email}</span>.
      </p>
      <ResetPasswordForm />
    </>
  );
}
