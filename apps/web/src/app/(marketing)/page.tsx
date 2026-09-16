import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-chrome";
import { SmoothScroll } from "@/components/smooth-scroll";
import { BrandStrip, ChoiceTable, Connect, Counters, CtaAoutive, EvidenceAccordion, FaqAoutive, HeroAoutive, Plans, UseCases, WorkflowTabs } from "@/components/landing/aoutive";
import { CheckSection, NumberStrip } from "@/components/landing/extras";
import { landingData } from "@/lib/landing-data";

/*
 * Landing page: the Aoutive home page, section for section, carrying Lookthrough's content. Every measured figure comes
 * from landingData() at request time. The motion catalogue is documented at the top of components/landing/aoutive.tsx.
 */
export const dynamic = "force-dynamic";

const SOCIAL = "30.35% of SPYx on Solana is held by programs the issuer cannot see. Paste a wallet and see if you're in it.";
export const metadata: Metadata = {
  title: { absolute: "Lookthrough. Rights or composability was a false choice." },
  description: "Put a tokenized stock into a pool and the register loses you. Lookthrough resolves every holder behind every program at the record date, proves it with one root on Solana, and pays or polls them without a token moving.",
  openGraph: { title: "Lookthrough. Rights or composability was a false choice.", description: SOCIAL },
  twitter: { card: "summary_large_image", title: "Lookthrough. Rights or composability was a false choice.", description: SOCIAL }
};

export default async function Landing() {
  const d = await landingData();
  return (
    <div>
      <SmoothScroll />
      <HeroAoutive />
      <BrandStrip />
      <CheckSection example={d.example?.wallet ?? null} />
      <WorkflowTabs data={d} />
      <ChoiceTable />
      <UseCases />
      <Counters data={d} />
      <NumberStrip data={d} />
      <EvidenceAccordion />
      <Connect data={d} />
      <Plans data={d} />
      <FaqAoutive />
      <CtaAoutive />
      <SiteFooter network={d.clusterLabel} slot={d.latest?.slotActual ?? null} />
    </div>
  );
}
