"use client";

import { useActionState, useState } from "react";
import {
  fieldErrorClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  statusClassName,
} from "@/app/ui/form-styles";
import { minorToInput } from "@/lib/money";
import {
  PRICE_CATEGORIES,
  PRICE_DOCUMENT_ACCEPT,
  PRICE_DOCUMENT_MAX_BYTES,
  PRICE_UNITS,
  type PriceCategory,
  type PriceUnit,
} from "@/lib/price-book-rules";
import {
  savePriceItem,
  uploadPriceDocument,
  type ItemFormState,
  type UploadState,
} from "./actions";

export function UploadForm() {
  const [state, formAction, pending] = useActionState<UploadState, FormData>(uploadPriceDocument, {});
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? state.error;
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="document" className={labelClassName}>
        Price list, rate sheet, or past invoices
      </label>
      <input
        id="document"
        name="document"
        type="file"
        required
        accept={PRICE_DOCUMENT_ACCEPT}
        onChange={(event) => {
          const file = event.target.files?.[0];
          setLocalError(file && file.size > PRICE_DOCUMENT_MAX_BYTES ? "Choose a file smaller than 10 MB." : null);
        }}
        className="text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-[1.5px] file:border-line file:bg-white file:px-4 file:font-bold"
      />
      <p className="text-sm text-muted">PDF, text, CSV, or a photo, up to 10 MB. For Word files, save as PDF first.</p>
      {error ? (
        <p role="alert" className={fieldErrorClassName}>
          {error}
        </p>
      ) : null}
      {state.uploaded && !pending && !error ? (
        <p role="status" className={statusClassName}>
          Uploaded {state.uploaded}. Reading it now; suggested items appear below in a minute or so.
        </p>
      ) : null}
      <button type="submit" disabled={pending || Boolean(localError)} className={`${primaryButtonClassName} self-start`}>
        {pending ? "Uploading…" : "Upload and read"}
      </button>
    </form>
  );
}

export type ItemFormValues = {
  id: string;
  name: string;
  description: string;
  category: PriceCategory;
  unit: PriceUnit;
  priceLowMinor: number | null;
  priceHighMinor: number | null;
};

// One form for adding an item, editing an item, and reviewing a suggestion.
export function ItemForm({
  initial,
  mode,
  onDone,
}: {
  initial?: ItemFormValues;
  /** "suggestion" shows Approve plus Save; others just Save. */
  mode: "new" | "edit" | "suggestion";
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(async (prev, formData) => {
    const result = await savePriceItem(prev, formData);
    if (result.saved) onDone?.();
    return result;
  }, {});
  const id = initial?.id ?? "";
  const field = (name: string) => `${name}-${id || "new"}`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={field("name")} className={labelClassName}>
            Name
          </label>
          <input id={field("name")} name="name" required maxLength={120} defaultValue={initial?.name} className={inputClassName} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={field("category")} className={labelClassName}>
            Category
          </label>
          <select id={field("category")} name="category" defaultValue={initial?.category ?? "repair"} className={inputClassName}>
            {PRICE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={field("description")} className={labelClassName}>
          Description customers see <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id={field("description")}
          name="description"
          maxLength={300}
          defaultValue={initial?.description}
          className={inputClassName}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={field("unit")} className={labelClassName}>
            Unit
          </label>
          <select id={field("unit")} name="unit" defaultValue={initial?.unit ?? "flat"} className={inputClassName}>
            {PRICE_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={field("priceLow")} className={labelClassName}>
            Price from
          </label>
          <input
            id={field("priceLow")}
            name="priceLow"
            inputMode="decimal"
            placeholder="e.g. 89"
            defaultValue={minorToInput(initial?.priceLowMinor ?? null)}
            className={inputClassName}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={field("priceHigh")} className={labelClassName}>
            Price to
          </label>
          <input
            id={field("priceHigh")}
            name="priceHigh"
            inputMode="decimal"
            placeholder="same"
            defaultValue={minorToInput(initial?.priceHighMinor ?? null)}
            className={inputClassName}
          />
        </div>
      </div>
      {state.error ? (
        <p role="alert" className={fieldErrorClassName}>
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {mode === "suggestion" ? (
          <>
            <button type="submit" name="intent" value="activate" disabled={pending} className={primaryButtonClassName}>
              {pending ? "Saving…" : "Approve"}
            </button>
            <button type="submit" name="intent" value="save" disabled={pending} className={secondaryButtonClassName}>
              Save for later
            </button>
          </>
        ) : (
          <button type="submit" name="intent" value={mode === "new" ? "activate" : "save"} disabled={pending} className={primaryButtonClassName}>
            {pending ? "Saving…" : mode === "new" ? "Add item" : "Save"}
          </button>
        )}
      </div>
    </form>
  );
}

// Toggles an inline editor for one item.
export function EditableItem({ initial, mode, children }: { initial: ItemFormValues; mode: "edit" | "suggestion"; children: React.ReactNode }) {
  const [editing, setEditing] = useState(mode === "suggestion");
  return editing ? (
    <div className="flex flex-col gap-2">
      <ItemForm initial={initial} mode={mode} onDone={() => setEditing(mode === "suggestion")} />
      {mode === "edit" ? (
        <button type="button" onClick={() => setEditing(false)} className="self-start text-sm font-bold text-muted underline">
          Cancel
        </button>
      ) : null}
    </div>
  ) : (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-sm font-bold text-accent-strong underline">
        Edit
      </button>
    </div>
  );
}
