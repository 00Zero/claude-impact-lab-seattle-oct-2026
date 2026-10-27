"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Form } from "@base-ui/react/form";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PhotoField } from "@/components/ui/photo-field";
import { createEvent, type FormState } from "../../actions";

/** Starting values, e.g. an event drafted by the AI planner. */
export type EventDraft = { title: string; description: string; capacity: string };

export function CreateEventForm({
  spaceId,
  capacity,
  draft = null,
}: {
  spaceId: string;
  capacity: number;
  draft?: EventDraft | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createEvent, {});
  // After a failed submit, show what the user typed; otherwise start from the draft.
  const v: Record<string, string> = state.values ?? draft ?? {};

  return (
    <Form action={action} errors={state.errors} className="flex flex-col gap-5">
      <input type="hidden" name="spaceId" value={spaceId} />
      {draft && !state.values && (
        <p className="rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          Drafted by the AI planner. Review and edit anything before publishing.
        </p>
      )}
      <TextField name="title" label="Event title" defaultValue={v.title} placeholder="Debating Pythagoras" />
      <TextField
        name="description"
        multiline
        label="Description (optional)"
        defaultValue={v.description}
        placeholder="What will people do, talk about, or bring?"
      />
      <TextField
        name="capacity"
        type="number"
        min={1}
        max={capacity}
        step={1}
        inputMode="numeric"
        label="Available spots"
        defaultValue={v.capacity || String(capacity)}
        hint={`How many people can join, up to ${capacity} (the space's capacity).`}
      />
      <PhotoField
        label="Event photo (optional)"
        hint="A JPEG, PNG or WebP up to 4 MB. If you don't add one, the restaurant's photo is used."
      />
      <TextField name="organizerName" label="Your name" defaultValue={v.organizerName} autoComplete="name" />
      <TextField
        name="organizerEmail"
        type="email"
        label="Your email"
        defaultValue={v.organizerEmail}
        autoComplete="email"
        hint="Not shown on the event page. No payment is collected."
      />
      {state.errors?.form && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.errors.form}{" "}
          {state.spaceGone && (
            <Link href="/spaces" className="font-medium underline">
              Browse other spaces
            </Link>
          )}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending || state.spaceGone}>
          {pending ? "Booking…" : "Book space & publish event"}
        </Button>
        <ButtonLink href={`/spaces/${spaceId}`} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </Form>
  );
}
