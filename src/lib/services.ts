export type ServiceSocial = {
  label: string;
  href: string;
};

export type Service = {
  id: "tucop" | "cards" | "copby" | "arc" | "neeru";
  name: string;
  description: string;
  href: string;
  cta: string;
  learnMoreHref?: string;
  status: "live" | "soon";
  external: boolean;
  featured?: boolean;
  partner?: boolean;
  tag?: string;
  socials?: ServiceSocial[];
  contact?: ServiceSocial;
};

export type ServiceLinkProps = {
  href: string | undefined;
  target: "_blank" | undefined;
  rel: "noopener noreferrer" | undefined;
  isLink: boolean;
};

export const services: Service[] = [
  {
    id: "tucop",
    name: "TuCop",
    description:
      "Billetera móvil para ahorrar, enviar y recibir pesos digitales. La puerta de entrada al hub.",
    href: "https://tucop.xyz",
    cta: "Abrir TuCop",
    status: "live",
    external: true,
    featured: true,
    tag: "Billetera",
  },
  {
    id: "cards",
    name: "Comprar pesos",
    description:
      "Marketplace: paga en pesos con tarjeta, recibe un código y reclámalo en tu billetera. Fee de plataforma 1% más costos de pago.",
    href: "https://cards.digitalcop.shop",
    cta: "Comprar pesos",
    tag: "Marketplace",
    status: "live",
    external: true,
  },
  {
    id: "copby",
    name: "COP By",
    description:
      "Cambia dólares a pesos digitales dentro de MiniPay. El tipo de cambio se muestra al convertir.",
    href: "https://copby.digitalcop.shop",
    cta: "Cambiar dólares a pesos",
    learnMoreHref: "/cambiar-usd-a-cop",
    tag: "Cambio",
    status: "live",
    external: true,
  },
  {
    id: "arc",
    name: "Arc → COPm",
    description:
      "Convierte USDC en Arc a COPm en Celo con una ruta verificable en cada etapa.",
    href: "https://copby.digitalcop.shop",
    cta: "Explorar Arc → COPm",
    tag: "Infraestructura",
    status: "live",
    external: true,
    contact: {
      label: "Hablar con el equipo",
      href:
        "https://t.me/CeloCol?text=Hola%20equipo%20de%20Celo%20Colombia%2C%20me%20interesa%20integrar%20Arc%20%E2%86%92%20COPm%20con%20COP%20By%20para%20convertir%20USDC%20en%20Arc%20a%20COPm%20en%20Celo.%20%C2%BFCon%20qui%C3%A9n%20puedo%20hablar%20para%20evaluar%20la%20integraci%C3%B3n%3F",
    },
  },
  {
    id: "neeru",
    name: "Neeru",
    description:
      "Partner. Explora rendimiento en pesos digitales. No es un CDT: el capital puede bajar y no hay tasa fija garantizada.",
    href: "https://neerufinance.xyz",
    cta: "Explorar rendimiento",
    learnMoreHref: "/invertir-pesos-digitales",
    status: "live",
    external: true,
    partner: true,
    socials: [
      { label: "Instagram", href: "https://www.instagram.com/neerufinance/" },
      { label: "X", href: "https://x.com/NeeruFinance" },
      { label: "TikTok", href: "https://www.tiktok.com/@neerufinance" },
    ],
  },
];

export function serviceLinkProps(service: Service): ServiceLinkProps {
  if (service.status === "soon") {
    return { href: undefined, target: undefined, rel: undefined, isLink: false };
  }

  if (service.external) {
    return {
      href: service.href,
      target: "_blank",
      rel: "noopener noreferrer",
      isLink: true,
    };
  }

  return { href: service.href, target: undefined, rel: undefined, isLink: true };
}
