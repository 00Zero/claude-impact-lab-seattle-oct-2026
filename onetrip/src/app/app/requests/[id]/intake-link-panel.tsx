"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/ui/form-styles";
import { markIntakeLinkShared, regenerateIntakeLink, revokeIntakeLink } from "../actions";

type IntakeLinkPanelProps = {
  requestId: string;
  customerName: string;
  businessName: string;
  url: string | null;
  expiresLabel: string | null;
  expired: boolean;
};

function subscribeNoop() {
  return () => {};
}

export function IntakeLinkPanel({
  requestId,
  customerName,
  businessName,
  url,
  expiresLabel,
  expired,
}: IntakeLinkPanelProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, startRegenerate] = useTransition();
  const [revoking, startRevoke] = useTransition();
  // The Web Share API only exists in some browsers; false during SSR.
  const canShare = useSyncExternalStore(
    subscribeNoop,
    () => typeof navigator.share === "function",
    () => false,
  );

  const usable = url !== null && !expired;
  const message = `Hi ${customerName}, ${businessName} asked for a few details before your visit. Open this link to take a photo of the problem and answer a few questions: ${url}`;

  async function copy() {
    if (!url) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      void markIntakeLinkShared(requestId);
    } catch {
      setError("Couldn't copy automatically. Select the link and copy it.");
    }
  }

  async function share() {
    try {
      await navigator.share({ text: message });
      void markIntakeLinkShared(requestId);
    } catch (err) {
      // AbortError means the user closed the share sheet.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError("Couldn't open sharing. Copy the link instead.");
      }
    }
  }

  function regenerate() {
    if (
      usable &&
      !window.confirm(
        "Create a new link? The current link will stop working for the customer.",
      )
    ) {
      return;
    }
    setError(null);
    startRegenerate(async () => {
      const result = await regenerateIntakeLink(requestId);
      if (result.error) setError(result.error);
    });
  }

  function revoke() {
    if (
      !window.confirm(
        "Revoke this link? It will stop working for the customer. Photos and answers already sent are kept.",
      )
    ) {
      return;
    }
    setError(null);
    startRevoke(async () => {
      const result = await revokeIntakeLink(requestId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <section
      aria-labelledby="intake-link-heading"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6"
    >
      <div className="space-y-1">
        <h2 id="intake-link-heading" className="text-base font-semibold">
          Customer intake link
        </h2>
        <p className="text-sm leading-6 text-muted">
          Send this link by text, WhatsApp, or email. Anyone with it can open
          this intake, so share it only with the customer.
        </p>
      </div>

      {usable ? (
        <>
          <input
            readOnly
            value={url}
            aria-label="Intake link"
            onFocus={(event) => event.currentTarget.select()}
            className="h-12 w-full rounded-xl border-[1.5px] border-line bg-page px-3 font-mono text-sm"
          />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={copy} className={primaryButtonClassName}>
              {copied ? "Copied" : "Copy link"}
            </button>
            {canShare ? (
              <button type="button" onClick={share} className={secondaryButtonClassName}>
                Share…
              </button>
            ) : null}
            <Link
              href={`/app/requests/${requestId}/preview`}
              className={secondaryButtonClassName}
            >
              Preview
            </Link>
          </div>
          <p className="text-sm text-muted">Expires {expiresLabel}.</p>
        </>
      ) : (
        <p className="text-sm text-ink">
          {expired
            ? `This link expired ${expiresLabel}. Create a new one to send the customer.`
            : "This request has no active link."}
        </p>
      )}

      <p aria-live="polite" className="text-sm text-danger">
        {error}
      </p>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <button
          type="button"
          onClick={regenerate}
          disabled={regenerating || revoking}
          className="min-h-10 text-sm font-bold text-accent-strong disabled:opacity-40"
        >
          {regenerating ? "Creating new link…" : "Create a new link"}
        </button>
        {usable ? (
          <button
            type="button"
            onClick={revoke}
            disabled={regenerating || revoking}
            className="min-h-10 text-sm font-bold text-danger disabled:opacity-40"
          >
            {revoking ? "Revoking…" : "Revoke link"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
