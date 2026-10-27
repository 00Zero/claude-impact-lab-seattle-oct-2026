"use client";

import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import { Field } from "@base-ui/react/field";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { ReactNode } from "react";

export type Tile = { value: string; label: ReactNode; hint?: ReactNode };

// Surfaces, not outlines: an unselected tile is a sunken fill; the selected one is ink with white
// text (the same ink as a taken seat). Basil stays reserved for the screen's one action.
const tile =
  "flex min-h-[52px] cursor-pointer flex-col items-center justify-center rounded-control bg-sunken px-3 py-2 text-center text-base font-semibold text-ink outline-none transition-colors hover:bg-divider focus-visible:shadow-[var(--alt-focus)] data-[checked]:bg-ink data-[checked]:text-white data-[checked]:hover:bg-ink";

function Frame({
  name,
  label,
  icon,
  hint,
  children,
}: {
  name: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Field.Root name={name} className="alt-field">
      <Field.Label nativeLabel={false} render={<div />} className="alt-label flex items-center gap-2">
        {icon}
        {label}
      </Field.Label>
      {children}
      {hint && <Field.Description className="alt-help">{hint}</Field.Description>}
      <Field.Error className="alt-error" />
    </Field.Root>
  );
}

type GroupProps = {
  name: string;
  label: string;
  /** Phosphor icon shown beside the label. */
  icon?: ReactNode;
  hint?: string;
  tiles: Tile[];
  columns?: string;
};

/** Pick exactly one tile. Submits `name=value` with the form. */
export function TileSelect({
  name,
  label,
  icon,
  hint,
  tiles,
  defaultValue,
  value,
  onValueChange,
  columns = "grid-cols-2 sm:grid-cols-3",
}: GroupProps & { defaultValue?: string; value?: string; onValueChange?: (value: string) => void }) {
  return (
    <Frame name={name} label={label} icon={icon} hint={hint}>
      <RadioGroup
        name={name}
        defaultValue={defaultValue}
        value={value}
        onValueChange={onValueChange ? (v) => onValueChange(String(v)) : undefined}
        className={`grid gap-2 ${columns}`}
      >
        {tiles.map((t) => (
          <Radio.Root key={t.value} value={t.value} className={tile}>
            <span>{t.label}</span>
            {t.hint && <span className="text-sm font-normal opacity-80">{t.hint}</span>}
          </Radio.Root>
        ))}
      </RadioGroup>
    </Frame>
  );
}

/** Pick any number of tiles. Submits one `name=value` entry per selected tile. */
export function TileMultiSelect({
  name,
  label,
  icon,
  hint,
  tiles,
  defaultValue,
  columns = "grid-cols-2 sm:grid-cols-3",
}: GroupProps & { defaultValue?: string[] }) {
  return (
    <Frame name={name} label={label} icon={icon} hint={hint}>
      <CheckboxGroup defaultValue={defaultValue} className={`grid gap-2 ${columns}`}>
        {tiles.map((t) => (
          <Checkbox.Root key={t.value} name={name} value={t.value} className={tile}>
            <span>{t.label}</span>
          </Checkbox.Root>
        ))}
      </CheckboxGroup>
    </Frame>
  );
}
