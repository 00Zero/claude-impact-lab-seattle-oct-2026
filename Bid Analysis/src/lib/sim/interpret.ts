import type { FollowUpQuestion, InterpretResponse, ProfileField, ServiceArea, VendorProfileFields, WorkCategoryId } from "../contracts";
import { WA_COUNTIES, WA_PLACES } from "../taxonomy";

// SIMULATED PROFILE INTERPRETATION (development only).
// A deterministic keyword reader standing in for workstream B's Claude-based
// interpreter. It only extracts what the vendor actually wrote. It never infers
// licenses, bonding, insurance, certifications, experience, or equipment from a
// trade or business name (ONB-07); those stay unknown until the vendor says so.

const SERVICE_PATTERNS: [WorkCategoryId, RegExp][] = [
  ["pothole_repair", /pot ?holes?|patch(ing|es)?\b/i],
  ["paving", /\b(pav(e|ing|ers?)|asphalt|overlay|blacktop|crack ?seal|chip ?seal|seal ?coat)/i],
  ["excavation", /excavat|trench|dig(ging)?\b|hauling|earthwork|dirt work/i],
  ["grading", /grad(e|ing)\b|leveling|shoulder work|gravel road/i],
  ["drainage", /drain|culvert|storm ?water|ditch|swale|catch basin/i],
  ["landscaping", /landscap|plant(ing|s)?\b|irrigation|lawn|turf|restoration planting|tree/i],
  ["site_prep", /site ?prep|clearing|land clearing|erosion control|demo(lition)?\b/i],
  ["concrete", /concrete|sidewalk|curbs?\b|flatwork|gutter|curb ramp/i],
  ["utilities", /water ?main|sewer|utility (work|lines?)/i],
  ["janitorial", /janitor|custodial|cleaning services/i],
  ["it_services", /software|\bIT\b|network|cyber/i],
];

const EQUIPMENT = ["excavator", "mini excavator", "backhoe", "skid steer", "dump truck", "paver", "roller", "grader", "loader", "crack sealer", "hydroseeder", "concrete saw", "water truck"];

const field = <T,>(value: T | null, provenance: ProfileField<T>["provenance"] = value == null ? "unknown" : "inferred"): ProfileField<T> => ({ value, provenance });

const unknownField = <T,>(): ProfileField<T> => ({ value: null, provenance: "unknown" });

export function emptyProfileFields(): VendorProfileFields {
  return {
    businessName: unknownField(),
    baseLocation: unknownField(),
    serviceArea: unknownField(),
    coreServices: unknownField(),
    specialties: unknownField(),
    exclusions: unknownField(),
    crewSize: unknownField(),
    equipment: unknownField(),
    relevantExperience: unknownField(),
    governmentExperience: unknownField(),
    projectScale: unknownField(),
    contractorRegistration: unknownField(),
    licenses: unknownField(),
    bonding: unknownField(),
    insurance: unknownField(),
    certifications: unknownField(),
    roleInterest: unknownField(),
    availability: unknownField(),
    mobilizationLeadTime: unknownField(),
    workingConstraints: unknownField(),
  };
}

/** Splits text into clauses so "we don't do concrete" excludes concrete instead of adding it. */
function clauses(text: string) {
  return text.split(/[.;\n]|,\s*(?:but|and)\s+|\bbut\b/i).map((c) => c.trim()).filter(Boolean);
}
const NEGATION = /\b(no|not|don'?t|do not|never|won'?t|without|except|avoid|exclud)/i;

export function findCounties(text: string): string[] {
  const found = new Set<string>();
  for (const c of WA_COUNTIES) if (new RegExp(`\\b${c}\\s+(county|counties|co\\.?)\\b`, "i").test(text) || new RegExp(`\\b${c}\\b(?=[^.]*\\bcounties\\b)`, "i").test(text)) found.add(c);
  return [...found];
}

export function findPlace(text: string) {
  return WA_PLACES.find((p) => new RegExp(`\\b${p.name}\\b`, "i").test(text)) ?? null;
}

