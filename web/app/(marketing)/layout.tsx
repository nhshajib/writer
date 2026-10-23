import { MarketingFrame } from "@/components/marketing/MarketingFrame";
export default function MarketingLayout(
  { children }: { children: React.ReactNode },
) {
  return <MarketingFrame>{children}</MarketingFrame>;
}
