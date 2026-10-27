"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  fieldErrorClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
} from "@/app/ui/form-styles";
import {
  AVATAR_ACCEPT,
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_BYTES,
} from "@/lib/avatar-rules";
import { TRADE_OTHER_MAX_LENGTH, TRADES } from "@/lib/trades";
import {
  createWorkspace,
  type OnboardingField,
  type OnboardingFormState,
} from "./actions";

type OnboardingFormProps = {
  defaultEmail: string;
  timeZones: string[];
};

export function OnboardingForm({ defaultEmail, timeZones }: OnboardingFormProps) {
  const [state, formAction, pending] = useActionState<
    OnboardingFormState,
    FormData
  >(createWorkspace, {});
  const timeZoneRef = useRef<HTMLSelectElement>(null);
  const [trade, setTrade] = useState(state.values?.trade ?? TRADES[0].value);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  // undefined: show the server's avatar error, if any. null: the user has
  // changed the picture since, so hide it. string: a local error.
  const [avatarError, setAvatarError] = useState<string | null | undefined>();

  // Release the preview's object URL when it's replaced or on unmount.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // Preselect the browser's timezone. Done after hydration because the
  // server can't know it.
  useEffect(() => {
    const select = timeZoneRef.current;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (select && !select.value && timeZones.includes(detected)) {
      select.value = detected;
    }
  }, [timeZones]);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setAvatarError(null);
    if (!file) {
      setAvatarPreview(null);
      return;
    }
    if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      event.target.value = "";
      setAvatarPreview(null);
      setAvatarError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      event.target.value = "";
      setAvatarPreview(null);
      setAvatarError("Choose a picture smaller than 5 MB.");
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
  }

  function removeAvatar() {
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    setAvatarPreview(null);
    setAvatarError(null);
  }

  // Submitting manually skips React's automatic form reset, so a failed
  // submit keeps the chosen picture and every other field.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAvatarError(undefined);
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const values = state.values ?? {};
  const avatarMessage =
    avatarError === undefined ? state.fieldErrors?.avatar : avatarError;
  const fieldError = (field: OnboardingField) =>
    state.fieldErrors?.[field] ? (
      <p id={`${field}-error`} className={fieldErrorClassName}>
        {state.fieldErrors[field]}
      </p>
    ) : null;
  const describedBy = (field: OnboardingField) =>
    state.fieldErrors?.[field] ? `${field}-error` : undefined;

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <span id="avatar-label" className={labelClassName}>
          Profile picture{" "}
          <span className="font-normal text-muted">(optional)</span>
        </span>
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-chip text-muted/70">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img
                src={avatarPreview}
                alt="Selected profile picture"
                className="size-full object-cover"
              />
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-8"
                fill="currentColor"
              >
                <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2.25c-4.14 0-7.5 2.35-7.5 5.25 0 .41.34.75.75.75h13.5c.41 0 .75-.34.75-.75 0-2.9-3.36-5.25-7.5-5.25Z" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={avatarInputRef}
              id="avatar"
              name="avatar"
              type="file"
              accept={AVATAR_ACCEPT}
              onChange={handleAvatarChange}
              aria-labelledby="avatar-label avatar-button"
              aria-invalid={Boolean(avatarMessage)}
              aria-describedby={avatarMessage ? "avatar-error" : undefined}
              className="peer sr-only"
            />
            <label
              id="avatar-button"
              htmlFor="avatar"
              className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-bold peer-focus-visible:ring-2 peer-focus-visible:ring-accent-strong"
            >
              {avatarPreview ? "Change picture" : "Add picture"}
            </label>
            {avatarPreview ? (
              <button
                type="button"
                onClick={removeAvatar}
                className="min-h-10 text-sm font-bold text-accent-strong"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
        {avatarMessage ? (
          <p id="avatar-error" className={fieldErrorClassName}>
            {avatarMessage}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClassName}>
          Business name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="organization"
          required
          maxLength={120}
          defaultValue={values.name}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          aria-describedby={describedBy("name")}
          className={inputClassName}
        />
        {fieldError("name")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="trade" className={labelClassName}>
          Trade
        </label>
        <select
          id="trade"
          name="trade"
          required
          defaultValue={values.trade ?? TRADES[0].value}
          onChange={(event) => setTrade(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.trade)}
          aria-describedby={describedBy("trade")}
          className={inputClassName}
        >
          {TRADES.map((trade) => (
            <option key={trade.value} value={trade.value}>
              {trade.label}
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
            id="tradeOther"
            name="tradeOther"
            type="text"
            required
            maxLength={TRADE_OTHER_MAX_LENGTH}
            placeholder="e.g. Chimney sweeping"
            defaultValue={values.tradeOther}
            aria-invalid={Boolean(state.fieldErrors?.tradeOther)}
            aria-describedby={describedBy("tradeOther")}
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
          id="contactEmail"
          name="contactEmail"
          type="email"
          autoComplete="email"
          required
          defaultValue={values.contactEmail ?? defaultEmail}
          aria-invalid={Boolean(state.fieldErrors?.contactEmail)}
          aria-describedby={describedBy("contactEmail")}
          className={inputClassName}
        />
        {fieldError("contactEmail")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contactPhone" className={labelClassName}>
          Business phone <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          defaultValue={values.contactPhone}
          aria-invalid={Boolean(state.fieldErrors?.contactPhone)}
          aria-describedby={describedBy("contactPhone")}
          className={inputClassName}
        />
        {fieldError("contactPhone")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="timezone" className={labelClassName}>
          Timezone
        </label>
        <select
          ref={timeZoneRef}
          id="timezone"
          name="timezone"
          required
          defaultValue={values.timezone ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.timezone)}
          aria-describedby={describedBy("timezone")}
          className={inputClassName}
        >
          <option value="" disabled>
            Choose a timezone
          </option>
          {timeZones.map((timeZone) => (
            <option key={timeZone} value={timeZone}>
              {timeZone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        {fieldError("timezone")}
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-line p-4">
        <input
          type="checkbox"
          name="estimatesEnabled"
          defaultChecked={values.estimatesEnabled === "on"}
          className="mt-1 size-5 accent-accent-strong"
        />
        <span>
          <span className="block text-[15px] font-bold">Prepare estimates for me</span>
          <span className="block text-sm text-muted">
            Upload your price list or past invoices, and AI drafts a preliminary
            estimate after each customer sends their photos. You approve every
            estimate before the customer sees it. You can change this later.
          </span>
        </span>
      </label>

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
        {pending ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
