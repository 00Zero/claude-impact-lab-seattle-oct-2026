#!/usr/bin/env bash
# Confirms GTMagic's API keys are present and accepted, without ever printing them.
#
# Usage: scripts/check-keys.sh [tavily] [openrouter]     (no arguments = both)
# Exit status: 0 when every key checked was accepted (warnings allowed), 1 otherwise. With no
# arguments, a missing optional key (OpenRouter) is only a warning; name it to require it.
#
# Each key is looked up where the skills look (environment variable, then macOS Keychain) and sent
# to the provider's free "who am I" endpoint, so a check spends no search or model credits.
set -uo pipefail
set +x  # never trace: a trace would print the key

here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source-path=SCRIPTDIR source=lib/keys.sh
. "$here/lib/keys.sh"

named_explicitly=$#
# shellcheck disable=SC2086  # word-splitting the provider list is intended
[ $# -gt 0 ] || set -- $KEY_PROVIDERS
for provider in "$@"; do provider_info "$provider" || exit 1; done

body_file="$(mktemp "${TMPDIR:-/tmp}/gtmagic-keycheck.XXXXXX")"
err_file="$(mktemp "${TMPDIR:-/tmp}/gtmagic-keycheck.XXXXXX")"
trap 'rm -f "$body_file" "$err_file"' EXIT

report() {  # $1 = ok|warn|fail, $2 = message
  printf '  %-6s %-11s %s\n' "[$1]" "$PROVIDER_NAME" "$2"
}

detail() {  # a follow-up line, indented under the message
  printf '%21s%s\n' "" "$1"
}

note_env_override() {  # a stale env var silently shadowing a fresh Keychain key is the classic trap
  if [ "$KEY_SOURCE" = "env" ] && keychain_has "$KEY_SERVICE"; then
    detail "Note: \$$KEY_ENV_VAR is set, so the Keychain item '$KEY_SERVICE' is being ignored."
  fi
}

# Returns 0 when the key is usable, 1 otherwise. Counts warnings in $warnings.
check_one() {
  provider_info "$1"
  resolve_key

  if [ -z "$KEY_VALUE" ] && [ -n "$KEY_OPTIONAL_FOR" ] && [ "$named_explicitly" -eq 0 ]; then
    report warn "no key found; optional, only $KEY_OPTIONAL_FOR needs it. Add one: scripts/setup-keys.sh $1"
    warnings=$((warnings + 1))
    return 0
  fi
  if [ -z "$KEY_VALUE" ]; then
    report fail "no key found. Run: scripts/setup-keys.sh $1"
    return 1
  fi

  local source result status curl_rc verdict
  source="$(key_source_label)"

  : >"$body_file"
  : >"$err_file"
  result="$(probe_key "$KEY_VALUE" "$body_file" "$err_file")"
  KEY_VALUE=""
  status="${result% *}"
  curl_rc="${result#* }"

  case "$status" in
    200)
      if [ "$curl_rc" != "0" ]; then
        report fail "the answer from $PROVIDER_NAME was cut off ($(head -n 1 "$err_file")). Try again."
        return 1
      fi
      verdict="$(read_usage "$1" "$body_file")"
      report "${verdict%% *}" "${verdict#* } (key from $source)"
      [ "${verdict%% *}" != "warn" ] || warnings=$((warnings + 1))
      note_env_override
      [ "${verdict%% *}" != "fail" ]
      return
      ;;
    401 | 403)
      report fail "the key from $source was rejected (HTTP $status)."
      if [ "$KEY_SOURCE" = "env" ]; then
        detail "Fix or unset \$$KEY_ENV_VAR (check your shell profile too)."
        note_env_override
      else
        detail "Copy a fresh key from $KEY_HELP_URL and run: scripts/setup-keys.sh $1"
      fi
      ;;
    000)
      report fail "couldn't reach $PROVIDER_NAME ($(head -n 1 "$err_file")). Check your network or VPN."
      ;;
    429)
      report fail "$PROVIDER_NAME is rate-limiting (HTTP 429), so the key couldn't be confirmed. Try again in a minute."
      ;;
    *)
      report fail "$PROVIDER_NAME answered HTTP $status, so the key couldn't be confirmed. Try again later."
      ;;
  esac
  return 1
}

if ! command -v curl >/dev/null 2>&1; then
  echo "check-keys needs curl, which ships with macOS; install it from your package manager." >&2
  exit 1
fi

echo "Checking GTMagic API keys (the keys themselves are never shown):"
failures=0
warnings=0
for provider in "$@"; do
  check_one "$provider" || failures=$((failures + 1))
done

if [ "$failures" -eq 0 ] && [ "$warnings" -eq 0 ]; then
  echo "All set: every key was accepted, and none is known to be out of credits."
elif [ "$failures" -eq 0 ]; then
  echo "Usable, with $warnings warning(s) above."
else
  echo "$failures key(s) need attention; see above."
  exit 1
fi
