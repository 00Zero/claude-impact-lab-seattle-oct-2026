export type StatTile = { label: string; value: string; note?: string };

// Answer-first numbers in cards: white surface, no border, no shadow.
export function StatTiles({ items }: { items: StatTile[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="alt-card flex flex-col gap-2 !p-5">
          <dt className="alt-label-text alt-secondary">{i.label}</dt>
          <dd className="alt-answer">{i.value}</dd>
          {i.note && <p className="alt-help !text-sm">{i.note}</p>}
        </div>
      ))}
    </dl>
  );
}
