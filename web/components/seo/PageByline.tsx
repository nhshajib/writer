import Link from "next/link";

/** "By the TypeWit team · Updated 8 November 2026", shared by guides and landing pages. */
export function PageByline({ updated }: { updated: string }) {
  const shown = new Date(`${updated}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return <p className="updated">By the <Link href="/about/">TypeWit team</Link> · Updated <time dateTime={updated}>{shown}</time></p>;
}
