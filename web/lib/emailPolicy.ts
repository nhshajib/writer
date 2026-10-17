/**
 * Personal email providers accepted at sign-up. The server enforces the same
 * list (table public.allowed_email_domains); this copy only gives early feedback.
 */
export const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com",
  "proton.me", "protonmail.com",
  "gmx.com", "gmx.net",
  "mail.com",
  "yandex.com",
];

export function emailProblem(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Enter a valid email address.";
  const domain = trimmed.split("@")[1];
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return "Please use a personal email from a common provider such as Gmail, Outlook, Yahoo or iCloud. Work, school and temporary addresses aren't accepted.";
  }
  return null;
}
