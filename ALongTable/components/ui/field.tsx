import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import type { ComponentProps, ReactNode } from "react";

export function TextField({
  label,
  hint,
  multiline,
  ...inputProps
}: {
  label: string;
  hint?: string;
  multiline?: boolean;
} & Omit<ComponentProps<typeof Input>, "className">) {
  return (
    <Field.Root name={inputProps.name} className="alt-field">
      <Field.Label className="alt-label">{label}</Field.Label>
      {multiline ? (
        <Field.Control render={<textarea rows={3} className="alt-input" />} {...(inputProps as object)} />
      ) : (
        <Field.Control className="alt-input" {...inputProps} />
      )}
      {hint && <Field.Description className="alt-help">{hint}</Field.Description>}
      <Field.Error className="alt-error" />
    </Field.Root>
  );
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{children}</div>;
}
