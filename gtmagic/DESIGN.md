---
name: GTMagic
description: Find out who will buy from you and what to say to them, counted one figure per customer.
colors:
  ground: "#fbfbf8"
  ink: "#1d1d1b"
  ink-2: "#4a4945"
  ink-3: "#6a6863"
  rule: "#d8d6cf"
  tint: "#efeee8"
  paper: "#ffffff"
  on-ink: "#f4f3ee"
  on-ink-2: "#b9b7af"
  group-red: "#c8372a"
  group-blue: "#2c5aa0"
  group-ochre: "#b5790a"
  group-green: "#3d7a4f"
  none-grey: "#8a8780"
  sim-bg: "#f3f2ed"
  highlight: "#f2d8a0"
  rail-ochre: "#e6b24a"
  rail-ochre-text: "#f0c56c"
  warn: "#8a5a00"
  warn-bg: "#fbf1dc"
  bad: "#a3281d"
typography:
  headline:
    fontFamily: "Jost, Futura, Century Gothic, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Jost, Futura, Century Gothic, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Jost, Futura, Century Gothic, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-small:
    fontFamily: "Jost, Futura, Century Gothic, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  meta:
    fontFamily: "Jost, Futura, Century Gothic, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Jost, Futura, Century Gothic, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  none: "0"
  round: "50%"
spacing:
  xxs: "0.25rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  xxl: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.none}"
    padding: "0.5rem 1.125rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "#3a3936"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.5rem 1.125rem"
    height: "2.75rem"
  button-secondary-hover:
    backgroundColor: "{colors.tint}"
  button-ghost-rail:
    backgroundColor: "transparent"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.none}"
    padding: "0.4375rem 0.75rem"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.375rem 0.875rem"
    height: "2.5rem"
  composer-input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.8125rem 1rem"
    height: "3.25rem"
  send-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.none}"
    size: "3.25rem"
  owner-turn:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.875rem 1.125rem"
  simulated-words:
    backgroundColor: "{colors.sim-bg}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.none}"
    padding: "0.625rem 0.875rem"
  inset-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "1rem 1.125rem"
  rail:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    padding: "1.5rem 1.375rem"
    width: "17.5rem"
  figure:
    width: "1rem"
    height: "2.125rem"
---

# Design System: GTMagic

## Overview

**Creative North Star: "Isotype Count"**

One figure is one customer. GTMagic answers in picture statistics in the Isotype tradition: a flat, upright pictogram stands for one simulated customer, rows of them are counted by eye, and the count beside the row is the only number that matters. The interface around that count is a ruled statistics sheet, not a chat skin. A near-white ground, an ink rail on the left, and plates divided by a heavy ink rule carry everything; colour is reserved almost entirely for saying which customer group a figure belongs to.

The density is that of a working document. A single thread runs at a reading measure, turns arrive inside it, and results land as plates rather than cards. Flat colour, square corners, hairline row dividers and one weight of emphasis (Jost 500) do the structural work that shadows and rounded containers do in category-default products. The world refuses the grey-sidebar, blue-accent, neutral-card-with-progress-bar chat wrapper, and it refuses bar charts and bare percentages for the crowd.

Honesty is drawn, not just written. Real customer words are set as quotes with a source link; simulated words sit in a hue-free, dashed-rule register that can never be mistaken for a real quote; drafts carry a warning-coloured label.

