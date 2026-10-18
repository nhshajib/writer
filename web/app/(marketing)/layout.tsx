import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
    </>
  );
}
