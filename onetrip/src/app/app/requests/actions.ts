"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import {
  approveEstimate,
  newEstimateVersion,
  releaseEstimate,
  runEstimateJob,
  saveEstimateDraft,
  startEstimateRegeneration,
} from "@/lib/estimates";
import { retryBrief, runBriefJob } from "@/lib/intake-ai";
import { newIntakeLink } from "@/lib/intake-links";
import { processStorageDeletions } from "@/lib/storage-cleanup";
import { createClient } from "@/lib/supabase/server";
import { TRADE_OTHER_MAX_LENGTH, TRADES, type Trade } from "@/lib/trades";
import { PHONE_PATTERN, PHONE_PATTERN_MESSAGE } from "@/lib/validation";
import { canManageWorkspace, requireWorkspace } from "@/lib/workspace";

export type RequestField =
  | "customerName"
  | "customerPhone"
  | "customerEmail"
  | "serviceAddress"
  | "trade"
  | "tradeOther"
  | "issueDescription";

export type RequestFormState = {
  error?: string;
  fieldErrors?: Partial<Record<RequestField, string>>;
};

const tradeValues = TRADES.map((trade) => trade.value) as [Trade, ...Trade[]];

const requestSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(1, { error: "Enter the customer's name." })
      .max(120, { error: "Keep the name under 120 characters." }),
    customerPhone: z
      .string()
      .trim()
      .max(40, { error: "Enter a shorter phone number." })
      .regex(PHONE_PATTERN, { error: PHONE_PATTERN_MESSAGE }),
    customerEmail: z
      .string()
      .trim()
      .max(254)
      .refine((value) => value === "" || z.email().safeParse(value).success, {
        error: "Enter a valid email address, or leave it blank.",
      }),
    serviceAddress: z
      .string()
      .trim()
      .max(300, { error: "Keep the address under 300 characters." }),
    trade: z.enum(tradeValues, { error: "Choose a trade." }),
    tradeOther: z
      .string()
      .trim()
      .max(TRADE_OTHER_MAX_LENGTH, {
        error: `Keep the trade under ${TRADE_OTHER_MAX_LENGTH} characters.`,
      }),
    issueDescription: z
      .string()
      .trim()
      .min(1, { error: "Describe the issue." })
      .max(2000, { error: "Keep the description under 2,000 characters." }),
  })
  .refine((data) => data.trade !== "other" || data.tradeOther.length > 0, {
    error: "Enter the trade.",
    path: ["tradeOther"],
    when: (payload) =>
      !payload.issues.some((issue) =>
        ["trade", "tradeOther"].includes(String(issue.path?.[0])),
      ),
  });

type ParsedRequest = z.infer<typeof requestSchema>;

function parseRequestForm(
  formData: FormData,
): { data: ParsedRequest } | { state: RequestFormState } {
  const parsed = requestSchema.safeParse({
    customerName: String(formData.get("customerName") ?? ""),
    customerPhone: String(formData.get("customerPhone") ?? ""),
    customerEmail: String(formData.get("customerEmail") ?? ""),
    serviceAddress: String(formData.get("serviceAddress") ?? ""),
    trade: String(formData.get("trade") ?? ""),
    tradeOther: String(formData.get("tradeOther") ?? ""),
    issueDescription: String(formData.get("issueDescription") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: RequestFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as RequestField;
      fieldErrors[field] ??= issue.message;
    }
    return { state: { fieldErrors } };
  }
  return { data: parsed.data };
}

export async function createServiceRequest(
  _prevState: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const { workspace } = await requireWorkspace();

  const result = parseRequestForm(formData);
  if ("state" in result) {
    return result.state;
  }
  const { data } = result;

  const link = newIntakeLink();
  const supabase = await createClient();
  const { data: requestId, error } = await supabase.rpc(
    "create_service_request",
    {
      p_organization_id: workspace.id,
      p_customer_name: data.customerName,
      p_customer_phone: data.customerPhone,
      p_customer_email: data.customerEmail,
      p_service_address: data.serviceAddress,
      p_trade: data.trade,
      p_trade_other: data.trade === "other" ? data.tradeOther : null,
      p_issue_description: data.issueDescription,
      p_link_id: link.id,
      p_token_hash: link.tokenHash,
    },
  );

  if (error || typeof requestId !== "string") {
    return { error: "We couldn't create the request. Please try again." };
  }

  revalidatePath("/app/requests");
  redirect(`/app/requests/${requestId}?created=1`);
}

// Bound to a request id on the edit page. The id comes from the client, so
// the update is scoped to the caller's workspace (and RLS enforces it too).
export async function updateServiceRequest(
  requestId: string,
  _prevState: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const { workspace } = await requireWorkspace();

  const result = parseRequestForm(formData);
  if ("state" in result) {
    return result.state;
  }
  const { data } = result;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("service_requests")
    .update({
      customer_name: data.customerName,
      customer_phone: data.customerPhone || null,
      customer_email: data.customerEmail || null,
      service_address: data.serviceAddress || null,
      trade: data.trade,
      trade_other: data.trade === "other" ? data.tradeOther : null,
      issue_description: data.issueDescription,
    })
    .eq("id", requestId)
    .eq("organization_id", workspace.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "We couldn't save your changes. Please try again." };
  }
  if (!updated) {
    return { error: "This request no longer exists or isn't in your workspace." };
  }

  revalidatePath("/app/requests");
  revalidatePath(`/app/requests/${requestId}`);
  redirect(`/app/requests/${requestId}?updated=1`);
}

