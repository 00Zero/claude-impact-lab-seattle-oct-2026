import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AutoRefresh } from "@/app/ui/auto-refresh";
import { statusClassName, textLinkClassName } from "@/app/ui/form-styles";
import { formatRange } from "@/lib/money";
import { getPriceBook, type PriceBookItem } from "@/lib/price-book";
import { categoryLabel, PRICE_CATEGORIES, unitLabel } from "@/lib/price-book-rules";
import { canManageWorkspace, requireWorkspace } from "@/lib/workspace";
import {
  addStarterTemplate,
  approvePricedSuggestions,
  deleteSuggestion,
  retryPriceDocument,
  setPriceItemStatus,
} from "./actions";
import { ActionButton } from "@/app/ui/action-button";
import { EditableItem, ItemForm, UploadForm, type ItemFormValues } from "./price-book-forms";

// Price-book uploads are read by AI after the response.
export const maxDuration = 300;

const card = "rounded-2xl border border-line bg-white p-5 sm:p-6";

export default function PriceBookPage({ searchParams }: PageProps<"/app/settings/price-book">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <PriceBook searchParams={searchParams} />
    </Suspense>
  );
}

const unitSuffix = (unit: string) => (unit === "hour" ? " / hour" : unit === "each" ? " each" : "");

function priceLabel(item: PriceBookItem, currency: string) {
  return item.priceLowMinor !== null && item.priceHighMinor !== null
    ? `${formatRange(item.priceLowMinor, item.priceHighMinor, currency)}${unitSuffix(item.unit)}`
    : "No price yet";
}

function formValues(item: PriceBookItem): ItemFormValues {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    category: item.category,
    unit: item.unit,
    priceLowMinor: item.priceLowMinor,
    priceHighMinor: item.priceHighMinor,
  };
}

async function PriceBook({ searchParams }: Pick<PageProps<"/app/settings/price-book">, "searchParams">) {
  const { welcome } = await searchParams;
  const { workspace } = await requireWorkspace();
  const canManage = canManageWorkspace(workspace);
  const { items, documents } = await getPriceBook(workspace.id);
  const currency = workspace.currency;

  const suggested = items.filter((i) => i.status === "suggested");
  const active = items.filter((i) => i.status === "active");
  const archived = items.filter((i) => i.status === "archived");
  const processing = documents.some((d) => d.status === "processing");
  const hasServiceFee = active.some((i) => i.category === "service_fee");
  const pricedSuggestions = suggested.filter((i) => i.priceLowMinor !== null && i.priceHighMinor !== null).length;

  return (
    <>
      {processing ? <AutoRefresh /> : null}

      {welcome ? (
        <p role="status" className={statusClassName}>
          Your workspace is ready. Upload your price list or a few past invoices and we’ll suggest your price book.
          You can also add items by hand.
        </p>
      ) : null}

      {!workspace.estimatesEnabled ? (
        <p className="rounded-xl bg-caution-soft p-4 text-[15px] text-caution">
          Estimates are turned off, so this price book isn’t used yet.{" "}
          <Link href="/app/settings/business" className={textLinkClassName}>
            Turn them on in Business settings
          </Link>
          .
        </p>
      ) : !hasServiceFee ? (
        <p className="rounded-xl bg-caution-soft p-4 text-[15px] text-caution">
          Estimates need a priced <b>service call / diagnostic fee</b> item. Add or approve one below.
        </p>
      ) : null}

      <Section
        title="Read your pricing documents"
        intro="AI reads your price lists, rate sheets, or past invoices and suggests items with price ranges from what it finds. Nothing is used until you approve it."
      >
        {canManage ? <UploadForm /> : <p className="text-sm text-muted">Only owners and admins can upload documents.</p>}
        {documents.length ? (
          <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-bold">{doc.fileName}</span>
                  <span className="shrink-0 text-muted">
                    {doc.status === "processing"
                      ? "Reading…"
                      : doc.status === "failed"
                        ? "Couldn’t read"
                        : `${doc.itemsFound} item${doc.itemsFound === 1 ? "" : "s"} suggested`}
                  </span>
                </div>
                {doc.status === "failed" && canManage ? (
                  <ActionButton action={retryPriceDocument.bind(null, doc.id)} label="Try again" pendingLabel="Starting…" variant="link" />
                ) : null}
                {doc.notes.length ? (
                  <ul className="list-disc pl-5 text-muted">
                    {doc.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      {suggested.length ? (
        <Section
          title={`Review suggestions (${suggested.length})`}
          intro="Check each price against your document. Approved items are used for estimates; the rest are ignored."
        >
          {canManage && pricedSuggestions ? (
            <div className="mb-4">
              <ActionButton
                action={approvePricedSuggestions}
                label={`Approve all ${pricedSuggestions} with prices`}
                pendingLabel="Approving…"
                variant="primary"
              />
            </div>
          ) : null}
          <ul className="flex flex-col gap-4">
            {suggested.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 rounded-xl border border-line p-4">
                {item.sourceNote ? <p className="text-sm text-muted">From your document: “{item.sourceNote}”</p> : null}
                {canManage ? (
                  <>
                    <EditableItem initial={formValues(item)} mode="suggestion">
                      {null}
                    </EditableItem>
                    <ActionButton action={deleteSuggestion.bind(null, item.id)} label="Discard" pendingLabel="Discarding…" variant="link" />
                  </>
                ) : (
                  <ItemSummary item={item} currency={currency} />
                )}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Your price book" intro="Prices are ranges so estimates can show a realistic low and high. One price works too.">
        {active.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">No items yet.</p>
            {canManage && workspace.trade === "hvac" ? (
              <ActionButton action={addStarterTemplate} label="Start from common HVAC items" pendingLabel="Adding…" />
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {PRICE_CATEGORIES.map((category) => {
              const inCategory = active.filter((i) => i.category === category.value);
              if (inCategory.length === 0) return null;
              return (
                <div key={category.value}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{category.label}</h3>
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {inCategory.map((item) => (
                      <li key={item.id} className="px-4 py-3">
                        {canManage ? (
                          <EditableItem initial={formValues(item)} mode="edit">
                            <ItemSummary item={item} currency={currency} />
                            <ActionButton
                              action={setPriceItemStatus.bind(null, item.id, "archived")}
                              label="Archive"
                              pendingLabel="Archiving…"
                              variant="link"
                            />
                          </EditableItem>
                        ) : (
                          <ItemSummary item={item} currency={currency} />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {canManage ? (
        <Section title="Add an item">
          <ItemForm mode="new" />
        </Section>
      ) : null}

      {archived.length ? (
        <Section title={`Archived (${archived.length})`} intro="Not used for new estimates. Estimates that already use them keep their prices.">
          <ul className="divide-y divide-line rounded-xl border border-line">
            {archived.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <ItemSummary item={item} currency={currency} />
                {canManage ? (
                  <ActionButton action={setPriceItemStatus.bind(null, item.id, "active")} label="Restore" pendingLabel="Restoring…" variant="link" />
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className={card}>
      <h2 className="mb-1 text-base font-semibold">{title}</h2>
      {intro ? <p className="mb-4 text-sm leading-6 text-muted">{intro}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

function ItemSummary({ item, currency }: { item: PriceBookItem; currency: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[15px] font-bold">{item.name}</p>
      <p className="text-sm text-muted">
        {priceLabel(item, currency)} · {categoryLabel(item.category)} · {unitLabel(item.unit)}
      </p>
      {item.description ? <p className="text-sm text-muted">{item.description}</p> : null}
    </div>
  );
}
