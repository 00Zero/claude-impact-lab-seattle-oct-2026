import type { ReactNode } from "react";
import { Icon } from "../figures";

export function Notice({ title, children, tone = "info" }: { title: string; children?: ReactNode; tone?: "info" | "error" }) {
  return (
    <div className={tone === "error" ? "notice error" : "notice"} role={tone === "error" ? "alert" : undefined}>
      <Icon name="i-warn" />
      <div><strong>{title}</strong>{children}</div>
    </div>
  );
}
