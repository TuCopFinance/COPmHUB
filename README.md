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
    offramp/              Bre-B off-ramp and on-ramp registration (feature-flagged)
    api/ramp/             Server relay to the TuCOPRamp platform API
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

## Bre-B off-ramp and on-ramp (feature-flagged)

`/offramp` registers a person as a direct client of TuCOP Ramp without leaving the hub: confirm an email with a one-time code, enter their name and identity document, complete Bridge's terms and identity check inside the page, then register their own Bre-B key. Once the Bre-B directory verifies the key is theirs, the person gets a liquidation address (USDC on Celo in, pesos to their key out) and, separately, a Bre-B key to buy USDC with pesos (on-ramp). Someone who registered before signs in with the same email and sees what they already have; nothing is created twice.

The service is operated by TuCOP. The form calls only this site: `src/app/api/ramp/[...path]/route.ts` relays an allowlist of TuCOPRamp platform calls (`/v1/sessions`, `/v1/parties`, `/v1/destinations`, `/v1/withdrawals`, `/v1/deposits`, `/v1/document-types`) with TuCOP Ramp's integrator key, which stays on the server. The party session token lives in an httpOnly cookie and never reaches client code. Signing out (`src/app/api/ramp/session/route.ts`) revokes the session at TuCOPRamp (`DELETE /v1/sessions/current`) and then drops the cookie. Each call carries the person's address in `X-TuCOPRamp-Client-IP`, taken from `X-Real-IP`, which Railway's edge sets and overwrites (never from `X-Forwarded-For`), so TuCOPRamp's per-IP limits apply per person rather than to the hub's server. POSTs carry an `Idempotency-Key` the page keeps for that action until it gets a final answer, so retrying after a dropped connection does not create anything twice. The relay does not store or log request or response bodies. The site has no database.

Selling USDC: a person can register up to 10 active Bre-B keys of their own (`MAX_ACTIVE_KEYS`; the ramp's console limit, when set, also applies and answers `destination_limit_reached`). Each verified key gets its own withdrawal address with its own return wallet, and USDC sent to an address is paid only to its key. An address can be disabled (`DELETE /v1/withdrawals/{id}`) and re-enabled (`POST /v1/withdrawals` with its key); disabled addresses stay listed, because USDC sent to them is still paid out. A key without an active address can be removed, and keys removed are listed with `include_disabled=true`. The page quotes how much USDC to send for a given amount of pesos (`/v1/quotes`), shows `settlement_time`, and lists each address's payouts in the ramp's statuses (`processing`, `completed`, `failed`, `refunded`, `canceled`). Buying USDC (`/v1/deposits`, with its activity from `/v1/deposits/{id}`) shows only when `ONRAMP_ENABLED=true`. The tarjeta de identidad is never offered: Bridge onboards adults only. When identity is approved but enabling Colombia needs more from the person, the ramp sends `links.kyc` again and the page shows it as a third step.

Webhooks: `src/app/api/webhooks/tucopramp/route.ts` receives the integrator's events, verifying the Standard Webhooks signature over the raw body (5-minute window) with `TUCOPRAMP_WEBHOOK_SECRET`. Every event of the integrator arrives, including clients of ramp.tucop.xyz; the site keeps no client list, so a verified event is acknowledged with 200 and only its type and id are logged.

```text
src/app/offramp/          the page
src/app/api/ramp/         the relay to TuCOPRamp (allowlist, session cookie)
src/app/api/webhooks/     TuCOPRamp webhook receiver
src/components/offramp/   flow, off-ramp and on-ramp steps, wallet input, promo, pop-up
src/lib/offramp/          flag + config, copy, error messages, wallet checks
src/lib/ramp/             allowlist, relay and webhook signature logic (tested without Next)
```

The card on the home page, the pop-up, the page and the relay stay off unless `OFFRAMP_ENABLED=true` and the variables in [`.env.example`](./.env.example) are set. The home and privacy pages are static, so the flag is read at build time; changing it needs a redeploy. `next.config.ts` redirects `www` to the apex domain, which is the return URL TuCOP has on file for identity verification.

The ramp only checks that a wallet is shaped like an address. This site answers for it: the form asks for the wallet twice, does not allow pasting into the second field, checks both match and shows the checksummed address before the person confirms.

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

`next.config.ts` sets a Content-Security-Policy, HSTS, `X-Frame-Options: DENY` and related headers on every route. `connect-src` allows only this site and Google Analytics: the off-ramp form calls TuCOPRamp through `/api/ramp`. With the off-ramp on, `frame-src` and the camera permission open to Bridge's terms and identity pages. If the site starts calling a new origin from the browser, add it there.

## CI

`.github/workflows/ci.yml` runs lint, tests and the production build on every pull request and on pushes to `main`. `main` is protected: changes land through a pull request with a green `ci` check.

## Deploy

Railway (see `railway.json`). Build: `npm run build`. Start: `npm run start`.

Set `NEXT_PUBLIC_SITE_URL` in the environment for correct canonical URLs, sitemap, and OG tags. Defaults to `https://digitalcop.shop`. Set `NEXT_PUBLIC_GA_ID` to turn on Google Analytics; without it the tracked events go nowhere.
