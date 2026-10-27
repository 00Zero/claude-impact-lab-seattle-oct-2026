/* One card by name. Every card renders from the save file (intake.json), never from chat text. */
import type { IntakeBrief } from "@/app/_intake/schema";
import { buildSim } from "@/app/_intake/sim-placeholder";
import type { PlateId } from "@/app/_session/events";
import { AdsPlate } from "./Ads";
import { BaselinePlate } from "./Baseline";
import { ConstraintsPlate } from "./Constraints";
import { CreativesPlate } from "./Creatives";
import { CrowdPlate } from "./Crowd";
import { EconomicsPlate } from "./Economics";
import { EvidencePlate } from "./Evidence";
import { ResearchPlate } from "./Research";
import { ResultsPlate } from "./Results";
import { SaveFilePlate } from "./SaveFile";

type Props = { plate: PlateId; brief: IntakeBrief; updated: boolean; hideLinks: boolean; downloadHref?: string };

export function Plate({ plate, brief, updated, hideLinks, downloadHref }: Props) {
  switch (plate) {
    case "baseline": return <BaselinePlate baseline={brief.baseline} />;
    case "creatives": return <CreativesPlate creatives={brief.creatives} business={brief.business} updated={updated} />;
    case "economics": return <EconomicsPlate business={brief.business} updated={updated} />;
    case "ads": return <AdsPlate experiments={brief.priorExperiments} business={brief.business} updated={updated} />;
    case "constraints": return <ConstraintsPlate constraints={brief.constraints} updated={updated} />;
    case "research": return <ResearchPlate brief={brief} updated={updated} hideLinks={hideLinks} />;
    case "evidence": return <EvidencePlate brief={brief} updated={updated} />;
    case "save": return <SaveFilePlate brief={brief} updated={updated} downloadHref={downloadHref} />;
    case "crowd": return <CrowdPlate brief={brief} sim={buildSim(brief)} hideLinks={hideLinks} updated={updated} />;
    case "results": return <ResultsPlate brief={brief} sim={buildSim(brief)} updated={updated} />;
  }
}
