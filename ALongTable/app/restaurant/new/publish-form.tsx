"use client";

import { useActionState } from "react";
import { Form } from "@base-ui/react/form";
import { CalendarBlank, ChatsCircle, Chair, Clock, ForkKnife, Storefront, WarningCircle } from "@phosphor-icons/react/ssr";
import { Button, ButtonLink } from "@/components/ui/button";
import { TileMultiSelect, TileSelect } from "@/components/ui/tiles";
import { AREAS, CAPACITIES, FEATURES, PRICES, SLOTS } from "@/lib/space-options";
import type { DayOption } from "@/lib/time";
import { publishSpace, type FormState } from "../actions";

const icon = { size: 20, "aria-hidden": true } as const;

/** Starting selections, e.g. from an AI suggestion's "Edit first" link. Values are already validated. */
export type SpaceDraft = {
  area?: string;
  date?: string;
  slot?: string;
  capacity?: string;
  price?: string;
  features?: string[];
};

export function PublishForm({ days, draft = {} }: { days: DayOption[]; draft?: SpaceDraft }) {
  const [state, action, pending] = useActionState<FormState, FormData>(publishSpace, {});

  return (
    <Form action={action} errors={state.errors} className="flex flex-col gap-8">
      <TileSelect
        name="area"
        label="Where in the restaurant?"
        icon={<Storefront {...icon} />}
        defaultValue={draft.area ?? "Main dining"}
        tiles={AREAS.map((a) => ({ value: a, label: a }))}
      />
      <TileSelect
        name="date"
        label="Which day?"
        icon={<CalendarBlank {...icon} />}
        columns="grid-cols-3 sm:grid-cols-5 md:grid-cols-7"
        defaultValue={draft.date}
        tiles={days.map((d) => ({ value: d.value, label: d.label, hint: d.weekday }))}
      />
      <TileSelect
        name="slot"
        label="What time?"
        icon={<Clock {...icon} />}
        hint="Seattle time (Pacific)."
        defaultValue={draft.slot ?? "dinner"}
        columns="grid-cols-2"
        tiles={SLOTS.map((s) => ({ value: s.value, label: s.label, hint: s.hint }))}
      />
      <TileSelect
        name="capacity"
        label="How many seats?"
        icon={<Chair {...icon} />}
        defaultValue={draft.capacity ?? "6"}
        columns="grid-cols-3 sm:grid-cols-6"
        tiles={CAPACITIES.map((c) => ({ value: String(c), label: c }))}
      />
      <TileMultiSelect
        name="features"
        label="What's it like? (optional)"
        icon={<ChatsCircle {...icon} />}
        defaultValue={draft.features}
        tiles={FEATURES.map((f) => ({ value: f, label: f }))}
      />
      <TileSelect
        name="price"
        label="Minimum spend per person"
        icon={<ForkKnife {...icon} />}
        hint="Shown to people booking the space. No payments are collected yet."
        defaultValue={draft.price ?? "none"}
        columns="grid-cols-2 sm:grid-cols-4"
        tiles={PRICES.map((p) => ({ value: p.value, label: p.label }))}
      />

      {state.errors?.form && (
        <p role="alert" className="alt-notice alt-notice--problem">
          <WarningCircle size={24} aria-hidden="true" className="alt-icon" />
          {state.errors.form}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button type="submit" disabled={pending} className="alt-button--block">
          {pending ? "Publishing…" : "Publish space"}
        </Button>
        <p className="alt-help text-center">Your space goes live right away, and guests can book it.</p>
        <ButtonLink href="/restaurant" variant="quiet" className="self-center">
          Cancel
        </ButtonLink>
      </div>
    </Form>
  );
}
