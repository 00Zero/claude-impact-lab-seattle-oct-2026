"use client";

import { useActionState, useState } from "react";
import {
  fieldErrorClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  statusClassName,
} from "@/app/ui/form-styles";
import { CURRENCIES } from "@/lib/money";
import { TRADE_OTHER_MAX_LENGTH, TRADES } from "@/lib/trades";
import {
  LINK_EXPIRY_DAYS,
  PHOTO_RETENTION_OPTIONS,
} from "@/lib/workspace-schema";
import {
  updateBusinessSettings,
  type BusinessField,
  type BusinessFormState,
} from "../actions";

type BusinessFormProps = {
  canManage: boolean;
  timeZones: string[];
  initial: Record<BusinessField, string>;
};

export function BusinessForm({ canManage, timeZones, initial }: BusinessFormProps) {
  const [state, formAction, pending] = useActionState<
    BusinessFormState,
    FormData
  >(updateBusinessSettings, {});
  const values = { ...initial, ...state.values };
  const [trade, setTrade] = useState(values.trade);

  const fieldError = (field: BusinessField) =>
    state.fieldErrors?.[field] ? (
      <p id={`${field}-error`} className={fieldErrorClassName}>
        {state.fieldErrors[field]}
      </p>
    ) : null;
  const fieldProps = (field: BusinessField) => ({
    id: field,
    name: field,
    "aria-invalid": Boolean(state.fieldErrors?.[field]),
    "aria-describedby": state.fieldErrors?.[field] ? `${field}-error` : undefined,
  });

  return (
    <form action={formAction} noValidate>
      {/* Disabled for members; the server enforces it too. */}
      <fieldset disabled={!canManage} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={labelClassName}>
            Business name
          </label>
          <input
            {...fieldProps("name")}
            type="text"
            autoComplete="organization"
            required
            maxLength={120}
            defaultValue={values.name}
            className={inputClassName}
          />
          {fieldError("name")}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="trade" className={labelClassName}>
            Trade
          </label>
          <select
            {...fieldProps("trade")}
            required
            defaultValue={values.trade}
            onChange={(event) => setTrade(event.target.value)}
            className={inputClassName}
          >
            {TRADES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldError("trade")}
        </div>

        {trade === "other" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tradeOther" className={labelClassName}>
              Your trade
            </label>
            <input
              {...fieldProps("tradeOther")}
              type="text"
              required
              maxLength={TRADE_OTHER_MAX_LENGTH}
              placeholder="e.g. Chimney sweeping"
              defaultValue={values.tradeOther}
              className={inputClassName}
            />
            {fieldError("tradeOther")}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="contactEmail" className={labelClassName}>
            Business email
          </label>
          <input
            {...fieldProps("contactEmail")}
            type="email"
            autoComplete="email"
            required
            defaultValue={values.contactEmail}
            className={inputClassName}
          />
          {fieldError("contactEmail")}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="contactPhone" className={labelClassName}>
            Business phone{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            {...fieldProps("contactPhone")}
            type="tel"
            autoComplete="tel"
            maxLength={40}
            defaultValue={values.contactPhone}
            className={inputClassName}
          />
          {fieldError("contactPhone")}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="timezone" className={labelClassName}>
            Timezone
          </label>
          <select
            {...fieldProps("timezone")}
            required
            defaultValue={values.timezone}
            className={inputClassName}
          >
            {timeZones.map((timeZone) => (
              <option key={timeZone} value={timeZone}>
                {timeZone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          {fieldError("timezone")}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="linkExpiryDays" className={labelClassName}>
            Intake links expire after (days)
          </label>
          <input
            {...fieldProps("linkExpiryDays")}
            type="number"
            inputMode="numeric"
            required
            min={LINK_EXPIRY_DAYS.min}
            max={LINK_EXPIRY_DAYS.max}
            defaultValue={values.linkExpiryDays}
            className={`${inputClassName} w-28`}
          />
          <p className="text-sm text-muted">
            Between {LINK_EXPIRY_DAYS.min} and {LINK_EXPIRY_DAYS.max} days.
            Applies to links created from now on.
          </p>
          {fieldError("linkExpiryDays")}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="photoRetentionDays" className={labelClassName}>
            Keep customer photos for
          </label>
          <select
            {...fieldProps("photoRetentionDays")}
            required
            defaultValue={values.photoRetentionDays}
            className={`${inputClassName} w-40`}
          >
            {PHOTO_RETENTION_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days === 365 ? "1 year" : `${days} days`}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted">
            Your preference is saved, but photos aren&apos;t deleted
            automatically yet. Until then, delete a request to remove its
            photos.
          </p>
          {fieldError("photoRetentionDays")}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="estimatesEnabled"
              defaultChecked={values.estimatesEnabled === "on"}
              className="mt-1 size-5 accent-accent-strong"
            />
            <span>
              <span className="block text-[15px] font-bold">Prepare estimates</span>
              <span className="block text-sm text-muted">
                After a customer sends their photos, AI drafts a preliminary
                estimate from your price book. You review and approve it before
                the customer sees anything.
              </span>
            </span>
          </label>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="currency" className={labelClassName}>
              Currency
            </label>
            <select
              {...fieldProps("currency")}
              defaultValue={values.currency}
              className={`${inputClassName} w-32`}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
            {fieldError("currency")}
          </div>
        </div>

        {state.error ? (
          <p role="alert" className={fieldErrorClassName}>
            {state.error}
          </p>
        ) : null}
        {state.saved && !pending ? (
          <p role="status" className={statusClassName}>
            Settings saved.
          </p>
        ) : null}

        {canManage ? (
          <div>
            <button
              type="submit"
              disabled={pending}
              className={primaryButtonClassName}
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
