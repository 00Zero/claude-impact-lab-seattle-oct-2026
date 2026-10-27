import type {
  ApiError,
  CatalogFilter,
  CatalogResponse,
  CoverageSummary,
  InterpretResponse,
  MatchResponse,
  Opportunity,
  Agency,
  Session,
  VendorProfile,
  VendorProfileFields,
} from "../contracts";

/**
 * The only boundary between UI components and other workstreams.
 * Components never call fetch, a database, or a model provider directly.
 * Swap implementations with NEXT_PUBLIC_DATA_MODE (see createServices).
 */
export interface ExplorerServices {
  /** What powers each capability, shown to users so nothing simulated looks live. */
  readonly integration: IntegrationStatus;

  auth: {
    getSession(): Promise<Session | null>;
    signUp(username: string, password: string): Promise<Session>;
    signIn(username: string, password: string): Promise<Session>;
    signOut(): Promise<void>;
  };
  catalog: {
    listOpportunities(filter: CatalogFilter, signal?: AbortSignal): Promise<CatalogResponse>;
    getOpportunity(id: string, signal?: AbortSignal): Promise<{ opportunity: Opportunity; agency: Agency | null }>;
    getCoverage(): Promise<CoverageSummary>;
  };
  profile: {
    interpret(description: string, hints: { baseLocation?: string; serviceAreaText?: string }): Promise<InterpretResponse>;
    getMine(): Promise<VendorProfile | null>;
    /** Saves a confirmed revision; the backend regenerates the text summary and embedding (ONB-13). */
    saveMine(fields: VendorProfileFields, originalDescription: string, expectedRevision: number | null): Promise<VendorProfile>;
  };
  matching: {
    match(profile: VendorProfile, filter: CatalogFilter, signal?: AbortSignal): Promise<MatchResponse>;
  };
  saved: {
    list(): Promise<string[]>;
    save(opportunityId: string): Promise<void>;
    remove(opportunityId: string): Promise<void>;
  };
}

export type CapabilityMode = "live" | "simulated" | "fixture" | "session_only" | "unavailable";

export interface IntegrationStatus {
  catalog: CapabilityMode;
  interpretation: CapabilityMode;
  matching: CapabilityMode;
  auth: CapabilityMode;
  saving: CapabilityMode;
}

export class ServiceError extends Error implements ApiError {
  code: ApiError["code"];
  retryable: boolean;
  constructor(err: ApiError) {
    super(err.message);
    this.code = err.code;
    this.retryable = err.retryable;
  }
}

export function isServiceError(e: unknown): e is ServiceError {
  return e instanceof ServiceError;
}
