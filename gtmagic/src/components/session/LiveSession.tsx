"use client";
/* A live gtm-web session: renders the transcript and cards, and sends the owner's answers.
   Re-fetches the session whenever the server-sent stream reports a change. */
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { IntakeBriefSchema } from "@/app/_intake/schema";
import { TranscriptEventSchema } from "@/app/_session/events";
import { postAnswer } from "@/app/_session/post-answer";
import { buildThread, composerPlaceholder, isDisconnected } from "@/app/_session/thread";
import { Plate } from "../plates/Plate";
import { Composer } from "../shell/Composer";
import { Legend } from "../shell/Legend";
import { Rail } from "../shell/Rail";
import { Steps } from "../shell/Steps";
import { AskTurn } from "../turns/AskTurn";
import { BotTurn } from "../turns/BotTurn";
import { Notice } from "../turns/Notice";
import { OwnerTurn } from "../turns/OwnerTurn";
import { Typing } from "../turns/Typing";
import { Icon } from "../figures";
import { SessionEnded } from "./SessionEnded";

const SessionResponse = z.object({
  id: z.string(),
  business: z.string().nullable(),
  events: z.array(TranscriptEventSchema),
  lastEventAt: z.string().nullable(),
  brief: IntakeBriefSchema.nullable(),
  briefUpdatedAt: z.string().nullable(),
  briefIssues: z.array(z.string()),
  agent: z.enum(["running", "stopped", "none"]),
});
type Session = z.infer<typeof SessionResponse>;

export function LiveSession({ id, hideLinks }: { id: string; hideLinks: boolean }) {
  const [s, setS] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
      const parsed = SessionResponse.safeParse(await r.json());
      if (!parsed.success) throw new Error("unexpected response");
      setS(parsed.data);
      setLoadError(null);
    } catch {
      setLoadError("Can't reach the GTMagic app. Is it still running?");
    }
  }, [id]);

  // The stream sends an "update" as soon as it connects, which triggers the first load.
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${id}/stream`);
    es.addEventListener("update", () => void load());
    es.onerror = () => setLoadError("Can't reach the GTMagic app. Is it still running? (Start it with npm run dev.)");
    const clock = setInterval(() => setNow(new Date()), 5000);
    return () => { es.close(); clearInterval(clock); };
  }, [id, load]);

  const t = buildThread(s?.events ?? [], s?.briefUpdatedAt ?? null);
  const quiet = isDisconnected(s?.lastEventAt ?? null, now, t.openAsk !== null) && !t.finished;
  const agentGone = s?.agent === "stopped" && !t.finished;
  // Nobody reads an answer once Claude Code has exited, so don't take one.
  const canAnswer = t.openAsk !== null && t.mode === "live" && !agentGone;

  async function answer(text: string, files: File[]): Promise<boolean> {
    if (!t.openAsk) return false;
    const r = await postAnswer(id, t.openAsk.askId, text, files);
    setSendError(r.ok ? null : r.error);
    await load();
    return r.ok;
  }

  const end = useRef<HTMLDivElement>(null);
  const itemCount = t.items.length;
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [itemCount]);

  async function stop() {
    await fetch(`/api/sessions/${id}/stop`, { method: "POST" });
    await load();
  }

  return (
    <div className="app">
      <Rail footer={s?.agent === "running" && !t.finished ? <button className="ghost-btn" type="button" onClick={() => void stop()}><Icon name="i-trash" />Stop session</button> : null}
        badge={t.mode === "scripted" || s?.brief?.mode === "demo" ? "Example · fictional data" : undefined}>
        <Steps steps={t.steps} />
        <Legend segments={s?.brief?.segments ?? []} />
      </Rail>
      <main className="main">
        <div className="thread" aria-live="polite">
          {loadError ? <Notice title={loadError} tone="error" /> : null}
          {!s && !loadError ? <Typing /> : null}
          {s && t.items.length === 0 ? <BotTurn text="Connected. Claude Code will start the interview here in a moment." /> : null}
          {t.items.map((it) => {
            switch (it.kind) {
              case "bot": return <BotTurn key={it.id} text={it.text} />;
              case "ask": return <AskTurn key={it.id} questions={it.questions} state={it.state} />;
              case "owner": return <OwnerTurn key={it.id} text={it.text} from={it.from} files={it.files} />;
              case "notice": return <Notice key={it.id} title={it.text} tone={it.tone} />;
              case "plate": return s?.brief
                ? <Plate key={it.id} plate={it.plate} brief={s.brief} updated={it.updated} hideLinks={hideLinks} downloadHref={s.business ? `/api/businesses/${encodeURIComponent(s.business)}/intake.json` : undefined} />
                : <BotTurn key={it.id} text="This card appears once the save file exists." />;
            }
          })}
          {s?.briefIssues.length ? <Notice title="The save file can't be read yet." tone="error"><ul className="open">{s.briefIssues.map((i) => <li key={i}>{i}</li>)}</ul></Notice> : null}
          {canAnswer && t.openAsk?.chips.length ? (
            <div className="turn bot"><div className="chips">{t.openAsk.chips.map((c) => <button key={c} type="button" className="chip" onClick={() => void answer(c, [])}>{c}</button>)}</div></div>
          ) : null}
          {s && !t.openAsk && !t.finished && !quiet && !agentGone ? <Typing /> : null}
          {agentGone ? <Notice title="Claude Code stopped before the session finished." tone="error">Its log is in gtm-workspace/.sessions/{id}/agent.log. Start a new session from the home page.</Notice> : null}
          {quiet ? <Notice title="Claude Code hasn't sent anything for a while." tone="error">Check the terminal where it&apos;s running.</Notice> : null}
          {sendError ? <Notice title={sendError} tone="error" /> : null}
          {t.finished ? <SessionEnded business={s?.business ?? null} brief={s?.brief ?? null} /> : null}
          <div ref={end} />
        </div>
        <Composer disabled={!canAnswer} onSubmit={answer} placeholder={composerPlaceholder(t, canAnswer, agentGone)} />
      </main>
    </div>
  );
}
