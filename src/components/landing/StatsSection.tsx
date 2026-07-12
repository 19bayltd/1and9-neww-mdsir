import type { ContentBlock } from "@/lib/landing";
import { BlockCta, Paragraphs } from "./_shared";
import { SpecIcon, type IconName } from "./icons";

/**
 * Manufacturing Overview — RPC copy + a stats card row, per the reference.
 *
 * The stat values are the brand's standard manufacturing terms (identical on
 * every page — the RPC block carries only prose). No invented capacity or
 * client-count figures are shown.
 */

const STATS: { value: string; label: string; icon: IconName }[] = [
  { value: "300 pcs", label: "Minimum MOQ", icon: "moq" },
  { value: "7–10 days", label: "Sample Time", icon: "sampling" },
  { value: "30–45 days", label: "Production Time", icon: "production" },
  { value: "AQL 2.5", label: "Final Inspection", icon: "qc" },
  { value: "DDP", label: "Shipping Terms", icon: "shipping" },
];

export function StatsSection({ block }: { block: ContentBlock }) {
  return (
    <div>
      {block.heading ? (
        <h3 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
          {block.heading}
        </h3>
      ) : null}
      {block.body ? (
        <div className="mt-3 max-w-3xl space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
          <Paragraphs text={block.body} />
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[#E5E5E5] bg-white p-4 text-center shadow-sm sm:p-5"
          >
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-900">
              <SpecIcon icon={s.icon} />
            </span>
            <p className="mt-3 text-lg font-black tracking-tight text-neutral-900 sm:text-xl">
              {s.value}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* DB-driven CTA — renders only when the block carries the pair. */}
      <BlockCta label={block.cta_label} url={block.cta_url} />
    </div>
  );
}
