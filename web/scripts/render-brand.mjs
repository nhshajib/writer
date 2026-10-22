// Renders the logo SVGs in public/brand/ to every PNG the site, Google and Word need.
// Run from web/ after scripts/brand.py:  node scripts/render-brand.mjs
// Uses Playwright's Chromium (set CHROMIUM_PATH to use a specific browser).
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
const svg = (name) => readFileSync(`public/brand/${name}`, "utf8");

/** Draws `html` on a transparent (or given) background at w×h and saves a PNG. */
async function shoot(html, w, h, out, background = "transparent") {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<!doctype html><html><head><style>
      html,body{margin:0;width:${w}px;height:${h}px;background:${background};overflow:hidden}
      svg{display:block;width:100%;height:100%}
    </style></head><body>${html}</body></html>`,
  );
  await page.screenshot({ path: out, omitBackground: background === "transparent" });
  console.log("wrote", out);
}

// The mark, for anywhere a square icon is needed.
for (const size of [16, 32, 48, 64, 128, 192, 256, 512, 1024]) {
  await shoot(svg("mark.svg"), size, size, `public/brand/mark-${size}.png`);
}
// ICO containers can embed PNG frames, keeping the browser favicon in sync too.
const faviconSizes = [16, 32, 48];
const faviconFrames = faviconSizes.map(size => readFileSync(`public/brand/mark-${size}.png`));
const faviconHeader = Buffer.alloc(6 + 16 * faviconFrames.length);
faviconHeader.writeUInt16LE(1, 2);
faviconHeader.writeUInt16LE(faviconFrames.length, 4);
let frameOffset = faviconHeader.length;
for (let i = 0; i < faviconFrames.length; i++) {
  const entry = 6 + 16 * i;
  faviconHeader[entry] = faviconSizes[i];
  faviconHeader[entry + 1] = faviconSizes[i];
  faviconHeader.writeUInt16LE(1, entry + 4);
  faviconHeader.writeUInt16LE(32, entry + 6);
  faviconHeader.writeUInt32LE(faviconFrames[i].length, entry + 8);
  faviconHeader.writeUInt32LE(frameOffset, entry + 12);
  frameOffset += faviconFrames[i].length;
}
writeFileSync("app/favicon.ico", Buffer.concat([faviconHeader, ...faviconFrames]));
console.log("wrote app/favicon.ico");

// Site icons (Next.js picks these up from app/). Apple rounds the corners itself, so it gets the square.
await shoot(svg("mark.svg"), 512, 512, "app/icon.png");
await shoot(svg("mark-square.svg"), 180, 180, "app/apple-icon.png");
// Word add-in icons.
for (const size of [16, 32, 64, 80]) await shoot(svg("mark.svg"), size, size, `public/word/icon-${size}.png`);

// Google OAuth consent screen: square, 120×120 px, under 1 MB. Google may show it in a circle,
// so this is the full-bleed version with the glyph inside the circle.
await shoot(svg("mark-square.svg"), 120, 120, "public/brand/google-oauth-logo-120.png");
await shoot(svg("mark-square.svg"), 1024, 1024, "public/brand/mark-square-1024.png");

// Horizontal logos.
const logoRatio = (name) => {
  const [, , w, h] = svg(name).match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  return w / h;
};
for (const [name, bg] of [["logo.svg", "transparent"], ["logo-white.svg", "transparent"], ["logo-black.svg", "transparent"]]) {
  const h = 160;
  await shoot(svg(name), Math.round(h * logoRatio(name)), h, `public/brand/${name.replace(".svg", ".png")}`, bg);
}

// Social share image (1200×630).
const og = `
  <div style="box-sizing:border-box;width:1200px;height:630px;padding:96px;display:flex;flex-direction:column;justify-content:space-between;
              background:#edf6fc;font-family:'Inter','Inter Display',system-ui,sans-serif;color:#000f22;border-bottom:12px solid #3f6593">
    <div style="height:120px">${svg("logo.svg").replace("<svg ", '<svg style="height:120px;width:auto" ')}</div>
    <div>
      <div style="font-size:60px;font-weight:700;letter-spacing:-0.03em;line-height:1.1">Your words in Google Docs<br>and Word, without typing.</div>
      <div style="font-size:30px;color:#3f6593;margin-top:24px">Automated text entry, at the pace you choose.</div>
    </div>
  </div>`;
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<!doctype html><html><body style="margin:0">${og}</body></html>`);
await page.screenshot({ path: "app/opengraph-image.png" });
writeFileSync("app/twitter-image.png", readFileSync("app/opengraph-image.png"));
console.log("wrote app/opengraph-image.png, app/twitter-image.png");

await browser.close();
