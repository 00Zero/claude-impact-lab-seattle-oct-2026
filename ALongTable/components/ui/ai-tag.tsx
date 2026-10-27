import type { ReactNode } from "react";
import { Sparkle } from "@phosphor-icons/react/ssr";

// Marks anything ALong AI wrote or picked, so people can tell it apart from what
// they entered or decided themselves (brand/DESIGN.md → AI tag). The note says
// what the AI did and, where it matters, what the person still decides.
export function AiTag({ children }: { children?: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="alt-chip alt-chip--info shrink-0">
        <Sparkle size={16} aria-hidden="true" />
        ALong AI
      </span>
      {children && <span className="alt-secondary">{children}</span>}
    </p>
  );
}
