import type { Plan } from "@/lib/planner";

// Shown only when the live planner fails (e.g. no network on stage), clearly
// labelled as an example. The spaces are illustrative, so cards link to /spaces
// instead of a create-event form.

const inDays = (days: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const SAMPLE_REQUEST = "Philosophy meetup for about 8 people, Wednesday evening, somewhere quiet, under $30 each.";

export function samplePlan(): Plan {
  return {
    event: {
      title: "Debating Pythagoras",
      description:
        "A relaxed evening of conversation about numbers, harmony and the good life, over a shared dinner. No reading required; bring a question you've been turning over. Newcomers welcome.",
      spots: 8,
    },
    note: "Example result. The live planner couldn't be reached, so this shows what a plan looks like.",
    recommendations: [
      {
        space: {
          id: "sample-1",
          restaurantName: "Il Nido",
          location: "West Seattle, Seattle, WA",
          label: "Window",
          startsAt: inDays(3, 18),
          endsAt: inDays(3, 21),
          capacity: 10,
          description: "Quiet, Window view",
          priceInfo: "$25 minimum spend per person",
        },
        reason: "Quiet window table for 10 on Wednesday evening, with a $25 minimum that fits your budget.",
        spots: 8,
        createEventUrl: "/spaces",
      },
      {
        space: {
          id: "sample-2",
          restaurantName: "Harbor & Pine",
          location: "Ballard, Seattle, WA",
          label: "Long Table",
          startsAt: inDays(3, 18),
          endsAt: inDays(3, 21),
          capacity: 12,
          description: "Reclaimed-wood communal table under the skylight.",
          priceInfo: "$30 minimum spend per person",
        },
        reason: "Same evening and right at your budget; a little larger than you need.",
        spots: 8,
        createEventUrl: "/spaces",
      },
    ],
  };
}
