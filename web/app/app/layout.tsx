import type { Metadata } from "next";
import { privateMeta } from "@/lib/seo";
import { Shell } from "@/components/app/Shell";

export const metadata: Metadata = { ...privateMeta("/app/", "Dashboard", "Your TypeWit dashboard: sessions, documents, plan and settings."), title: { default: "Dashboard", template: "%s · TypeWit" } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
