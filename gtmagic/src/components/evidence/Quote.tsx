/* A real customer quote: the evidence excerpt, the borrowed phrase marked inside it, and its source. */
import { PLAIN } from "@/app/_intake/labels";
import type { Evidence } from "@/app/_intake/schema";
import { Icon } from "../figures";

export function Quote({ evidence, phrase, hideLinks = false }: { evidence: Evidence; phrase?: string; hideLinks?: boolean }) {
  const text = evidence.excerpt;
  const at = phrase ? text.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
  const label = evidence.title ?? PLAIN.sourceType[evidence.sourceType];
  return (
    <div className="quote">
      <q>
        {at < 0 || !phrase ? text : (<>{text.slice(0, at)}<mark>{text.slice(at, at + phrase.length)}</mark>{text.slice(at + phrase.length)}</>)}
      </q>
      <span className="src">
        {evidence.url && !hideLinks ? (<><Icon name="i-link" /><a href={evidence.url} target="_blank" rel="noopener noreferrer">{label}</a></>) : label}
        {evidence.limitations ? <span className="placeholder">{evidence.limitations}</span> : null}
      </span>
    </div>
  );
}
