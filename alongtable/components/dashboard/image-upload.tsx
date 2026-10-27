"use client";

import Image from "next/image";
import { useActionState, useRef } from "react";
import { Camera, Info, Storefront, WarningCircle } from "@phosphor-icons/react/ssr";
import type { PhotoState } from "@/app/restaurant/photo-actions";

/**
 * A small photo with an add / change button. Picking a file uploads it right away.
 * Used for the restaurant's photo (large) and for an event's photo (small).
 */
export function ImageUpload({
  action,
  hidden,
  photoUrl,
  alt,
  addLabel,
  changeLabel,
  guidance,
  size = "lg",
}: {
  action: (prev: PhotoState, formData: FormData) => Promise<PhotoState>;
  /** An extra hidden field, such as the id of the event the photo belongs to. */
  hidden?: { name: string; value: string };
  photoUrl: string | null | undefined;
  alt: string;
  addLabel: string;
  changeLabel: string;
  /** A note shown while there is no photo yet. */
  guidance?: string;
  size?: "lg" | "sm";
}) {
  const [state, act, pending] = useActionState<PhotoState, FormData>(action, {});
  const form = useRef<HTMLFormElement>(null);
  const box = size === "lg" ? "size-20" : "size-14";

  return (
    <form ref={form} action={act} className="flex flex-col gap-3">
      {hidden && <input type="hidden" name={hidden.name} value={hidden.value} />}
      <div className="flex items-center gap-4">
        <div className={`relative ${box} shrink-0 overflow-hidden rounded-photo bg-sunken`}>
          {photoUrl ? (
            <Image src={photoUrl} alt={alt} fill sizes="80px" className="object-cover" />
          ) : (
            <Storefront size={size === "lg" ? 32 : 24} aria-hidden="true" className="absolute inset-0 m-auto text-ink-soft" />
          )}
        </div>
        <label className="alt-button cursor-pointer has-[:focus-visible]:shadow-[var(--alt-focus)]" aria-disabled={pending}>
          <Camera size={20} aria-hidden="true" />
          {pending ? "Uploading…" : photoUrl ? changeLabel : addLabel}
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={pending}
            onChange={(e) => e.currentTarget.files?.length && form.current?.requestSubmit()}
          />
        </label>
      </div>

      {guidance && !photoUrl && !state.error && (
        <p className="alt-notice alt-notice--info">
          <Info size={24} aria-hidden="true" className="alt-icon" />
          {guidance}
        </p>
      )}
      {state.error && (
        <p role="alert" className="alt-notice alt-notice--problem">
          <WarningCircle size={24} aria-hidden="true" className="alt-icon" />
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="alt-secondary">
          Photo saved.
        </p>
      )}
    </form>
  );
}
