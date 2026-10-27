"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import {
  fieldErrorClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  statusClassName,
} from "@/app/ui/form-styles";

export function ForgotPasswordForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, {
    error: initialError,
  });

  if (state.message) {
    return (
      <p role="status" className={statusClassName}>
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={labelClassName}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className={inputClassName}
        />
      </div>
      {state.error ? (
        <p role="alert" className={fieldErrorClassName}>
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClassName}
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
