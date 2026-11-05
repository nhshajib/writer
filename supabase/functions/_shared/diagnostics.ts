/** Do not serialize exception messages, provider bodies, credentials or user text. */
export function diagnosticFailure(error: unknown): { error_type: string; code?: string } {
  const value = error && typeof error === "object" ? error as { name?: unknown; code?: unknown } : {};
  const names = ["Error", "TypeError", "RangeError", "StripeError", "AbortError", "TimeoutError", "PostgrestError"];
  const name = typeof value.name === "string" && names.includes(value.name) ? value.name : "Error";
  const providerCodes = [
    "resource_missing",
    "api_key_expired",
    "rate_limit",
    "lock_timeout",
    "invalid_request_error",
    "api_error",
    "card_declined",
  ];
  const code =
    typeof value.code === "string" && (providerCodes.includes(value.code) || /^[0-9A-Z]{5}$/.test(value.code))
      ? value.code
      : undefined;
  return { error_type: name, ...(code ? { code } : {}) };
}
