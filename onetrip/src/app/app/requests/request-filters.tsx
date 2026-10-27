"use client";

import Form from "next/form";
import Link from "next/link";
import { useRef, useState } from "react";
import { inputClassName, labelClassName } from "@/app/ui/form-styles";

type Option = { value: string; label: string };

type RequestFiltersProps = {
  q: string;
  status: string;
  review: string;
  sort: string;
  statusOptions: Option[];
  reviewOptions: Option[];
  sortOptions: Option[];
  showClear: boolean;
};

// Filter state lives in the URL. Selects apply immediately; search applies
// on Enter or the Search button. Submitting drops `page`, so results
// always restart at page 1.
export function RequestFilters(props: RequestFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { q, status, review, sort } = props;

  // Controlled fields that follow the URL (e.g. after Back or "Clear")
  // without remounting, so focus isn't lost.
  const urlKey = JSON.stringify({ q, status, review, sort });
  const [syncedKey, setSyncedKey] = useState(urlKey);
  const [values, setValues] = useState({ q, status, review, sort });
  if (urlKey !== syncedKey) {
    setSyncedKey(urlKey);
    setValues({ q, status, review, sort });
  }

  function update(field: keyof typeof values, value: string, submit: boolean) {
    setValues((current) => ({ ...current, [field]: value }));
    if (submit) {
      // The DOM already holds the new value, so this submits it.
      formRef.current?.requestSubmit();
    }
  }

  const select = (
    field: "status" | "review" | "sort",
    label: string,
    options: Option[],
  ) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`filter-${field}`} className={labelClassName}>
        {label}
      </label>
      <select
        id={`filter-${field}`}
        name={field}
        value={values[field]}
        onChange={(event) => update(field, event.target.value, true)}
        className={inputClassName}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <Form
      ref={formRef}
      action="/app/requests"
      role="search"
      aria-label="Filter requests"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="filter-q" className={labelClassName}>
          Search
        </label>
        <div className="flex gap-2">
          <input
            id="filter-q"
            name="q"
            type="search"
            value={values.q}
            onChange={(event) => update("q", event.target.value, false)}
            placeholder="Customer, address, or #reference"
            maxLength={100}
            className={`${inputClassName} min-w-0 flex-1`}
          />
          <button
            type="submit"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-line bg-white px-4 text-sm font-bold"
          >
            Search
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {select("status", "Intake status", props.statusOptions)}
        {select("review", "Review", props.reviewOptions)}
        {select("sort", "Sort by", props.sortOptions)}
      </div>
      {props.showClear ? (
        <Link href="/app/requests" className="inline-flex min-h-10 items-center self-start text-sm font-bold text-accent-strong">
          Clear filters
        </Link>
      ) : null}
    </Form>
  );
}