export async function regenerateIntakeLink(requestId: string) {
  await requireWorkspace();

  const link = newIntakeLink();
  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_intake_link", {
    p_service_request_id: requestId,
    p_link_id: link.id,
    p_token_hash: link.tokenHash,
  });
  if (error) {
    return { error: "We couldn't create a new link. Please try again." };
  }

  revalidatePath(`/app/requests/${requestId}`);
  return {};
}

// Called after the contractor copies or shares the link. RLS limits the
// update to the user's workspace; only drafts move to "shared".
export async function markIntakeLinkShared(requestId: string) {
  const { workspace } = await requireWorkspace();
  const supabase = await createClient();
  await supabase
    .from("service_requests")
    .update({ intake_status: "shared" })
    .eq("id", requestId)
    .eq("organization_id", workspace.id)
    .eq("intake_status", "draft");

  revalidatePath(`/app/requests/${requestId}`);
  revalidatePath("/app/requests");
}

// Starts a fresh brief after a failure. The id comes from the client, so
// retryBrief re-checks it belongs to the caller's workspace.
export async function retryBriefAction(requestId: string) {
  const { workspace } = await requireWorkspace();
  const result = await retryBrief(workspace.id, requestId);
  if (!result.ok) return { error: result.error };
  after(() => runBriefJob(result.jobId));
  revalidatePath(`/app/requests/${requestId}`);
  return {};
}

export async function revokeIntakeLink(requestId: string) {
  await requireWorkspace();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_intake_link", {
    p_service_request_id: requestId,
  });
  if (error) {
    return { error: "We couldn't revoke the link. Please try again." };
  }

  revalidatePath(`/app/requests/${requestId}`);
  return {};
}

// Marks the brief as reviewed (or back to unreviewed) from the request page.
// Archived requests stay archived. RLS limits the update to the workspace.
export async function setRequestReviewed(requestId: string, reviewed: boolean) {
  const { workspace } = await requireWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .update({ review_status: reviewed ? "reviewed" : "unreviewed" })
    .eq("id", requestId)
    .eq("organization_id", workspace.id)
    .neq("review_status", "archived")
    .select("id");
  if (error || data.length === 0) {
    return { error: "We couldn't update the request. Please try again." };
  }

  revalidatePath(`/app/requests/${requestId}`);
  revalidatePath("/app/requests");
  return {};
}

// Archived requests leave the default list. Restoring treats the request
// as reviewed, the step before archiving. RLS limits the update to the
// user's workspace.
export async function setRequestArchived(requestId: string, archived: boolean) {
  const { workspace } = await requireWorkspace();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .update({ review_status: archived ? "archived" : "reviewed" })
    .eq("id", requestId)
    .eq("organization_id", workspace.id)
    .select("id");
  if (error || data.length === 0) {
    return {
      error: archived
        ? "We couldn't archive the request. Please try again."
        : "We couldn't restore the request. Please try again.",
    };
  }

  revalidatePath(`/app/requests/${requestId}`);
  revalidatePath("/app/requests");
  return {};
}

// Permanently deletes the request, its links, answers, and photos. The
// database checks the caller's role and queues the photo files, which are
// then deleted from storage; failures stay queued and are retried by the
// next deletion.
export async function deleteServiceRequest(requestId: string, confirmation: string) {
  const { workspace } = await requireWorkspace();
  if (!canManageWorkspace(workspace)) {
    return { error: "Only owners and admins can delete requests." };
  }

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("service_requests")
    .select("number")
    .eq("id", requestId)
    .eq("organization_id", workspace.id)
    .maybeSingle<{ number: number }>();
  if (!request) {
    return { error: "This request no longer exists." };
  }
  if (confirmation.trim().replace(/^#/, "") !== String(request.number)) {
    return { error: `Type ${request.number} to confirm.` };
  }

  const { error } = await supabase.rpc("delete_service_request", {
    p_service_request_id: requestId,
  });
  if (error) {
    return { error: "We couldn't delete the request. Please try again." };
  }
  await processStorageDeletions();

  revalidatePath("/app/requests");
  redirect(`/app/requests?deleted=${request.number}`);
}

// ---------- estimates (B9) ----------
// Each action re-checks the workspace; approve and release also go through
// database functions that check the user's role.

export async function saveEstimateAction(requestId: string, estimateId: string, edit: unknown) {
  const { user, workspace } = await requireWorkspace();
  const result = await saveEstimateDraft(workspace.id, user.id, estimateId, edit);
  revalidatePath(`/app/requests/${requestId}`);
  return result.ok ? {} : { error: result.error };
}

export async function approveEstimateAction(requestId: string, estimateId: string) {
  await requireWorkspace();
  const result = await approveEstimate(estimateId);
  revalidatePath(`/app/requests/${requestId}`);
  return result.ok ? {} : { error: result.error };
}

export async function releaseEstimateAction(requestId: string, estimateId: string) {
  await requireWorkspace();
  const result = await releaseEstimate(estimateId);
  revalidatePath(`/app/requests/${requestId}`);
  return result.ok ? {} : { error: result.error };
}

export async function newEstimateVersionAction(requestId: string, estimateId: string) {
  const { user, workspace } = await requireWorkspace();
  const result = await newEstimateVersion(workspace.id, user.id, estimateId);
  revalidatePath(`/app/requests/${requestId}`);
  return result.ok ? {} : { error: result.error };
}

export async function regenerateEstimateAction(requestId: string) {
  const { workspace } = await requireWorkspace();
  const result = await startEstimateRegeneration(workspace.id, requestId);
  if (!result.ok) return { error: result.error };
  after(() => runEstimateJob(result.jobId));
  revalidatePath(`/app/requests/${requestId}`);
  return {};
}
