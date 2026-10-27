"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { useReveal } from "./use-reveal";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";

/**
 * A titled, horizontally scrolling row of cards (swipe on phones, arrows on larger screens).
 * Nothing moves on its own: the row only scrolls when the person scrolls or taps an arrow.
 */
export function Row({
  title,
  href,
  linkLabel,
  toolbar,
  children,
}: {
  title: string;
  href: string;
  /** Accessible name for the arrow link next to the title. */
  linkLabel: string;
  /** Optional controls (filters) shown under the title. */
  toolbar?: ReactNode;
  /** The cards, each wrapped in an <li>. */
  children: ReactNode;
}) {
  const list = useRef<HTMLUListElement>(null);
  const section = useRef<HTMLElement>(null);
  useReveal(section, [children]); // re-runs when the cards change (a filter), animating only the new ones

  function scroll(direction: 1 | -1) {
    const el = list.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  }

  const arrow = "alt-button !min-h-11 !w-11 !px-0";

  return (
    <section ref={section} className="flex flex-col gap-4">
      <div data-reveal-item className="flex items-center justify-between gap-4">
        <h2 className="alt-h2 flex items-center gap-3">
          {title}
          <Link href={href} className={arrow} aria-label={linkLabel}>
            <CaretRight size={20} aria-hidden="true" />
          </Link>
        </h2>
        <div className="hidden gap-2 sm:flex">
          <button type="button" className={arrow} onClick={() => scroll(-1)} aria-label={`Scroll ${title} back`}>
            <CaretLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className={arrow} onClick={() => scroll(1)} aria-label={`Scroll ${title} forward`}>
            <CaretRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      {toolbar && <div data-reveal-item>{toolbar}</div>}
      <ul
        ref={list}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
    </section>
  );
}
