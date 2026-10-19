import type { Metadata } from "next";
import { Shell } from "@/components/app/Shell";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · TypeWit" }, robots: { index: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
