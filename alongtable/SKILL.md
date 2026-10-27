---
name: alongtable-design-concept
description: Design, build, or refine ALongTable and ALongPartner product experiences using the established shared-table dining concept. Use whenever a request touches the brand, C-end discovery and bookings, themes, seats, prepaid prix fixe menus, checkout, restaurant operations, AI off-peak offers, or either prototype, even when the user does not explicitly ask for this skill.
compatibility: Works with static HTML prototypes and web application projects. No external service is required for design work.
---

# ALongTable design concept

Use this skill to keep ALongTable's product, interaction design, and visual language coherent as the experience grows. Treat the current prototypes and the product decisions captured here as the design foundation; follow newer user direction when it changes a detail.

## Product idea

ALongTable helps people meet through shared meals. Guests choose what they want to gather around, find a table with open seats, select a restaurant prix fixe menu, and pay ahead. Restaurants use ALongPartner to fill quiet periods with curated offers and receive prepaid bookings.

The experience should feel like an inviting hosted dinner: good food is the reason to arrive, and a compatible table is the reason to join. Keep discovery centered on people, interests, and a specific gathering rather than turning the product into a generic restaurant directory or dating app.

## Brand and visual language

- Use the promise **“总有一桌，合你胃口”** — “There’s always a table you’ll love.”
- Use the ALongTable mark: two rows of four outlined circles with a strong horizontal table line between them; the last lower circle is gold.
- Keep the interface warm, calm, and editorial. Use soft ivory backgrounds, white surfaces, charcoal text, muted gray supporting text, restrained gold accents, subtle borders, and rounded cards.
- Make typography clear and confident. Let restaurant names, theme labels, gathering details, and prices carry the hierarchy.
- Keep Chinese and English copy concise and natural. Preserve the language toggle where the product already offers one; localize labels, helper text, dates, and prices consistently.
- Use gold for the selected state and the brand accent, not as a blanket highlight. Avoid loud gradients, dense dashboard chrome, or generic dating-app imagery.

## C-end: guest discovery and booking

Design for a mobile-first guest flow:

1. **Onboarding:** Ask which themes the guest may enjoy. Let them choose more than one, then recommend matching tables. The prompt is “Choose your table” / “选择你的餐桌,” not “What would you like to gather around?”
2. **Themes:** Offer a broad set of specific, welcoming interests such as New in town, Creative people, Tech & product, Food lovers, Outdoors, Books & culture, After-work, Singles in town, Design & architecture, Founders & makers, Writers & readers, Board games, Coffee & tea, Fitness & wellness, Language exchange, Live music, Parents & caregivers, Women in tech, Climate & community, and Film & photography. Use **“Singles in town”** rather than “Dating table.”
3. **Theme to tables:** Tapping a theme goes directly to the list of matching tables. Do not add an intermediate restaurant-selection screen. Show realistic populated demo tables by default so the concept is immediately understandable. If a theme has no tables, show a clear empty state with an action to create one.
4. **Table cards:** Make the gathering easy to scan: restaurant and area, theme, date and time, host, minimum guest count, seat capacity, filled seats, and remaining availability. Distinguish joining an existing table from creating a new one.
5. **Seat status:** Use a compact set of seat indicators, not a spatial chair map. Communicate capacity once. Filled seats are gray, open seats are white with a visible outline, and the guest's chosen seat is gold. Keep the colors and labels consistent in cards, detail views, and checkout.
6. **Menu and prepaid checkout:** Preserve the prepaid offer. Let guests choose a one-, two-, or three-course prix fixe tier, then choose dishes for each included course from visible selection lists. Do not put dish choices in dropdowns. Show the set-menu savings and itemized total clearly, including tax and tip where applicable, before payment. Finish with a booking confirmation and a useful booking reference.

### Table creation rules

- A guest can create a table for a restaurant only at least 48 hours before the gathering.
- At 24 hours before the start time, automatically cancel a table that has not reached its minimum guest count. If it has reached the minimum, confirm it.
- Explain both rules near the create-table controls and show the table's minimum and capacity before publishing.
- A host follows the same menu-selection and prepaid flow as other guests when they reserve their own seat.

## Partner experience: ALongPartner

Design the partner side as a responsive restaurant operations console, separate from the guest discovery experience. Use a clear overview, offer management, prix fixe menu setup, prepaid order management, and auto-adjustment controls.

- One partner login manages one restaurant. Show the restaurant identity as a fixed account label; do not show a restaurant switcher or a list of other restaurants.
- Recommend off-peak days and time windows using clear reasons. Show the proposed availability, discount, prix fixe price, and expected table-fill improvement together.
- Let the restaurant build prix fixe courses from its existing menu through visible selection lists. Make selected dishes and the resulting offer price easy to review.
- Provide separate controls for automatic availability, pricing, and timing adjustments. Keep each control's scope and limits visible. AI suggestions are reviewable; publishing an offer requires an affirmative restaurant action. Auto-adjustments remain bounded by the restaurant's chosen settings and can be paused.
- Orders arrive from C-end prepaid bookings. Show guest or party size, gathering time, selected courses, seat details, booking reference, prepaid amount, and booking status.
- Do not describe these as B-end bookings. The partner console receives orders created by C-end guests.

## Prototype behavior and content

- Favor a complete, believable journey over a static landing page: onboarding, theme selection, populated tables, table details, course and dish choices, seat selection, checkout, confirmation, partner offer controls, and incoming prepaid orders.
- Keep the C-end and partner site as distinct experiences and deployments. Their shared brand does not mean they should share navigation or audience-specific copy.
- Use believable demo data for restaurants, themes, hosts, dates, seat counts, dishes, discounts, and orders. Make all visible controls work in the prototype and use clear feedback for actions.
- Explain the product in the interface through concrete examples. Avoid unsupported claims about what AI knows or guarantees.
- Keep accessible labels and keyboard interaction for selectable themes, dishes, seats, and controls. Do not rely on color alone to communicate seat state or selection.

## Avoid

- Inserting an extra step between choosing a theme and seeing matching tables.
- Dropdowns for course or dish selection.
- A large circular or room-style seat map when a compact capacity indicator is enough.
- Ambiguous availability that mixes total seats, occupied seats, and seats remaining without labels.
- Restaurant account switching for a single-restaurant partner login.
- Calling the “Singles in town” theme a dating table.
- Hiding the prepaid nature, chosen dishes, or final price until after checkout.
- Empty screens in the default demo flow when realistic sample data can show how the service works.
