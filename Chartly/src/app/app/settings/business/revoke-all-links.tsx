"use client";

import { useState, useTransition } from "react";
import { fieldErrorClassName } from "@/app/ui/form-styles";
import { revokeAllIntakeLinks } from "../actions";

export function RevokeAllLinks() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function revoke() {
    if (
      !window.confirm(
        "Revoke every active intake link? Customers who haven't finished will need a new link.",
      )
    ) {
      return;
    }
    setResult(null);
    setError(null);
    startTransition(async () => {
      const outcome = await revokeAllIntakeLinks();
      if ("error" in outcome) {
        setError(outcome.error);
      } else {
        setResult(
          outcome.revoked === 0
            ? "There were no active links to revoke."
            : `Revoked ${outcome.revoked} active ${outcome.revoked === 1 ? "link" : "links"}.`,
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border-[1.5px] border-danger/40 bg-white px-4 text-sm font-bold text-danger disabled:opacity-60"
        >
          {pending ? "Revoking…" : "Revoke all active links"}
        </button>
      </div>
      <p aria-live="polite" className="text-sm text-muted">
        {result}
      </p>
      {error ? (
        <p role="alert" className={fieldErrorClassName}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
