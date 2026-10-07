import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { OfframpFlow } from "@/components/offramp/OfframpFlow";
import {
  isOfframpEnabled,
  offrampConfig,
  OFFRAMP_PATH,
} from "@/lib/offramp/config";
import { OFFRAMP_COPY } from "@/lib/offramp/copy";
import { pageMetadata } from "@/lib/seo";

// The flag and its configuration are read per request, not at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: OFFRAMP_COPY.title,
  description: OFFRAMP_COPY.body,
  path: OFFRAMP_PATH,
});

export default function OfframpPage() {
  if (!isOfframpEnabled()) notFound();
  const { apiUrl, dataController, privacyContact } = offrampConfig();

  return (
    <main>
      <Nav />
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-wide text-brand">
            Off-ramp
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {OFFRAMP_COPY.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            {OFFRAMP_COPY.body}
          </p>
          <div className="mt-10">
            <OfframpFlow
              apiUrl={apiUrl}
              dataController={dataController}
              privacyContact={privacyContact}
            />
          </div>
          <p className="mt-6 rounded-2xl border border-line bg-bg p-4 text-sm leading-relaxed text-muted">
            Solo para cuentas en Colombia a tu propio nombre. El servicio lo
            opera {dataController}, que es quien guarda tus datos; la
            verificación de identidad y los pagos los procesa Bridge.
            Registrarte no tiene costo ni te obliga a usar el servicio. Al
            confirmar tu llave recibes una dirección de liquidación que solo
            acepta USDC en la red Celo.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
