import type { ReactNode } from "react";

export function BotTurn({ text, lede = false, children }: { text?: string; lede?: boolean; children?: ReactNode }) {
  return (
    <div className="turn bot">
      {text ? <p className={lede ? "lede" : undefined}>{text}</p> : null}
      {children}
    </div>
  );
}
