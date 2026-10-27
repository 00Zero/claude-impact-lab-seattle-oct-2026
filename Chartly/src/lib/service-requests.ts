import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Trade } from "@/lib/trades";

export type IntakeStatus = "draft" | "shared" | "in_progress" | "submitted";
export type ReviewStatus = "unreviewed" | "reviewed" | "archived";

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  draft: "Link not shared yet",
  shared: "Link shared",
  in_progress: "Intake in progress",
  submitted: "Submitted",
};

export function requestReference(number: number) {
  return `#${number}`;
}

export type ServiceRequestSummary = {
  id: string;
  number: number;
  customerName: string;
  serviceAddress: string | null;
  intakeStatus: IntakeStatus;
  createdAt: string;
};

export type ServiceRequest = ServiceRequestSummary & {
  customerPhone: string | null;
  customerEmail: string | null;
  trade: Trade;
  tradeOther: string | null;
  issueDescription: string | null;
  customerDescription: string | null;
  limitedVisualInfo: boolean;
  reviewStatus: ReviewStatus;
  updatedAt: string;
  activeLink: { id: string; expiresAt: string; expired: boolean } | null;
};

type RequestRow = {
  id: string;
  number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  service_address: string | null;
  trade: Trade;
  trade_other: string | null;
  issue_description: string | null;
  customer_description: string | null;
  limited_visual_info: boolean;
  review_status: ReviewStatus;
  intake_status: IntakeStatus;
  created_at: string;
  updated_at: string;
  intake_links: { id: string; expires_at: string; revoked_at: string | null }[];
};

export type AnalysisStatus =
  | "not_started"
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  not_started: "Not analyzed",
  pending: "Analysis queued",
  running: "Analyzing",
  succeeded: "Brief ready",
  failed: "Analysis failed",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  unreviewed: "Unreviewed",
  reviewed: "Reviewed",
  archived: "Archived",
};

export const REQUEST_SORTS = {
  created: "Newest",
  activity: "Recent activity",
  submitted: "Recently submitted",
} as const;
export type RequestSort = keyof typeof REQUEST_SORTS;

export const REVIEW_FILTERS = {
  active: "Not archived",
  unreviewed: "Unreviewed",
  reviewed: "Reviewed",
  archived: "Archived",
  all: "All",
} as const;
export type ReviewFilter = keyof typeof REVIEW_FILTERS;

export const REQUESTS_PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 100;

export type RequestListParams = {
  q: string;
  status: IntakeStatus | null;
  review: ReviewFilter;
  sort: RequestSort;
  page: number;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isKey<T extends object>(obj: T, key: string | undefined): key is Extract<keyof T, string> {
  return key !== undefined && Object.hasOwn(obj, key);
}

// Turns untrusted URL search params into valid list options, falling back
// to defaults for anything unrecognized.
export function parseRequestListParams(
  searchParams: Record<string, string | string[] | undefined>,
): RequestListParams {
  const status = first(searchParams.status);
  const review = first(searchParams.review);
  const sort = first(searchParams.sort);
  const page = Number.parseInt(first(searchParams.page) ?? "", 10);
  return {
    q: (first(searchParams.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    status: isKey(INTAKE_STATUS_LABELS, status) ? status : null,
    review: isKey(REVIEW_FILTERS, review) ? review : "active",
    sort: isKey(REQUEST_SORTS, sort) ? sort : "created",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function hasActiveFilters(params: RequestListParams) {
  return params.q !== "" || params.status !== null || params.review !== "active";
}

export type ListedServiceRequest = ServiceRequestSummary & {
  reviewStatus: ReviewStatus;
  analysisStatus: AnalysisStatus;
  updatedAt: string;
  lastActivityAt: string;
  submittedAt: string | null;
};

type SearchRow = {
  id: string;
  number: number;
  customer_name: string;
  service_address: string | null;
  intake_status: IntakeStatus;
  review_status: ReviewStatus;
  analysis_status: AnalysisStatus;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  submitted_at: string | null;
  total_count: number;
};

// Callers must pass the organization from requireWorkspace(); the search
// function also runs under RLS, limiting rows to the user's workspaces.
export async function searchServiceRequests(
  organizationId: string,
  params: RequestListParams,
): Promise<{ requests: ListedServiceRequest[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_service_requests", {
    p_organization_id: organizationId,
    p_query: params.q || null,
    p_intake_status: params.status,
    p_review: params.review,
    p_sort: params.sort,
    p_limit: REQUESTS_PAGE_SIZE,
    p_offset: (params.page - 1) * REQUESTS_PAGE_SIZE,
  });

  if (error) {
    throw new Error(`Failed to load requests: ${error.message}`);
  }

  const rows = (data ?? []) as SearchRow[];
  return {
    total: Number(rows[0]?.total_count ?? 0),
    requests: rows.map((row) => ({
      id: row.id,
      number: row.number,
      customerName: row.customer_name,
      serviceAddress: row.service_address,
      intakeStatus: row.intake_status,
      reviewStatus: row.review_status,
      analysisStatus: row.analysis_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastActivityAt: row.last_activity_at,
      submittedAt: row.submitted_at,
    })),
  };
}

export async function getServiceRequest(
  organizationId: string,
  requestId: string,
): Promise<ServiceRequest | null> {
  // Avoid a database error for malformed ids in the URL.
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_requests")
    .select(
      "id, number, customer_name, customer_phone, customer_email, service_address, trade, trade_other, issue_description, customer_description, limited_visual_info, review_status, intake_status, created_at, updated_at, intake_links (id, expires_at, revoked_at)",
    )
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .maybeSingle<RequestRow>();

  if (error) {
    throw new Error(`Failed to load request: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  const active = data.intake_links.find((link) => link.revoked_at === null);
  return {
    id: data.id,
    number: data.number,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerEmail: data.customer_email,
    serviceAddress: data.service_address,
    trade: data.trade,
    tradeOther: data.trade_other,
    issueDescription: data.issue_description,
    customerDescription: data.customer_description,
    limitedVisualInfo: data.limited_visual_info,
    reviewStatus: data.review_status,
    intakeStatus: data.intake_status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    activeLink: active
      ? {
          id: active.id,
          expiresAt: active.expires_at,
          expired: new Date(active.expires_at).getTime() <= Date.now(),
        }
      : null,
  };
}
