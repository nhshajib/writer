import { z } from "npm:zod@4.6.7";
import { HttpError } from "./http.ts";
import { MAX_TEXT_CHARS } from "./limits.ts";

const planText = z.string().max(MAX_TEXT_CHARS);

/** Reject oversized source before parsing rich text, splitting or compiling edits. */
export function validatePlanSource(text: string): void {
  if (!planText.safeParse(text).success) {
    throw new HttpError(400, `The text is too long (max ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters).`);
  }
}
