import type { Metadata } from "next";
import { IntentLayout } from "@/components/IntentLayout";
import { JsonLd } from "@/components/JsonLd";
import { isOfframpEnabled, offrampConfig } from "@/lib/offramp/config";
import { pageMetadata, webPageJsonLd } from "@/lib/seo";
import { LEGAL_PAGES } from "@/lib/site";

const page = LEGAL_PAGES[1];

export const metadata: Metadata = pageMetadata(page);

export default function TerminosPage() {
  const offramp = isOfframpEnabled() ? offrampConfig() : null;
  return (
    <>
      <JsonLd data={webPageJsonLd(page)} />
      <IntentLayout
        eyebrow="Legal"
        title="Términos de uso"
        lead="Estos términos cubren el hub digitalcop.shop. No sustituyen los términos de TuCop, Cards, COP By o Neeru."
      >
        <p>
          Al usar este sitio aceptas que DigitalCOP es un directorio
          informativo. No abrimos cuentas, no custodiamos COPm y no ejecutamos
          tus conversiones ni tus depósitos de rendimiento.
        </p>
        <p>
          Los enlaces a terceros abren productos con sus propias reglas, fees
          y riesgos. Si compras en Cards, el contrato de compra es con ese
          servicio (pago Wompi, códigos, claim). Si usas Neeru, aplican los
          términos de Neeru.
        </p>
        {offramp ? (
          <p>
            El off-ramp a llaves Bre-B lo opera {offramp.dataController}, no
            DigitalCOP. Este sitio solo aloja el formulario: la verificación
            de identidad y los pagos los procesa Bridge, y aplican los
            términos de ambos. La dirección de liquidación solo acepta USDC
            en la red Celo; lo que envíes en otro token o por otra red se
            puede perder.
          </p>
        ) : null}
        <p>
          El contenido sobre FX, carry trade e inversión es educativo. No es
          una oferta, no es asesoría y no garantiza retornos. Puedes perder
          dinero.
        </p>
        <p>
          Podemos cambiar textos, enlaces y el listado de servicios sin
          aviso previo. Si un dato (paridad de COPm, APY, entidad legal) no
          está publicado aquí, no debes asumirlo.
        </p>
        <p>
          Colombia: los criptoactivos no son moneda de curso legal. Cumple
          tus obligaciones tributarias y de reporte. Esto no es asesoría
          jurídica.
        </p>
      </IntentLayout>
    </>
  );
}
