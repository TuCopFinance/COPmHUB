import { MiniPayStrip } from "@/components/CarryPath";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { JsonLd } from "@/components/JsonLd";
import { Nav } from "@/components/Nav";
import { OfframpPopup } from "@/components/offramp/OfframpPopup";
import { Services } from "@/components/Services";
import { WhatIs } from "@/components/WhatIs";
import { HOME_FAQ, OFFRAMP_FAQ } from "@/lib/faq";
import { isOfframpEnabled } from "@/lib/offramp/config";
import { faqJsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export default function HomePage() {
  const offramp = isOfframpEnabled();
  const faq = offramp ? [...HOME_FAQ, OFFRAMP_FAQ] : HOME_FAQ;
  return (
    <main>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <JsonLd data={faqJsonLd(faq)} />
      <Nav />
      <Hero />
      <Services />
      <HowItWorks />
      <WhatIs />
      <MiniPayStrip />
      <Faq items={faq} />
      <Footer />
      {offramp ? <OfframpPopup /> : null}
    </main>
  );
}
