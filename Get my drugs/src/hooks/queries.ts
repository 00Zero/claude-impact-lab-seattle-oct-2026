import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { CoverageType, EstimateRequest, Insurer } from "../types";

export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function useDiagnosisSearch(query: string) {
  const q = useDebounced(query.trim());
  return useQuery({
    queryKey: ["diagnoses", q],
    queryFn: () => api.searchDiagnoses(q),
    enabled: q.length >= 2,
  });
}

export function useFormularies(insurer?: Insurer, coverageType?: CoverageType) {
  return useQuery({
    queryKey: ["formularies", insurer, coverageType],
    queryFn: () => api.listFormularies(insurer!, coverageType!),
    enabled: Boolean(insurer && coverageType),
  });
}

export function useDrugsForDiagnosis(icd10?: string) {
  return useQuery({
    queryKey: ["drugs", icd10],
    queryFn: () => api.listDrugsForDiagnosis(icd10!),
    enabled: Boolean(icd10),
  });
}

export function useEstimate() {
  return useMutation({
    mutationFn: (req: EstimateRequest) => api.getEstimate(req),
  });
}
