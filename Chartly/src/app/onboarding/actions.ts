"use server";

import { redirect } from "next/navigation";
import { processAvatar, saveAvatar } from "@/lib/avatar";
import { getCurrentWorkspace } from "@/lib/workspace";
import { workspaceDetailsSchema } from "@/lib/workspace-schema";
import { createClient } from "@/lib/supabase/server";

export type OnboardingField =
  | "avatar"
  | "name"
  | "trade"
  | "tradeOther"
  | "contactEmail"
  | "contactPhone"
  | "timezone"
  | "estimatesEnabled";

export type OnboardingFormState = {
  error?: string;
  fieldErrors?: Partial<Record<OnboardingField, string>>;
  values?: Partial<Record<OnboardingField, string>>;
};

export async function createWorkspace(
  _prevState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const { user, workspace } = await getCurrentWorkspace();
  if (workspace) {
    redirect("/app");
  }

  const values = {
    name: String(formData.get("name") ?? ""),
    trade: String(formData.get("trade") ?? ""),
    tradeOther: String(formData.get("tradeOther") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    estimatesEnabled: formData.get("estimatesEnabled") === "on" ? "on" : "",
  };

  const avatarFile = formData.get("avatar");
  const avatar =
    avatarFile instanceof File && avatarFile.size > 0
      ? await processAvatar(avatarFile)
      : null;

  const parsed = workspaceDetailsSchema.safeParse(values);
  if (!parsed.success || (avatar && !avatar.ok)) {
    const fieldErrors: OnboardingFormState["fieldErrors"] = {};
    for (const issue of parsed.error?.issues ?? []) {
      const field = issue.path[0] as OnboardingField;
      fieldErrors[field] ??= issue.message;
    }
    if (avatar && !avatar.ok) {
      fieldErrors.avatar = avatar.error;
    }
    return { fieldErrors, values };
  }

  // Upload before creating the workspace so a failure leaves nothing
  // half-finished; a retry overwrites the same file.
  if (avatar) {
    const saved = await saveAvatar(user.id, avatar.data);
    if (!saved.ok) {
      return {
        fieldErrors: {
          avatar:
            "We couldn't upload your picture. Try again, or remove it and add one later.",
        },
        values,
      };
    }
  }

  const supabase = await createClient();
  const { data: organizationId, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_trade: parsed.data.trade,
    p_trade_other: parsed.data.trade === "other" ? parsed.data.tradeOther : null,
    p_contact_email: parsed.data.contactEmail,
    p_contact_phone: parsed.data.contactPhone,
    p_timezone: parsed.data.timezone,
  });

  // A double submit can race past the check above; the database rejects
  // the second workspace, and the first one is already usable.
  if (error && error.message !== "User already belongs to a workspace") {
    return {
      error: "We couldn't create your workspace. Please try again.",
      values,
    };
  }

  // The owner can update their new workspace through RLS.
  if (!error && values.estimatesEnabled && typeof organizationId === "string") {
    await supabase.from("organizations").update({ estimates_enabled: true }).eq("id", organizationId);
    // Next step: give the AI their pricing to work from.
    redirect("/app/settings/price-book?welcome=1");
  }

  redirect("/app");
}
