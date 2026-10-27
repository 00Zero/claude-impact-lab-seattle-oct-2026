import type { BriefAnswer, BriefPhoto, ServiceBrief } from "@/lib/brief-types";

// Demo brief for the HVAC "AC not cooling" scenario (docs/design), matching
// the answers in intake-demo.ts. It's also the example the AI prompt should
// copy: same fields, same tone, same length.

export const DEMO_BRIEF_PHOTOS: BriefPhoto[] = [
  { id: "outdoor-unit", title: "The outdoor unit", url: "/landing/ac-condenser.jpg", width: 1920, height: 1337 },
  { id: "thermostat", title: "Thermostat screen", url: "/demo/thermostat.svg", width: 400, height: 300 },
];

export const DEMO_BRIEF_ANSWERS: BriefAnswer[] = [
  { questionId: "fan", short: "Outdoor fan spinning?", answer: "No, it’s still" },
  { questionId: "hum", short: "Humming sound?", answer: "Yes, humming" },
  { questionId: "vents", short: "Vent air warm?", answer: "Yes, it’s warm" },
  { questionId: "smell", short: "Burning smell?", answer: "No" },
  { questionId: "note", short: "Anything else", answer: "“Stopped after the heat wave”" },
];

export const DEMO_BRIEF: ServiceBrief = {
  verdict: "Failed run capacitor",
  confidence: "high",
  why: "Fan won’t spin but the unit hums. The thermostat is calling for cool.",
  bring: [
    { item: "Dual run capacitor 45/5 µF, 440V" },
    { item: "Contactor 30A 2-pole", note: "Backup, if the contacts are pitted" },
    { item: "Multimeter with capacitance" },
  ],
  confirmOnSite: "Test the capacitor before swapping it. If the fan still won’t start, check the motor.",
  alsoPossible: [
    { cause: "Stuck contactor", confidence: "low" },
    { cause: "Failed fan motor", confidence: "low" },
  ],
  equipment: { label: "Carrier outdoor AC unit", model: "24ACC636A003", serial: "2919E1••••" },
  photoNotes: [
    {
      photoId: "outdoor-unit",
      x: 66.5,
      y: 43,
      text: "Carrier outdoor unit",
      supports: "Identifies the equipment and the capacitor rating to bring",
    },
    {
      photoId: "outdoor-unit",
      x: 48,
      y: 59,
      text: "Condenser fan",
      supports: "Drew says it isn’t spinning while the unit runs",
    },
    {
      photoId: "outdoor-unit",
      x: 70.5,
      y: 58,
      text: "Refrigerant lines intact, no ice or debris",
      supports: "Makes a frozen or blocked coil less likely",
    },
    {
      photoId: "thermostat",
      x: 50,
      y: 42,
      text: "Set to Cool, 72°, room at 81°",
      supports: "The thermostat is calling for cooling, so it’s not the cause",
    },
  ],
  answerNotes: [
    { questionId: "hum", quote: "“Yes, humming” from the outdoor unit", supports: "Power is reaching the unit, but the fan can’t start" },
    { questionId: "note", quote: "“Stopped after the heat wave”", supports: "Capacitors often fail after long hot runs" },
  ],
  notSeen: "Inside the service panel (Drew wasn’t asked to open it) and the breaker.",
  estimate: { low: 150, high: 350 },
};
