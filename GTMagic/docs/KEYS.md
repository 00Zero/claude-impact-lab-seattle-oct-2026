# API keys: technical notes

The step-by-step setup for everyone is in the [README](../README.md#getting-started). This page covers other operating systems and how the key scripts work.

## Not on a Mac?

`scripts/setup-keys.sh` needs the macOS Keychain. On Linux or Windows (WSL), add these two lines, with your real keys, to your shell profile (`~/.bashrc` or `~/.zshrc`) using a text editor. Don't type them at the prompt, because that saves the keys in your shell history.

```bash
export TAVILY_API_KEY="tvly-..."
export GTMAGIC_OPENROUTER_API_KEY="sk-or-..."
```

Then open a new terminal and run `scripts/check-keys.sh`, which works anywhere with bash and curl. There's no key-file option: the skills read keys only from these variables or the Keychain, so a key file in the repo would be invisible to them.

## How the keys are found

The skills, and `check-keys.sh`, look for each key in this order:

| Key | 1. Environment variable | 2. Keychain item (account: your macOS user) |
|---|---|---|
| Tavily | `TAVILY_API_KEY` | `gtmagic-tavily` |
| OpenRouter | `GTMAGIC_OPENROUTER_API_KEY` | `gtmagic-openrouter` |
| Anthropic (`gtm-evaluate`) | `GTMAGIC_ANTHROPIC_API_KEY` | `gtmagic-anthropic` |

- **Precedence.** The environment variable wins, so an old one in your shell profile hides a fresh Keychain key; the check flags that case. The `GTMAGIC_` prefix means a key set for another project is never billed for GTMagic.
- **How setup handles the key.** It reads the key at a `read -s` prompt and stores it by piping the command into `security -i`, so it never appears in argv. The check sends it with `curl -q -H @-` (`-q` ignores `~/.curlrc`) and calls free account endpoints: Tavily `GET /usage` and OpenRouter `GET /api/v1/key`. Both scripts turn off `set -x`.
- **Exit codes.** `check-keys.sh` exits 0 when every key it checks was accepted (warnings allowed), and 1 otherwise. A missing OpenRouter key is a warning unless you name it (`scripts/check-keys.sh openrouter`). For OpenRouter the check sees only the key's credit limit, not the account balance. `setup-keys.sh` also exits 1 if a key you entered wasn't saved.
- **Anthropic key, not scripted yet.** `gtm-evaluate` calls the Claude API with its own key, billed to your Anthropic API account (a Claude subscription doesn't cover it). To store it, run `security add-generic-password -U -s gtmagic-anthropic -a "$USER" -w` and paste the key at the hidden prompt (it asks twice).

## Contributing

To push branches, ask Nick for Write access to the repo. Node isn't needed for the skills; `evals/` has its own setup in [evals/README.md](../evals/README.md).
