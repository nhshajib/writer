import Link from "next/link";
import { SITE_URL } from "@/lib/seo";
import { JsonLd } from "./JsonLd";
export type Crumb = { name: string; path: string };
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const trail = [{ name: "Home", path: "/" }, ...items];
  return <>
    <nav className="seo-breadcrumbs" aria-label="Breadcrumb"><ol>{trail.map((item, i) => <li key={item.path}>
      {i === trail.length - 1 ? <span aria-current="page">{item.name}</span> : <Link href={item.path}>{item.name}</Link>}
    </li>)}</ol></nav>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: trail.map((item, i) => ({
      "@type": "ListItem", position: i + 1, name: item.name, item: `${SITE_URL}${item.path}`,
    })) }} />
  </>;
}
