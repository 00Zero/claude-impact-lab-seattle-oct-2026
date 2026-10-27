---
name: push-to-main
description: Commit finished work and push it straight to main. This team does not use pull requests or feature branches. Use whenever a developer asks to commit, push, ship, publish, merge, or open a pull request for their changes.
---

# Push to main

The team pushes directly to `main`. Don't create feature branches or open pull requests, even if the developer says "open a PR" or "publish a PR". Use this workflow instead and mention that the team pushes to `main`. Only open a PR if the developer insists after that.

## Steps

1. **Check the branch.** Run `git status -sb`. If you're not on `main`, ask before switching, because there may be work on that branch the developer wants to keep there.
2. **Pull first.** Run `git pull --ff-only --autostash`. Teammates push often, so do this every time. If the pull fails because local commits diverged, run `git pull --rebase --autostash`. If that hits conflicts, show them and ask how to resolve them.
3. **Check what landed.** If the pull brought in new commits, skim `git log` and the diff for files your changes touch (schema, `lib/`, shared components). Make sure your changes still fit.
4. **Review your changes.** Run `git status` and `git diff`. Stage only files that belong to this change. Never stage `.env.local`, other secrets, or unrelated edits.
5. **Verify.** Run `npm run lint` and `npm run build`. Next 16 needs Node 20 or newer, so run `nvm use 22` first if `node -v` is older. If either command fails, fix the problem or report it. Don't push a broken `main`.
6. **Commit.** Make one commit per logical change, with a short imperative subject (e.g. "Add browse spaces page (U1)"). The body should say what changed and why.
7. **Push.** Run `git push origin main`. If it's rejected because someone pushed in the meantime, go back to step 2, then push again.
8. **Report back** with the commit hashes and subjects, and anything that wasn't verified.

## Never

- Force-push (`--force`, `--force-with-lease`) to `main`.
- Skip hooks (`--no-verify`).
- Rewrite commits that are already on `origin/main`.
