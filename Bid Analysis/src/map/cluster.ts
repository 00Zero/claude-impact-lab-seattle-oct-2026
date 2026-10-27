export interface ScreenPoint<T> {
  x: number;
  y: number;
  data: T;
}

export interface Cluster<T> {
  key: string;
  x: number;
  y: number;
  /** Unique opportunity ids, so multi-site work counts once (MAP-03, MAP-09). */
  ids: string[];
  members: ScreenPoint<T & { oppId: string }>[];
}

/**
 * Greedy screen-space clustering. Deterministic for a given input order.
 * Points matching `keepOut` (the selection) are never absorbed into a cluster.
 * A cluster whose members all share one display anchor is returned as singles,
 * because zooming cannot separate them; the renderer fans those out instead.
 */
export function clusterPoints<T extends { oppId: string }>(
  points: ScreenPoint<T>[],
  radius: number,
  keepOut: (p: ScreenPoint<T>) => boolean,
  anchorKey: (p: ScreenPoint<T>) => string,
) {
  const singles: ScreenPoint<T>[] = [];
  const clusters: Cluster<T>[] = [];
  const pool = points.filter((p) => !keepOut(p));
  singles.push(...points.filter(keepOut));
  const used = new Array(pool.length).fill(false);
  const r2 = radius * radius;
  for (let i = 0; i < pool.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const members = [pool[i]];
    if (radius > 0) {
      for (let j = i + 1; j < pool.length; j++) {
        if (used[j]) continue;
        const dx = pool[j].x - pool[i].x, dy = pool[j].y - pool[i].y;
        if (dx * dx + dy * dy <= r2) {
          used[j] = true;
          members.push(pool[j]);
        }
      }
    }
    const ids = [...new Set(members.map((m) => m.data.oppId))];
    const oneAnchor = members.every((m) => anchorKey(m) === anchorKey(members[0]));
    if (members.length === 1 || ids.length === 1 || oneAnchor) singles.push(...members);
    else
      clusters.push({
        key: ids.slice().sort().join("|"),
        x: members.reduce((a, m) => a + m.x, 0) / members.length,
        y: members.reduce((a, m) => a + m.y, 0) / members.length,
        ids,
        members,
      });
  }
  return { clusters, singles };
}
