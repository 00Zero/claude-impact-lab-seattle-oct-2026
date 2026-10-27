// Live check of the freshness and location rules:
//   npx tsx --env-file=.env.local scripts/check-fresh.mts "Austin, TX"
import { findOffers } from "../lib/offers";

const item = { id: "c", name: "Boneless skinless chicken breast", searchQuery: "boneless skinless chicken breast 40 lb case", packSize: 40, unit: "lb" as const, qtyPerOrder: 1 };
const offers = await findOffers(item, process.argv[2]);
for (const o of offers) console.log(`$${o.price} / ${o.packSize} ${o.unit} · ${o.store} · ${o.confidence} · ${o.url}`);
console.log(offers.length, "offers");
