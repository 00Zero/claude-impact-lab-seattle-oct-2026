import Link from "next/link";
import { PLAIN } from "@/app/_intake/labels";
import { listBusinesses } from "@/app/_intake/workspace";
import { listSessions } from "@/app/_session/store";
import { Rail } from "@/components/shell/Rail";
import { BotTurn } from "@/components/turns/BotTurn";
import { SessionList } from "@/components/home/SessionList";
import { StartSession } from "@/components/home/StartSession";
import { Tag } from "@/components/evidence/Tag";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [businesses, sessions] = await Promise.all([listBusinesses(), listSessions()]);
  const saved = businesses.filter((b) => !b.isDemo);
  return (
    <div className="app">
      <Rail />
      <main className="main"><div className="thread">
        <BotTurn lede text="Find out who will buy from you, and what to say to them.">
          <p>Click Start, answer a few questions here, and GTMagic researches how real customers talk and builds your save file as you go. It runs on your computer, using your Claude Code login.</p>
          <div className="actions"><StartSession /><Link className="btn secondary" href="/run/demo?replay=1">Try the example</Link></div>
        </BotTurn>
        <section className="plate" aria-label="Sessions">
          <h3>Sessions</h3>
          <SessionList sessions={sessions} />
        </section>
        <section className="plate" aria-label="Saved businesses">
          <h3>Saved businesses</h3>
          {saved.length === 0 ? <p className="meta">Nothing in gtm-workspace yet. Your save files appear here after a run.</p> : (
            <ul className="home-list">{saved.map((b) => (
              <li key={b.slug}>
                <Link className="strong" href={`/run/${b.slug}`}>{b.name}</Link>
                <Tag text={b.status === "unreadable" ? "Can't read yet" : PLAIN.readiness[b.status]} variant={b.status === "ready" ? "v-serviceable" : undefined} />
              </li>
            ))}</ul>
          )}
          <p className="meta"><Link href="/run/demo">See the example save file (KeepStrong, fictional)</Link></p>
        </section>
      </div></main>
    </div>
  );
}
