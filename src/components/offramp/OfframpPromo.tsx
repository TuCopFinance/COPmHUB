import { CtaLink } from "@/components/CtaLink";
import { ArrowIcon } from "@/components/offramp/ArrowIcon";
import { OFFRAMP_COPY } from "@/lib/offramp/copy";

export function OfframpPromo() {
  return (
    <div className="reveal mt-4 flex flex-col gap-6 rounded-[20px] border border-brand/25 bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand">
            {OFFRAMP_COPY.tag}
          </span>
          <span className="rounded-full bg-celo-yellow px-2 py-0.5 text-[10px] font-bold tracking-wide text-ink">
            PREINSCRIPCIÓN
          </span>
        </div>
        <h3 className="mt-4 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          {OFFRAMP_COPY.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {OFFRAMP_COPY.body}
        </p>
      </div>
      <CtaLink
        href={OFFRAMP_COPY.href}
        label={OFFRAMP_COPY.cta}
        event="product_card_click"
        section="servicios"
        product="offramp"
        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white"
      >
        {OFFRAMP_COPY.cta}
        <ArrowIcon />
      </CtaLink>
    </div>
  );
}
