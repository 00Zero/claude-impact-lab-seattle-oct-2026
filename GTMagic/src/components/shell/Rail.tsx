import Link from "next/link";
import type { ReactNode } from "react";

export function Rail({ badge, children, footer }: { badge?: string; children?: ReactNode; footer?: ReactNode }) {
  return (
    <aside className="rail" aria-label="Run">
      <div className="rail-head">
        <Link className="mark" href="/">GT<span>Magic</span></Link>
        {badge ? <span className="badge">{badge}</span> : null}
      </div>
      {children}
      <div className="rail-foot">
        {footer}
        <p>Open source and free. Runs on your computer.</p>
      </div>
    </aside>
  );
}
