"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({ children, pendingLabel, disabled = false }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-5 py-3.5 text-sm font-semibold text-ink shadow-sm transition hover:border-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
