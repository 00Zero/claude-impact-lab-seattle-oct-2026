"use client";

import { useFormStatus } from "react-dom";

export function SignOutButton({ className }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={`${className} disabled:cursor-wait disabled:opacity-50`} disabled={pending} aria-busy={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
