import { Suspense } from "react";
import { logout } from "@/app/auth/actions";
import { getAvatarUrl } from "@/lib/avatar";
import { requireWorkspace } from "@/lib/workspace";
import { PasswordForm } from "./password-form";
import { ProfilePictureForm } from "./profile-picture-form";

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  technician: "Technician",
} as const;

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ProfileSettings />
    </Suspense>
  );
}

async function ProfileSettings() {
  const { user, workspace } = await requireWorkspace();
  const avatarUrl = await getAvatarUrl(user.id);

  return (
    <>
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold">Account</h2>
        <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-muted">Email</dt>
          <dd className="text-sm text-ink">{user.email}</dd>
          <dt className="text-sm text-muted">Role</dt>
          <dd className="text-sm text-ink">
            {ROLE_LABELS[workspace.role]} of {workspace.name}
          </dd>
        </dl>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold">Profile picture</h2>
        <ProfilePictureForm avatarUrl={avatarUrl} />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold">Change password</h2>
        <PasswordForm />
      </section>

      <form action={logout}>
        <button type="submit" className="min-h-10 text-sm font-bold text-accent-strong">
          Log out
        </button>
      </form>
    </>
  );
}
