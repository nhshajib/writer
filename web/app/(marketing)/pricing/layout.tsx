import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pricing", description: "Free: 250 words a day. Pro: unlimited words, sessions up to a week, 3 at once." };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
