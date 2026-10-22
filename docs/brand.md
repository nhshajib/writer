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
| Ice | `#c0e6fd` | Highlights, cursor, links on midnight backgrounds |
| Sky | `#80aad3` | Borders, decorative accents |
| Slate | `#5b86b6` | Illustrations, gradient transitions |
| TypeWit Blue | `#3f6593` | Buttons, links and the mark on light surfaces |
| Navy | `#1b3554` | Secondary text, hover states and dark surfaces |
| Midnight | `#000f22` | Main ink, footer and dark-mode canvas |
| Paper | `#f5fbff` | Light canvas; cards use this with ice-blue surface variations |
| Red | `#c5221f` | Errors only |

Light mode uses pale blue surfaces with navy ink. Dark mode uses midnight and navy surfaces with ice-blue text. The footer stays midnight in both modes. Avoid white text on Sky or Slate; use Midnight ink instead. Provider logos retain their official brand colours.

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


### Why Google still says “continue to …supabase.co”

The account chooser can show the OAuth callback domain separately from the app name and logo.
TypeWit signs in through Supabase Auth, whose default callback is
`https://jopggisumjlfitapkgjh.supabase.co/auth/v1/callback`. Setting the website's branding alone
does not replace this domain. Also check that the Google OAuth client configured in Supabase
belongs to the same Google Cloud project whose TypeWit branding was verified and published.

To use a branded address such as `auth.typewit.com`:

1. In Supabase project settings, review the paid Custom Domain add-on and its price before enabling it.
2. Follow Supabase's domain setup instructions and add its CNAME and verification TXT records in DNS.
3. Before activating the domain, add `https://auth.typewit.com/auth/v1/callback` to the Google OAuth
   client's authorized redirect URIs. Keep the existing Supabase callback too.
4. Complete certificate verification and activate the custom domain in Supabase.
5. Set the deployed frontend's `NEXT_PUBLIC_SUPABASE_URL` to `https://auth.typewit.com`, rebuild,
   and test sign-in, sign-out, password recovery, and the Google Docs connection. Keep the site's
   Supabase redirect allowlist and Google authorized origins set to the TypeWit frontend URLs.

This requires access to Supabase project settings, DNS, and Google Cloud; a SQL migration or a
change to the login button cannot change Google's hosted account chooser. Do not change the
frontend URL until the domain and callback are ready.

References: https://supabase.com/docs/guides/auth/social-login/auth-google and
https://supabase.com/docs/guides/platform/custom-domains
