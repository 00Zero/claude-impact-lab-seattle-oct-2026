import type { ReactNode } from "react";
import { Tag } from "../evidence/Tag";

/** Isotype's ruled statistics sheet. "Updated" when the save file changed after it was first shown. */
export function PlateFrame({ title, label, updated = false, meta, children }: { title: string; label?: string; updated?: boolean; meta?: ReactNode; children?: ReactNode }) {
  return (
    <section className="plate" aria-label={label ?? title}>
      <h3>{title}{updated ? <> <Tag text="Updated" /></> : null}</h3>
      {meta ? <p className="meta">{meta}</p> : null}
      {children}
    </section>
  );
}
