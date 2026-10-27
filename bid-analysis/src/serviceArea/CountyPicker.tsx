"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { IconCheck, IconSearch } from "@/explorer/components/Icons";
import type { CountyStat } from "./core/comparison";
import { WASHINGTON_COUNTY_NAMES } from "./core/counties";

/** Prefix matches first, then word starts, then anywhere. */
function matchCounties(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...WASHINGTON_COUNTY_NAMES];
  const rank = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.startsWith(q)) return 0;
    if (lower.split(" ").some((w) => w.startsWith(q))) return 1;
    return lower.includes(q) ? 2 : 3;
  };
  return WASHINGTON_COUNTY_NAMES.filter((n) => rank(n) < 3).sort((a, b) => rank(a) - rank(b));
}

/** Combobox for adding or removing counties; stays open for several toggles. */
export function CountyPicker({ selected, stats, disabled, onToggle }: {
  selected: ReadonlySet<string>;
  /** Null while the catalog is loading or failed; options then show no counts. */
  stats: Readonly<Record<string, CountyStat>> | null;
  disabled?: boolean;
  onToggle(county: string): void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const optionPrefix = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const options = useMemo(() => matchCounties(query), [query]);
  const activeName = open ? options[Math.min(active, options.length - 1)] : undefined;
  const optionId = (name: string) => `${optionPrefix}-${name.replace(/\s+/g, "-")}`;

  useEffect(() => {
    if (activeName) listRef.current?.querySelector(`[data-county="${activeName}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeName]);

  function toggle(name: string) {
    onToggle(name);
    setQuery("");
    setActive(Math.max(0, WASHINGTON_COUNTY_NAMES.indexOf(name)));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (!options.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (Math.min(i, options.length - 1) + step + options.length) % options.length);
    } else if (e.key === "Enter" && activeName) {
      e.preventDefault();
      toggle(activeName);
    } else if (e.key === "Escape" && (open || query)) {
      // Keep Escape from also closing the detail panel behind the explorer.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (query) setQuery("");
      else setOpen(false);
    }
  }

  return (
    <div className={`sa-picker${open ? " is-open" : ""}`}>
      <div className="search-field">
        <IconSearch size={17} className="search-icon" />
        <input
          className="search-input"
          type="text"
          role="combobox"
          aria-label="Add or remove a Washington county"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeName ? optionId(activeName) : undefined}
          placeholder="Add or remove counties"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && (
        <ul ref={listRef} id={listId} className="sa-options" role="listbox" aria-multiselectable="true" aria-label="Washington counties">
          {options.map((name) => {
            const on = selected.has(name);
            const stat = stats?.[name];
            return (
              <li
                key={name}
                id={optionId(name)}
                data-county={name}
                role="option"
                aria-selected={on}
                className={`sa-option${name === activeName ? " is-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggle(name)}
                onMouseMove={() => setActive(options.indexOf(name))}
              >
                <span className="sa-option-check" aria-hidden="true">{on && <IconCheck size={15} />}</span>
                <span className="sa-option-name">{name}</span>
                {stat && <OptionMeta on={on} stat={stat} />}
              </li>
            );
          })}
          {!options.length && <li className="sa-option-empty" role="presentation">No Washington county matches “{query.trim()}”</li>}
        </ul>
      )}
    </div>
  );
}

function OptionMeta({ on, stat }: { on: boolean; stat: CountyStat }) {
  if (on) return stat.lossIfRemoved > 0 ? <span className="sa-option-meta is-loss">−{stat.lossIfRemoved} if removed</span> : null;
  return <span className={`sa-option-meta${stat.gainIfAdded > 0 ? " is-gain" : ""}`}>{stat.gainIfAdded > 0 ? `+${stat.gainIfAdded} new` : "No new"}</span>;
}
