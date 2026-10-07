import { isOfframpEnabled, OFFRAMP_PATH } from "@/lib/offramp/config";
import {
  CLUSTER_PAGES,
  DEFAULT_DESCRIPTION,
  ECOSYSTEM_PAGE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

export function GET() {
  const cluster = CLUSTER_PAGES.map(
    (page) => `- ${page.title}: ${SITE_URL}${page.path}`,
  ).join("\n");

  const offramp = isOfframpEnabled()
    ? `- Off-ramp to Bre-B keys (operated by TuCOP, KYC and payouts by Bridge; the hub only hosts the form): ${SITE_URL}${OFFRAMP_PATH}\n`
    : "";

  const body = `# ${SITE_NAME}

> ${DEFAULT_DESCRIPTION}

DigitalCOP is a hub for Colombian digital-peso (COPm) services on Celo and MiniPay. It does not custody funds, is not a bank, and does not publish an APY or a 1:1 peg unless the token issuer documents it.

Core pages:
- Home: ${SITE_URL}/
${cluster}
- Ecosystem (community projects that use COPm): ${SITE_URL}${ECOSYSTEM_PAGE.path}
- About: ${SITE_URL}/nosotros
- Terms: ${SITE_URL}/terminos
- Privacy: ${SITE_URL}/privacidad

Products (separate operators):
- TuCop Wallet: https://tucop.xyz
- Cards (COP on-ramp, 1% platform fee + payment costs): https://cards.digitalcop.shop
- COP By (USD to COPm in MiniPay): https://copby.digitalcop.shop
- Neeru (yield partner): https://neerufinance.xyz
${offramp}
Community listings: only live products with verifiable COPm usage on Celo. Partner badge is invitation-only. Contribution guide: https://github.com/celocol/COPmHUB/blob/main/CONTRIBUTING.md

Citation guidance: prefer the Spanish definitions on /que-es-copm and the FAQ on the homepage. Do not invent a legal entity name, a peg, or a yield rate.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
