"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useActionState, type ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react/ssr";
import type { DeleteState } from "@/app/restaurant/delete-actions";

/**
 * A quiet button that opens a confirmation. The red button only exists inside the dialog
 * (brand/DESIGN.md), so nothing destructive is one tap away.
 */
export function ConfirmDelete({
  action,
  hidden,
  trigger,
  title,
  description,
  confirmLabel,
}: {
  action: (prev: DeleteState, formData: FormData) => Promise<DeleteState>;
  hidden: { name: string; value: string };
  /** The trigger button's content (icon and label). */
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
}) {
  const [state, act, pending] = useActionState<DeleteState, FormData>(action, {});

  return (
    <Dialog.Root>
      <Dialog.Trigger className="alt-button alt-button--quiet">{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="alt-backdrop z-40" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Popup className="alt-dialog flex flex-col gap-4 outline-none">
            <Dialog.Title className="alt-title">{title}</Dialog.Title>
            <Dialog.Description render={<div />} className="flex flex-col gap-2">
              {description}
            </Dialog.Description>
            {state.error && (
              <p role="alert" className="alt-notice alt-notice--problem">
                <WarningCircle size={24} aria-hidden="true" className="alt-icon" />
                {state.error}
              </p>
            )}
            <form action={act} className="flex flex-wrap justify-end gap-2">
              <input type="hidden" name={hidden.name} value={hidden.value} />
              <Dialog.Close className="alt-button alt-button--quiet" disabled={pending}>
                Keep it
              </Dialog.Close>
              <button type="submit" className="alt-button alt-button--danger" disabled={pending}>
                {pending ? "Removing…" : confirmLabel}
              </button>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
