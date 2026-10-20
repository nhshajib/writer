# TypeWit brand

All files are in `web/public/brand/` (also served at `https://typewit.com/brand/…`).
They are generated: edit `web/scripts/brand.py`, then run the three commands at the top of it.

## Logo

| File | Use |
|---|---|
| `logo.svg` / `logo.png` | Main logo on light backgrounds |
| `logo-white.svg` / `logo-white.png` | On dark backgrounds |
| `logo-black.svg` / `logo-black.png` | One-colour printing |
| `mark.svg`, `mark-16…1024.png` | The square mark alone: favicons, app icons, small spaces |
| `mark-square.svg`, `mark-square-1024.png` | Avatars and anywhere the image is cropped to a circle (social profiles) |
| `mark-black.svg`, `mark-white.svg` | One-colour mark |
| `google-oauth-logo-120.png` | Google OAuth consent screen (see below) |
| `wordmark.svg` | The name alone, when the mark is already nearby |

The mark is a rounded blue tile with a **T** and a **text cursor** beside it: text appearing step by step.
The wordmark is Inter Display Bold, slightly tight, "Type" in ink and "Wit" in blue.

Rules:

- Leave clear space around the logo of at least a quarter of the mark's height.
- Don't recolour, stretch, rotate, outline or add shadows; don't put the colour logo on busy photos.
- Smallest size: the mark at 16 px, the full logo at 96 px wide.
- Always "TypeWit": one word, capital T and W.

## Colours

| Name | Hex | Use |
|---|---|---|
| TypeWit Blue | `#0b57d0` | Mark, buttons, links, "Wit" |
| Blue, hover | `#0842a0` | Pressed and hover states |
| Cursor Blue | `#8ab4f8` | The cursor in the mark; links and "Wit" in dark mode |
| Blue tint | `#eef3fd` | Soft backgrounds, info notices |
| Ink | `#0a0a0b` | Text |
| Grey | `#5f6368` | Secondary text |
| Paper | `#ffffff` / dark `#0b0b0c` | Backgrounds |
| Red | `#c5221f` | Errors only (5.1:1 on its tint) |

Text colours meet WCAG AA contrast; keep it that way when adding colours.

## Type

Inter for everything (the site loads Inter Variable); Inter Display Bold for the wordmark. Headings use
tight letter-spacing (about −0.03em), body text normal.

## Voice

Plain, calm and honest. TypeWit is **automated text entry**, so say so: never describe it as the user
typing, and never promise to hide that text was entered by a tool. Short sentences, no hype.

## Google OAuth consent screen

Google Cloud Console → **Google Auth Platform → Branding** (older consoles: APIs & Services → OAuth consent screen):

- **App name:** TypeWit
- **User support email:** support@typewit.com
- **App logo:** upload `web/public/brand/google-oauth-logo-120.png` (120 × 120 px, square, under 1 MB)
- **Application home page:** https://typewit.com
- **Privacy policy:** https://typewit.com/privacy/
- **Terms of service:** https://typewit.com/terms/
- **Authorized domains:** typewit.com
- **Developer contact:** your email

Adding a logo makes Google review the app's branding (usually a few days). The domain must be verified in
Google Search Console under the same Google account.
