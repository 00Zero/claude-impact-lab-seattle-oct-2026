---
name: report-bug
description: File a bug as a GitHub issue on amarjahin/alongtable from a plain-language description, e.g. "The bug is that I'm not able to click on the restaurant". Use whenever a developer reports a bug, says something is broken, or asks to log or file an issue.
---

# Report a bug

Turn a developer's plain-language bug report into a clear GitHub issue.

## Steps

1. **Check `gh`.** Run `gh auth status`. If `gh` is missing or not logged in, tell the developer to install the GitHub CLI and run `gh auth login`, then stop.
2. **Understand the bug.** From the description, work out:
   - what went wrong
   - where it happens (page or route, e.g. `/restaurant`, `/restaurant/new`)
   - how to reproduce it
   - what should happen instead

   Use anything they shared: screenshots, error text, the page they were on. Glance at the relevant page or component to name the affected area correctly, but don't try to fix the bug.
3. **Fill gaps only if needed.** If you can't tell where the bug happens or what's wrong, ask one short question. Otherwise file it right away and note unknowns in the issue.
4. **Check for duplicates.** Run `gh issue list --state open --search "<keywords>"`. If a matching issue exists, show it and ask whether to comment on it instead of filing a new one.
5. **File it.** Run `gh issue create --label bug --title "<title>" --body "<body>"`.
6. **Report back** with the issue URL and title.

## Title

One line, under ~60 characters, describing the problem from the user's point of view: "Restaurant cards can't be clicked on /restaurant", not "Bug" or "Fix onClick".

## Body

Keep it short and plain, focusing on behavior rather than code:

```
<One or two sentences: what's wrong and where.>

**Steps to reproduce**
1. ...
2. ...

**Expected:** ...
**Actual:** ...

<Optional: exact error message, quoted. Any likely cause, labeled as a guess.>
```

Leave out sections you have nothing for rather than filling them with placeholders.

## Never include

Secrets or credentials (API keys, `.env.local` values, Supabase keys), personal data, or full stack traces. Quote just the error message line instead.
