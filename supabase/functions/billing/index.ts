// Stripe billing for signed-in users.
//
//   POST /billing/checkout   { interval: "month" | "year" | "day" }  ->  { url }
//   POST /billing/portal     { flow?: PortalFlow }           ->  { url }
//   POST /billing/summary                                    ->  { subscription, card, invoices, email, current_price, outdated_price }
//   POST /billing/reprice    moves a subscription on an older, higher price to today's price
//
// Checkout starts a Pro subscription. The 7-day trial (card required) is only
// offered if this person's normalized email has never claimed one.

import { grantDayPass } from "../_shared/dayPass.ts";
import { requireUser } from "../_shared/auth.ts";
import { sha256Hex } from "../_shared/crypto.ts";
import { adminClient, requireEnv } from "../_shared/env.ts";
import { HttpError, json, readJson, serve } from "../_shared/http.ts";
import {
  customerSubscriptions,
  isMissingStripeCustomer,
  preferredSubscription,
  StripeError,
  stripeGet,
  stripeRequest,
  subscriptionHasNotEnded,
} from "../_shared/stripe.ts";

const TRIAL_DAYS = "7";
const ADULT_AGE = 18;

/** Whole years from a month and year of birth; a birthday this month counts as not reached (as in public.age_from). */
function ageFrom(year: number, month: number, now = new Date()): number {
  return now.getUTCFullYear() - year - (now.getUTCMonth() + 1 <= month ? 1 : 0);
}

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
  const action = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  // Ineligible accounts must still be able to inspect and end existing
  // billing before account deletion. They cannot buy or upgrade a plan.
  const user = await requireUser(req, { allowIneligible: action === "portal" || action === "summary" });

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new HttpError(503, "Payments are not configured yet.");
  const appUrl = requireEnv("APP_URL").replace(/\/$/, "");

  try {
    if (action === "activate-pass") return await activatePass(user.id, secretKey, req);
    if (action === "checkout") return await checkout(user, secretKey, appUrl, req);
    if (action === "portal") return await portal(user.id, secretKey, appUrl, req, user.eligibilityBlocked);
    if (action === "summary") return await summary(user.id, secretKey);
    if (action === "reprice") return await reprice(user.id, secretKey);
  } catch (error) {
    if (error instanceof StripeError) {
      console.error("Stripe error", error.status, error.code, error.param, error.message);
      if (isMissingStripeCustomer(error)) {
        throw new HttpError(
          502,
          "Your billing account is unavailable with the current payment settings. Start a new checkout, or contact support if you already have a subscription.",
        );
      }
      if (error.status === 401) {
        throw new HttpError(502, "Payments need a configuration update. Please contact support.");
      }
      if (error.code === "resource_missing" && error.param?.includes("price")) {
        throw new HttpError(502, "This plan is unavailable with the current payment settings. Please contact support.");
      }
      throw new HttpError(502, "The payment provider returned an error. Please try again.");
    }
    throw error;
  }
  throw new HttpError(404, "Not found.");
});

