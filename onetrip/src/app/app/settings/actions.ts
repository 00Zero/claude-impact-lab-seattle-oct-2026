"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { processAvatar, removeAvatar, saveAvatar } from "@/lib/avatar";
import { CURRENCIES } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { canManageWorkspace, requireWorkspace } from "@/lib/workspace";
import {
  LINK_EXPIRY_DAYS,
  PHOTO_RETENTION_OPTIONS,
  workspaceDetailsSchema,
} from "@/lib/workspace-schema";

export type BusinessField =
  | "name"
  | "trade"
  | "tradeOther"
  | "contactEmail"
  | "contactPhone"
  | "timezone"
  | "linkExpiryDays"
  | "photoRetentionDays"
  | "estimatesEnabled"
  | "currency";

export type BusinessFormState = {
  error?: string;
  saved?: boolean;
  fieldErrors?: Partial<Record<BusinessField, string>>;
  values?: Partial<Record<BusinessField, string>>;
};

const businessSchema = workspaceDetailsSchema.and(
  z.object({
    linkExpiryDays: z.coerce
      .number<string>({ error: "Enter a number of days." })
      .int({ error: "Enter a whole number of days." })
      .min(LINK_EXPIRY_DAYS.min, {
        error: `Links must last at least ${LINK_EXPIRY_DAYS.min} day.`,
      })
      .max(LINK_EXPIRY_DAYS.max, {
        error: `Links can last at most ${LINK_EXPIRY_DAYS.max} days.`,
      }),
    photoRetentionDays: z.coerce
      .number<string>()
      .refine(
        (days) => (PHOTO_RETENTION_OPTIONS as readonly number[]).includes(days),
        { error: "Choose how long to keep photos." },
      ),
    estimatesEnabled: z.string().transform((value) => value === "on"),
    currency: z.enum(CURRENCIES, { error: "Choose a currency." }),
  }),
);

export async function updateBusinessSettings(
  _prevState: BusinessFormState,
  formData: FormData,
): Promise<BusinessFormState> {
  const { workspace } = await requireWorkspace();
  const values = {
    name: String(formData.get("name") ?? ""),
    trade: String(formData.get("trade") ?? ""),
    tradeOther: String(formData.get("tradeOther") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
    linkExpiryDays: String(formData.get("linkExpiryDays") ?? ""),
    photoRetentionDays: String(formData.get("photoRetentionDays") ?? ""),
    estimatesEnabled: formData.get("estimatesEnabled") === "on" ? "on" : "",
    currency: String(formData.get("currency") ?? ""),
  };
  if (!canManageWorkspace(workspace)) {
    return { error: "Only owners and admins can change business settings.", values };
  }

  const parsed = businessSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: BusinessFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as BusinessField;
      fieldErrors[field] ??= issue.message;
    }
    return { fieldErrors, values };
  }

  // RLS also limits updates to owners and admins of this workspace.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      trade: parsed.data.trade,
      trade_other: parsed.data.trade === "other" ? parsed.data.tradeOther : null,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone || null,
      timezone: parsed.data.timezone,
      intake_link_expiry_days: parsed.data.linkExpiryDays,
      photo_retention_days: parsed.data.photoRetentionDays,
      estimates_enabled: parsed.data.estimatesEnabled,
      currency: parsed.data.currency,
    })
    .eq("id", workspace.id)
    .select("id");
  if (error || data.length === 0) {
    return { error: "We couldn't save your settings. Please try again.", values };
  }

  // The business name appears in the portal header.
  revalidatePath("/app", "layout");
  return { saved: true, values };
}

export async function revokeAllIntakeLinks(): Promise<
  { revoked: number } | { error: string }
> {
  const { workspace } = await requireWorkspace();
  if (!canManageWorkspace(workspace)) {
    return { error: "Only owners and admins can revoke every link." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_all_intake_links", {
    p_organization_id: workspace.id,
  });
  if (error || typeof data !== "number") {
    return { error: "We couldn't revoke the links. Please try again." };
  }

  revalidatePath("/app/requests", "layout");
  return { revoked: data };
}

export type ProfileFormState = { error?: string; message?: string };

export async function updateProfilePicture(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user } = await requireWorkspace();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a picture first." };
  }

  const avatar = await processAvatar(file);
  if (!avatar.ok) {
    return { error: avatar.error };
  }
  const saved = await saveAvatar(user.id, avatar.data);
  if (!saved.ok) {
    return { error: "We couldn't upload your picture. Please try again." };
  }

  revalidatePath("/app", "layout");
  return { message: "Profile picture updated." };
}

export async function removeProfilePicture(): Promise<ProfileFormState> {
  const { user } = await requireWorkspace();
  const result = await removeAvatar(user.id);
  if (!result.ok) {
    return { error: "We couldn't remove your picture. Please try again." };
  }
  revalidatePath("/app", "layout");
  return { message: "Profile picture removed." };
}

const MIN_PASSWORD_LENGTH = 8;

export async function changePassword(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user } = await requireWorkspace();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) {
    return { error: "Enter your current password." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`,
    };
  }
  if (password !== confirmPassword) {
    return { error: "The new passwords don't match." };
  }

  // Confirm it's really the account holder before changing the password,
  // in case the session was left open on a shared device.
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "Your current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return { error: "Choose a password different from your current one." };
    }
    return { error: error.message };
  }
  return { message: "Password changed." };
}
