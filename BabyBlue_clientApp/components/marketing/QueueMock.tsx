interface QueueMockProps {
  clinic: string;
  position: number;
  wait: string;
  className?: string;
}

/**
 * A miniature of the real patient queue screen, used as a floating
 * hero card on the marketing pages. Pure CSS — no live data.
 */
export default function QueueMock({ clinic, position, wait, className = "" }: QueueMockProps) {
  return (
    <div
      className={[
        "w-64 rounded-2xl border border-border bg-surface p-4 shadow-xl",
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-text-secondary">{clinic}</span>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
          Waiting
        </span>
      </div>

      <p className="mt-3 text-4xl font-extrabold tracking-tight text-text-primary">
        #{position}
      </p>
      <p className="mt-0.5 text-sm text-text-secondary">
        in line · est. {wait}
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <span className="text-xs text-text-secondary">Updated just now</span>
      </div>
    </div>
  );
}
