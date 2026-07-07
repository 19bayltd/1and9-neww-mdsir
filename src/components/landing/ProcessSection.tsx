import type { ContentBlock } from "@/lib/landing";
import { Paragraphs } from "./_shared";
import { SpecIcon, type IconName } from "./icons";

/**
 * Production Process — horizontal numbered steps with yellow markers, per the
 * reference; vertical rail on mobile. Step labels are generic manufacturing
 * stages; any durations live only in the RPC prose body (rendered verbatim).
 */

const STEPS: { label: string; caption: string; icon: IconName }[] = [
  { label: "Submit Your Design", caption: "Send your design or tech pack.", icon: "design" },
  { label: "Sampling", caption: "We develop your pre-production sample.", icon: "sampling" },
  { label: "Approval", caption: "Review and approve your sample.", icon: "check" },
  { label: "Production", caption: "Bulk production with strict QC.", icon: "production" },
  { label: "Quality Check", caption: "Full inspection before shipping.", icon: "qc" },
  { label: "Delivery", caption: "On-time delivery to your door.", icon: "shipping" },
];

export function ProcessSection({ block }: { block: ContentBlock }) {
  const last = STEPS.length - 1;

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

      {/* Horizontal steps (lg+) */}
      <ol className="mt-10 hidden lg:grid lg:grid-cols-6 lg:gap-2">
        {STEPS.map((step, i) => (
          <li key={step.label} className="relative flex flex-col items-center px-1 text-center">
            {i < last ? (
              <span className="absolute left-1/2 top-5 h-px w-full bg-neutral-200" aria-hidden />
            ) : null}
            <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFC400] font-mono text-sm font-black text-black ring-4 ring-white">
              {i + 1}
            </span>
            <span className="mt-3 flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-900">
              <SpecIcon icon={step.icon} className="h-4.5 w-4.5" />
            </span>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-neutral-900">
              {step.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">{step.caption}</p>
          </li>
        ))}
      </ol>

      {/* Vertical steps (below lg) */}
      <ol className="mt-8 lg:hidden">
        {STEPS.map((step, i) => (
          <li key={step.label} className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFC400] font-mono text-sm font-black text-black">
                {i + 1}
              </span>
              {i < last ? <span className="my-1 w-px grow bg-neutral-200" aria-hidden /> : null}
            </div>
            <div className={i < last ? "pb-7 pt-1" : "pt-1"}>
              <p className="text-sm font-bold uppercase tracking-wide text-neutral-900">
                {step.label}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{step.caption}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
