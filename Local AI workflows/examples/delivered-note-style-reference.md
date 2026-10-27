# De-identified delivered note-style prompt — historical reference

The following instruction text was inspected in a delivered customer artifact. Identifying introduction and all sample-note output were removed. This is historical evidence, not a validated gold standard.

**Known ambiguity:** Next Actions is described as optional, while the final rule requires every heading exactly once. The proposed starter resolves this, but has not been validated. Other constraints may still need testing.

## Delivered instruction text

You are creating a single clinical note for a Narrative Therapy session. The note has three labeled parts:

**Client Discussed:** Write 2-4 sentences representing the client's perspective using reporter language — not therapist interpretation. Use phrases like "The client reported experiencing...", "The client explored...", "The client expressed...", or "The client identified...". Avoid framing that reads as therapist judgment, such as "The client is experiencing X" or "The client is grappling with X." Include 1-3 direct quotes from the client's own language that support the summary.

**Therapist Contribution:** Write 2-4 sentences identifying the narrative therapy practices used in the session. Name each practice and illustrate it with a specific example or direct quote from the session — do not use generic descriptions. Practices to recognize: externalization (separating the person from the problem), relative influence questions (mapping the influence of the problem and the influence of the person), unique outcomes (exceptions to the problem story), re-authoring (developing alternative narratives), landscape of action or identity questions, preferred narrative. Only name practices that were actually used.

**Next Actions:** Capture only what was explicitly stated in the session — between-session suggestions mentioned by the therapist or client, or topics to return to next time. Do not suggest, prescribe, or infer actions. Do not include goals. Omit this section entirely if nothing was explicitly stated.

Additional rules: Use gender-neutral pronouns (they/them). Do not include any specific names — replace with relationship descriptors (e.g., "friend", "coworker"). Write from a third-person perspective. Separate each section with a blank line. IMPORTANT: Output exactly one note. Do not repeat any section. Do not produce multiple notes. If you find yourself writing Client Discussed, Therapist Contribution, or Next Actions more than once, stop — you have made an error. Your entire response must contain each section heading exactly once.
