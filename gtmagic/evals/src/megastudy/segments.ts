/** Segments defined by ONE wave 1–3 demographic answer (Twin-2K-500 question catalog QID11–QID24). */
export interface SegmentDef {
  id: string;
  /** What a predictor sees: demographic attributes only. */
  description: string;
  match: (d: Record<string, string>) => boolean;
}

const is = (field: string, ...values: string[]) => (d: Record<string, string>) => values.includes(d[field] ?? "");
const not = (field: string, ...values: string[]) => (d: Record<string, string>) => !values.includes(d[field] ?? "");

export const SEGMENTS: SegmentDef[] = [
  { id: "all", description: "US adults", match: () => true },
  { id: "party-rep", description: "US adults who identify as Republicans", match: is("party", "Republican") },
  { id: "party-dem", description: "US adults who identify as Democrats", match: is("party", "Democrat") },
  { id: "party-ind", description: "US adults who identify as Independents", match: is("party", "Independent") },
  { id: "ideo-con", description: "US adults whose political views are conservative or very conservative", match: is("ideology", "Conservative", "Very conservative") },
  { id: "ideo-mod", description: "US adults whose political views are moderate", match: is("ideology", "Moderate") },
  { id: "ideo-lib", description: "US adults whose political views are liberal or very liberal", match: is("ideology", "Liberal", "Very liberal") },
  { id: "age-18-49", description: "US adults aged 18 to 49", match: is("age", "18-29", "30-49") },
  { id: "age-50plus", description: "US adults aged 50 or older", match: is("age", "50-64", "65+") },
  { id: "sex-male", description: "US adult men", match: is("sex", "Male") },
  { id: "sex-female", description: "US adult women", match: is("sex", "Female") },
  { id: "edu-degree", description: "US adults with a four-year college degree or more", match: is("education", "College graduate/some postgrad", "Postgraduate") },
  { id: "edu-nodegree", description: "US adults without a four-year college degree", match: not("education", "College graduate/some postgrad", "Postgraduate") },
  { id: "inc-under50k", description: "US adults with family income under $50,000 a year", match: is("income", "Less than $30,000", "$30,000-$50,000") },
  { id: "inc-50-100k", description: "US adults with family income of $50,000 to $100,000 a year", match: is("income", "$50,000-$75,000", "$75,000-$100,000") },
  { id: "inc-100kplus", description: "US adults with family income of $100,000 a year or more", match: is("income", "$100,000 or more") },
  { id: "race-white", description: "White US adults", match: is("race", "White") },
  { id: "race-nonwhite", description: "US adults who are Black, Asian, Hispanic or another non-White race", match: not("race", "White") },
];

/** Complementary segments whose differences ("gaps") are tested and scored: [a, b] means a minus b. */
export const PAIRS: [string, string][] = [
  ["party-rep", "party-dem"],
  ["ideo-con", "ideo-lib"],
  ["age-18-49", "age-50plus"],
  ["sex-male", "sex-female"],
  ["edu-degree", "edu-nodegree"],
  ["inc-under50k", "inc-100kplus"],
  ["race-white", "race-nonwhite"],
];

export const segmentDef = (id: string): SegmentDef => {
  const s = SEGMENTS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown segment ${id}`);
  return s;
};
