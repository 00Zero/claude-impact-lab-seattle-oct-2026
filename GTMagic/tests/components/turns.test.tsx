import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseIntake } from "@/app/_intake/schema";
import { Quote } from "@/components/evidence/Quote";
import { SimulatedBlock } from "@/components/evidence/SimulatedBlock";
import { AskTurn } from "@/components/turns/AskTurn";
import { BotTurn } from "@/components/turns/BotTurn";
import { OwnerTurn } from "@/components/turns/OwnerTurn";

const r = parseIntake(readFileSync("fixtures/demo/intake.json", "utf8"));
if (!r.ok) throw new Error("demo fixture must parse");
const brief = r.brief;
const lex = brief.lexicon[0]!;
const ev = brief.evidence.find((e) => e.id === lex.evidenceId)!;

describe("Quote", () => {
  it("marks exactly the borrowed phrase and links the source", () => {
    const html = renderToStaticMarkup(<Quote evidence={ev} phrase={lex.phrase} />);
    expect(html).toContain(`<mark>${lex.phrase}</mark>`);
    expect(html).toContain(`href="${ev.url}"`);
  });

  it("hides source links for recordings", () => {
    expect(renderToStaticMarkup(<Quote evidence={ev} phrase={lex.phrase} hideLinks />)).not.toContain("<a ");
  });
});

describe("SimulatedBlock", () => {
  it("uses the simulated style and is never a quote", () => {
    const html = renderToStaticMarkup(<SimulatedBlock label="Simulated answer, not a real quote" text="I'd buy it." />);
    expect(html).toContain('class="sim"');
    expect(html).not.toContain("<q");
  });
});

describe("turns", () => {
  it("renders generated text as text, never as HTML", () => {
    const html = renderToStaticMarkup(<BotTurn text={'<script>alert("x")</script>'} />);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("labels the scripted demo owner as fictional", () => {
    expect(renderToStaticMarkup(<OwnerTurn text="About 9." from="scripted" files={[]} />)).toContain("Scripted demo owner · fictional");
  });

  it("notes an answer typed in the terminal", () => {
    expect(renderToStaticMarkup(<AskTurn questions={["Price?"]} state="answered-in-terminal" />)).toContain("Answered in the terminal");
  });
});
