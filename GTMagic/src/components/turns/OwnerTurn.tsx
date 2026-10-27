import type { AnswerFrom } from "@/app/_session/events";
import { Icon } from "../figures";

const WHO: Record<AnswerFrom, string> = { page: "You", terminal: "You, in the terminal", scripted: "Scripted demo owner · fictional" };

export function OwnerTurn({ text, from, files }: { text: string; from: AnswerFrom; files: string[] }) {
  return (
    <div className="turn me">
      <span className="who">{WHO[from]}</span>
      {text}
      {files.map((f) => (
        <span key={f} className="file"><Icon name="i-copy" />{f.replace(/^uploads\//, "")}</span>
      ))}
    </div>
  );
}
