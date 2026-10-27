"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { useReveal } from "./use-reveal";

/** A wrapper that animates the `data-reveal-item` and `data-seat-row` elements inside it. */
export function Motion({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLElement | null>(null);
  useReveal(ref);
  const Tag: ElementType = as;
  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        ref.current = el;
      }}
      className={className}
    >
      {children}
    </Tag>
  );
}
