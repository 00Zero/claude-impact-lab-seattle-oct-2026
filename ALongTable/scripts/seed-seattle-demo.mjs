// Demo data: ten invented Seattle restaurants, each with a booked event (guests included) and an open space.
// Every restaurant, event and guest here is made up. Neighborhood names are real; pins sit at the neighborhood center.
//
// Run:  node --env-file=.env.local scripts/seed-seattle-demo.mjs [--photos DIR]
//
// Safe to re-run. A restaurant is only given spaces and events if it has none, and a photo is only uploaded
// where there isn't one. Spaces are booked through the same database functions the app uses
// (create_event_for_space, reserve_seat), so seat counts and statuses are consistent.
//
// --photos DIR: a folder of JPEGs named as below. Restaurant photos: marrow-moss.jpg, copper-heron.jpg, ...
// Event photos: ev-*.jpg. Sources and licenses are in supabase/photo-credits.md. Photos are optional.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const photosDir = process.argv.includes("--photos") ? process.argv[process.argv.indexOf("--photos") + 1] : null;

// ---- time helpers (Seattle wall-clock -> UTC), same logic as lib/time.ts -------------------------------------
const TZ = "America/Los_Angeles";
const SLOTS = { lunch: ["11:30", "14:00"], early: ["17:00", "19:00"], dinner: ["18:00", "21:00"], late: ["21:00", "23:00"] };
function seattleToUtc(date, time) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(new Date(guess));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return new Date(guess - (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - guess));
}
function dayPlus(n) {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
const when = (offset, slot) => ({ starts_at: seattleToUtc(dayPlus(offset), SLOTS[slot][0]).toISOString(), ends_at: seattleToUtc(dayPlus(offset), SLOTS[slot][1]).toISOString() });

// ---- the data ----------------------------------------------------------------------------------------------
// `was`: the earlier name and location of this row, if it was renamed from something else.
const R = [
  { was: ["Canlis", "Queen Anne, Seattle, WA"], name: "Marrow & Moss", location: "Queen Anne, Seattle, WA", lat: 47.6394805, lng: -122.3607453, photo: "marrow-moss.jpg",
    event: { space: { label: "Private room", day: 3, slot: "dinner", capacity: 10, description: "Quiet, Private", price: "$55 per person, three courses" },
      title: "Cheese & Cider Pairing Night", description: "Six farmhouse cheeses with dry ciders, guided by our cheesemonger. Come hungry, leave with a favorite.", organizer: "Elena Park", capacity: 10, guests: 6, photo: "ev-cheese.jpg" },
    open: { label: "Main dining", day: 6, slot: "dinner", capacity: 8, description: "Quiet", price: "$40 minimum spend per person" } },
  { was: ["Matt's in the Market", "Pike Place Market, Seattle, WA"], name: "The Copper Heron", location: "Wallingford, Seattle, WA", lat: 47.6594631, lng: -122.3343417, photo: "copper-heron.jpg",
    event: { space: { label: "Window", day: 2, slot: "early", capacity: 6, description: "Quiet, Window view", price: "$25 minimum spend per person" },
      title: "Old World vs New World: A Wine Debate", description: "Four wines, two sides, one friendly argument. No expertise needed, just opinions.", organizer: "Marcus Webb", capacity: 6, guests: 4, photo: "ev-wine.jpg" },
    open: { label: "Bar", day: 5, slot: "late", capacity: 4, description: "Lively", price: "$15 minimum spend per person" } },
  { was: ["The Pink Door", "Pike Place Market, Seattle, WA"], name: "Lantern Alley Trattoria", location: "Greenwood, Seattle, WA", lat: 47.6909806, lng: -122.3548773, photo: "lantern-alley.jpg",
    event: { space: { label: "Communal table", day: 4, slot: "dinner", capacity: 12, description: "Lively, Long communal table", price: "$35 per person, pasta and wine" },
      title: "Hand-Rolled Pasta Night", description: "Roll, cut and shape fresh pasta with our chef, then eat what you make.", organizer: "Giulia Romano", capacity: 12, guests: 9, photo: "ev-pasta.jpg" },
    open: { label: "Patio", day: 8, slot: "early", capacity: 6, description: "Outdoor", price: "$25 minimum spend per person" } },
  { was: ["Din Tai Fung", "University Village, Seattle, WA"], name: "Jade Steam House", location: "Columbia City, Seattle, WA", lat: 47.5579124, lng: -122.2852162, photo: "jade-steam.jpg",
    event: { space: { label: "Main dining", day: 5, slot: "lunch", capacity: 8, description: "Lively", price: "$30 per person, dumpling feast" },
      title: "Dumpling Folding Workshop", description: "Learn three classic folds, then steam your own batch. All skill levels welcome.", organizer: "Wen Li", capacity: 8, guests: 5, photo: "ev-dumplings.jpg" },
    open: { label: "Private room", day: 9, slot: "dinner", capacity: 10, description: "Private", price: "$40 minimum spend per person" } },
  { was: ["Salumi Artisan Cured Meats", "Pioneer Square, Seattle, WA"], name: "Fennel & Flint", location: "Georgetown, Seattle, WA", lat: 47.5489326, lng: -122.3300573, photo: "fennel-flint.jpg",
    event: { space: { label: "Bar", day: 3, slot: "late", capacity: 6, description: "Lively", price: "$25 minimum spend per person" },
      title: "Natural Wine & Cheese Evening", description: "A relaxed flight of low-intervention wines with a board of cheese and cured meats.", organizer: "Tomás Rivera", capacity: 6, guests: 3, photo: "ev-wine-cheese.jpg" },
    open: { label: "Communal table", day: 7, slot: "dinner", capacity: 10, description: "Long communal table", price: "$25 minimum spend per person" } },
  { was: ["Paseo", "Fremont, Seattle, WA"], name: "Sunday Sandwich Co.", location: "Phinney Ridge, Seattle, WA", lat: 47.6721306, lng: -122.3540306, photo: "sunday-sandwich.jpg",
    event: { space: { label: "Communal table", day: 2, slot: "lunch", capacity: 8, description: "Lively", price: "$15 minimum spend per person" },
      title: "Board Game Lunch Club", description: "Sandwiches, soup and a shelf of board games. Bring a favorite or borrow ours.", organizer: "Priya Shah", capacity: 8, guests: 7, photo: "ev-boardgame.jpg" },
    open: { label: "Window", day: 6, slot: "lunch", capacity: 4, description: "Window view", price: "$15 minimum spend per person" } },
  { was: ["Ivar's Acres of Clams", "Central Waterfront, Seattle, WA"], name: "Tidewater Fish House", location: "Eastlake, Seattle, WA", lat: 47.6408253, lng: -122.3257232, photo: "tidewater.jpg",
    event: { space: { label: "Patio", day: 4, slot: "lunch", capacity: 6, description: "Outdoor", price: "$25 minimum spend per person" },
      title: "Seafood Brunch Club", description: "A long table by the water for seafood, mimosas and unhurried conversation.", organizer: "Hannah Brooks", capacity: 6, guests: 2, photo: "ev-brunch.jpg" },
    open: { label: "Main dining", day: 7, slot: "dinner", capacity: 8, description: "Quiet", price: "$25 minimum spend per person" } },
  { was: ["Metropolitan Grill", "Downtown, Seattle, WA"], name: "Ironbark Steakhouse", location: "Beacon Hill, Seattle, WA", lat: 47.5775857, lng: -122.30996, photo: "ironbark.jpg",
    event: { space: { label: "Private room", day: 6, slot: "dinner", capacity: 10, description: "Private, Quiet", price: "$45 per person, three courses" },
      title: "Beer & Whiskey Flight Dinner", description: "A three-course dinner paired with local beer and whiskey flights.", organizer: "Dale Okafor", capacity: 10, guests: 8, photo: "ev-whiskey.jpg" },
    open: { label: "Main dining", day: 3, slot: "early", capacity: 6, description: "Quiet", price: "$40 minimum spend per person" } },
  { was: ["Tilikum Place Cafe", "Belltown, Seattle, WA"], name: "Willow Table Cafe", location: "Madrona, Seattle, WA", lat: 47.6127915, lng: -122.2912264, photo: "willow-table.jpg",
    event: { space: { label: "Window", day: 3, slot: "lunch", capacity: 6, description: "Quiet, Window view", price: "$15 minimum spend per person" },
      title: "Vegetarian Supper Club", description: "A shared vegetarian meal built around what's good at the market this week.", organizer: "Nora Lindqvist", capacity: 6, guests: 4, photo: "ev-veg.jpg" },
    open: { label: "Patio", day: 10, slot: "lunch", capacity: 4, description: "Outdoor", price: "$15 minimum spend per person" } },
  // No event photo here on purpose: its cards fall back to the restaurant's photo.
  { was: ["Taylor Shellfish Oyster Bar", "Pioneer Square, Seattle, WA"], name: "Brine & Pearl Oyster Bar", location: "Fremont, Seattle, WA", lat: 47.6504529, lng: -122.3499861, photo: "brine-pearl.jpg",
    event: { space: { label: "Bar", day: 4, slot: "early", capacity: 6, description: "Lively", price: "$30 minimum spend per person" },
      title: "Oyster Happy Hour & Shucking 101", description: "Learn to shuck, then taste six varieties with a glass of something cold.", organizer: "Jun Takahashi", capacity: 6, guests: 6, photo: null },
    open: { label: "Communal table", day: 8, slot: "dinner", capacity: 8, description: "Long communal table", price: "$30 minimum spend per person" } },
];
const GUESTS = ["Avery Chen", "Jordan Alvarez", "Sam Okonkwo", "Riley Nakamura", "Casey Petrov", "Morgan Dubois", "Taylor Haddad", "Quinn Larsen", "Jamie Osei", "Drew Kowalski", "Rowan Mehta", "Skyler Brandt"];

// ---- helpers -----------------------------------------------------------------------------------------------
const key = (n, l) => `${n.trim().toLowerCase()}|${l.trim().toLowerCase()}`;
const must = (res, what) => { if (res.error) throw new Error(`${what}: ${res.error.message}`); return res.data; };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
async function uploadPhoto(kind, id, file) {
  if (!photosDir || !file) return null;
  const path = `${photosDir}/${file}`;
  if (!existsSync(path)) { console.log(`    (no file ${file}, skipping photo)`); return null; }
  const storagePath = `${kind}/${id}/${randomUUID()}.jpg`;
  must(await db.storage.from("photos").upload(storagePath, readFileSync(path), { contentType: "image/jpeg", cacheControl: "31536000" }), "upload");
  return db.storage.from("photos").getPublicUrl(storagePath).data.publicUrl;
}

// ---- run ---------------------------------------------------------------------------------------------------
const all = must(await db.from("restaurants").select("id,name,location,photo_url"), "list restaurants");
const byKey = new Map(all.map((r) => [key(r.name, r.location), r]));
let guestCounter = 0;

for (const spec of R) {
  console.log(`\n${spec.name} (${spec.location})`);
  // 1) the restaurant: rename the earlier row, or find, or create
  let row = byKey.get(key(spec.name, spec.location));
  const old = spec.was && byKey.get(key(...spec.was));
  if (!row && old) {
    must(await db.from("restaurants").update({ name: spec.name, location: spec.location, lat: spec.lat, lng: spec.lng }).eq("id", old.id), "rename");
    row = { ...old, name: spec.name, location: spec.location };
    console.log(`  renamed from ${spec.was[0]}`);
  } else if (!row) {
    row = must(await db.from("restaurants").insert({ name: spec.name, location: spec.location, lat: spec.lat, lng: spec.lng }).select("id,name,location,photo_url").single(), "insert");
    console.log("  created");
  } else {
    console.log("  already there");
  }
  if (!row.photo_url) {
    const url = await uploadPhoto("restaurants", row.id, spec.photo);
    if (url) { must(await db.from("restaurants").update({ photo_url: url }).eq("id", row.id), "set photo"); console.log("  restaurant photo added"); }
  }

  // 2) spaces and the event, only if the restaurant has none yet
  const existing = must(await db.from("spaces").select("id").eq("restaurant_id", row.id), "list spaces");
  if (existing.length) { console.log(`  already has ${existing.length} space(s), leaving them alone`); continue; }

  const e = spec.event;
  const bookedSpace = must(await db.from("spaces").insert({ restaurant_id: row.id, label: e.space.label, ...when(e.space.day, e.space.slot), capacity: e.space.capacity, description: e.space.description, price_info: e.space.price }).select("id").single(), "insert space");
  const event = must(await db.rpc("create_event_for_space", { p_space_id: bookedSpace.id, p_title: e.title, p_description: e.description, p_capacity: e.capacity, p_organizer_name: e.organizer, p_organizer_email: `${slug(e.organizer)}@example.com` }), "create event");
  for (let i = 0; i < e.guests; i++) {
    const name = GUESTS[guestCounter++ % GUESTS.length];
    must(await db.rpc("reserve_seat", { p_event_id: event.id, p_name: name, p_email: `${slug(name)}.${guestCounter}@example.com` }), "reserve seat");
  }
  const eventPhoto = await uploadPhoto("events", event.id, e.photo);
  if (eventPhoto) must(await db.from("events").update({ photo_url: eventPhoto }).eq("id", event.id), "set event photo");
  console.log(`  event "${e.title}": ${e.guests} of ${e.capacity} seats taken${eventPhoto ? ", with its own photo" : ", no photo of its own"}`);

  const o = spec.open;
  must(await db.from("spaces").insert({ restaurant_id: row.id, label: o.label, ...when(o.day, o.slot), capacity: o.capacity, description: o.description, price_info: o.price }), "insert open space");
  console.log(`  open space: ${o.label}, ${o.capacity} seats`);
}
console.log("\nDone.");
