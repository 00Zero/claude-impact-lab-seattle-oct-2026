import type { IntakeAnalysisView } from "@/lib/intake-questions";

// Sample analysis for the contractor preview and /demo/intake, where nothing
// is saved and no AI runs. Same shape as the real analysis, so the wizard
// renders both the same way.

const DEMO_ANALYSIS: IntakeAnalysisView = {
  seen: ["Carrier outdoor AC unit · label found", "Thermostat set to Cool, 72°, room at 81°"],
  photoIssues: [],
  urgentConcern: null,
  questions: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      type: "yes_no_unknown",
      label: "With the AC on, is the big fan on the outdoor unit spinning?",
      help: "Look from a few feet away. Don’t touch it.",
      options: ["Yes", "No", "Not sure"],
      unit: null,
      required: false,
      allowUnknown: true,
      reason: "Your photo shows the outdoor unit.",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      type: "single_select",
      label: "When did you first notice the problem?",
      help: null,
      options: ["Today", "In the last few days", "About a week ago", "Longer than that"],
      unit: null,
      required: false,
      allowUnknown: true,
      reason: "Timing helps them figure out what to bring.",
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      type: "short_text",
      label: "Anything they should know to get to the unit? (gate code, pets, parking)",
      help: null,
      options: [],
      unit: null,
      required: false,
      allowUnknown: false,
      reason: "So the technician can get to the equipment easily.",
    },
  ],
};

export async function demoAnalysis(): Promise<IntakeAnalysisView> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  return DEMO_ANALYSIS;
}
