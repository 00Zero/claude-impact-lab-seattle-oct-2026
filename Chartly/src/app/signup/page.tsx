import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { AuthForm } from "@/app/auth/auth-form";
import { AuthShell } from "@/app/auth/auth-shell";
import { textLinkClassName } from "@/app/ui/form-styles";

export default function SignupPage() {
  return (
    <AuthShell
      title="Start free"
      intro="Create your account, then set up your shop in about a minute."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className={textLinkClassName}>
            Log in
          </Link>
        </p>
      }
    >
      <AuthForm
        action={signup}
        submitLabel="Create account"
        pendingLabel="Creating account…"
        passwordAutoComplete="new-password"
      />
    </AuthShell>
  );
}
