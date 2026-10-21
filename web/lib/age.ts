/**
 * Who may use TypeWit, by age. The same rules are enforced in the database
 * (supabase/migrations/20261020024953_age_and_guardian.sql): 13 and over, and at
 * least the age of digital consent in the person's country; under-18s need a
 * parent or guardian's agreement. Only the country and the month and year of
 * birth are asked for.
 */

export const ADULT_AGE = 18;

/** Countries whose age of digital consent is above 13 (GDPR Article 8 and similar laws). */
const MINIMUM_AGE: Record<string, number> = {
  DE: 16, HR: 16, HU: 16, IE: 16, LI: 16, LU: 16, NL: 16, PL: 16, RO: 16, SK: 16,
  CZ: 15, FR: 15, GR: 15, SI: 15,
  AT: 14, BG: 14, CY: 14, ES: 14, IT: 14, LT: 14, KR: 14, CN: 14,
};

export function minimumAge(country: string): number {
  return MINIMUM_AGE[country.toUpperCase()] ?? 13;
}

/** Whole years of age. A birthday in the current month counts as not reached yet, as in the database. */
export function ageFrom(year: number, month: number, now = new Date()): number {
  return now.getFullYear() - year - (now.getMonth() + 1 <= month ? 1 : 0);
}

export type AgeCheck = "ok" | "guardian" | "too_young";

/** What the answers mean: fine, needs a parent or guardian's agreement, or not allowed. */
export function checkAge(country: string, year: number, month: number, now = new Date()): AgeCheck {
  const age = ageFrom(year, month, now);
  if (age < minimumAge(country)) return "too_young";
  return age < ADULT_AGE ? "guardian" : "ok";
}

// ISO 3166-1 alpha-2 codes; names come from the browser in the person's language.
const CODES = (
  "AF AX AL DZ AS AD AO AI AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BR IO BN BG BF BI CV KH CM CA KY " +
  "CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE " +
  "DE GH GI GR GL GD GP GU GT GG GN GW GY HT VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV " +
  "LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF " +
  "MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI " +
  "SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI " +
  "WF EH YE ZM ZW"
).split(" ");

/** Every country, by name in the browser's language. */
export function countries(locale?: string): { code: string; name: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(locale ? [locale] : undefined, { type: "region" });
  } catch {
    // Older browsers: show the codes.
  }
  return CODES.map((code) => ({ code, name: names?.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** A best guess at the person's country from their browser language ("en-GB" → "GB"), or "". */
export function guessCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region ?? "";
    return CODES.includes(region) ? region : "";
  } catch {
    return "";
  }
}

const BLOCK_KEY = "typewit:age-block";

/** After a refusal, the form stays closed in this browser for a day, so it isn't simply retried with another year. */
export function rememberAgeBlock(): void {
  try {
    localStorage.setItem(BLOCK_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
  } catch {
    // Storage blocked: the server still refuses.
  }
}

export function ageBlocked(): boolean {
  try {
    return Number(localStorage.getItem(BLOCK_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}
