# COPmHUB

Landing site for **DigitalCOP** (`digitalcop.shop`): the product hub for pesos digitales (COPm) on Celo in Colombia. Presents TuCop Wallet as the recommended entry point and links to Cards, COP By, and Neeru. Community projects that use COPm can apply via PR to be listed on `/ecosystem`.

Built with Next.js 16 (App Router, Turbopack) and Tailwind CSS 4.

## Structure

```text
content/
  ecosystem/              Community project JSON listings (one file per id)
src/
  app/
    page.tsx              Home (hero, how-it-works, services, FAQ, related)
    layout.tsx            Root layout, metadata, analytics
    globals.css           Tailwind + custom tokens
    llms.txt/route.ts     Machine-readable summary for LLM crawlers
    robots.ts             /robots.txt
    sitemap.ts            /sitemap.xml (from INDEXABLE_PATHS)
    ecosystem/            Community COPm project directory
    nosotros/             Legal: about
    terminos/             Legal: terms
    privacidad/           Legal: privacy
    offramp/              Bre-B off-ramp pre-registration form (feature-flagged)
    que-es-copm/          SEO cluster page
    cambiar-usd-a-cop/    SEO cluster page
    invertir-pesos-digitales/    SEO cluster page
    carry-trade-peso-colombiano/ SEO cluster page
    crypto-colombia/      SEO cluster page
  components/             Nav, Hero, HeroLandscape, HowItWorks, Services,
                          EcosystemGrid, WhatIs, Faq, RelatedLinks,
                          IntentLayout, Footer, CtaLink, JsonLd,
                          AnalyticsListener, CarryPath
  lib/
    site.ts               Site config (URL, nav, cluster + legal + ecosystem)
    services.ts           Core service catalog rendered by <Services />
    ecosystem.ts          Ecosystem schema, loader, validation
    seo.ts                Metadata helpers
    faq.ts                FAQ items
    analytics.ts          Client analytics helpers
public/
  hero/                   Hero landscape assets (hill.png, plant.png)
```

`src/lib/services.ts` is the source of truth for the core Services section. `content/ecosystem/*.json` is the source of truth for `/ecosystem`. `src/lib/site.ts` drives URLs, nav, SEO cluster / legal pages, and the sitemap.

## Bre-B off-ramp pre-registration (optional, off by default)

`/offramp` lets a person pre-register for the off-ramp to Bre-B keys in Colombia without leaving the hub: confirm an email with a one-time code, enter their name and identity document, complete KYC and terms on Bridge's hosted pages, and register their own Bre-B key. It only collects the pre-registration; withdrawals are not built.

The hub hosts the form and nothing else. The service is operated by TuCOP, and the browser sends everything straight to its TuCOPRamp API (`/v1/prereg/*`). This repo has no database, no API routes and no secrets for it, and the hub's server never sees personal data.

```text
src/app/offramp/          the pre-registration page
src/components/offramp/   form, promo card, one-time pop-up
src/lib/offramp/          flag + public config, copy, error messages
```

The card on the home page, the pop-up and the page stay off unless `OFFRAMP_ENABLED=true` and the variables in [`.env.example`](./.env.example) are set. The home and privacy pages are static, so the flag is read at build time; changing it needs a redeploy. The hub origin must be listed in TuCOPRamp's `CORS_ORIGINS`.

## Listing a community project

Read [CONTRIBUTING.md](./CONTRIBUTING.md). Add `content/ecosystem/<id>.json` and open a PR with the ecosystem template. Requirement: live product with verifiable COPm usage on Celo. Partner badge is invitation-only.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run build   # Next production build
npm run lint    # ESLint
npm test        # Vitest (services + site)
```

## Deploy

Railway (see `railway.json`). Build: `npm run build`. Start: `npm run start`.

Set `NEXT_PUBLIC_SITE_URL` in the environment for correct canonical URLs, sitemap, and OG tags. Defaults to `https://digitalcop.shop`.
