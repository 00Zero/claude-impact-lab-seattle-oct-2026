"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  message?: string;
  email?: string;
};

const MIN_PASSWORD_LENGTH = 8;

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

async function getOrigin() {
  return (await headers()).get("origin");
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error: "Confirm your email first. Check your inbox for the link.",
        email,
      };
    }
    return { error: "Incorrect email or password.", email };
  }

  redirect("/app");
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Enter an email and password.", email };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
      email,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await getOrigin()}/auth/confirm?next=/app` },
  });

  if (error) {
    return { error: error.message, email };
  }

  // With email confirmation enabled, Supabase returns no session until the
  // user clicks the link in their inbox.
  if (!data.session) {
    return {
      message: `We sent a confirmation link to ${email}. Open it to finish creating your account.`,
    };
  }

  redirect("/app");
}

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter your email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await getOrigin()}/auth/confirm?next=/reset-password`,
  });

  if (error?.status === 429) {
    return {
      error: "Too many reset requests. Wait a few minutes and try again.",
      email,
    };
  }

  // Same response whether or not the account exists, so the form can't be
  // used to discover registered emails.
  return {
    message: `If an account exists for ${email}, we sent a link to reset your password.`,
  };
}

export async function updatePassword(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // The reset link signs the user in, so a session is required here.
  const user = await getOptionalUser();
  if (!user) {
    return {
      error: "Your reset link has expired. Request a new one to continue.",
    };
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
    };
  }
  if (password !== confirmPassword) {
    return { error: "The passwords don't match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    if (error.code === "same_password") {
      return { error: "Choose a password different from your current one." };
    }
    return { error: error.message };
  }

  redirect("/app");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
