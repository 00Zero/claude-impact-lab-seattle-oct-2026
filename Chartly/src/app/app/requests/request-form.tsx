"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
} from "react";
import {
  fieldErrorClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
} from "@/app/ui/form-styles";
import {
  TRADE_OTHER_MAX_LENGTH,
  TRADES,
  tradeLabel,
  type Trade,
} from "@/lib/trades";
import type { RequestField, RequestFormState } from "./actions";

export type RequestFormValues = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceAddress: string;
  trade: Trade;
  tradeOther: string;
  issueDescription: string;
};

type RequestFormProps = {
  action: (
    state: RequestFormState,
    formData: FormData,
  ) => Promise<RequestFormState>;
  initialValues: RequestFormValues;
  // The workspace's trade, shown as a hint when creating a request.
  workspaceTrade?: { trade: Trade; tradeOther: string | null };
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
};

// Shared by "New request" and "Edit request" so both stay in sync.
export function RequestForm({
  action,
  initialValues,
  workspaceTrade,
  submitLabel,
  pendingLabel,
  cancelHref,
}: RequestFormProps) {
  const [state, formAction, pending] = useActionState<
    RequestFormState,
    FormData
  >(action, {});
  const [trade, setTrade] = useState<string>(initialValues.trade);

  // Submitting manually skips React's automatic form reset, so a failed
  // submit keeps everything the contractor typed.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const fieldError = (field: RequestField) =>
    state.fieldErrors?.[field] ? (
      <p id={`${field}-error`} className={fieldErrorClassName}>
        {state.fieldErrors[field]}
      </p>
    ) : null;
  const fieldProps = (field: RequestField) => ({
    id: field,
    name: field,
    "aria-invalid": Boolean(state.fieldErrors?.[field]),
    "aria-describedby": state.fieldErrors?.[field] ? `${field}-error` : undefined,
  });
  const optional = (
    <span className="font-normal text-muted">(optional)</span>
  );

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      autoComplete="off"
      className="flex flex-col gap-5"
      noValidate
    >
      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-base font-semibold">Customer</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customerName" className={labelClassName}>
            Name
          </label>
          <input
            {...fieldProps("customerName")}
            type="text"
            defaultValue={initialValues.customerName}
            autoComplete="off"
            required
            maxLength={120}
            className={inputClassName}
          />
          {fieldError("customerName")}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerPhone" className={labelClassName}>
              Phone {optional}
            </label>
            <input
              {...fieldProps("customerPhone")}
              type="tel"
              defaultValue={initialValues.customerPhone}
              autoComplete="off"
              maxLength={40}
              className={inputClassName}
            />
            {fieldError("customerPhone")}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="customerEmail" className={labelClassName}>
              Email {optional}
            </label>
            <input
              {...fieldProps("customerEmail")}
              type="email"
              defaultValue={initialValues.customerEmail}
              autoComplete="off"
              maxLength={254}
              className={inputClassName}
            />
            {fieldError("customerEmail")}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="serviceAddress" className={labelClassName}>
            Service address {optional}
          </label>
          <textarea
            {...fieldProps("serviceAddress")}
            defaultValue={initialValues.serviceAddress}
            rows={2}
            maxLength={300}
            className={`${inputClassName} h-auto py-2`}
          />
          {fieldError("serviceAddress")}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-base font-semibold">Job</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="trade" className={labelClassName}>
            Trade
          </label>
          {/* Controlled so browser form restoration can't override the
              initial trade. */}
          <select
            {...fieldProps("trade")}
            value={trade}
            onChange={(event) => setTrade(event.target.value)}
            autoComplete="off"
            className={inputClassName}
          >
            {TRADES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {workspaceTrade ? (
            <p className="text-sm text-muted">
              Defaults to your business&apos;s trade:{" "}
              {tradeLabel(workspaceTrade.trade, workspaceTrade.tradeOther)}.
            </p>
          ) : null}
          {fieldError("trade")}
        </div>
        {trade === "other" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tradeOther" className={labelClassName}>
              Trade name
            </label>
            <input
              {...fieldProps("tradeOther")}
              type="text"
              required
              maxLength={TRADE_OTHER_MAX_LENGTH}
              defaultValue={initialValues.tradeOther}
              className={inputClassName}
            />
            {fieldError("tradeOther")}
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="issueDescription" className={labelClassName}>
            What&apos;s the issue?
          </label>
          <textarea
            {...fieldProps("issueDescription")}
            defaultValue={initialValues.issueDescription}
            required
            rows={4}
            maxLength={2000}
            placeholder="e.g. AC running but not cooling, water under the indoor unit"
            className={`${inputClassName} h-auto py-2`}
          />
          <p className="text-sm text-muted">
            Anything you already know, so the customer isn&apos;t asked again.
          </p>
          {fieldError("issueDescription")}
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className={fieldErrorClassName}>
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className={primaryButtonClassName}
        >
          {pending ? pendingLabel : submitLabel}
        </button>
        <Link href={cancelHref} className="min-h-10 text-sm font-bold text-accent-strong">
          Cancel
        </Link>
      </div>
    </form>
  );
}
