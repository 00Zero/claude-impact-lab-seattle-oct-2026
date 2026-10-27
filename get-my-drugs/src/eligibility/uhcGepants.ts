// UnitedHealthcare prior authorization survey for oral gepants (Ubrelvy, Nurtec ODT, Qulipta).
// Source: UHC Clinical Pharmacy Programs, program 2026 P 2189-15, effective 2026-06-01,
// as distilled in data/pa_criteria_uhc.yaml. DEMO ONLY: verify against the current policy.

import { RXCUI } from "../api/mockData";
import type { Alternative, Answers, Question, Survey, Verdict } from "./survey";

type DrugKey = "ubrelvy" | "nurtec" | "qulipta";

const DRUG_NAMES: Record<DrugKey, string> = {
  ubrelvy: "Ubrelvy",
  nurtec: "Nurtec ODT",
  qulipta: "Qulipta",
};

const YES_NO_UNSURE = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "I'm not sure" },
];

const TRIPTANS = [
  { value: "sumatriptan", label: "Sumatriptan (Imitrex)" },
  { value: "rizatriptan", label: "Rizatriptan (Maxalt)" },
  { value: "zolmitriptan", label: "Zolmitriptan (Zomig)" },
  { value: "eletriptan", label: "Eletriptan (Relpax)" },
  { value: "naratriptan", label: "Naratriptan (Amerge)" },
  { value: "almotriptan", label: "Almotriptan (Axert)" },
  { value: "frovatriptan", label: "Frovatriptan (Frova)" },
];

// Preventives that count toward the "tried two" step on the preventive pathways.
// Botox counts for Qulipta but not Nurtec ODT.
const PREVENTIVES = [
  { value: "beta_blocker", label: "Beta-blocker", hint: "propranolol, metoprolol, atenolol, nadolol, timolol" },
  { value: "topiramate", label: "Topiramate (Topamax)" },
  { value: "tca", label: "Amitriptyline or nortriptyline" },
  { value: "snri", label: "Duloxetine or venlafaxine" },
  { value: "divalproex", label: "Divalproex (Depakote)" },
  { value: "candesartan", label: "Candesartan (Atacand)" },
  { value: "botox", label: "Botox injections" },
];

const NONE = { value: "none", label: "None of these" };

const picked = (v: Answers[string]) => (Array.isArray(v) ? v.filter((x) => x !== "none") : []);

// ---------- Reusable alternatives ----------

const ALT_GENERIC_TRIPTANS: Alternative[] = [
  {
    title: "Try generic sumatriptan",
    detail: "Usually tier 1 with a low copay, and it counts toward the two-triptan requirement.",
    rxcui: RXCUI.sumatriptan,
  },
  {
    title: "Try generic rizatriptan",
    detail: "Another low-cost tier 1 triptan that counts toward the requirement.",
    rxcui: RXCUI.rizatriptan,
  },
  {
    title: "Can't take triptans?",
    detail:
      "Heart disease, stroke history or uncontrolled blood pressure can rule triptans out. If your prescriber documents that, it counts in place of trying them.",
  },
];

const ALT_GENERIC_PREVENTIVES: Alternative = {
  title: "Start a low-cost generic preventive",
  detail:
    "Topiramate, propranolol and amitriptyline are inexpensive generics. Side effects or a reason you can't take one also count, so tell your prescriber.",
};

const ALT_EXCEPTION: Alternative = {
  title: "Ask for an exception",
  detail:
    "If there's a clinical reason the rules don't fit you, your prescriber can request a medical-necessity exception or file an appeal with UnitedHealthcare.",
};

const ALT_COUPON: Alternative = {
  title: "Pay with a coupon instead",
  detail: "Coupon prices don't need prior authorization. Choose \"See prices anyway\" to compare pharmacies.",
};

function notMet(label: string, reason: string, alternatives: Alternative[]): Verdict {
  return { status: "not_met", label, reason, alternatives: [...alternatives, ALT_EXCEPTION, ALT_COUPON] };
}

const confirm = (label: string): Verdict => ({ status: "confirm", label });
const met = (label: string): Verdict => ({ status: "met", label });

// ---------- Survey builder ----------

