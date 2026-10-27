# GTMagic

> Find out who will buy from you, why, and what to say to them, before you spend money on marketing.

GTMagic helps small businesses and founders work out who to sell to and what to say. It researches your market and builds a synthetic audience from **real customer quotes**. It then has that audience choose blind between competing messages, including your current headline. You get three plain answers: who to target, what to say, and what to try this week.

![The original whiteboard sketch](docs/sketch.webp)

## Status: the skills work today, with a local web app

GTMagic runs today as a set of skills inside Claude Code. To try them, see [Getting started](#getting-started).

| Skill | What it does |
|---|---|
| `gtm-intake` | Interviews you and researches your market, then works out who to target and your first messaging lines |
| `gtm-message-test` | Tests competing messages on simulated customers and reports which message, and which customer group, responded best |
| `gtm-ad-wording` | Writes and compares ad wording, and screens your own variants before you spend money |
| `gtm-evaluate` | Ranks ads you already run, using simulated customers (needs a separate paid Anthropic API key) |
| `gtm-web` | Runs the `gtm-intake` interview in a local web page instead of the terminal |

- **In progress:** deeper research (`gtm-research`; the spec is in [docs/skills/RESEARCH.md](docs/skills/RESEARCH.md)) and draft ads (`gtm-creatives`).
- **Web app (local):** `npm install`, then `npm run dev`, open http://127.0.0.1:3000 and click **Start a new session** (it runs Claude Code in the background with your login) or **Try the example**. The hosted version in "How one run works" isn't built.
- **Also in the repo:** `evals/` (checks whether GTMagic reaches the conclusions real founders reached).

### Planned before the event

The docs in `docs/` (requirements, architecture, data contracts, task split) and the folder READMEs were written before the event as planning. All code is written during the hackathon.

## How one run works

1. **Describe your business:** a description, plus optionally your website, your guess at your best customer, your current headline, and pasted customer reviews or emails. Or click **Try an example**.
2. **Research:** finds customer groups, competitors, and how real customers describe the problem, each with a source link.
3. **Audience:** about 48 synthetic customers, each built from one customer group and "talking like" 3–5 real quotes. It's rebuilt fresh from the evidence on every run, so it never drifts.
4. **Test:** each customer sees 4–6 messages plus your current headline, unbranded and in a balanced order, and picks one or "none of these."
5. **Decide:** a recommendation computed from the counts, including an honest "your guess was right" when it is. Then objections, draft copy, and a ranked list of cheap real-world tests.

Synthetic customers produce **hypotheses to test**, not proof. Every result is labeled that way.

## Docs

| Doc | What's in it |
|---|---|
| [REQUIREMENTS.md](docs/REQUIREMENTS.md) | Who it's for, MVP scope, acceptance criteria, how we score against the judging, open questions |
| [TECH_STACK.md](docs/TECH_STACK.md) | Stack, models, cost and time per run, Claude API facts |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Pipeline, orchestration, failure handling, API, storage, security |
| [CONTRACTS.md](docs/CONTRACTS.md) | The data passed between modules: the team's shared language |
| [TASKS.md](docs/TASKS.md) | Work per owner, checkpoints, demo plan |
| [COLLABORATION.md](docs/COLLABORATION.md) | GitHub workflow, ownership, Day-0 and after-event checklists |

## Team

| Workstream | Owner | Folders |
|---|---|---|
| Platform & Integration (lead) | Nick | `src/contracts`, `src/platform`, `src/app/api` |
| Market Intelligence & Strategy | _TBD_ | `src/modules/market-intelligence`, `src/modules/reporting` |
| Synthetic Audience | _TBD_ | `src/modules/audience` |
| Positioning & Experiments | _TBD_ | `src/modules/positioning`, `src/modules/experiments` |
| Founder Experience (+ pitch, user research) | _TBD_ | `src/app` (UI), `src/components` |

## Getting started

This guide assumes you've never used a terminal or GitHub. It takes about 30 minutes, most of it waiting for downloads. You need:

- **A Mac.** (On Windows or Linux, see [docs/KEYS.md](docs/KEYS.md#not-on-a-mac).)
- **A paid Claude plan** (Pro or higher). The free plan doesn't include Claude Code, the app that runs GTMagic.
- **A card for OpenRouter credits**, only if you'll make draft ads (Option B, step 5). A few dollars is plenty.

There are two ways to set up. In **Option A**, Claude does most of the work and tells you when it needs you. In **Option B**, you do every step yourself. Both end in the same place.

### Option A: let Claude set it up for you

1. **Install the Claude app.** Download it for Mac from [claude.com/download](https://claude.com/download), open the downloaded file, and drag **Claude** into **Applications**. Open it (if your Mac warns that it came from the internet, click **Open**) and sign in with the account that has your paid plan.
2. **Start a Code session in your home folder.**
   1. Click **Code** at the top of the sidebar.
   2. Under the message box, click the first control (the environment) and choose the top entry under **Local**.
   3. Click the folder control next to it, choose **Open folder…**, press **⌘ + Shift + H** to jump to your home folder (the one with your name), and click **Open**.
3. **Send Claude the setup request.** Copy this whole message, paste it into the message box, and send it:

```text
Please set up GTMagic on this Mac for me. I'm not technical, so explain each step in plain words and tell me exactly what to click whenever you need me.

1. Check that git works by running `git --version`. If it doesn't, run `xcode-select --install`. Tell me to click Install (not "Get Xcode") and then Agree in the window that pops up, and wait until I say Apple's window shows the install finished.
2. Download GTMagic by running `git clone https://github.com/nsbogert/GTMagic.git ~/GTMagic`. If that folder already exists, run `git pull` inside it instead.
3. Read the "Getting started" section of ~/GTMagic/README.md. Using its "Get a Tavily key" step, tell me how to get a Tavily API key, one step at a time, and have me leave that browser tab open. Skip the OpenRouter key unless I say I need draft ads.
4. Have me save the key myself. Tell me to open the Terminal app and run `cd ~/GTMagic && scripts/setup-keys.sh` first. Then, when it shows "Paste your Tavily API key", I switch to my browser, copy the key, switch back to Terminal and paste it. Explain that the paste stays invisible, and that if it asks "Replace it? [y/N]" I type y, not the key. Wait until I say I'm done.
5. Run `scripts/check-keys.sh` in ~/GTMagic and explain the result. If any line says [fail], help me fix it using the README's "If something goes wrong" table.
6. Finally, tell me how to start a new Local Code session with ~/GTMagic as its folder (GTMagic only works from there), and how to start my first GTMagic run.

Rules:
- Only work in ~/GTMagic. Don't open or change anything else in my home folder.
- Never ask me to paste an API key into this chat, and never look at a key yourself. scripts/check-keys.sh is the only way to test one, and it never shows it.
- Only I open websites, in my own browser. Don't use a built-in browser, take screenshots, or watch a terminal you can read while I handle keys.
- If I paste a key into this chat by mistake, tell me to delete that key on the provider's website and make a new one.
- Never sign up, sign in or pay for anything for me.
```

Claude stops and hands things back to you whenever only you should do them:

- **Approving commands.** Claude may ask before it runs a command. Click **Allow** for commands about GTMagic setup (like `git`, `xcode-select` or `scripts/check-keys.sh`), and **Deny** anything else.
- **Clicking Install** in Apple's developer-tools window.
- **Signing up on Tavily** in your own browser.
- **Pasting your key into Terminal**, never into the chat.

If your Mac asks whether Claude may access Documents, Desktop or another folder, click **Don't Allow**; setup doesn't need them. If you get stuck, switch to Option B: developer tools are step 2, downloading is step 3, keys are steps 4–6, and running GTMagic is step 8.

### Option B: set it up by hand

#### 1. Open Terminal

Terminal is a Mac app where you type commands instead of clicking. It's already on your Mac.

1. Press **Command (⌘) + Space** to open Spotlight search.
2. Type `Terminal` and press **Return**.

A window opens with a line ending in `%`. That's the prompt: Terminal is waiting for a command. To run any command in this guide:

1. Hover over the grey box with the command and click the **copy** button in its top-right corner.
2. Click in the Terminal window and press **⌘ + V** to paste.
3. Press **Return**, then wait until a new line ending in `%` appears before running the next command.

Good to know:

- When Terminal asks for a password or a key with `Paste…`, **nothing shows up as you type or paste**. That's on purpose, and the key is still there.
- Questions ending in `[y/N]` are not hidden. Answer them by typing `y` (yes) or `n` (no), then pressing **Return**. Never paste a key at a `[y/N]` question.
- Press **Control + C** to stop a command that's stuck.

#### 2. Install Apple's free developer tools

GTMagic needs two free tools that Apple provides: **git** (downloads GTMagic and keeps it up to date) and **Python** (runs GTMagic's small helper programs). Run:

```bash
xcode-select --install
```

- **If a window pops up:** click **Install** (not "Get Xcode"), then **Agree**. Terminal shows the `%` prompt again right away; ignore it. Wait until Apple's window says the software was installed (5–15 minutes), then click **Done**.
- **If Terminal says the tools are already installed:** you're done with this step.

To confirm it worked, run this. It should print a line starting with `git version`:

```bash
git --version
```

#### 3. Download GTMagic

GTMagic's files live on GitHub, a website where teams share code. Making your own copy is called **cloning**. Your copy stays linked to the shared one, so you can get updates later (step 9). You don't need a GitHub account for this. Run these three commands, one at a time:

```bash
cd ~
```

```bash
git clone https://github.com/nsbogert/GTMagic.git
```

```bash
cd GTMagic
```

What they do: `cd ~` moves Terminal to your **home folder** (the one with your name on it in Finder), `git clone …` downloads GTMagic into a new folder there called **GTMagic**, and `cd GTMagic` moves Terminal into that folder.

To see the folder in Finder, click **Finder** in the Dock, then choose **Go → Home** from the menu bar.

#### 4. Get a Tavily key (for web research)

GTMagic researches your market by searching the web through a service called Tavily. An **API key** is like a password that lets GTMagic use your Tavily account.

1. Go to [app.tavily.com](https://app.tavily.com) and sign up. The free plan includes a monthly allowance of searches.
2. On the main page, find **API Keys**. Your key starts with `tvly-`.
3. **Leave this browser tab open.** You'll copy the key from it in step 6.

**Never paste a key into a chat (including Claude), an email, Slack or a document.** Step 6 is the only place it goes.

#### 5. Optional: get an OpenRouter key (only for draft ads)

Skip this step unless you'll use `gtm-creatives`, which writes draft ads with an AI model from OpenAI through a service called OpenRouter. That part of GTMagic is still being built.

<details>
<summary>Show the OpenRouter steps</summary>

1. Go to [openrouter.ai](https://openrouter.ai) and sign up.
2. Open [Settings → Credits](https://openrouter.ai/settings/credits) and add a few dollars. Without credits, the key doesn't work.
3. Open [Settings → API Keys](https://openrouter.ai/settings/keys) and click **Create Key**. Name it `gtmagic` and set a **credit limit** (for example, 5) so it can never spend more than that.
4. OpenRouter shows the key (it starts with `sk-or-`) only once. **Leave that window open** until you finish step 6.

</details>

#### 6. Save your keys

This stores your keys in the **Keychain**, the same secure place your Mac keeps your passwords. If you closed Terminal, open it again (step 1). Then run these two commands:

```bash
cd ~/GTMagic
```

```bash
scripts/setup-keys.sh
```

It asks for each key in turn. Your clipboard now holds the command you just copied, so copy each key only when its prompt appears:

1. At `Paste your Tavily API key`:
   1. Switch to your browser with **⌘ + Tab**.
   2. Click the **copy** button next to your Tavily key.
   3. Click back in Terminal, press **⌘ + V**, then press **Return**. Nothing appears when you paste; that's normal.
2. At `Paste your OpenRouter API key`, do the same with your OpenRouter key. If you skipped step 5, just press **Return**.
3. It then tests each key and prints one line per key:
   - `[ok]` means the key works.
   - `[warn]` means read the message. A skipped OpenRouter key shows as `[warn]`, and that's fine.
   - `[fail]` means something needs fixing. See [If something goes wrong](#if-something-goes-wrong).

You're done when the last line says `All set…` or `Usable, with 1 warning(s) above`.

To redo one key later, run the line for that key. If it asks `Replace it? [y/N]`, type `y` and press **Return**, then paste the new key at the hidden prompt.

```bash
scripts/setup-keys.sh tavily
```

```bash
scripts/setup-keys.sh openrouter
```

#### 7. Install the Claude app

Claude Code is the part of the Claude app that runs GTMagic.

1. Download the Claude app for Mac from [claude.com/download](https://claude.com/download).
2. Open the downloaded file and drag **Claude** into **Applications**.
3. Open Claude from Applications. If your Mac warns that it was downloaded from the internet, click **Open**.
4. Sign in with the Claude account that has your paid plan.

<details>
<summary>Prefer Terminal? Install the command-line version instead</summary>

Run this. It shows no progress for a minute or two while it downloads, so don't stop it.

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

When it finishes, close Terminal, open a new window, and run `claude --version` to check that it installed. To start GTMagic later, run `cd ~/GTMagic` and then `claude`. The first time, a browser window opens so you can sign in with your Claude account. If it asks whether you trust this folder, choose **Yes**. Anthropic's [install help](https://code.claude.com/docs/en/troubleshoot-install) covers problems.

</details>

#### 8. Run GTMagic

1. In the Claude app, click **Code** at the top of the sidebar.
2. Under the message box, click the first control (the environment) and choose the top entry under **Local**. (Cloud sessions can't use your saved keys.)
3. Click the folder control next to it and choose **Open folder…**. Press **⌘ + Shift + H** to jump to your home folder, select **GTMagic**, and click **Open**.
4. Describe your business in plain words, for example: *"Who should I target? I run a mobile dog-grooming van."*

GTMagic interviews you, researches your market, and writes up the results. Claude may ask before running a command. Allow the ones that start with `python3`: those are GTMagic's own helper programs. If Claude ever asks you to paste a key into the chat, say no and run `scripts/check-keys.sh` in Terminal instead.

Your results are saved in the `gtm-workspace` folder inside GTMagic, on your computer only. What you type is sent to Claude, and search terms are sent to Tavily, to do the research.

One feature, ranking ads you already run (`gtm-evaluate`), needs a separate paid Anthropic API key. Skip it unless the team gives you one; [docs/KEYS.md](docs/KEYS.md#how-the-keys-are-found) shows how to save it.

#### 9. Later: get updates and recheck keys

To get the newest version of GTMagic, run these in Terminal:

```bash
cd ~/GTMagic
```

```bash
git pull
```

To test your keys at any time (it never shows them and uses no credits):

```bash
scripts/check-keys.sh
```

### If something goes wrong

| What you see | What to do |
|---|---|
| `command not found: git`, or `xcrun: error` | The developer tools aren't installed yet. Do step 2 |
| `no such file or directory: scripts/…` | Terminal isn't in the GTMagic folder. Run `cd ~/GTMagic` and try again |
| `destination path 'GTMagic' already exists` | You already downloaded it. Run `cd ~/GTMagic`, then `git pull` |
| `command not found: claude` | Use the Claude app (step 7), or close Terminal, open a new window and try again |
| `has spaces or symbols an API key doesn't contain` | Something other than the key was pasted. Copy the key again from the website, then rerun step 6 |
| `keys usually start with … Save it anyway? [y/N]` | You probably copied the wrong thing. Type `n`, press Return, and rerun step 6 |
| `[fail] … no key found` | Run step 6 again and paste the key when asked |
| `[fail] … was rejected (HTTP 401)` (or 403) | The key was mistyped or deleted. Copy it again from the website and rerun step 6 |
| `no credits bought on this account yet` | Add credits on OpenRouter (step 5) |
| `credit limit is used up` or `plan credits are used up` | Raise the key's limit or add credits on the provider's website |
| `is rate-limiting (HTTP 429)` | Wait a minute and run `scripts/check-keys.sh` again |
| `couldn't reach …` or `was cut off` | An internet or VPN problem. Check your connection and try again |
| `[warn] … credit details couldn't be read` | The key works. You can check your credits on the provider's website |

Stuck? Ask in the team chat, and include what you ran and what Terminal printed. Never include your keys.

### Not on a Mac, or a developer?

Linux and Windows setup, and how the key scripts work, are in [docs/KEYS.md](docs/KEYS.md).
