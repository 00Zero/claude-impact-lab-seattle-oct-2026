"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/auth/actions";
import {
  fieldErrorClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
} from "@/app/ui/form-styles";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={labelClassName}>
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClassName}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirmPassword" className={labelClassName}>
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
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
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
