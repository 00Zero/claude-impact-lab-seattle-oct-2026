"use client";

// Executes during HTML parsing on full page loads; when React renders it in the
// browser it becomes inert text/plain, which avoids React's <script> warning.
export function InlineScript({ html }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