**Key Characteristics:**
- One pictogram per customer, flat-filled in its group colour; "none of these" as a grey outline figure.
- Ink rail (#1d1d1b) left, warm near-white ground, thread centred at a 46rem measure.
- Plates ruled by a 3px ink line on top; rows ruled by 1px warm-grey hairlines.
- Square corners everywhere; circles only for step counters, pending dots and the spinner.
- Jost in two weights (400, 500), tabular numerals throughout.
- No elevation shadows, no decorative gradients.

## Colors

A warm, almost colourless paper-and-ink sheet with four flat Isotype group colours that carry meaning, never decoration.

### Primary
- **Rail Ink** (ink): the left rail, primary buttons, the send button, plate rules, table header rules, the real-quote mark, focus outlines. The structural colour of the whole system.

### Secondary
- **Isotype Red** (group-red): customer group 1 figures, legend swatches and key; also the composer caret and favicon figure.
- **Isotype Blue** (group-blue): customer group 2.
- **Deep Ochre** (group-ochre): customer group 3. Ships darker than the contract's #d99a1e so figures reach at least 3:1 non-text contrast on the ground.
- **Isotype Green** (group-green): customer group 4.
- **None-of-these Grey** (none-grey): outline figures for customers who picked nothing.

### Tertiary
- **Guess Highlight** (highlight): the owner's own claims marked in place: the "Your guess" tag, the "Your headline" tag, text selection, and the composer focus ring.
- **Rail Ochre** (rail-ochre) and **Rail Ochre Text** (rail-ochre-text): the only warm accent on the ink rail: the "Magic" half of the wordmark, the "Example run" badge border and text, and "Your guess" under a legend entry.

### Neutral
- **Warm Ground** (ground): page background.
- **Paper White** (paper): surfaces that sit on the ground and hold input or a focused record: composer, chips, the customer card, the verdict, draft copy blocks.
- **Second Ink** (ink-2): secondary text, metadata, table headers, simulated words.
- **Third Ink** (ink-3): placeholders, quiet labels, pending steps, the simulated-words dashed rule.
- **Warm Hairline** (rule): 1px row dividers, disabled borders.
- **Owner Tint** (tint): the owner's own chat turns, attribute pills, hover fill for secondary buttons and chips.
- **On-Ink** (on-ink) and **On-Ink Muted** (on-ink-2): text on the rail.
- **Simulated Fill** (sim-bg): background of simulated words.
- **Warning** (warn, warn-bg) and **Failure** (bad): thin-evidence notices, draft labels and flag icons; failed steps and error notices.

### Named Rules
**The Hue Is Group Rule.** The four group colours and the none-grey mean "this customer group" and nothing else. No group colour may be used for a button, link, status or decoration.

**The Hue-Free Simulation Rule.** Simulated words are set in a deliberately colourless register: Simulated Fill background, 1px dashed Third Ink rule, Second Ink text, and an outline figure in the label. Because hue means customer group in this world, a tinted simulation box would read as belonging to a group.

**The Contrast Floor Rule.** Every figure colour holds at least 3:1 against the ground. When a historically correct Isotype hue fails (the contract's #d99a1e ochre), darken it rather than lighten the ground.

## Typography

**Display Font:** Jost (with Futura, Century Gothic, system-ui fallback)
**Body Font:** Jost (same stack)

**Character:** A geometric sans in the Futura lineage, the same family of letter Isotype's own charts used. One family, two weights, tabular numerals, so counts line up in columns and the type sits as plainly as the figures.

### Hierarchy
- **Headline** (500, 1.5rem, 1.25 to 1.3, -0.01em): plate titles, the lede line of a GTMagic turn, the wordmark, numbered test indices. Balanced wrapping.
- **Title** (400 or 500, 1.25rem, 1.35 to 1.45): GTMagic's conversational turns (400, max 40rem); answer values, crowd counts and verdict lines (500).
- **Body** (400, 1.0625rem, 1.5): default text; real quotes are body at 500.
- **Body Small** (400, 0.9375rem, 1.35 to 1.45): crowd row messages, group descriptions, table cells, chips, simulated words.
- **Meta** (400, 0.875rem): plate metadata, quote sources, plate footers, key entries.
- **Label** (500, 0.8125rem, sentence case): tags, simulated-words label, draft label, table column heads, the "You" attribution on owner turns.

### Named Rules
**The Two Weights Rule.** Only Jost 400 and 500 ship. Bold and strong map to 500. Hierarchy comes from size and ink level, never from a third weight.

**The Tabular Count Rule.** Numerals are tabular across the whole document so every count, n and rank aligns.

## Layout

A two-column shell: a 17.5rem sticky ink rail (wordmark, run steps, customer-group legend, delete action) and a main column holding a single thread at a 46rem measure plus 2rem side padding, centred. The composer is pinned to the bottom of the main column at the same width. Turns stack with 2rem gaps; inside plates, blocks sit 1.25rem apart under the 1.125rem rule offset.

The crowd is a ledger grid per row: a 1.5rem letter, a message column up to 15rem, a flexible figure run, and a 2.5rem right-aligned count, each row closed by a hairline. Figures sit 0.1875rem apart and wrap; blocks of figures may be grouped with a 0.5rem gap. Answers use a 9rem label column against the value.

Below 52rem the rail becomes a sticky top bar (wordmark, badge, delete action only), thread padding drops to 1.5rem 1rem with 1.5rem gaps, crowd figures move to a second line under the message, and answer rows stack.

Spacing follows a quarter-rem rhythm (0.25, 0.5, 0.75, 1, 1.5, 2, 3rem) with 0.375, 0.625, 0.875 and 1.125rem as in-between steps for compact components.

## Elevation & Depth

Flat. There is no elevation shadow anywhere in the system. Depth and grouping come from three devices only: the ink rail against the ground, the 3px ink rule that opens a plate, and Paper White panels with a 1.5px ink border for a focused record (customer card, verdict). The single box-shadow in the build is the composer's 3px Guess Highlight focus ring, a state indicator rather than elevation. The pinned composer uses a short ground-coloured fade above it so thread text scrolls under it legibly; that is the only gradient, and it is functional.

### Named Rules
**The Ruled Plate Rule.** A results block is a plate: a 3px ink top rule, no radius, no shadow, no surrounding box. If it needs a container to read as a unit, it is not yet a plate.

## Shapes

Square corners throughout (radius 0) for buttons, inputs, chips, panels, tags and plates. Circles (50%) appear only in run-status marks: rail step counters, pending dots and the spinner. Borders carry weight by role: 3px ink opens a plate, 2px ink for primary buttons, the composer and table header rules, 1.5px ink for chips, small buttons and inset panels, 1px warm hairline between rows, 1px dashed Third Ink only for simulated words. The recurring silhouette is the Isotype figure: round head, square shoulders, two legs (16 by 34 viewBox).

## Components

### Buttons
Blunt, ink, square.
- **Shape:** square corners (0), 2px ink border, minimum height 2.75rem.
- **Primary:** Rail Ink fill, On-Ink text, Jost 500, 0.5rem 1.125rem padding; hover lightens fill and border to #3a3936.
- **Secondary:** transparent with ink border and ink text; hover fills with Owner Tint.
- **Small:** 2.25rem minimum height, 1.5px border, 0.9375rem text (used for Copy, Close).
- **Rail ghost:** transparent on ink, 1px #55534e border, On-Ink text; hover brightens the border to On-Ink and fills #2a2a27.
- **Send:** a 3.25rem ink square with an arrow; hover nudges it 2px right.
- **Focus:** 2px ink outline, 2px offset, for every interactive element. Disabled: 0.5 opacity (send turns Warm Hairline).

### Chips
- **Style:** Paper White, 1.5px ink border, 0.9375rem left-aligned text, 2.5rem minimum height; suggested replies under a GTMagic turn.
- **State:** hover fills with Owner Tint.

### Cards / Containers
- **Corner Style:** square (0).
- **Background:** plates sit directly on the ground; the customer card and verdict use Paper White with a 1.5px ink border; owner turns use Owner Tint with no border.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Internal Padding:** 1rem 1.125rem for inset panels; 0.875rem 1.125rem for owner turns.

### Inputs / Fields
- **Style:** Paper White composer, 2px ink border, square, 3.25rem minimum height, Third Ink placeholder, Isotype Red caret.
- **Focus:** outline removed in favour of a 3px Guess Highlight ring.
- **Disabled:** Owner Tint fill, Warm Hairline border.

### Navigation
- **Rail:** Rail Ink background, On-Ink text. Section heads in Meta size at 500 in On-Ink Muted. Run steps are a numbered list with 1.25rem circled counters; running inverts the counter and sets the label at 500; done replaces the number with a check; failed turns the label #f2a097. The legend lists each customer group beside its figure, with "Your guess" in Rail Ochre Text.
- **Mobile:** the rail collapses into a sticky top bar holding the wordmark, badge and delete action.

### Crowd Row (signature)
The core picture statistic. Each message is a hairline-ruled row: letter, message (with "Your headline" as a Label line when it is the owner's), a run of figures in their group colours, and the count. Figures drop into their row as each simulated customer answers (0.45s ease-out). A figure is a button: hover lifts it 3px; pressed adds a 2px ink outline and opens the customer card inline beneath the crowd, never as a modal. A colour key with figure swatches precedes the chart; the status line reads "n of 48 answered" with the count at Title size. On the intro turn, a waiting crowd of 48 outline figures in four rows of 12 under a 3px ink rule fades each figure to 0.12 opacity as its customer answers.

### Real Quote vs Simulated Words
- **Real quote:** body text at 500 under a 2.5rem ink opening quotation mark hung in a 1.75rem indent; source link with an external-link icon in Meta size and Second Ink beneath.
- **Simulated words:** the hue-free register (see The Hue-Free Simulation Rule) with a Label reading "Simulated answer, not a real quote" beside an outline figure.

### Notices
Square, icon plus text grid. Warning: Warning Fill background, #4d3500 text, Warning icon. Error: #fbe6e3 background, #5c160f text, Failure icon. Strong lead line at 500.

### Typing Indicator
Three small Third Ink figures nodding in sequence, not dots.

## Do's and Don'ts

### Do:
- **Do** draw every customer as one Isotype figure and show the count beside the row; counts and n, never bare percentages.
- **Do** open results blocks with a 3px ink rule and keep them on the ground.
- **Do** keep corners square (0) on every surface; reserve circles for run-status marks.
- **Do** use Deep Ochre (#b5790a) for group 3 figures and check any new figure colour reaches 3:1 on the ground.
- **Do** mark the owner's own claims (their guess, their headline) with the Guess Highlight tag.
- **Do** set simulated words in the hue-free dashed register and label them "simulated."
- **Do** use a 2px ink outline with 2px offset for keyboard focus.

### Don't:
- **Don't** use a group colour for anything except its customer group: no coloured buttons, links or status chips.
- **Don't** add elevation shadows, rounded cards or decorative gradients; the composer's legibility fade is the only gradient.
- **Don't** introduce a third weight of Jost or a second type family.
- **Don't** tint simulated words with any hue, or style them like a real quote.
- **Don't** replace the crowd with a bar chart, progress bars or a percentage.
- **Don't** open the customer card as a modal; it opens inline under the crowd.
