import { Button, ButtonLink } from "@/components/ui/button";
import type { NextMove } from "@/lib/next-move";

// "Your next move": one suggestion with a secondary action, so the page's
// "Publish a space" stays the only basil button. An action without an href
// renders disabled (the insights sample uses this).
type Move = Omit<NextMove, "action"> & { action?: { label: string; href?: string } };

export function NextMoveCard({ move, className = "" }: { move: Move | null; className?: string }) {
  if (!move) return null;
  return (
    <section className={`alt-card flex flex-col items-start gap-3 ${className}`} aria-labelledby="next-move-title">
      <span className={`alt-chip ${move.tone === "filling" ? "alt-chip--filling" : "alt-chip--info"}`}>Your next move</span>
      <h2 id="next-move-title" className="alt-title">
        {move.title}
      </h2>
      <p className="alt-secondary">{move.body}</p>
      {move.action &&
        (move.action.href ? (
          <ButtonLink href={move.action.href} variant="secondary" className="mt-1">
            {move.action.label}
          </ButtonLink>
        ) : (
          <Button variant="secondary" disabled className="mt-1">
            {move.action.label}
          </Button>
        ))}
    </section>
  );
}
