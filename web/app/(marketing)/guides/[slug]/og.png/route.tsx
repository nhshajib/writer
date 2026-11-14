import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { GUIDES } from "@/lib/search-content";

/** Each guide's share image (og.png beside the page) carries its own title, in the site's brand colours. */
export const dynamic = "force-static";
const size = { width: 1200, height: 630 };

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = GUIDES.find((g) => g.slug === slug);
  const mark = `data:image/png;base64,${(await readFile(path.join(process.cwd(), "public/brand/mark-512.png"))).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 88, background: "#edf6fc", color: "#000f22", borderBottom: "12px solid #3f6593" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 700 }}>
          <img src={mark} width={64} height={64} alt="" />
          TypeWit
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 28, color: "#3f6593", textTransform: "uppercase", letterSpacing: 2 }}>Practical guide</div>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, marginTop: 16 }}>{guide?.title ?? "TypeWit guide"}</div>
        </div>
      </div>
    ),
    size,
  );
}
