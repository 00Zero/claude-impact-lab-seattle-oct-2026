import Link from "next/link";
import { Tag } from "../evidence/Tag";

type Session = { id: string; business: string | null; lastEventAt: string | null; done: boolean };

export function SessionList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return <p className="meta">No sessions yet. Start one above.</p>;
  return (
    <ul className="home-list">
      {sessions.map((s) => (
        <li key={s.id}>
          <div>
            <Link className="strong" href={`/session/${s.id}`}>{s.business ?? "New session"}</Link>
            {s.lastEventAt ? <span className="sub">Last update {new Date(s.lastEventAt).toLocaleString("en-US")}</span> : null}
          </div>
          <Tag text={s.done ? "Finished" : "Live"} variant={s.done ? undefined : "v-serviceable"} />
        </li>
      ))}
    </ul>
  );
}
