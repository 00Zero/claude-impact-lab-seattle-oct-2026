"use client";

import { useActionState, useEffect, useState, useTransition, type ChangeEvent } from "react";
import {
  fieldErrorClassName,
  primaryButtonClassName,
  statusClassName,
} from "@/app/ui/form-styles";
import {
  AVATAR_ACCEPT,
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_BYTES,
} from "@/lib/avatar-rules";
import {
  removeProfilePicture,
  updateProfilePicture,
  type ProfileFormState,
} from "../actions";

export function ProfilePictureForm({ avatarUrl }: { avatarUrl: string | null }) {
  const [state, formAction, uploading] = useActionState<ProfileFormState, FormData>(
    updateProfilePicture,
    {},
  );
  const [removing, startRemove] = useTransition();
  const [removeState, setRemoveState] = useState<ProfileFormState>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Release the preview's object URL when it's replaced or on unmount.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setLocalError(null);
    setPreview(null);
    if (!file) return;
    if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      event.target.value = "";
      setLocalError("Use a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      event.target.value = "";
      setLocalError("Choose a picture smaller than 5 MB.");
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  function remove() {
    setRemoveState({});
    startRemove(async () => setRemoveState(await removeProfilePicture()));
  }

  const shown = preview ?? avatarUrl;
  const error = localError ?? state.error ?? removeState.error;
  const message = uploading || removing ? null : (state.message ?? removeState.message);

  return (
    <form
      action={(formData) => {
        setRemoveState({});
        formAction(formData);
        setPreview(null);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-chip text-muted/70">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview or signed URL
            <img src={shown} alt="Profile picture" className="size-full object-cover" />
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-8" fill="currentColor">
              <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2.25c-4.14 0-7.5 2.35-7.5 5.25 0 .41.34.75.75.75h13.5c.41 0 .75-.34.75-.75 0-2.9-3.36-5.25-7.5-5.25Z" />
            </svg>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="avatar"
            name="avatar"
            type="file"
            accept={AVATAR_ACCEPT}
            onChange={handleChange}
            className="peer sr-only"
          />
          <label
            htmlFor="avatar"
            className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border-[1.5px] border-line bg-white px-3 text-sm font-bold peer-focus-visible:ring-2 peer-focus-visible:ring-accent-strong"
          >
            {shown ? "Choose a new picture" : "Choose a picture"}
          </label>
          {avatarUrl && !preview ? (
            <button
              type="button"
              onClick={remove}
              disabled={removing}
              className="min-h-10 text-sm font-bold text-accent-strong disabled:opacity-40"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p role="alert" className={fieldErrorClassName}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className={statusClassName}>
          {message}
        </p>
      ) : null}
      {preview ? (
        <div>
          <button type="submit" disabled={uploading} className={primaryButtonClassName}>
            {uploading ? "Uploading…" : "Save picture"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
