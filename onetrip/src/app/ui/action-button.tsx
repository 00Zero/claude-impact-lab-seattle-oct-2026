"use client";

import { useState, useTransition } from "react";
import { primaryButtonClassName, secondaryButtonClassName } from "@/app/ui/form-styles";

// A small button that runs a server action and shows its error.
export function ActionButton({
  action,
  label,
  pendingLabel,
  confirm,
  variant = "secondary",
}: {
  action: () => Promise<{ error?: string }>;
  label: string;
  pendingLabel: string;
  confirm?: string;
  variant?: "primary" | "secondary" | "link";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const className =
    variant === "link"
      ? "text-sm font-bold text-accent-strong underline disabled:opacity-40"
      : variant === "primary"
        ? primaryButtonClassName
        : secondaryButtonClassName;
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            setError(null);
            const result = await action();
            if (result.error) setError(result.error);
          });
        }}
        className={className}
      >
        {pending ? pendingLabel : label}
      </button>
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
