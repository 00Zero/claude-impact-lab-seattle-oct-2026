import type {
  CoverageType,
  Diagnosis,
  Drug,
  EstimateRequest,
  EstimateResponse,
  Formulary,
  Insurer,
  PharmacyPrice,
  PriceEstimate,
} from "../types";
import {
  CASH_PRICE_PER_UNIT,
  COPAY_BY_TIER,
  COVERAGE_BY_DRUG,
  DIAGNOSES,
  DRUGS,
  DRUGS_BY_DIAGNOSIS,
  FORMULARIES,
  PHARMACIES,
} from "./mockData";

/** Everything the UI needs from the backend. Swap implementations freely. */
export interface DrugCostApi {
  searchDiagnoses(query: string): Promise<Diagnosis[]>;
  listFormularies(insurer: Insurer, coverageType: CoverageType): Promise<Formulary[]>;
  listDrugsForDiagnosis(icd10: string): Promise<Drug[]>;
  getEstimate(req: EstimateRequest): Promise<EstimateResponse>;
}

// ---------- Mock implementation (default) ----------

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

const mockApi: DrugCostApi = {
  async searchDiagnoses(query) {
    await delay(150);
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return DIAGNOSES.filter(
      (d) => d.description.toLowerCase().includes(q) || d.icd10.toLowerCase().startsWith(q),
    );
  },

  async listFormularies(insurer, coverageType) {
    await delay();
    return FORMULARIES.filter((f) => f.insurer === insurer && f.coverageType === coverageType);
  },

  async listDrugsForDiagnosis(icd10) {
    await delay();
    const ids = DRUGS_BY_DIAGNOSIS[icd10] ?? [];
    return DRUGS.filter((d) => ids.includes(d.rxcui));
  },

  async getEstimate({ drug: sel }) {
    await delay(500);
    const drug = DRUGS.find((d) => d.rxcui === sel.rxcui);
    if (!drug) throw new Error(`Unknown drug ${sel.rxcui}`);

    const coverage = COVERAGE_BY_DRUG[sel.rxcui] ?? {
      covered: false,
      priorAuth: false,
      stepTherapy: false,
    };
    const asOf = new Date().toISOString().slice(0, 10);
    const cash = (CASH_PRICE_PER_UNIT[sel.rxcui] ?? 0) * sel.quantity;

    const prices: PriceEstimate[] = [];
    if (coverage.covered && coverage.tier) {
      prices.push({
        kind: "plan",
        amount: COPAY_BY_TIER[coverage.tier] ?? 0,
        label: `Estimated copay (tier ${coverage.tier})`,
        source: "Mock formulary",
        asOf,
      });
    }
    prices.push(
      { kind: "cash", amount: cash, label: "Cash price (no insurance)", source: "Mock", asOf },
      { kind: "coupon", amount: cash * 0.67, label: "Discount coupon price", source: "Mock", asOf },
    );

    const pharmacyPrices: PharmacyPrice[] = PHARMACIES.map((p) => ({
      pharmacy: p.name,
      amount: Math.round(cash * 0.67 * p.multiplier * 100) / 100,
      distanceMiles: p.distanceMiles,
    }));

    return { drug, strength: sel.strength, quantity: sel.quantity, coverage, prices, pharmacyPrices };
  },
};

// ---------- HTTP implementation (your backend) ----------

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

const httpApi: DrugCostApi = {
  searchDiagnoses: (q) => get("/api/diagnoses", { q }),
  listFormularies: (insurer, coverageType) => get("/api/formularies", { insurer, coverageType }),
  listDrugsForDiagnosis: (icd10) => get("/api/drugs", { icd10 }),
  async getEstimate(req) {
    const res = await fetch(`${BASE_URL}/api/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<EstimateResponse>;
  },
};

/** Uses mocks unless VITE_USE_MOCKS=false. */
export const api: DrugCostApi = import.meta.env.VITE_USE_MOCKS === "false" ? httpApi : mockApi;
