import Link from "next/link";
import type { IntakeBrief } from "@/app/_intake/schema";
import { BotTurn } from "../turns/BotTurn";

const ENDED = "This page won't take more questions.";

/* Shown once the session is over. Without it the greyed-out chat box looks like the session froze.
   "Done" also follows an early Stop, so what it offers depends on how far the save file got. */
export function SessionEnded({ business, brief }: { business: string | null; brief: IntakeBrief | null }) {
  const startOver = <li>To start over, <Link href="/">start a new session</Link> from the home page.</li>;
  if (!business || !brief) {
    return (
      <BotTurn text={`This session has ended before your save file was finished. ${ENDED}`}>
        <ul className="open">{startOver}</ul>
      </BotTurn>
    );
  }
  const ready = brief.readiness.status === "ready";
  const folder = `gtm-workspace/${business}`;
  return (
    <BotTurn text={ready
      ? `That's the end of this interview. ${ENDED} Your save file is in ${folder}.`
      : `This session has ended, and your save file isn't finished yet. ${ENDED} It's in ${folder}.`}>
      <ul className="open">
        <li><Link href={`/run/${encodeURIComponent(business)}`}>{ready ? "See your save file" : "See what your save file still needs"}</Link></li>
        <li>To keep going, open Claude Code with your GTMagic folder and ask: &ldquo;What should I do next with my {brief.business.name} save file?&rdquo;</li>
        {startOver}
      </ul>
    </BotTurn>
  );
}
