"use client";

import { Field } from "@base-ui/react/field";
import { useState } from "react";
import { Camera } from "@phosphor-icons/react/ssr";

/** An optional photo picker for a form. The file travels with the form's FormData under `name`. */
export function PhotoField({ name = "photo", label, hint }: { name?: string; label: string; hint?: string }) {
  const [file, setFile] = useState("");

  return (
    <Field.Root name={name} className="alt-field">
      <Field.Label nativeLabel={false} render={<div />} className="alt-label">
        {label}
      </Field.Label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="alt-button cursor-pointer has-[:focus-visible]:shadow-[var(--alt-focus)]">
          <Camera size={20} aria-hidden="true" />
          {file ? "Choose a different photo" : "Choose a photo"}
          <Field.Control
            render={<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" />}
            onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0]?.name ?? "")}
          />
        </label>
        {file && <span className="alt-secondary min-w-0 truncate">{file}</span>}
      </div>
      {hint && <Field.Description className="alt-help">{hint}</Field.Description>}
      <Field.Error className="alt-error" />
    </Field.Root>
  );
}