function buildSurvey(drug: DrugKey): Survey {
  const name = DRUG_NAMES[drug];
  const otherGepants = (["ubrelvy", "nurtec", "qulipta"] as DrugKey[]).filter((d) => d !== drug);
  const gepantList = [...otherGepants.map((d) => DRUG_NAMES[d]), "Zavzpret"].join(", ");

  const path = (a: Answers): "acute" | "preventive" => {
    if (drug === "ubrelvy") return "acute";
    if (drug === "qulipta") return "preventive";
    return a.use === "preventive" ? "preventive" : "acute";
  };
  const acute = (a: Answers) => path(a) === "acute";
  const preventive = (a: Answers) => path(a) === "preventive";
  const trialLength = (a: Answers) => (a.state === "ct_ky_ms" ? "30 days" : "2 months");

  const questions: Question[] = [
    {
      id: "use",
      prompt: `What will you use ${name} for?`,
      options: [
        { value: "acute", label: "To stop a migraine once it starts" },
        { value: "preventive", label: "To prevent migraines from happening" },
        { value: "unsure", label: "I'm not sure" },
      ],
      score: (a) => {
        const label = a.use === "preventive" ? "Used to prevent migraines" : "Used to treat a migraine attack";
        if (a.use === "unsure") return confirm("What it's used for (treat vs. prevent)");
        if (drug === "ubrelvy" && a.use === "preventive")
          return notMet(label, "UnitedHealthcare covers Ubrelvy only to treat a migraine attack, not to prevent migraines.", [
            { title: "Qulipta", detail: "A daily gepant covered for preventing migraines.", rxcui: RXCUI.qulipta },
            { title: "Nurtec ODT", detail: "Covered for prevention of episodic migraine as well as attacks.", rxcui: RXCUI.nurtec },
          ]);
        if (drug === "qulipta" && a.use === "acute")
          return notMet(label, "UnitedHealthcare covers Qulipta only to prevent migraines, not to treat an attack.", [
            { title: "Ubrelvy", detail: "A gepant covered for treating a migraine attack.", rxcui: RXCUI.ubrelvy },
            { title: "Nurtec ODT", detail: "Covered for treating attacks as well as prevention.", rxcui: RXCUI.nurtec },
            ALT_GENERIC_TRIPTANS[0],
          ]);
        return met(label);
      },
    },
    {
      id: "dx",
      prompt: "Has a doctor or other clinician diagnosed you with migraine?",
      options: YES_NO_UNSURE,
      when: () => drug === "qulipta",
      score: (a) => {
        const label = "Migraine diagnosed by a clinician";
        if (a.dx === "yes") return met(label);
        if (a.dx === "unsure") return confirm(label);
        return notMet(label, "Qulipta needs a migraine diagnosis from a clinician first.", [
          { title: "See a clinician", detail: "A primary care visit is usually enough to get a migraine diagnosis on record." },
        ]);
      },
    },
    {
      id: "days",
      prompt: "About how many days a month do you have a migraine?",
      help: "Count any day with a migraine, even if it was short.",
      options: [
        { value: "lt4", label: "Fewer than 4" },
        { value: "4to7", label: "4 to 7" },
        { value: "8to14", label: "8 to 14" },
        { value: "ge15", label: "15 or more" },
        { value: "unsure", label: "I'm not sure" },
      ],
      score: (a) => {
        if (acute(a)) return a.days === "lt4" ? met("Preventive status: fewer than 4 migraine days a month") : undefined;

        const label = drug === "nurtec" ? "Episodic migraine, 4 or more days a month" : "Enough migraine days each month";
        if (a.days === "unsure") return confirm(label);
        if (a.days === "lt4")
          return notMet(label, `UnitedHealthcare covers ${name} for prevention only with 4 or more migraine days a month.`, [
            { title: "Treat attacks instead", detail: "With fewer migraine days, a medicine you take when a migraine starts may fit better.", rxcui: RXCUI.ubrelvy },
            ...ALT_GENERIC_TRIPTANS.slice(0, 1),
          ]);
        if (drug === "nurtec" && a.days === "ge15")
          return notMet(label, "Nurtec ODT is covered for prevention of episodic migraine only. 15 or more days a month is usually chronic migraine.", [
            { title: "Qulipta", detail: "Covered for preventing chronic migraine too.", rxcui: RXCUI.qulipta },
            { title: "CGRP injection or Botox", detail: "Aimovig, Emgality or Botox are other preventives for chronic migraine. Ask your prescriber." },
          ]);
        if (drug === "qulipta" && a.days === "4to7") return undefined; // scored by the headache-days questions
        return met(label);
      },
    },

    // ----- Qulipta 4–7 day branch -----
    {
      id: "headache15",
      prompt: "Do you have fewer than 15 headache days a month, counting every kind of headache?",
      options: YES_NO_UNSURE,
      when: (a) => drug === "qulipta" && a.days === "4to7",
      score: (a) => (a.headache15 === "yes" ? met("Enough migraine days each month") : undefined),
    },
    {
      id: "predominant",
      prompt: "Has your prescriber said migraine is your main headache condition?",
      options: YES_NO_UNSURE,
      when: (a) => drug === "qulipta" && a.days === "4to7" && a.headache15 !== "yes",
      score: (a) => {
        const label = "Enough migraine days each month";
        if (a.predominant === "yes") return met(label);
        if (a.predominant === "unsure" || a.headache15 === "unsure") return confirm(label);
        return notMet(label, "With 4 to 7 migraine days, Qulipta needs fewer than 15 headache days, or your prescriber confirming migraine is your main headache type.", [
          { title: "Talk with your prescriber", detail: "Ask them to review your headache diary and whether migraine is your main diagnosis." },
        ]);
      },
    },

    // ----- Acute pathway -----
    {
      id: "triptans",
      prompt: "Which of these triptans have you tried?",
      help: "Triptans are common migraine medicines. Pick all you've taken.",
      multi: true,
      options: [...TRIPTANS, NONE],
      when: acute,
      score: (a) =>
        picked(a.triptans).length >= 2
          ? undefined // scored by triptanTrial
          : notMet("Two different triptans tried first", `UnitedHealthcare requires trying two different triptans before it covers ${name}.`, ALT_GENERIC_TRIPTANS),
    },
    {
      id: "triptanTrial",
      prompt: "For each triptan you tried, did one of these happen?",
      help: "It didn't help after at least 3 migraines over 30 days or more · it caused side effects · a doctor said you shouldn't take it",
      options: YES_NO_UNSURE,
      when: (a) => acute(a) && picked(a.triptans).length >= 2,
      score: (a) => {
        const label = "Two different triptans tried first";
        if (a.triptanTrial === "yes") return met(label);
        if (a.triptanTrial === "unsure") return confirm(label);
        return notMet(label, "Each triptan has to be tried for at least 30 days and 3 migraines, unless it caused side effects or isn't safe for you.", [
          { title: "Keep trying your current triptan", detail: "Track your migraines. After 30 days and 3 attacks, ask your prescriber to re-check." },
          ...ALT_GENERIC_TRIPTANS.slice(2),
        ]);
      },
    },
    {
      id: "onPreventive",
      prompt: "Are you currently taking a daily medicine to prevent migraines?",
      help: "For example propranolol, topiramate, amitriptyline, Botox, or a CGRP injection.",
      options: YES_NO_UNSURE,
      when: (a) => acute(a) && a.days !== "lt4",
      score: (a) => {
        if (a.onPreventive === "yes") return met("Preventive status: currently on a preventive");
        if (a.onPreventive === "unsure") return confirm("Preventive medicine status");
        return undefined; // scored by preventiveRuledOut
      },
    },
    {
      id: "preventiveRuledOut",
      prompt: "Has a preventive medicine caused you side effects, or has a doctor said you can't take one?",
      options: YES_NO_UNSURE,
      when: (a) => acute(a) && a.days !== "lt4" && a.onPreventive === "no",
      score: (a) => {
        const label = "Preventive medicine status";
        if (a.preventiveRuledOut === "yes") return met(label);
        if (a.preventiveRuledOut === "unsure" || a.days === "unsure") return confirm(label);
        return notMet(label, `With 4 or more migraine days a month, UnitedHealthcare wants you on a daily preventive, or to have a reason you can't take one, before it covers ${name}.`, [
          ALT_GENERIC_PREVENTIVES,
          { title: "Qulipta", detail: "A gepant taken daily to prevent migraines.", rxcui: RXCUI.qulipta },
        ]);
      },
    },
    {
      id: "otherGepant",
      prompt: `Will you take another gepant at the same time (${gepantList})?`,
      options: YES_NO_UNSURE,
      when: acute,
      score: (a) => {
        const label = "Not taken with another gepant";
        if (a.otherGepant === "no") return met(label);
        if (a.otherGepant === "unsure") return confirm(label);
        return notMet(label, "UnitedHealthcare won't cover two gepants used together.", [
          { title: "Choose one gepant", detail: "Ask your prescriber which single gepant fits you best, then compare prices." },
        ]);
      },
    },

    // ----- Preventive pathway -----
    {
      id: "state",
      prompt: "Which state is your insurance plan based in?",
      help: "Some states change the preventive-medicine rules.",
      options: [
        { value: "ca", label: "California" },
        { value: "ct_ky_ms", label: "Connecticut, Kentucky or Mississippi" },
        { value: "other", label: "Another state" },
      ],
      when: preventive,
      score: (a) => (a.state === "ca" ? met("California plan: trying preventives first isn't required") : undefined),
    },
    {
      id: "preventives",
      prompt: "Which daily preventive medicines have you tried?",
      help: "Pick all you've taken for at least a short time.",
      multi: true,
      options: [...PREVENTIVES.filter((p) => drug === "qulipta" || p.value !== "botox"), NONE],
      when: (a) => preventive(a) && a.state !== "ca",
      score: (a) =>
        picked(a.preventives).length >= 2
          ? undefined // scored by preventiveTrial
          : notMet("Two daily preventives tried first", `UnitedHealthcare requires trying two different daily preventives before it covers ${name} for prevention.`, [
              ALT_GENERIC_PREVENTIVES,
            ]),
    },
    {
      id: "preventiveTrial",
      prompt: "For each preventive you tried, did one of these happen?",
      help: (a) => `It didn't help after at least ${trialLength(a)} · it caused side effects · a doctor said you shouldn't take it`,
      options: YES_NO_UNSURE,
      when: (a) => preventive(a) && a.state !== "ca" && picked(a.preventives).length >= 2,
      score: (a) => {
        const label = "Two daily preventives tried first";
        if (a.preventiveTrial === "yes") return met(label);
        if (a.preventiveTrial === "unsure") return confirm(label);
        return notMet(label, `Each preventive has to be tried for at least ${trialLength(a)}, unless it caused side effects or isn't safe for you.`, [
          { title: "Keep taking your current preventive", detail: `Preventives can take weeks to work. After ${trialLength(a)}, ask your prescriber to re-check.` },
          ALT_GENERIC_PREVENTIVES,
        ]);
      },
    },
    {
      id: "otherCgrp",
      prompt: "Will you take a CGRP injection or another gepant at the same time?",
      help: `Injections: Aimovig, Ajovy, Emgality, Vyepti. Gepants: ${gepantList}.`,
      options: YES_NO_UNSURE,
      when: preventive,
      score: (a) => {
        const label = "Not taken with a CGRP injection or another gepant";
        if (a.otherCgrp === "no") return met(label);
        if (a.otherCgrp === "unsure") return confirm(label);
        return notMet(label, `UnitedHealthcare won't cover ${name} together with a CGRP injection or another gepant.`, [
          { title: "Choose one CGRP medicine", detail: "Ask your prescriber which single option fits you best, then compare prices." },
        ]);
      },
    },
  ];

  return { drugName: name, policy: "UnitedHealthcare program 2026 P 2189-15 (effective 6/1/2026)", questions };
}

export const UHC_GEPANT_SURVEYS: Record<string, Survey> = {
  [RXCUI.ubrelvy]: buildSurvey("ubrelvy"),
  [RXCUI.nurtec]: buildSurvey("nurtec"),
  [RXCUI.qulipta]: buildSurvey("qulipta"),
};