export function interpretDescription(description: string, hints: { baseLocation?: string; serviceAreaText?: string } = {}): InterpretResponse {
  const draft = emptyProfileFields();
  const text = description.trim();
  const services = new Set<WorkCategoryId>();
  const exclusions = new Set<WorkCategoryId>();
  for (const clause of clauses(text)) {
    const negative = NEGATION.test(clause);
    for (const [id, re] of SERVICE_PATTERNS) if (re.test(clause)) (negative ? exclusions : services).add(id);
  }
  for (const e of exclusions) services.delete(e);
  if (services.size) draft.coreServices = field([...services]);
  if (exclusions.size) draft.exclusions = field([...exclusions]);

  const name = text.match(/\b(?:we are|we're|i run|i own|called|named)\s+([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,4})/);
  if (name) draft.businessName = field(name[1].replace(/[.,]$/, ""));

  const baseText = hints.baseLocation?.trim() || text;
  const base = findPlace(baseText);
  if (hints.baseLocation?.trim()) draft.baseLocation = field(hints.baseLocation.trim(), "user");
  else if (base) draft.baseLocation = field(`${base.name}, WA`);

  const areaText = `${hints.serviceAreaText ?? ""} ${text}`;
  if (/\bstatewide\b|anywhere in (the state|washington)|all of washington/i.test(areaText)) draft.serviceArea = field<ServiceArea>({ kind: "statewide" }, hints.serviceAreaText ? "user" : "inferred");
  else {
    const counties = findCounties(areaText);
    if (counties.length) draft.serviceArea = field<ServiceArea>({ kind: "counties", counties }, hints.serviceAreaText ? "user" : "inferred");
  }

  const crew = text.match(/\b(\d{1,3})\s*(?:-|to)?\s*(\d{1,3})?\s*(?:person|people|employees|guys|workers|crew members|man)\b/i);
  if (crew) draft.crewSize = field(crew[2] ? `${crew[1]} to ${crew[2]} people` : `${crew[1]} people`);

  const equipment = EQUIPMENT.filter((e) => new RegExp(`\\b${e}s?\\b`, "i").test(text));
  const dedup = equipment.filter((e) => !equipment.some((o) => o !== e && o.includes(e)));
  if (dedup.length) draft.equipment = field(dedup);

  // Only explicit statements count. Silence stays unknown.
  if (/\b(registered|licensed and bonded|contractor registration|L&I registered)\b/i.test(text) && !/not (yet )?registered/i.test(text)) draft.contractorRegistration = field("yes");
  if (/not (yet )?registered|no contractor registration/i.test(text)) draft.contractorRegistration = field("no");
  if (/\bbonded\b/i.test(text) && !/not bonded/i.test(text)) draft.bonding = field("yes");
  if (/\binsured\b/i.test(text) && !/not insured|uninsured/i.test(text)) draft.insurance = field("yes");
  if (/subcontract|\bsub\b|as a sub/i.test(text)) draft.roleInterest = field(/prime/i.test(text) ? "both" : "subcontract");
  else if (/\bprime\b/i.test(text)) draft.roleInterest = field("prime");
  if (/never (done|bid|worked).*(government|public|city|county)|first (government|public)/i.test(text)) draft.governmentExperience = field("first_time");
  else if (/(city|county|state|government|public)\s+(contracts?|jobs|work)/i.test(text)) draft.governmentExperience = field(/\bsub/i.test(text) ? "subcontractor" : "prime");
  if (/night|weekend|emergency|24\/7|on.call/i.test(text)) {
    const c = ["nights", "weekends", "emergency call-outs"].filter((w) => new RegExp(w.split(" ")[0].replace(/s$/, ""), "i").test(text));
    if (c.length) draft.workingConstraints = field(c.map((x) => `Available for ${x}`));
  }

  return { draft, followUps: followUpsFor(draft), mode: "simulated" };
}

/** At most three questions, only where the answer changes matching (ONB-05). */
export function followUpsFor(d: VendorProfileFields): FollowUpQuestion[] {
  const qs: FollowUpQuestion[] = [];
  if (!d.serviceArea.value)
    qs.push({ id: "q-area", field: "serviceArea", prompt: "Which counties can your crews work in?", why: "Location is one of the biggest factors in whether a job fits.", options: [], allowsMultiple: true });
  if (!d.coreServices.value?.length)
    qs.push({ id: "q-services", field: "coreServices", prompt: "Which kinds of work do you do?", why: "We couldn't tell your main services from the description.", options: [], allowsMultiple: true });
  if (d.contractorRegistration.value == null)
    qs.push({
      id: "q-reg", field: "contractorRegistration", prompt: "Do you have an active Washington contractor registration?", why: "Most public works bids require one. If you're not sure, we'll flag it rather than rule anything out.",
      options: [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }, { label: "Not sure", value: "unknown" }],
    });
  if (d.bonding.value == null && d.coreServices.value?.length)
    qs.push({
      id: "q-bond", field: "bonding", prompt: "Can you meet the bonding requirement on a bid?", why: "Many public works bids require bonding. We won't rule anything out if you're not sure.",
      options: [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }, { label: "Not sure", value: "unknown" }],
    });
  if (qs.length < 3 && d.roleInterest.value == null)
    qs.push({
      id: "q-role", field: "roleInterest", prompt: "Do you want to bid as the prime contractor, or work as a subcontractor?", why: "Some jobs suit a prime contractor, others a sub.",
      options: [{ label: "Prime", value: "prime" }, { label: "Subcontractor", value: "subcontract" }, { label: "Either", value: "both" }, { label: "Not sure", value: "unsure" }],
    });
  return qs.slice(0, 3);
}
