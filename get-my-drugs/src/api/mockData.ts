// MOCK DATA ONLY. Numbers here are placeholders for building the UI,
// not real coverage or prices. Replace with backend responses.

import type { Coverage, Diagnosis, Drug, Formulary } from "../types";

export const DIAGNOSES: Diagnosis[] = [
  { icd10: "G43.909", description: "Migraine, unspecified" },
  { icd10: "G43.109", description: "Migraine with aura" },
  { icd10: "G43.709", description: "Chronic migraine without aura" },
  { icd10: "I10", description: "Essential (primary) hypertension" },
  { icd10: "E11.9", description: "Type 2 diabetes mellitus without complications" },
];

export const FORMULARIES: Formulary[] = [
  { id: "uhc-emp-advantage", insurer: "uhc", coverageType: "employer", name: "Advantage PDL", source: "Optum Rx" },
  { id: "uhc-emp-essential", insurer: "uhc", coverageType: "employer", name: "Essential PDL", source: "Optum Rx" },
  { id: "uhc-mkt-2026", insurer: "uhc", coverageType: "marketplace", name: "Individual & Family 2026", source: "Plan FHIR API" },
  { id: "aetna-emp-standard", insurer: "aetna", coverageType: "employer", name: "Standard Plan formulary", source: "CVS Caremark" },
  { id: "aetna-emp-advanced", insurer: "aetna", coverageType: "employer", name: "Advanced Control formulary", source: "CVS Caremark" },
  { id: "cigna-emp-national", insurer: "cigna", coverageType: "employer", name: "National Preferred formulary", source: "Express Scripts" },
  { id: "cigna-mkt-2026", insurer: "cigna", coverageType: "marketplace", name: "Individual & Family 2026", source: "Plan FHIR API" },
];

/** IDs referenced elsewhere (e.g. the eligibility survey's suggested alternatives). */
export const RXCUI = {
  ubrelvy: "2268236",
  nurtec: "2272552",
  qulipta: "2571836", // Qulipta (atogepant) 60 mg tablet, per RxNorm/NDC 0074-7094
  sumatriptan: "313157",
  rizatriptan: "312035",
} as const;

export const DRUGS: Drug[] = [
  { rxcui: "2268236", name: "Ubrelvy (ubrogepant)", strengths: ["50 mg", "100 mg"], form: "tablet" },
  { rxcui: "2272552", name: "Nurtec ODT (rimegepant)", strengths: ["75 mg"], form: "orally disintegrating tablet" },
  { rxcui: RXCUI.qulipta, name: "Qulipta (atogepant)", strengths: ["10 mg", "30 mg", "60 mg"], form: "tablet" },
  { rxcui: "313157", name: "Sumatriptan (generic Imitrex)", strengths: ["25 mg", "50 mg", "100 mg"], form: "tablet" },
  { rxcui: "312035", name: "Rizatriptan (generic Maxalt)", strengths: ["5 mg", "10 mg"], form: "tablet" },
  { rxcui: "314076", name: "Lisinopril", strengths: ["10 mg", "20 mg", "40 mg"], form: "tablet" },
  { rxcui: "197361", name: "Amlodipine", strengths: ["5 mg", "10 mg"], form: "tablet" },
  { rxcui: "861007", name: "Metformin", strengths: ["500 mg", "1000 mg"], form: "tablet" },
];

/** Which drugs treat which diagnosis (real version: RxClass "may_treat"). */
export const DRUGS_BY_DIAGNOSIS: Record<string, string[]> = {
  "G43.909": ["2268236", "2272552", RXCUI.qulipta, "313157", "312035"],
  "G43.109": ["2268236", "2272552", RXCUI.qulipta, "313157", "312035"],
  "G43.709": ["2268236", "2272552", RXCUI.qulipta, "313157", "312035"],
  I10: ["314076", "197361"],
  "E11.9": ["861007"],
};

const GEPANT_COVERAGE: Coverage = {
  covered: true,
  tier: 3,
  priorAuth: true,
  stepTherapy: true,
  stepTherapyNote: "Must have tried 2 triptans (e.g. sumatriptan, rizatriptan) first.",
  quantityLimit: "16 tablets per 30 days",
};

const QULIPTA_COVERAGE: Coverage = {
  covered: true,
  tier: 3,
  priorAuth: true,
  stepTherapy: true,
  stepTherapyNote: "Must have tried 2 daily preventive medicines first.",
  quantityLimit: "30 tablets per 30 days",
};

const GENERIC_COVERAGE: Coverage = {
  covered: true,
  tier: 1,
  priorAuth: false,
  stepTherapy: false,
};

/** Default coverage per drug; real version comes from the formulary data. */
export const COVERAGE_BY_DRUG: Record<string, Coverage> = {
  "2268236": GEPANT_COVERAGE,
  "2272552": GEPANT_COVERAGE,
  [RXCUI.qulipta]: QULIPTA_COVERAGE,
  "313157": { ...GENERIC_COVERAGE, quantityLimit: "9 tablets per 30 days" },
  "312035": { ...GENERIC_COVERAGE, quantityLimit: "12 tablets per 30 days" },
  "314076": GENERIC_COVERAGE,
  "197361": GENERIC_COVERAGE,
  "861007": GENERIC_COVERAGE,
};

/** Mock per-unit cash prices (USD). */
export const CASH_PRICE_PER_UNIT: Record<string, number> = {
  "2268236": 144,
  "2272552": 160,
  [RXCUI.qulipta]: 34,
  "313157": 2.5,
  "312035": 3,
  "314076": 0.4,
  "197361": 0.35,
  "861007": 0.3,
};

/** Mock pharmacies: price multiplier vs. the base coupon price, and distance. */
export const PHARMACIES: { name: string; multiplier: number; distanceMiles: number }[] = [
  { name: "Costco Pharmacy", multiplier: 0.85, distanceMiles: 4.2 },
  { name: "Walmart Pharmacy", multiplier: 0.92, distanceMiles: 2.1 },
  { name: "Kroger Pharmacy", multiplier: 1.0, distanceMiles: 1.4 },
  { name: "Walgreens", multiplier: 1.18, distanceMiles: 0.6 },
  { name: "CVS Pharmacy", multiplier: 1.25, distanceMiles: 0.9 },
  { name: "Rite Aid", multiplier: 1.3, distanceMiles: 3.0 },
];

/** Mock flat copay by tier. */
export const COPAY_BY_TIER: Record<number, number> = { 1: 10, 2: 35, 3: 70 };
