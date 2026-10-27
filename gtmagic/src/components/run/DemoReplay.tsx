"use client";
/* The no-Claude demo replay of the KeepStrong example: the gtm-intake session flow on timers,
   every card from the demo save file, then the placeholder crowd test. #error shows a failed research step. */
import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_SCRIPT as S } from "@/app/_intake/demo-script";
import type { IntakeBrief } from "@/app/_intake/schema";
import { buildSim } from "@/app/_intake/sim-placeholder";
import { STEP_IDS, type PlateId, type StepId } from "@/app/_session/events";
import type { StepState } from "@/app/_session/thread";
import { Figure, Icon } from "../figures";
import { CrowdPlate } from "../plates/Crowd";
import { Plate } from "../plates/Plate";
import { ResultsPlate } from "../plates/Results";
import { Composer } from "../shell/Composer";
import { Legend } from "../shell/Legend";
import { Rail } from "../shell/Rail";
import { Steps } from "../shell/Steps";
import { AskTurn } from "../turns/AskTurn";
import { BotTurn } from "../turns/BotTurn";
import { Notice } from "../turns/Notice";
import { OwnerTurn } from "../turns/OwnerTurn";
import { Typing } from "../turns/Typing";

type Item =
  | { kind: "bot"; text: string } | { kind: "ask"; questions: string[] } | { kind: "me"; text: string; file?: string }
  | { kind: "plate"; plate: PlateId } | { kind: "count"; n: number } | { kind: "error" } | { kind: "crowd" } | { kind: "results" };

const idle = (): Record<StepId, StepState> => Object.fromEntries(STEP_IDS.map((s) => [s, "pending"])) as Record<StepId, StepState>;

