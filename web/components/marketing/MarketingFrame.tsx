"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export function MarketingFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const home = path === "/";
  const router = useRouter();
  useEffect(() => {
    if (!home) return;
    const follow = () => {
      const target: Record<string, string> = {
        "#how": "/how-it-works/",
        "#features": "/features/",
        "#faq": "/faq/",
        "#pricing": "/pricing/",
      };
      const next = target[window.location.hash];
      if (next) router.replace(next);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [home, router]);
  return (
    <div className={home ? "home-backdrop" : "marketing-shell"}>
      <div className={home ? "home-frame" : "marketing-frame"}>
        <Header />
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer compact={home} />
      </div>
    </div>
  );
}
