import { ChevronDown } from "lucide-react";

export interface FAQItem {
  q: string;
  a: string;
}

export default function FAQ({ items }: { items: FAQItem[] }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      {items.map((item) => (
        <details
          key={item.q}
          className="group rounded-2xl border border-border bg-surface p-5 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-text-primary">
            {item.q}
            <ChevronDown
              size={20}
              className="shrink-0 text-text-secondary transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
