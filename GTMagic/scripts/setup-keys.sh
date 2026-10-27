#!/usr/bin/env bash
# Saves GTMagic's API keys in your macOS Keychain, then checks them.
#
# Usage: scripts/setup-keys.sh [tavily] [openrouter]     (no arguments = both)
#
# Why the Keychain: the key is typed at a hidden prompt and handed to the Keychain over stdin, so it
# never lands in shell history, a file in the repo, the process list, a commit or a chat transcript.
# The skills read it back from the same place (service gtmagic-tavily / gtmagic-openrouter,
# account $USER), or from TAVILY_API_KEY / GTMAGIC_OPENROUTER_API_KEY if you set those instead.
set -euo pipefail
set +x  # never trace: a trace would print the key

here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source-path=SCRIPTDIR source=lib/keys.sh
. "$here/lib/keys.sh"

check_args=("$@")  # the check gets only what the user named, so "no arguments" keeps OpenRouter optional
# shellcheck disable=SC2086  # word-splitting the provider list is intended
[ $# -gt 0 ] || set -- $KEY_PROVIDERS
for provider in "$@"; do provider_info "$provider" || exit 1; done

if ! has_keychain; then
  cat >&2 <<'EOF'
This script saves keys in the macOS Keychain, so it only runs on a Mac.
On Linux or WSL, put the keys in your shell profile instead (see docs/KEYS.md):
  export TAVILY_API_KEY=...   export GTMAGIC_OPENROUTER_API_KEY=...
then open a new terminal and run: scripts/check-keys.sh
EOF
  exit 1
fi

if [ ! -t 0 ]; then
  echo "Run this in a terminal: it asks for each key at a hidden prompt." >&2
  exit 1
fi

# macOS's bash 3.2 leaves typing invisible if you press Ctrl-C at the hidden prompt, so restore the
# terminal on any exit. (An INT trap wouldn't help: bash 3.2 holds it until `read` returns.)
saved_tty="$(stty -g 2>/dev/null || true)"
trap '[ -z "$saved_tty" ] || stty "$saved_tty" 2>/dev/null' EXIT

yes_no() {  # $1 = question. Returns 0 for y/yes.
  local answer
  read -r -p "$1 [y/N] " answer
  [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]
}

save_one() {
  provider_info "$1"
  echo
  echo "== $PROVIDER_NAME =="

  if keychain_has "$KEY_SERVICE"; then
    if ! yes_no "There's already a $PROVIDER_NAME key saved. Replace it?"; then
      echo "Kept the saved key."
      return 0
    fi
  fi

  local key
  if ! read -r -s -p "Paste your $PROVIDER_NAME API key (typing is hidden), then press Return: " key; then
    key=""
    echo
    echo "The input ended before Return, so nothing was saved." >&2
    return 1
  fi
  echo
  key="$(trim "$key")"

  if [ -z "$key" ]; then
    echo "Nothing entered, so nothing was saved. Get a key at $KEY_HELP_URL"
    return 0
  fi
  if ! is_plain_key "$key"; then
    key=""
    echo "That has spaces or symbols an API key doesn't contain. Nothing saved; copy the key again." >&2
    return 1
  fi
  if [[ "$key" != "$KEY_PREFIX"* ]] &&
    ! yes_no "$PROVIDER_NAME keys usually start with '$KEY_PREFIX' and this one doesn't. Save it anyway?"; then
    key=""
    echo "Nothing saved."
    return 0
  fi

  if ! keychain_write "$KEY_SERVICE" "GTMagic $PROVIDER_NAME API key" "$key"; then
    key=""
    echo "The Keychain refused the key (is your Keychain locked?). Nothing saved." >&2
    return 1
  fi
  key=""
  echo "Saved in your Keychain as '$KEY_SERVICE'."

  if [ -n "$(env_key)" ]; then
    echo "Heads-up: \$$KEY_ENV_VAR is set in this shell, and it takes priority over the Keychain."
    echo "Unset it (and remove it from your shell profile) if you want the key you just saved to be used."
  fi
}

echo "GTMagic key setup. Keys are saved to your Keychain only; they are never shown or written to the repo."
setup_failed=0
for provider in "$@"; do
  # `if` keeps one bad paste from stopping the other key; the failure still sets the exit status.
  if ! save_one "$provider"; then setup_failed=1; fi
done

echo
check_failed=0
# ${arr[@]+...} expands an empty array safely under `set -u` on bash 3.2
"$here/check-keys.sh" ${check_args[@]+"${check_args[@]}"} || check_failed=1
if [ "$setup_failed" -ne 0 ]; then
  echo "Not every key you entered was saved (see above); rerun the setup for that key."
fi
[ "$setup_failed" -eq 0 ] && [ "$check_failed" -eq 0 ]
