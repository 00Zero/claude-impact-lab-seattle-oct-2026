# Demo Video Script

Draft of Oct 25, 2026. Live version with comments: [Final Demo Video Script](https://claude.ai/artifact/PjMCRtx11snt8bcjDjDHDf).

## Overview

A 3-minute video: about 60 seconds of problem, about 100 seconds of live product, about 20 seconds of close. It follows one persona from intake to a pinned map of open bids to a "Book a call with Jon" handoff, following the app as built at bid-analytics-mauve.vercel.app.

- **Runtime:** 3:00 target, 3:30 hard cap.
- **Format:** narrator voiceover over screen recording, with an optional on-camera open and close.
- **Persona:** a two-person, women-owned pothole repair business in Washington ("two guys with a truck").
- **Legend:** lines marked **[PLACEHOLDER]** depend on what the build looks like at freeze. Swap in the real screen, label or number before recording. Everything else can be read as written.
- **Guardrail:** never show or say a score, a fit percentage or a bid price. Those belong to the client.

## Part 1: The problem (0:00 to 1:00)

The point to land: the bids small vendors could win exist, but they are scattered across hundreds of small local sites nobody has time to check.

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00 | Photo or b-roll of a pothole crew and a pickup truck. **[PLACEHOLDER: stock image or a team member's photo]** | "Meet Maria and her partner. They run a two-person pothole repair business in Washington. They're licensed, bonded, women-owned, and good at what they do." |
| 0:12 | Quick cuts of cluttered agency procurement pages: a city site, a county PDF, a school district bid board. | "Cities, counties and school districts need exactly this work, and they post the bids. But Washington alone has more than 1,000 public agencies, each posting on its own site, in PDFs, on pages that change every week." |
| 0:25 | Text on screen: "State. City. County. Special districts." with a counter climbing to 1,450+ sources. | "A small vendor can lose up to 240 hours a year digging through scattered bid boards. State portals like WEBS are the easy part. The long tail of small local agencies is where the most winnable bids are, and it's the hardest place to look." |
| 0:40 | Title card: product name and tagline "We help businesses win government contracts." **[PLACEHOLDER: final product name]** | "So we built a free tool that does the looking for them. Nothing to install. Tell it what you do and where you work, and it shows you open Washington public work you can actually win, and why each one fits." |
| 0:52 | Small caption: "Built with [client name], who helps small contractors win public work." **[PLACEHOLDER: client name and whether they want to be named]** | "And when a vendor finds a bid worth chasing, it can book them a call with someone who helps small contractors win." |

## Part 2: The demo (1:00 to 2:40)

One continuous run as Maria, recorded live if the 4 p.m. build holds, otherwise from the backup recording. Each beat names who owns it so the right person can check it before recording. It follows the app as built: sign-in, Washington bids, fit labels, the agency's own contact details, and booking a call with Jon on bids that fit.

| Time | On screen | Voiceover | Owner |
| --- | --- | --- | --- |
| 1:00 | Live app at bid-analytics-mauve.vercel.app. Quick sign-up with a username and password. | "Signing up takes ten seconds. No code, nothing to install. Just open it in a browser." | Ashwin |
| 1:08 | Onboarding: Maria types one sentence, such as "Two-person pothole and asphalt patching crew based in Tacoma, women-owned, licensed and bonded." | "No long forms. Maria describes her business in her own words." | Ashwin |
| 1:18 | The app asks up to three follow-up questions, then shows a drafted profile with work categories, service area and where each field came from. Edit one field and confirm. **[PLACEHOLDER: real follow-up questions]** | "The tool turns that into a profile, asks a couple of follow-ups, and shows its work. She can fix anything before she confirms. It never guesses at her certifications." | Ashwin |
| 1:35 | Map and list of open Washington bids, with clusters across Puget Sound. Click a cluster to expand it. **[PLACEHOLDER: live bid count on screen]** | "And here's the payoff: open public work near her, on a map and in a list. These are real, open bids pulled today from city and county procurement sites." | Dhruv, Colin |
| 1:50 | Zoom on a card's fit label (Good fit or Possible fit) with its reasons, mismatches and unknowns. | "Each bid gets a plain fit label and the reasons behind it, plus anything that doesn't fit or that we couldn't confirm, like bonding. No made-up win percentages." | Ashwin |
| 2:02 | Filter by work category and deadline, then pan the map and tap "Search this area". | "She can narrow by type of work and deadline, or just pan the map to where she's willing to drive." | Ashwin |
| 2:10 | Point at a small local agency bid. **[PLACEHOLDER: best long-tail bid on screen, e.g. a Lewis or Cowlitz County listing]** | "This one is from a small [county / city]. She would never have found it on the state portal. That's the long tail, and it's where most of her real opportunities are." | Colin, Jon |
| 2:18 | Quick cut to the Supabase source registry and bids table, or the "Data and coverage" sheet. **[PLACEHOLDER: decide screen vs diagram]** | "Behind this is a registry of 1,450+ state and local procurement pages across Washington, Oregon and Idaho that we built in Supabase. Our puller reads them, cleans up the bids, and the map reads straight from that database. No federal listings, just the work small crews actually win." | Colin, Dhruv |
| 2:30 | Open the bid detail: summary, requirements, deadline, and the agency's website, email and phone with copy buttons. Save the bid. (2:30 to 2:35) | "When she finds one she wants, she gets the agency's real contact in one tap and saves it for later." | Ashwin |
| 2:35 | On a Good fit bid, tap "Book a call with Jon". Show the booking card and Jon's Calendly opening. | "And if it's a good fit, she can book a call with Jon, who has spent years helping small contractors win public work, to plan her bid. That's the step from 'I didn't know this existed' to a real shot at winning." | Ashwin, Jon |

## Part 3: The close (2:40 to 3:00)

| Time | On screen | Voiceover |
| --- | --- | --- |
| 2:40 | Back to the map with Maria's pins, or the team on camera. | "Under five minutes from 'what do you do' to a map of open bids she can win, including ones she didn't know existed." **[PLACEHOLDER: real time from the run, if it beats 5 minutes]** |
| 2:48 | Two short lines on screen: "Free for vendors." "An expert one call away." | "Free for small vendors, built with a consultant who helps them win. And every time the puller runs, the map gets deeper." |
| 2:55 | End card: product name, public repo link, and one line per teammate with their role: Jon (client and domain expert, business plan), Ashwin (product spec and map app), Dhruv (data integration, map wired to Supabase), Colin (bid data: 1,450+ source registry, bid puller, data model). Live app: bid-analytics-mauve.vercel.app. **[PLACEHOLDER: match the team slide]** | "Four of us, four lanes: the client kept us honest on what real bids look like, and each of us owned one piece of the pipeline. For a vendor there's no code and no setup. Just open it and try it. Thanks for watching." |

## Before recording

Run this list right after the 4 p.m. freeze, then record the backup take before presenting. The event (Claude Impact Lab Hackathon, Seattle AI Week) has a small-business theme, so keep the vendor's win as the headline.

- [ ] Pick the persona's name and business ("Maria" is a stand-in) and pre-fill a website if using the paste shortcut.
- [ ] Swap every **[PLACEHOLDER]** above for the real screen, label or number.
- [ ] Client picks the long-tail bid for 2:10 from the King, Snohomish and Pierce answer key and confirms it is still open.
- [ ] Colin decides between the Supabase screen and a diagram for 2:18.
- [ ] Dhruv and Ashwin confirm the app is reading live bids from Supabase, not sample data.
- [ ] Scan every frame for scores, fit percentages or prices, and cut them.
- [ ] Confirm the client is happy to be named in the video.
- [ ] Trim the enrichment wait in edit so the demo stays under 3:30.
- [ ] Record a full backup run, as the Swimlanes plan requires.
- [ ] Submit by 5:30 p.m. PT with the working tool, README, public repo and video. The site sets no video length, and finals are 5-minute live demos, so 3:00 works for the video and stretches to a live run.
