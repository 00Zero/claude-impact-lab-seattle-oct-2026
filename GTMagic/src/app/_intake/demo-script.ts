/* The no-Claude demo replay, from fixtures/demo/intake-script.md, as ordered events.
   FICTIONAL: KeepStrong, its owner and every answer are invented for the demo.
   Every number shown in a card comes from intake.json; skill lines that quote a number read it from the brief. */
import type { PlateId } from "../_session/events";
import { money } from "./format";
import type { IntakeBrief } from "./schema";

export type DemoEvent =
  | { kind: "ask"; questions: string[] }
  | { kind: "me"; text: string; file?: string }
  | { kind: "bot"; text: string | ((brief: IntakeBrief) => string) }
  | { kind: "plate"; plate: PlateId };

const ask = (...questions: string[]): DemoEvent => ({ kind: "ask", questions });
const me = (text: string, file?: string): DemoEvent => ({ kind: "me", text, file });
const bot = (text: Extract<DemoEvent, { kind: "bot" }>["text"]): DemoEvent => ({ kind: "bot", text });
const plate = (p: PlateId): DemoEvent => ({ kind: "plate", plate: p });

export const DEMO_SCRIPT = {
  oneLiner: "A fitness app for people on GLP-1s.",
  interview: [
    bot("Before I look anything up, here's what a plain AI would guess. I've frozen it so we can compare at the end."),
    plate("baseline"),
    ask("What do you sell, and what does a customer get on day one?", "Do you have ads, landing pages, headlines or buttons you've already used? Any results?", "What does it cost?"),
    me("It's called KeepStrong. Short strength workouts, about 20 minutes, plus protein tracking. The idea is you keep your muscle while the weight comes off on the medication."),
    me("Two Meta ads from September, the results are in the export. And a headline I wrote for the website but never used: 'Strength first, scale second'.", "meta-ads.csv"),
    bot("Here's what you've already made. Please check I've got the wording right."),
    plate("creatives"),
    me("$14.99 a month, and that's not changing."),
    bot("On average, how many payments does a customer make in their first year, counting people who cancel early?"),
    me("About 9. A few drop off after a couple of months."),
    ask("What's the least revenue you need in the next 12 months?", "Do you know the most you can spend on ads to win one new paying customer?"),
    me("Enough that it's a real business, not a hobby."),
    bot("What's the least you'd need coming in over the next 12 months to keep the business going? One dollar figure is fine."),
    me("At least $180,000 a year. Below that, it's a hobby. And no, I've never worked out what I can spend per customer."),
    bot("Let's back into it. What does it cost you to serve a customer: payment fees, hosting and software, support, the coaching content? Roughly what share of what they pay is that?"),
    me("Payment fees, hosting and the coach who writes the programs... maybe 30% all in."),
    bot((b) => {
      const be = b.business.unitEconomics?.breakEvenCac;
      const cur = b.business.pricing?.currency;
      return be != null
        ? `Then you break even in year one if a new customer costs less than ${money(be, cur)}. Knowing that, what share of a customer's first-year revenue do you want to spend to win them?`
        : "What share of a customer's first-year revenue do you want to spend to win them, keeping some margin for yourself?";
    }),
    me("I'll cap it at 40% of their first year, so I keep some margin."),
    plate("economics"),
    bot("Were those ad sign-ups paying customers, or free trials?"),
    me("Paying. We don't have a free trial."),
    plate("ads"),
    ask("If you could reach only one group next month, who would it be?", "Where are your customers, and any age limits?", "Any rules for your ads, and which channels do you want?"),
    me("Honestly? Everyone on these meds."),
    bot("If you could only reach one group of people on these medications next month, who would it be, and what are they doing today?"),
    me("People who just started the medication and are new to fitness. They don't know where to start."),
    me("US only. 35 to 64. My lawyer says no medical claims and never name the drugs. Meta and Reddit, open to others."),
    bot("Here's how I've sorted what you told me. Research can question a must-have once; after that it stands."),
    plate("constraints"),
  ] satisfies DemoEvent[],
  sendBack: {
    ask: "Lots of free apps and videos already target beginners. Is your user mainly protecting muscle, or mainly losing weight?",
    me: "Protecting muscle, if I'm honest. The weight is happening anyway on the medication.",
  },
  pushbackAsk: "One question about a must-have. A survey suggests about a quarter of US adults on these medications are 25 to 39. Do you want to keep ads limited to 35 to 64?",
  pushbackReply: "Keep it at 35 to 64. That's who I built it for.",
  rankReply: "Midlife strength protectors first. That's exactly the people who email me. The beginners second, maybe later.",
  confirm: "Yes, that's it. Lock it in.",
};
