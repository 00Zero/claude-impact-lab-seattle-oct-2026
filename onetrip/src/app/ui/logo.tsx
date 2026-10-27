export function Logo({ className = "text-lg" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-display font-extrabold ${className}`}>
      <span className="grid h-[1.4em] w-[1.4em] place-items-center rounded-md bg-accent text-[0.75em] text-accent-ink">
        1
      </span>
      OneTrip
    </span>
  );
}
