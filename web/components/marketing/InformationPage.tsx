import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
export function InformationPage(
  { title, intro, path, children }: {
    title: string;
    intro: string;
    path: string;
    children: React.ReactNode;
  },
) {
  return (
    <div className="information-page container">
      <Breadcrumbs items={[{ name: title, path }]} />
      <header className="information-heading">
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      {children}
      <div className="information-end">
        <Link className="btn btn-primary" href="/signup/">
          Get started free
        </Link>
        <Link href="/pricing/">Compare plans →</Link>
      </div>
    </div>
  );
}
