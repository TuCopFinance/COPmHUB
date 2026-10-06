import { CtaLink } from "@/components/CtaLink";
import { OfframpPromo } from "@/components/offramp/OfframpPromo";
import { isOfframpEnabled } from "@/lib/offramp/config";
import { serviceLinkProps, services } from "@/lib/services";

const doors = services.filter((service) =>
  ["tucop", "cards", "copby", "arc", "neeru"].includes(service.id),
);

function StatusPill({ partner }: { partner?: boolean }) {
  return (
    <span
      className={
        partner
          ? "rounded-full bg-tint px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-2"
          : "rounded-full bg-[#eef8ee] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#137211]"
      }
    >
      {partner ? "PARTNER" : "LIVE"}
    </span>
  );
}

export function Services() {
  const offramp = isOfframpEnabled();
  return (
    <section id="servicios" className="border-t border-line px-6 py-20 sm:py-28">
      <div className="relative z-10 mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Servicios para tus pesos digitales
        </h2>
        <p className="mt-3 max-w-xl text-muted">
          Guarda en TuCop, compra en el marketplace, cambia dólares con COP By,
          conecta Arc a COPm o explora rendimiento en Neeru.
        </p>

        {offramp ? <OfframpPromo /> : null}

        <div
          className={`${offramp ? "mt-4" : "mt-12"} grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`}
        >
          {doors.map((service, index) => {
            const link = serviceLinkProps(service);
            const outbound = link.href ?? service.href;
            return (
              <div
                key={service.id}
                className={
                  "lift reveal flex flex-col justify-between rounded-[20px] border bg-white p-6" +
                  (service.id === "tucop"
                    ? " border-brand/25"
                    : " border-line")
                }
                style={{ animationDelay: `${index * 0.07}s` }}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {service.tag ? (
                      <span className="text-[11px] font-bold uppercase tracking-wide text-brand">
                        {service.tag}
                      </span>
                    ) : null}
                    <StatusPill partner={service.partner} />
                  </div>
                  <h3 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
                    {service.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {service.description}
                  </p>
                  {service.socials ? (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {service.socials.map((item) => (
                        <CtaLink
                          key={item.label}
                          href={item.href}
                          label={item.label}
                          event="outbound_click"
                          section="servicios"
                          product={service.id}
                          className="text-xs font-semibold text-muted transition-colors hover:text-brand"
                        >
                          {item.label}
                        </CtaLink>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  {link.isLink ? (
                    <CtaLink
                      href={outbound}
                      label={service.cta}
                      event="product_card_click"
                      section="servicios"
                      product={service.id}
                      className={
                        service.id === "tucop"
                          ? "inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white"
                          : "text-sm font-bold text-brand"
                      }
                    >
                      {service.cta} →
                    </CtaLink>
                  ) : null}
                  {service.learnMoreHref ? (
                    <CtaLink
                      href={service.learnMoreHref}
                      label={`Cómo funciona ${service.name}`}
                      event="landing_cta_click"
                      section="servicios"
                      product={service.id}
                      className="text-sm font-semibold text-muted hover:text-ink"
                    >
                      Cómo funciona
                    </CtaLink>
                  ) : null}
                  {service.contact ? (
                    <CtaLink
                      href={service.contact.href}
                      label={service.contact.label}
                      event="product_contact_click"
                      section="servicios"
                      product={service.id}
                      className="text-sm font-semibold text-muted hover:text-ink"
                    >
                      {service.contact.label}
                    </CtaLink>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-sm text-muted">
          ¿Tu proyecto usa COPm?{" "}
          <CtaLink
            href="/ecosystem"
            label="Ecosistema COPm"
            event="landing_cta_click"
            section="servicios"
            className="font-semibold text-brand hover:underline"
          >
            Ver el ecosistema y cómo listarlo →
          </CtaLink>
        </p>
      </div>
    </section>
  );
}
