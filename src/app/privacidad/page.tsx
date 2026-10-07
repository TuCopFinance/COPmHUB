import type { Metadata } from "next";
import { IntentLayout } from "@/components/IntentLayout";
import { JsonLd } from "@/components/JsonLd";
import { isOfframpEnabled, offrampConfig } from "@/lib/offramp/config";
import { pageMetadata, webPageJsonLd } from "@/lib/seo";
import { LEGAL_PAGES } from "@/lib/site";

const page = LEGAL_PAGES[2];

export const metadata: Metadata = pageMetadata(page);

function OfframpPrivacy() {
  const { dataController, privacyContact } = offrampConfig();
  return (
    <>
      <h2
        id="off-ramp"
        className="scroll-mt-24 text-xl font-extrabold tracking-tight"
      >
        Off-ramp a llaves Bre-B
      </h2>
      <p>
        El registro al off-ramp es la única parte de este sitio que pide
        datos personales. El responsable del tratamiento es{" "}
        {dataController}, que opera el servicio. El formulario envía tus
        datos directamente a sus sistemas: digitalcop.shop no los recibe ni
        los guarda. Para ejercer tus derechos o hacer una consulta, escribe
        a{" "}
        <a
          className="font-semibold text-brand underline"
          href={`mailto:${privacyContact}`}
        >
          {privacyContact}
        </a>
        .
      </p>
      <p>
        Qué guarda {dataController}: tu nombre, tu correo, el tipo y número
        de tu documento (cifrado), la fecha en que diste tu autorización, el
        estado de tu verificación y, de tu cuenta Bre-B, solo el banco, el
        nombre del titular y los últimos cuatro caracteres de la llave y del
        documento. No guarda tus fotos ni tu llave Bre-B completa.
      </p>
      <p>
        Para qué: verificar tu identidad, comprobar que la cuenta Bre-B es
        tuya, prestarte el servicio de off-ramp y enviarte por correo tu
        dirección de liquidación. Estos datos no se usan para publicidad
        de terceros ni se venden.
      </p>
      <p>
        Con quién se comparten: la verificación de identidad y los pagos los
        procesa Bridge (bridge.xyz), que recibe tu nombre y tu correo, y
        directamente en sus páginas tu documento y tus fotos, y trata esos
        datos según sus propios términos. Esto implica transferir datos
        fuera de Colombia.
      </p>
      <p>
        En tu navegador: mientras la pestaña esté abierta se guarda un
        identificador de sesión para que no tengas que confirmar tu correo
        en cada paso. Se borra al cerrar la pestaña o al elegir Salir.
      </p>
      <p>
        Tus derechos: puedes conocer, actualizar y rectificar tus datos,
        pedir prueba de tu autorización, revocarla y solicitar que se
        eliminen, conforme a la Ley 1581 de 2012. Algunos registros de
        verificación pueden tener que conservarse por obligación legal.
      </p>
    </>
  );
}

export default function PrivacidadPage() {
  const offramp = isOfframpEnabled();
  return (
    <>
      <JsonLd data={webPageJsonLd(page)} />
      <IntentLayout
        eyebrow="Legal"
        title="Privacidad"
        lead={
          offramp
            ? "El hub digitalcop.shop es un sitio informativo. Solo pedimos datos personales si te registras al off-ramp a llaves Bre-B."
            : "El hub digitalcop.shop es un sitio informativo. No pedimos crear una cuenta en esta web."
        }
      >
        <p>
          {offramp
            ? "Fuera del off-ramp, este sitio no tiene formulario de registro."
            : "Esta página no tiene formulario de registro."}{" "}
          Si activamos
          analítica (por ejemplo Google Analytics, cuando exista
          NEXT_PUBLIC_GA_ID), esa herramienta puede registrar páginas
          vistas, clics de CTA y profundidad de scroll. Los eventos se
          diseñaron sin incluir montos, correos ni wallets.
        </p>
        <p>
          Si haces clic a Cards, TuCop, COP By o Neeru, esas apps pueden
          recolectar datos según su propia política (correo de compra,
          wallet de claim, KYC de pago, etc.). Lee su aviso antes de pagar
          o conectar una wallet.
        </p>
        <p>
          No vendemos listas de visitantes del hub. No publicamos un DPO ni
          una razón social adicional en este documento porque no está
          definida en el copy del sitio: cuando exista, se actualizará aquí.
        </p>
        <p>
          Cookies: el sitio puede usar cookies técnicas de Next.js y, si se
          configura, cookies de analítica. Puedes bloquearlas en el
          navegador.
        </p>
        {offramp ? <OfframpPrivacy /> : null}
      </IntentLayout>
    </>
  );
}
