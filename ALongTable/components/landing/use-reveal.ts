"use client";

import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, type DependencyList, type RefObject } from "react";

// Landing-page motion, built on GSAP and held to brand/DESIGN.md: the brand easing, small rises, the seat
// timing from the motion table, nothing that loops or moves on its own, and nothing at all when the person
// has asked for reduced motion (the animations below simply never run, so everything is just visible).
//
// Mark things up with data attributes:
//   data-reveal-item        fades in and rises 8px when scrolled into view (90 ms apart within a batch)
//   data-seat-row           its taken seats fill in one after another (300 ms each, 60 ms apart)
//
// The first paint comes from the server, so a tiny script in app/page.tsx adds `motion` to <html> and
// globals.css pre-hides these items; otherwise they would flash visible and then fade in.

CustomEase.create("alt", "0.25, 0.1, 0.25, 1"); // --alt-ease
gsap.registerPlugin(ScrollTrigger);

declare global {
  interface Window {
    /** Set once the motion has taken over, so the page's failsafe knows not to un-hide anything. */
    __landingMotion?: boolean;
  }
}

const REVEALED = "data-revealed";
const unrevealed = (el: Element) => !el.hasAttribute(REVEALED);
const markRevealed = (els: Element[]) => els.forEach((el) => el.setAttribute(REVEALED, ""));

/**
 * Animate the `data-reveal-item` and `data-seat-row` elements inside `ref`. Items that were already revealed
 * are skipped, so passing changing `deps` (for example a filtered list) only animates what is new.
 */
export function useReveal(ref: RefObject<HTMLElement | null>, deps: DependencyList = []) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      window.__landingMotion = true;

      // Items: fade in and rise 8px, 90 ms apart, as they scroll into view (or at once if already in view).
      const items = Array.from(root.querySelectorAll("[data-reveal-item]")).filter(unrevealed);
      if (items.length) {
        gsap.set(items, { opacity: 0, y: 8 });
        ScrollTrigger.batch(items, {
          start: "top 94%",
          once: true,
          interval: 0.1,
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.4,
              ease: "alt",
              stagger: 0.09,
              overwrite: true,
              onComplete: () => {
                markRevealed(batch);
                gsap.set(batch, { clearProps: "opacity,transform" });
              },
            }),
        });
      }

      // Seat rows: the taken seats grow in from 80% and fade up, one after another.
      for (const row of Array.from(root.querySelectorAll("[data-seat-row]")).filter(unrevealed)) {
        const taken = Array.from(row.querySelectorAll('.alt-seat[data-state="taken"]'));
        if (!taken.length) continue;
        gsap.set(taken, { opacity: 0, scale: 0.8 });
        ScrollTrigger.create({
          trigger: row,
          start: "top 94%",
          once: true,
          onEnter: () =>
            gsap.to(taken, {
              opacity: 1,
              scale: 1,
              duration: 0.3,
              ease: "alt",
              stagger: 0.06,
              delay: 0.35, // after the card around it has come in
              onComplete: () => {
                markRevealed([row, ...taken]);
                gsap.set(taken, { clearProps: "opacity,transform" });
              },
            }),
        });
      }
    });

    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's list
  }, deps);
}
