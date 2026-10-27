import { Figure } from "../figures";
import type { GroupClass } from "./groups";

export function GroupFigure({ group }: { group: GroupClass }) {
  return <span className={group}><Figure /></span>;
}