async function checkout(
  user: { id: string; email: string | null },
  secretKey: string,
  appUrl: string,
  req: Request,
): Promise<Response> {
  const { interval } = await readJson<{ interval?: string }>(req);
  const price = interval === "year"
    ? requireEnv("STRIPE_PRICE_YEARLY")
    : interval === "month"
    ? requireEnv("STRIPE_PRICE_MONTHLY")
    : interval === "day"
    ? (Deno.env.get("STRIPE_PRICE_DAY") ?? Deno.env.get("stripe_price_day") ?? "")
    : null;
  const dayPass = interval === "day";
  if (dayPass && !price) throw new HttpError(503, "Day Pass payments are not configured yet.");
  if (!price) throw new HttpError(400, 'interval must be "month", "year" or "day".');
  if (!user.email) throw new HttpError(400, "Your account has no email address.");

  const db = adminClient();
  const { data: profile, error } = await db
    .from("profiles")
    .select("stripe_customer_id, subscription_status, age_confirmed_at, birth_year, birth_month, day_pass_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (dayPass && profile?.day_pass_expires_at && Date.parse(profile.day_pass_expires_at) > Date.now()) {
    throw new HttpError(409, "Your Day Pass is still active. You can buy another after it expires, or upgrade to Pro.");
  }
  // Paying needs an adult. Under-18s' accounts can't start a subscription themselves.
  if (!profile?.age_confirmed_at || profile.birth_year == null || profile.birth_month == null) {
    throw new HttpError(403, "Open your dashboard and finish setting up your account first.");
  }
  if (ageFrom(profile.birth_year, profile.birth_month) < ADULT_AGE) {
    throw new HttpError(
      403,
      "Pro has to be bought by an adult. Ask a parent or guardian to contact us from the help page.",
    );
  }
  const lease = crypto.randomUUID();
  const { data: acquired, error: lockError } = await db.rpc("acquire_billing_checkout", { owner: user.id, lease });
  if (lockError) throw new HttpError(503, "Checkout could not be prepared. Please try again.");
  if (!acquired) throw new HttpError(409, "Checkout is already being prepared. Please wait a moment and try again.");
  const deadline = Date.now() + 90_000;
  const checkoutFetch: typeof fetch = (input, init) => {
    if (Date.now() >= deadline) throw new HttpError(503, "Checkout took too long. Please try again.");
    const remaining = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
    return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, remaining]) : remaining });
  };
  try {
    // Reload after acquiring: another request may have created the customer
    // between the first profile read and this lock.
    let customer = await customerFor(user.id);
    let missingCustomer: string | undefined;
    if (dayPass) {
      const { data: current, error: currentError } = await db.from("profiles").select("day_pass_expires_at").eq(
        "user_id",
        user.id,
      ).maybeSingle();
      if (currentError) throw new HttpError(503, "Checkout could not be prepared. Please try again.");
      if (current?.day_pass_expires_at && Date.parse(current.day_pass_expires_at) > Date.now()) {
        throw new HttpError(
          409,
          "Your Day Pass is still active. You can buy another after it expires, or upgrade to Pro.",
        );
      }
    }
    let liveSubscriptions: Awaited<ReturnType<typeof customerSubscriptions>> = [];
    if (customer) {
      try {
        liveSubscriptions = await customerSubscriptions(secretKey, customer, false, checkoutFetch);
      } catch (error) {
        if (!isMissingStripeCustomer(error)) throw error;
        // A live key cannot read a sandbox customer. Never infer that an
        // ongoing subscription ended simply because its customer is missing.
        if (subscriptionHasNotEnded(profile?.subscription_status)) {
          throw new HttpError(
            409,
            "Your existing subscription needs a billing configuration review. Please contact support before starting another checkout.",
          );
        }
        missingCustomer = customer;
        customer = null;
      }
    }
    if (
      liveSubscriptions.some((s) => subscriptionHasNotEnded(s.status)) ||
      (!profile?.stripe_customer_id && subscriptionHasNotEnded(profile?.subscription_status))
    ) {
      throw new HttpError(409, "You already have Pro. Use “Manage billing” to change your plan.");
    }

    if (dayPass) {
      if (!/^price_[A-Za-z0-9_]{1,200}$/.test(price)) {
        throw new HttpError(503, "Day Pass needs a Stripe Price ID, not a Product ID.");
      }
      const configured = await stripeGet<
        {
          active: boolean;
          currency: string;
          unit_amount: number | null;
          type: string;
          recurring: unknown;
          product: { active: boolean };
        }
      >(secretKey, `prices/${encodeURIComponent(price)}`, { "expand[]": "product" }, checkoutFetch);
      if (
        !configured.active || configured.currency !== "usd" || configured.unit_amount !== 499 ||
        configured.type !== "one_time" || configured.recurring || !configured.product?.active
      ) {
        throw new HttpError(503, "Day Pass requires an active $4.99 USD one-time price. Please contact support.");
      }
      await ensureDayPassEvents(secretKey, checkoutFetch);
    }
    if (missingCustomer && !dayPass) {
      // Verify the price in the new Stripe environment before replacing the
      // saved customer. A sandbox price must not leave a half-migrated account.
      const configured = await stripeGet<{
        active: boolean;
        currency: string;
        unit_amount: number | null;
        type: string;
        recurring: { interval: string; interval_count: number } | null;
        product: { active: boolean };
      }>(secretKey, `prices/${encodeURIComponent(price)}`, { "expand[]": "product" }, checkoutFetch);
      if (
        !configured.active || !configured.product?.active || configured.currency !== "usd" ||
        configured.unit_amount !== (interval === "year" ? 6000 : 699) || configured.type !== "recurring" ||
        configured.recurring?.interval !== interval || configured.recurring?.interval_count !== 1
      ) {
        throw new HttpError(
          503,
          "This plan needs an active USD price matching its amount and billing interval. Please contact support.",
        );
      }
    }
    const customerId = customer ?? await createCustomer(user, secretKey, checkoutFetch, missingCustomer);

    const open = await stripeGet<
      {
        data: {
          id: string;
          url: string | null;
          mode: string;
          metadata?: { typewit_price?: string };
          line_items?: { data: { price: { id: string } | null }[] };
        }[];
        has_more: boolean;
      }
    >(secretKey, "checkout/sessions", {
      customer: customerId,
      status: "open",
      limit: "100",
      "expand[]": "data.line_items",
    }, checkoutFetch);
    // A partial list must not be mistaken for "no checkout".
    if (open.has_more) {
      throw new HttpError(
        409,
        "There are several unfinished checkouts. Please contact support before starting another.",
      );
    }
    const pending = open.data.filter((session) =>
      session.mode === "subscription" || session.metadata?.typewit_price === "typewit-day-pass-499-usd"
    );
    const same = pending.find((session) =>
      (dayPass
        ? session.metadata?.typewit_price === "typewit-day-pass-499-usd" &&
          session.line_items?.data[0]?.price?.id === price
        : (session.metadata?.typewit_price ?? session.line_items?.data[0]?.price?.id) === price) && session.url
    );
    // Retire older links when switching the selected billing interval, so only
    // one TypeWit checkout can be completed. Reuse an identical open checkout.
    for (const session of pending) {
      if (session.id !== same?.id) {
        await stripeRequest(secretKey, `checkout/sessions/${session.id}/expire`, {}, checkoutFetch);
      }
    }

    const { data: trialAvailable, error: trialError } = dayPass
      ? { data: false, error: null }
      : await db.rpc("trial_available", { email: user.email });
    if (trialError) throw new Error(trialError.message);
    if (same?.url) return json({ url: same.url, trial: dayPass ? false : Boolean(trialAvailable) });

    const params: Record<string, string> = {
      ui_mode: "hosted_page",
      billing_address_collection: "required",
      "phone_number_collection[enabled]": "false",
      "automatic_tax[enabled]": "false",
      allow_promotion_codes: "true",
      submit_type: "auto",
      "name_collection[individual][enabled]": "true",
      "saved_payment_method_options[payment_method_save]": "enabled",
      integration_identifier: "hosted_mobile_app_0001",
      origin_context: "mobile_app",
      mode: dayPass ? "payment" : "subscription",
      customer: customerId,
      client_reference_id: user.id,
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: `${appUrl}/account?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=canceled`,
      // Always collect a card, including for the trial.
      payment_method_collection: "always",
      "metadata[typewit_price]": dayPass ? "typewit-day-pass-499-usd" : price,
      "metadata[user_id]": user.id,
    };
    if (dayPass) {
      delete params.payment_method_collection; // Payment mode already requires payment; this option is subscription-only.
      params["payment_intent_data[metadata][user_id]"] = user.id;
      params["payment_intent_data[metadata][typewit_offer]"] = "day_pass";
      params["invoice_creation[enabled]"] = "true";
      params.success_url = `${appUrl}/app/billing/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    } else {
      params["subscription_data[metadata][user_id]"] = user.id;
      if (trialAvailable) params["subscription_data[trial_period_days]"] = TRIAL_DAYS;
    }

    const session = await stripeRequest<{ url: string }>(
      secretKey,
      "checkout/sessions",
      params,
      checkoutFetch,
      `typewit-checkout-${lease}`,
    );
    return json({ url: session.url, trial: dayPass ? false : Boolean(trialAvailable) });
  } finally {
    // A stale request must never release a newer request's lease.
    const { error } = await db.from("billing_checkout_locks").delete().eq("user_id", user.id).eq("lease_id", lease);
    if (error) console.error("Checkout lock release failed", error.message);
  }
}

/** Enable fulfillment/refund delivery on our existing endpoint before accepting a pass payment.
 * Keep every existing subscription event and every other endpoint untouched.
 */
async function ensureDayPassEvents(secretKey: string, fetchFn: typeof fetch): Promise<void> {
  const expected = `${requireEnv("SUPABASE_URL").replace(/\/$/, "")}/functions/v1/stripe-webhook`;
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const result = await stripeGet<
      { data: { id: string; url: string; status: string; enabled_events: string[] }[]; has_more: boolean }
    >(secretKey, "webhook_endpoints", { limit: "100", ...(cursor ? { starting_after: cursor } : {}) }, fetchFn);
    const endpoint = result.data.find((e) => e.status === "enabled" && e.url.replace(/\/$/, "") === expected);
    if (endpoint) {
      const required = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "charge.refunded"];
      if (endpoint.enabled_events.includes("*") || required.every((event) => endpoint.enabled_events.includes(event))) {
        return;
      }
      const events = [...new Set([...endpoint.enabled_events, ...required])];
      await stripeRequest(
        secretKey,
        `webhook_endpoints/${endpoint.id}`,
        Object.fromEntries(events.map((event, i) => [`enabled_events[${i}]`, event])),
        fetchFn,
      );
      return;
    }
    if (!result.has_more || !result.data.length) break;
    cursor = result.data.at(-1)!.id;
  }
  throw new HttpError(503, "Day Pass checkout is temporarily unavailable. Please try again later.");
}

/** Read Stripe's paid session; never trust the success query string as payment. */
async function activatePass(userId: string, secretKey: string, req: Request): Promise<Response> {
  const { session_id } = await readJson<{ session_id?: unknown }>(req);
  if (typeof session_id !== "string" || !/^cs_[A-Za-z0-9_]{1,200}$/.test(session_id)) {
    throw new HttpError(400, "Choose a valid payment receipt.");
  }
  const db = adminClient();
  const { data: allowed, error } = await db.rpc("hit_rate_limit", {
    owner: userId,
    bucket_name: "day-pass-activation",
    max_hits: 20,
    window_seconds: 60,
  });
  if (error) throw new HttpError(503, "Payment verification is temporarily unavailable.");
  if (!allowed) throw new HttpError(429, "Please wait a moment before verifying payment again.");
  const session = await stripeGet<Record<string, unknown>>(secretKey, `checkout/sessions/${session_id}`);
  const metadata = session.metadata as Record<string, string> | undefined;
  if (metadata?.user_id !== userId || session.customer !== await customerFor(userId)) {
    throw new HttpError(404, "This payment was not found for your account.");
  }
  if (typeof session.payment_intent === "string") {
    const payment = await stripeGet<{ latest_charge?: { refunded?: boolean } | null }>(
      secretKey,
      `payment_intents/${session.payment_intent}`,
      { "expand[]": "latest_charge" },
    );
    if (payment.latest_charge?.refunded) {
      const { error: refundError } = await db.rpc("refund_day_pass", { intent: session.payment_intent });
      if (refundError) throw new HttpError(503, "Payment verification is temporarily unavailable.");
      throw new HttpError(409, "This Day Pass payment was refunded.");
    }
  }
  return json({ active: await grantDayPass(session, userId) });
}

async function createCustomer(
  user: { id: string; email: string | null },
  secretKey: string,
  fetchFn: typeof fetch = fetch,
  replacedCustomer?: string,
): Promise<string> {
  const replacementKey = replacedCustomer ? `-replace-${(await sha256Hex(replacedCustomer)).slice(0, 24)}` : "";
  const customer = await stripeRequest<{ id: string }>(
    secretKey,
    "customers",
    {
      email: user.email ?? "",
      "metadata[user_id]": user.id,
    },
    fetchFn,
    `typewit-customer-${user.id}-${(await sha256Hex(user.email ?? "")).slice(0, 24)}${replacementKey}`,
  );
  const { error } = await adminClient()
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return customer.id;
}

const PORTAL_FLOWS = [
  "payment_method_update",
  "subscription_cancel",
  "subscription_update",
  "switch_interval",
] as const;
type PortalFlow = typeof PORTAL_FLOWS[number];

async function customerFor(userId: string): Promise<string | null> {
  const { data: profile, error } = await adminClient()
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return profile?.stripe_customer_id ?? null;
}

interface StripeSubscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start?: number;
  current_period_end?: number;
  trial_end: number | null;
  default_payment_method: StripePaymentMethod | null;
  items: {
    data: {
      id: string;
      current_period_start?: number;
      current_period_end?: number;
      price: { id: string; unit_amount: number | null; currency: string; recurring: { interval: string } | null };
    }[];
  };
}

interface StripePrice {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string } | null;
}

/** Today's Pro price for an interval, from the same settings checkout uses. */
async function currentPrice(interval: string | null | undefined, secretKey: string): Promise<StripePrice | null> {
  const id = interval === "year"
    ? Deno.env.get("STRIPE_PRICE_YEARLY")
    : interval === "month"
    ? Deno.env.get("STRIPE_PRICE_MONTHLY")
    : undefined;
  return id ? await stripeGet<StripePrice>(secretKey, `prices/${id}`) : null;
}

interface StripePaymentMethod {
  type: string;
  card?: { brand: string; last4: string; exp_month: number; exp_year: number };
}

async function latestSubscription(customer: string, secretKey: string): Promise<StripeSubscription | null> {
  return preferredSubscription(await customerSubscriptions<StripeSubscription>(secretKey, customer, true));
}

async function portal(
  userId: string,
  secretKey: string,
  appUrl: string,
  req: Request,
  cancellationOnly = false,
): Promise<Response> {
  const customer = await customerFor(userId);
  if (!customer) throw new HttpError(404, "You don't have a billing account yet.");
  const body = req.headers.get("content-length") === "0"
    ? {}
    : await readJson<{ flow?: string }>(req).catch(() => ({}));
  const flow = cancellationOnly
    ? "subscription_cancel"
    : PORTAL_FLOWS.find((f) => f === (body as { flow?: string }).flow);
  const returnUrl = `${appUrl}/app/billing/manage/`;

  const params: Record<string, string> = { customer, return_url: returnUrl };
  if (flow) {
    params["flow_data[type]"] = flow === "switch_interval" ? "subscription_update_confirm" : flow;
    if (flow !== "payment_method_update") {
      // The subscription and the prices are looked up here, never taken from the request.
      const subscription = await latestSubscription(customer, secretKey);
      if (!subscription || subscription.status === "canceled") {
        throw new HttpError(409, "There's no subscription to change.");
      }
      if (flow === "switch_interval") {
        // Straight to Stripe's confirmation page for today's price on the other interval.
        const item = subscription.items.data[0];
        const other = await currentPrice(item?.price.recurring?.interval === "year" ? "month" : "year", secretKey);
        if (!item || !other) throw new HttpError(409, "There's no other plan to switch to.");
        params["flow_data[subscription_update_confirm][subscription]"] = subscription.id;
        params["flow_data[subscription_update_confirm][items][0][id]"] = item.id;
        params["flow_data[subscription_update_confirm][items][0][price]"] = other.id;
      } else {
        params[`flow_data[${flow}][subscription]`] = subscription.id;
      }
    }
    params["flow_data[after_completion][type]"] = "redirect";
    params["flow_data[after_completion][redirect][return_url]"] = returnUrl;
  }

  try {
    const session = await stripeRequest<{ url: string }>(secretKey, "billing_portal/sessions", params);
    return json({ url: session.url });
  } catch (error) {
    // A flow the portal isn't set up for: open the portal's home page instead.
    if (!flow || !(error instanceof StripeError)) throw error;
    if (cancellationOnly) {
      throw new HttpError(503, "Cancellation could not be opened. Please contact support to end your subscription.");
    }
    console.warn("Portal flow unavailable, opening the portal home", flow, error.message);
    const session = await stripeRequest<{ url: string }>(secretKey, "billing_portal/sessions", {
      customer,
      return_url: returnUrl,
    });
    return json({ url: session.url });
  }
}

/** The subscription, card and recent invoices for the Manage billing page. Card details are brand, last 4 and expiry only. */
async function summary(userId: string, secretKey: string): Promise<Response> {
  const customer = await customerFor(userId);
  if (!customer) return noStore({ subscription: null, card: null, invoices: [], email: null });

  const [subscription, customerRecord, invoices] = await Promise.all([
    latestSubscription(customer, secretKey),
    stripeGet<{ email: string | null; invoice_settings?: { default_payment_method: StripePaymentMethod | null } }>(
      secretKey,
      `customers/${customer}`,
      { "expand[]": "invoice_settings.default_payment_method" },
    ),
    stripeGet<{
      data: {
        id: string;
        number: string | null;
        created: number;
        amount_paid: number;
        total: number;
        currency: string;
        status: string | null;
        hosted_invoice_url: string | null;
        invoice_pdf: string | null;
        lines?: { data: { description: string | null }[] };
      }[];
    }>(secretKey, "invoices", { customer, limit: "5" }),
  ]);

  const item = subscription?.items.data[0];
  const today = subscription && subscription.status !== "canceled"
    ? await currentPrice(item?.price.recurring?.interval, secretKey)
    : null;
  const method = subscription?.default_payment_method ?? customerRecord.invoice_settings?.default_payment_method ??
    null;
  return noStore({
    email: customerRecord.email,
    subscription: subscription && {
      status: subscription.status,
      interval: item?.price.recurring?.interval ?? null,
      amount: item?.price.unit_amount ?? null,
      currency: item?.price.currency ?? "usd",
      period_start: subscription.current_period_start ?? item?.current_period_start ?? null,
      period_end: subscription.current_period_end ?? item?.current_period_end ?? null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end: subscription.trial_end,
    },
    current_price: today
      ? { amount: today.unit_amount, currency: today.currency, interval: today.recurring?.interval ?? null }
      : null,
    // On an older price that is higher than today's: offer the move.
    outdated_price: Boolean(
      today && item && item.price.id !== today.id && (today.unit_amount ?? 0) <= (item.price.unit_amount ?? 0),
    ),
    card: method?.card
      ? {
        brand: method.card.brand,
        last4: method.card.last4,
        exp_month: method.card.exp_month,
        exp_year: method.card.exp_year,
      }
      : null,
    invoices: invoices.data
      .filter((i) => i.status !== "draft")
      .map((i) => ({
        id: i.id,
        number: i.number,
        created: i.created,
        amount: i.status === "paid" ? i.amount_paid : i.total,
        currency: i.currency,
        status: i.status,
        description: i.lines?.data[0]?.description ?? null,
        url: i.hosted_invoice_url,
        pdf: i.invoice_pdf,
      })),
  });
}

/**
 * Moves the subscription to today's price for its interval. Only ever lowers the price; the
 * change applies from the next renewal (or the end of the trial) and nothing is charged now.
 */
async function reprice(userId: string, secretKey: string): Promise<Response> {
  const customer = await customerFor(userId);
  if (!customer) throw new HttpError(404, "You don't have a billing account yet.");
  const subscription = await latestSubscription(customer, secretKey);
  const item = subscription?.items.data[0];
  if (!subscription || !item || subscription.status === "canceled") {
    throw new HttpError(409, "There's no subscription to change.");
  }
  const today = await currentPrice(item.price.recurring?.interval, secretKey);
  if (!today || today.id === item.price.id) throw new HttpError(409, "You're already on today's price.");
  if ((today.unit_amount ?? 0) > (item.price.unit_amount ?? 0)) {
    throw new HttpError(409, "Your current price is already lower than today's, so it stays.");
  }
  await stripeRequest(secretKey, `subscriptions/${subscription.id}`, {
    "items[0][id]": item.id,
    "items[0][price]": today.id,
    proration_behavior: "none",
  });
  return await summary(userId, secretKey);
}

function noStore(body: unknown): Response {
  const res = json(body);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
