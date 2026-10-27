// Shared types. Keep these in sync with the backend (or move to a shared package later).

export type Insurer = "uhc" | "aetna" | "cigna";
export type CoverageType = "employer" | "marketplace";

export const INSURER_LABELS: Record<Insurer, string> = {
  uhc: "UnitedHealthcare",
  aetna: "Aetna",
  cigna: "Cigna",
};

export const COVERAGE_TYPE_LABELS: Record<CoverageType, string> = {
  employer: "Employer plan",
  marketplace: "ACA Marketplace plan",
};

// Which coverage types each insurer offers (no Medicare in scope).
// Aetna left the ACA marketplace for 2026, so it is employer-only.
export const AVAILABLE_COVERAGE: Record<Insurer, CoverageType[]> = {
  uhc: ["employer", "marketplace"],
  aetna: ["employer"],
  cigna: ["employer", "marketplace"],
};

export type Diagnosis = {
  icd10: string;
  description: string;
};

export type Formulary = {
  id: string;
  insurer: Insurer;
  coverageType: CoverageType;
  name: string;
  /** e.g. "Optum Rx", "CVS Caremark", "Express Scripts", or "Plan FHIR API" */
  source: string;
};

export type PlanSelection = {
  insurer: Insurer;
  coverageType: CoverageType;
  formularyId: string;
};

export type Drug = {
  rxcui: string; // RxNorm concept ID
  name: string; // e.g. "Ubrelvy (ubrogepant)"
  strengths: string[]; // e.g. ["50 mg", "100 mg"]
  form: string; // e.g. "tablet"
};

export type DrugSelection = {
  rxcui: string;
  strength: string;
  quantity: number;
};

export type Coverage = {
  covered: boolean;
  tier?: number;
  priorAuth: boolean;
  stepTherapy: boolean;
  /** Plain-language step therapy requirement, if any */
  stepTherapyNote?: string;
  quantityLimit?: string;
};

export type PriceKind = "plan" | "cash" | "coupon";

export type PriceEstimate = {
  kind: PriceKind;
  amount: number; // USD
  label: string;
  source: string;
  asOf: string; // ISO date
};

export type PharmacyPrice = {
  pharmacy: string;
  /** Discount-card / coupon price at this pharmacy, USD */
  amount: number;
  distanceMiles: number;
};

export type EstimateRequest = {
  diagnosis: Diagnosis;
  plan: PlanSelection;
  drug: DrugSelection;
};

export type EstimateResponse = {
  drug: Drug;
  strength: string;
  quantity: number;
  coverage: Coverage;
  prices: PriceEstimate[];
  /** Per-pharmacy coupon prices, any order */
  pharmacyPrices: PharmacyPrice[];
};
