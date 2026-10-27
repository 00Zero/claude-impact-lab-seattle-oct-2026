"use client";

import { useActionState } from "react";
import {
  fieldErrorClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  statusClassName,
} from "@/app/ui/form-styles";
import { changePassword, type ProfileFormState } from "../actions";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    changePassword,
    {},
  );

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="currentPassword" className={labelClassName}>
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={inputClassName}
        />
      </div>
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
      {state.message && !pending ? (
        <p role="status" className={statusClassName}>
          {state.message}
        </p>
      ) : null}
      <div>
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
