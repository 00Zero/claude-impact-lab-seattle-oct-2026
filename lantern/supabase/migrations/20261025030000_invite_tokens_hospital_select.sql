-- The original migration deliberately left invite_tokens with no client
-- SELECT policy, to prevent a BARE/unscoped policy from letting any
-- authenticated user enumerate tokens. But T1.6 (docs/milestone-1-tasks.md)
-- needs the hospital to read back the token it just created, to show the
-- invite link on screen. A case-ownership-scoped policy -- the same
-- non-enumerable pattern already used for intake_documents/recommendations
-- -- closes that gap without reopening the enumeration risk: a hospital can
-- only ever see tokens for cases where it is the hospital_id, never anyone
-- else's.

create policy "invite_tokens_select_own_case"
  on invite_tokens for select
  to authenticated
  using (
    exists (
      select 1 from cases c
      where c.id = invite_tokens.case_id
        and c.hospital_id = auth.uid()
    )
  );
