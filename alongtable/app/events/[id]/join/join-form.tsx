"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Form } from "@base-ui/react/form";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { joinEvent, type FormState } from "../../actions";

export function JoinForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(joinEvent, {});
  const v = state.values ?? {};

  return (
    <Form action={action} errors={state.errors} className="flex flex-col gap-5">
      <input type="hidden" name="eventId" value={eventId} />
      <TextField name="name" label="Your name" defaultValue={v.name} autoComplete="name" />
      <TextField
        name="email"
        type="email"
        label="Your email"
        defaultValue={v.email}
        autoComplete="email"
        hint="One seat per email. Not shown on the event page."
      />
      {state.errors?.form && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.errors.form}{" "}
          {state.closed && (
            <Link href="/events" className="font-medium underline">
              Find other events
            </Link>
          )}
        </p>
      )}
      <p className="text-xs text-neutral-500">No payment is collected through ALongTable.</p>
      <div className="flex gap-3">
        <Button type="submit" disabled={pending || state.closed}>
          {pending ? "Reserving…" : "Reserve my seat"}
        </Button>
        <ButtonLink href={`/events/${eventId}`} variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </Form>
  );
}
