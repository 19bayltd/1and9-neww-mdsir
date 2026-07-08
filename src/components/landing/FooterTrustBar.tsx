import type { LandingPageData } from "@/lib/landing";
import { SpecIcon, type IconName } from "./icons";

/**
 * Black footer with a trust-chip bar, per the reference. Trust items are
 * generic brand-level service labels; the page title line comes from the RPC.
 */

const TRUST_ITEMS: { label: string; caption: string; icon: IconName }[] = [
  { label: "Secure Requests", caption: "Your information is safe with us", icon: "qc" },
  { label: "Worldwide DDP Shipping", caption: "Door-to-door delivery", icon: "shipping" },
  { label: "No Hidden Costs", caption: "Transparent landed pricing", icon: "check" },
  { label: "Dedicated Support", caption: "A merchandiser on every account", icon: "support" },
];

export function FooterTrustBar({ data }: { data: LandingPageData }) {
  const title = data.page?.title || "Custom Apparel Manufacturing";

  return (
    <footer className="bg-[#0A0A0A] text-white">
      {/* Trust bar */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {TRUST_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#FFC400] text-[#FFC400]">
              <SpecIcon icon={item.icon} />
            </span>
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-white">
                {item.label}
              </p>
              <p className="text-xs text-neutral-400">{item.caption}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-neutral-800">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-6 py-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-black tracking-tight">
              1<span className="text-[#FFC400]">&amp;</span>9{" "}
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-400">
                One and Nine
              </span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Bangladesh-based B2B custom apparel manufacturer · {title}
            </p>
          </div>
          <a
            href="#rfq"
            className="inline-flex items-center justify-center rounded-md bg-[#FFC400] px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-[#e6b100]"
          >
            Get a Quote
          </a>
        </div>
      </div>
    </footer>
  );
}
