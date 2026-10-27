#!/usr/bin/env bash
# Builds the showcase: snapshots each team's repo into a folder named after its
# project (e.g. neri-cash), removes oversized files and anything gitleaks flags,
# and regenerates README.md from the public Supabase views.
#
#   scripts/build.sh                     # every team
#   scripts/build.sh neri-cash           # just that project (folder or team name)
#
# Needs git, gh, jq, curl (and Homebrew, if gitleaks is not installed).
# ENV_FILE must define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
set -euo pipefail

OWNER=00Zero
REPO=claude-impact-lab-seattle-oct-2026
ENV_FILE=${ENV_FILE:-/Users/ab/Developer/claudeseattle-hack/.env.local}
GITLEAKS_REPORT=${GITLEAKS_REPORT:-/tmp/gitleaks.json}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
STATE="$ROOT/scripts/snapshots.json"
# Folder names come from the project title (text before any ":" or " - ", slugified).
# Override here when that is too long, keyed by team name.
FOLDER_OVERRIDES='{"Datamaps for small business": "datamaps"}'

for cmd in git gh jq curl; do
  command -v "$cmd" >/dev/null || { echo "missing: $cmd" >&2; exit 1; }
done

WORK=$(mktemp -d "${TMPDIR:-/tmp}/impact-lab-build.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

# --- Supabase ---------------------------------------------------------------

env_value() {
  grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

SUPABASE_URL=$(env_value NEXT_PUBLIC_SUPABASE_URL)
SUPABASE_KEY=$(env_value NEXT_PUBLIC_SUPABASE_ANON_KEY)
[ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ] || { echo "Supabase settings not found in $ENV_FILE" >&2; exit 1; }

# The key goes to curl on stdin so it never shows up in argv or output.
query() {
  printf 'header = "apikey: %s"\nheader = "Authorization: Bearer %s"\n' "$SUPABASE_KEY" "$SUPABASE_KEY" |
    curl -sSf -K - "$SUPABASE_URL/rest/v1/$1"
}

query 'public_judge_entries?select=team_name,title,tagline,video_url,repo_url' > "$WORK/entries.json"
query 'public_judge_results?select=team_name,place' > "$WORK/results.json"

jq --argjson ov "$FOLDER_OVERRIDES" '
  def slug: split(":")[0] | split(" - ")[0] | ascii_downcase
            | gsub("[^a-z0-9.]+"; "-") | gsub("^[-.]+|[-.]+$"; "");
  map(.folder = ($ov[.team_name] // ((.title // .team_name) | slug)))
' "$WORK/entries.json" > "$WORK/e.json" && mv "$WORK/e.json" "$WORK/entries.json"

bad=$(jq -r 'map(select(.folder | test("^[a-z0-9][a-z0-9.-]*$") | not) | .team_name)
             + (group_by(.folder) | map(select(length > 1)) | flatten | map(.team_name))
             + map(select(.folder == "scripts") | .team_name) | unique | .[]' "$WORK/entries.json")
[ -z "$bad" ] || { echo "fix these folder names in FOLDER_OVERRIDES (invalid or duplicate):" >&2; echo "$bad" >&2; exit 1; }

[ -f "$STATE" ] || echo '{}' > "$STATE"

set_state() { # team json
  jq --arg t "$1" --argjson v "$2" '.[$t] = $v' "$STATE" > "$WORK/state.json" && mv "$WORK/state.json" "$STATE"
}

# --- Snapshots ----------------------------------------------------------------

# https://www.github.com/owner/repo.git/ or .../owner/repo/tree/main/sub -> owner/repo
parse_repo() {
  local path
  path=$(printf '%s' "$1" | sed -E -e 's/[?#].*$//' -e 's#^(https?://)?(www\.)?github\.com/##' -e 's#^git@github\.com:##')
  local owner=${path%%/*} rest=${path#*/}
  local repo=${rest%%/*}
  printf '%s/%s\n' "$owner" "${repo%.git}"
}

snapshot() { # team repo_url folder
  local team=$1 url=$2 folder=$3 slug clone dest old sha date license large
  slug=$(parse_repo "$url")
  clone="$WORK/clone"
  dest="$ROOT/$folder"
  rm -rf "$clone"
  echo "==> $team -> $folder/ ($slug)"

  # No credential helper: only repos anyone can read get copied.
  if ! GIT_TERMINAL_PROMPT=0 git -c credential.helper= clone --quiet --depth 1 \
      "https://github.com/$slug.git" "$clone" 2> "$WORK/clone.err"; then
    echo "    clone failed: $(tail -1 "$WORK/clone.err")" >&2
    if [ -d "$dest" ] && jq -e --arg t "$team" '.[$t].status == "ok"' "$STATE" >/dev/null; then
      echo "    keeping the previous snapshot" >&2
    else
      rm -rf "$dest"
      set_state "$team" "$(jq -n --arg slug "$slug" --arg folder "$folder" '{slug: $slug, folder: $folder, status: "failed"}')"
    fi
    return 0
  fi

  sha=$(git -C "$clone" rev-parse HEAD)
  date=$(git -C "$clone" log -1 --format=%cs)

  # Drop the folder from an earlier build if the name changed (older builds used the team name).
  old=$(jq -r --arg t "$team" '.[$t].folder // $t' "$STATE")
  case "$old" in
    "$folder" | "" | . | .. | scripts | */*) ;;
    *) [ ! -d "$ROOT/$old" ] || { echo "    removing old folder: $old/" >&2; rm -rf "${ROOT:?}/$old"; } ;;
  esac
  rm -rf "$dest"
  mkdir -p "$dest"
  git -C "$clone" archive HEAD | tar -x -C "$dest"
  license=$(gh api "repos/$slug" --jq '.license.spdx_id // "None"' 2>/dev/null || echo None)

  large=$(cd "$dest" && find . -type f -size +50M | sed 's#^\./##' | sort)
  if [ -n "$large" ]; then
    while IFS= read -r f; do
      echo "    removed (over 50 MB): $f" >&2
      rm -f "$dest/$f"
    done <<< "$large"
  fi

  set_state "$team" "$(jq -n --arg slug "$slug" --arg folder "$folder" --arg sha "$sha" --arg date "$date" \
    --arg license "$license" --arg large "$large" \
    '{slug: $slug, folder: $folder, status: "ok", sha: $sha, date: $date, license: $license,
      large_removed: ($large | split("\n") | map(select(. != ""))), secrets_removed: []}')"
}

if [ $# -gt 0 ]; then
  jq -e --arg t "$1" 'any(.[]; .team_name == $t or .folder == $t)' "$WORK/entries.json" >/dev/null ||
    { echo "no entry for project or team: $1" >&2; exit 1; }
  jq --arg t "$1" 'map(select(.team_name == $t or .folder == $t))' "$WORK/entries.json" > "$WORK/selected.json"
else
  cp "$WORK/entries.json" "$WORK/selected.json"
fi

while IFS=$'\t' read -r team url folder <&3; do
  snapshot "$team" "$url" "$folder"
done 3< <(jq -r '.[] | [.team_name, .repo_url, .folder] | @tsv' "$WORK/selected.json")

# --- Secret scan ----------------------------------------------------------------

command -v gitleaks >/dev/null || brew install gitleaks
rm -f "$GITLEAKS_REPORT"
# Findings reviewed as false positives are listed in .gitleaksignore (read from $ROOT).
(cd "$ROOT" && gitleaks dir . --redact --no-banner --exit-code 0 --report-path "$GITLEAKS_REPORT")

jq -r '.[] | [(.File | sub("^\\./"; "")), .RuleID] | @tsv' "$GITLEAKS_REPORT" | sort -u > "$WORK/leaks.tsv"
while IFS=$'\t' read -r file rule; do
  folder=${file%%/*}
  team=$(jq -r --arg f "$folder" 'to_entries[] | select(.value.folder == $f and .value.status == "ok") | .key' "$STATE")
  if [ "$folder" = "$file" ] || [ -z "$team" ]; then
    echo "gitleaks flagged a showcase file, fix it by hand: $file ($rule)" >&2
    exit 1
  fi
  echo "    removed (gitleaks $rule): $file" >&2
  rm -f "$ROOT/$file"
  jq --arg t "$team" --arg f "${file#*/}" --arg r "$rule" \
    '.[$t].secrets_removed = (.[$t].secrets_removed + [{file: $f, rule: $r}] | unique)' \
    "$STATE" > "$WORK/state.json" && mv "$WORK/state.json" "$STATE"
done < "$WORK/leaks.tsv"

# --- README -----------------------------------------------------------------------

# Extra row notes, keyed by team.
team_note() {
  case "$1" in
    "The Ledgers") echo 'Built at the hackathon: [ronaldon2023/ledgers-receipts](https://github.com/ronaldon2023/ledgers-receipts)' ;;
  esac
}

jq -n '{}' > "$WORK/notes.json"
while IFS= read -r team <&3; do
  note=$(team_note "$team")
  if [ -n "$note" ]; then
    jq --arg t "$team" --arg n "$note" '.[$t] = $n' "$WORK/notes.json" > "$WORK/n.json" && mv "$WORK/n.json" "$WORK/notes.json"
  fi
done 3< <(jq -r '.[].team_name' "$WORK/entries.json")

rows() { # ok|missing|removed
  jq -r --arg want "$1" \
    --slurpfile results "$WORK/results.json" --slurpfile state "$STATE" --slurpfile notes "$WORK/notes.json" '
    def cell: (. // "") | gsub("[\r\n]+"; " ") | gsub("\\|"; "\\|");
    def award: if . == 1 then "1st place" elif . == 2 then "2nd place" elif . == 3 then "3rd place"
               elif . == 4 or . == 5 then "Finalist" else "" end;
    def removed: (.large_removed | map("`\(.)` (over 50 MB)"))
                 + (.secrets_removed | map("`\(.file)` (flagged by gitleaks: \(.rule))"));
    ($results[0] | map({(.team_name): .place}) | add // {}) as $places
    | map(. + {place: $places[.team_name], snap: $state[0][.team_name], note: $notes[0][.team_name]})
    | sort_by([(.place // 99), .folder])
    | if $want == "ok" then
        map(select(.snap.status == "ok")) | .[]
        | .snap as $s
        | ($s | removed) as $r
        | (if ($r | length) == 0 then ""
           elif ($r | length) <= 3 then $r | map("<br>Removed " + .) | join("")
           else "<br>Removed \($r | length) files, see [Removed files](#removed-files)" end) as $removed
        | (if (.repo_url | test("/tree/")) then .repo_url else "https://github.com/\($s.slug)" end) as $href
        | "| [\(.title // .team_name | cell)](\(.folder)/) | \(.team_name | cell) | \(.tagline | cell) | \(.place | award) "
          + "| [\($s.slug)](\($href))\(if .note then "<br>" + .note else "" end) "
          + "| \(if .video_url then "[Watch](\(.video_url))" else "" end) "
          + "| \(if $s.license == "NOASSERTION" then "Other" else $s.license end) "
          + "| [`\($s.sha[0:7])`](https://github.com/\($s.slug)/tree/\($s.sha)) \($s.date)\($removed) |"
      elif $want == "removed" then
        map(select(.snap.status == "ok" and (.snap | removed | length) > 0)) | .[]
        | "\n**\(.folder)/** (\(.team_name))\n", (.snap | removed | map("- " + .) | .[])
      else
        map(select(.snap.status != "ok")) | .[]
        | "- **\(.team_name)**: \(.title // "" | cell) ([\(.repo_url)](\(.repo_url)))"
      end
  ' "$WORK/entries.json"
}

{
  cat <<EOF
# Claude Impact Lab Hackathon: Seattle, Oct 25, 2026

Projects built at the [Claude Impact Lab Hackathon](https://hack.claudeseattle.org) in Seattle on October 25, 2026. The theme: AI tools, workflows and playbooks that small businesses can adopt.

Each folder below is one team's project, named after the project.

| Project | Team | Tagline | Award | Original repo | Demo video | License | Snapshot |
| --- | --- | --- | --- | --- | --- | --- | --- |
EOF
  rows ok
  missing=$(rows missing)
  if [ -n "$missing" ]; then
    printf '\n## Coming soon\n\nThese projects could not be copied yet:\n\n%s\n' "$missing"
  fi
  cat <<EOF

## About the snapshots

Each folder is a static copy of the team's repository at the commit shown in the Snapshot column, taken without git history. The original repo has the latest version.
EOF
  removed=$(rows removed)
  if [ -n "$removed" ]; then
    printf '\n## Removed files\n\nLeft out of the snapshots. Files over 50 MB are too big for GitHub; the others matched a [gitleaks](https://github.com/gitleaks/gitleaks) secret-scanning rule, which can include false positives. The original repos still have them.\n%s\n' "$removed"
  fi
  cat <<EOF

## Use a project

Copy one project by its folder name:

\`\`\`bash
npx degit $OWNER/$REPO/<folder> my-copy
\`\`\`

For example, \`npx degit $OWNER/$REPO/neri-cash my-copy\`.

Or get everything:

\`\`\`bash
git clone https://github.com/$OWNER/$REPO.git
\`\`\`

## Licensing

- These projects were submitted to an event advertised as open source.
- A project's own LICENSE file governs its folder.
- Projects without a LICENSE file (License column shows "None") haven't chosen a license yet. To reuse one, contact the team through its original repo, or [open an issue](https://github.com/$OWNER/$REPO/issues) here and we'll pass the request along.
- Each project's copyright belongs to its team.
- Everything here is provided as is, without warranty of any kind. Responsibility for use, liability and license compliance rests with the original creators and the people who use the code.

This repository's own files (this README and \`scripts/\`) are under the [MIT License](LICENSE).

## Rebuilding

\`scripts/build.sh\` rebuilds every project; \`scripts/build.sh <folder>\` rebuilds one.
EOF
} > "$ROOT/README.md"

echo "README.md written"
if [ -s "$WORK/leaks.tsv" ]; then
  echo "gitleaks removals (file, rule):"
  cat "$WORK/leaks.tsv"
fi
jq -r 'to_entries[] | select(.value.status != "ok") | "not copied: \(.key) (\(.value.slug))"' "$STATE"
