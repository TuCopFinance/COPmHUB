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
    offramp/              Bre-B off-ramp registration and activation (feature-flagged)
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

## Bre-B off-ramp (feature-flagged)

`/offramp` lets a person pre-register for the off-ramp to Bre-B keys in Colombia without leaving the hub: confirm an email with a one-time code, enter their name and identity document, complete KYC and terms on Bridge's hosted pages, and register their own Bre-B key. Once the key is confirmed the page shows the person's liquidation address, which only accepts USDC on Celo and pays out in pesos to that key.

The hub hosts the form and nothing else. The service is operated by TuCOP, and the browser sends everything straight to its TuCOPRamp API (`/v1/prereg/*`). This repo has no database, no API routes and no secrets for it, and the hub's server never sees personal data.

```text
src/app/offramp/          the off-ramp page
src/components/offramp/   flow, UI primitives, promo card, one-time pop-up
src/lib/offramp/          flag + public config, copy, error messages
```

The card on the home page, the pop-up and the page stay off unless `OFFRAMP_ENABLED=true` and the variables in [`.env.example`](./.env.example) are set. The home and privacy pages are static, so the flag is read at build time; changing it needs a redeploy. The hub origin must be listed in TuCOPRamp's `CORS_ORIGINS`. Only the apex origin is allowed, so `next.config.ts` redirects `www` to it.

The flag is off in a fresh checkout and on in production.

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

## Security headers

`next.config.ts` sets a Content-Security-Policy, HSTS, `X-Frame-Options: DENY` and related headers on every route. `connect-src` allows the `OFFRAMP_API_URL` origin and Google Analytics. If the site starts calling a new origin from the browser, add it there.

## CI

`.github/workflows/ci.yml` runs lint, tests and the production build on every pull request and on pushes to `main`. `main` is protected: changes land through a pull request with a green `ci` check.

## Deploy

Railway (see `railway.json`). Build: `npm run build`. Start: `npm run start`.

Set `NEXT_PUBLIC_SITE_URL` in the environment for correct canonical URLs, sitemap, and OG tags. Defaults to `https://digitalcop.shop`. Set `NEXT_PUBLIC_GA_ID` to turn on Google Analytics; without it the tracked events go nowhere.
