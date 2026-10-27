"use client";

import { useActionState } from "react";
import {
  fieldErrorClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  statusClassName,
} from "@/app/ui/form-styles";
import type { AuthFormState } from "./actions";

type AuthFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  pendingLabel: string;
  passwordAutoComplete: "current-password" | "new-password";
  initialError?: string;
};

export function AuthForm({
  action,
  submitLabel,
  pendingLabel,
  passwordAutoComplete,
  initialError,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClassName}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={passwordAutoComplete}
          required
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
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