export function DemoReplay({ brief, hideLinks }: { brief: IntakeBrief; hideLinks: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [steps, setSteps] = useState(idle);
  const [phase, setPhase] = useState<"intro" | "busy" | "done">("intro");
  const [typing, setTyping] = useState(false);
  const [gone, setGone] = useState(0);
  const [groupsKnown, setGroupsKnown] = useState(false);
  const run = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const sim = useMemo(() => buildSim(brief), [brief]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [items, typing]);

  function runner() {
    const token = ++run.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alive = () => token === run.current;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduce ? Math.min(ms, 120) : ms));
    const add = (it: Item) => { if (alive()) setItems((xs) => [...xs, it]); };
    const say = async (it: Item, ms = 600) => { setTyping(true); await wait(ms); setTyping(false); add(it); };
    const step = (s: StepId, state: StepState) => alive() && setSteps((x) => ({ ...x, [s]: state }));
    return { alive, wait, add, say, step };
  }

  async function play(fromResearch = false) {
    const { alive, wait, add, say, step } = runner();
    setPhase("busy");
    if (!fromResearch) {
      step("describe", "running"); add({ kind: "me", text: S.oneLiner }); step("describe", "done");
      step("guess", "running");
      for (const ev of S.interview) {
        if (!alive()) return;
        if (ev.kind === "plate" && ev.plate !== "baseline" && ev.plate !== "creatives") step("guess", "done");
        if (ev.kind === "plate") { step(ev.plate === "baseline" ? "guess" : "answers", "running"); add(ev); await wait(300); }
        else if (ev.kind === "ask") await say({ kind: "ask", questions: ev.questions }, 700);
        else if (ev.kind === "bot") await say({ kind: "bot", text: typeof ev.text === "function" ? ev.text(brief) : ev.text });
        else { await wait(450); add({ kind: "me", text: ev.text, file: ev.file }); }
      }
      step("guess", "done"); step("answers", "done");
    }
    step("research", "running");
    await say({ kind: "bot", text: "Researching how customers in this market talk." });
    for (let k = 1; k <= brief.evidence.length && alive(); k++) { await wait(80); setItems((xs) => [...xs.filter((x) => x.kind !== "count"), { kind: "count", n: k }]); }
    if (!fromResearch && window.location.hash === "#error") { step("research", "failed"); add({ kind: "error" }); setPhase("intro"); return; }
    await say({ kind: "ask", questions: [S.sendBack.ask] }); await wait(450); add({ kind: "me", text: S.sendBack.me });
    setGroupsKnown(true);
    await say({ kind: "bot", text: "Here's who is out there, in their own words." }); add({ kind: "plate", plate: "research" }); step("research", "done");
    step("check", "running");
    await say({ kind: "bot", text: "What the evidence says, and where I tried to prove it wrong." }); add({ kind: "plate", plate: "evidence" });
    await say({ kind: "ask", questions: [S.pushbackAsk] }); await wait(450); add({ kind: "me", text: S.pushbackReply });
    await say({ kind: "bot", text: "Settled. I won't raise it again." });
    const guess = brief.segments.find((s) => s.isOwnerGuess);
    const other = brief.segments.find((s) => !s.isOwnerGuess);
    if (guess && other) {
      await say({ kind: "ask", questions: [`Research points to a group you didn't name: ${other.name.toLowerCase()}. Your first guess was ${guess.name.toLowerCase()}. How would you rank them?`] });
      await wait(450); add({ kind: "me", text: S.rankReply });
    }
    step("check", "done"); step("save", "running");
    await say({ kind: "bot", text: "Here's your save file. Read it back and tell me if it's right." }); add({ kind: "plate", plate: "save" });
    await wait(600); add({ kind: "me", text: S.confirm }); step("save", "done");
    step("test", "running");
    await say({ kind: "bot", text: `Now your ${sim.messages.length} lines go to ${sim.size} simulated customers built from these groups.` });
    add({ kind: "crowd" });
  }

  function crowdDone() {
    if (phase === "done") return;
    setSteps((x) => ({ ...x, test: "done", results: "done" }));
    setItems((xs) => (xs.some((x) => x.kind === "results") ? xs : [...xs, { kind: "results" }, { kind: "bot", text: "Ask me anything about these results or your save file." }]));
    setPhase("done");
  }

  function reset() { run.current++; setItems([]); setSteps(idle()); setPhase("intro"); setGone(0); setGroupsKnown(false); setTyping(false); }

  function followUp(q: string) {
    const top = brief.segments.find((s) => s.ownerRank === 1) ?? brief.segments[0];
    const guess = brief.segments.find((s) => s.isOwnerGuess);
    const worry = top ? brief.concerns.find((c) => c.id === top.concernBundles[0]?.concernIds[0]) : undefined;
    const reply = /guess|first|beginner|starter/i.test(q) && guess
      ? `Your first guess was ${guess.name.toLowerCase()}. ${brief.findings.find((f) => f.segmentId === guess.id)?.claim ?? ""}`
      : /worr|concern|objection/i.test(q) && top && worry
        ? `For ${top.name.toLowerCase()}, the most common worry was ${worry.label.toLowerCase()} (${top.concernBundles[0]?.observedCount} times in the evidence).`
        : `Start with ${top?.name.toLowerCase() ?? "your top group"} and the line “${brief.roughMessaging[0]?.headline ?? ""}”. Treat it as a guess to test, not proof.`;
    setItems((xs) => [...xs, { kind: "me", text: q }, { kind: "bot", text: `${reply} (From your save file and this run's counts. Simulated customers suggest what to test; they don't prove it.)` }]);
  }

  return (
    <div className="app">
      <Rail badge={phase === "intro" && items.length === 0 ? undefined : "Example · fictional data"}
        footer={phase !== "intro" || items.length ? <button className="ghost-btn" type="button" onClick={reset}><Icon name="i-trash" />Delete this run</button> : null}>
        <Steps steps={steps} />
        <Legend segments={groupsKnown ? brief.segments : []} />
      </Rail>
      <main className="main">
        <div className="thread" aria-live="polite">
          <BotTurn lede text="Find out who will buy from you, and what to say to them.">
            <p>This is the KeepStrong example: a fictional business, played back without calling Claude.</p>
            {phase === "intro" && items.length === 0 ? <div className="actions"><button className="btn" type="button" onClick={() => void play()}>Try an example</button></div> : null}
            <div className="waiting" aria-hidden="true">
              {Array.from({ length: 4 }, (_, r) => <div key={r} className="figs">{Array.from({ length: 12 }, (_, c) => <span key={c} className={r * 12 + c < gone ? "fig gone" : "fig"}><Figure /></span>)}</div>)}
              <p>48 simulated customers, one figure each. They pick blind, and the counts decide.</p>
            </div>
          </BotTurn>
          {items.map((it, i) => {
            switch (it.kind) {
              case "bot": return <BotTurn key={i} text={it.text} />;
              case "ask": return <AskTurn key={i} questions={it.questions} state="answered" />;
              case "me": return <OwnerTurn key={i} text={it.text} from="scripted" files={it.file ? [it.file] : []} />;
              case "plate": return <Plate key={i} plate={it.plate} brief={brief} updated={false} hideLinks={hideLinks} downloadHref="/api/businesses/demo/intake.json" />;
              case "count": return <BotTurn key={i}><p className="research-count"><b>{it.n}</b> pieces of evidence so far</p></BotTurn>;
              case "error": return (
                <Notice key={i} title="Research didn't finish." tone="error">The web search timed out. Your answers are kept; trying again starts research over.
                  <div className="actions"><button className="btn" type="button" onClick={() => { setItems((xs) => xs.filter((x) => x.kind !== "error" && x.kind !== "count")); void play(true); }}>Try again</button></div>
                </Notice>
              );
              case "crowd": return <CrowdPlate key={i} brief={brief} sim={sim} animate hideLinks={hideLinks} onProgress={setGone} onDone={crowdDone} />;
              case "results": return <ResultsPlate key={i} brief={brief} sim={sim} />;
            }
          })}
          {typing ? <Typing /> : null}
          <div ref={end} />
        </div>
        <Composer disabled={phase !== "done"} allowFiles={false} onSubmit={(t) => followUp(t)}
          placeholder={phase === "done" ? "Ask about the results" : "Questions open when the results are in"} />
      </main>
    </div>
  );
}
