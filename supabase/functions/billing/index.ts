// Stripe billing for signed-in users.
//
//   POST /billing/checkout   { interval: "month" | "year" }  ->  { url }
//   POST /billing/portal     { flow?: PortalFlow }           ->  { url }
//   POST /billing/summary                                    ->  { subscription, card, invoices, email }
//
// Checkout starts a Pro subscription. The 7-day trial (card required) is only
// offered if this person's normalized email has never claimed one.

import { requireUser } from "../_shared/auth.ts";
import { adminClient, requireEnv } from "../_shared/env.ts";
import { HttpError, json, readJson, serve } from "../_shared/http.ts";
import { StripeError, stripeGet, stripeRequest } from "../_shared/stripe.ts";

const TRIAL_DAYS = "7";
const ADULT_AGE = 18;

/** Whole years from a month and year of birth; a birthday this month counts as not reached (as in public.age_from). */
function ageFrom(year: number, month: number, now = new Date()): number {
  return now.getUTCFullYear() - year - (now.getUTCMonth() + 1 <= month ? 1 : 0);
}

serve(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed.");
  const user = await requireUser(req);
  const action = new URL(req.url).pathname.split("/").filter(Boolean).pop();

  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new HttpError(503, "Payments are not configured yet.");
  const appUrl = requireEnv("APP_URL").replace(/\/$/, "");

  try {
    if (action === "checkout") return await checkout(user, secretKey, appUrl, req);
    if (action === "portal") return await portal(user.id, secretKey, appUrl, req);
    if (action === "summary") return await summary(user.id, secretKey);
  } catch (error) {
    if (error instanceof StripeError) {
      console.error("Stripe error", error.status, error.message);
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
    : null;
  if (!price) throw new HttpError(400, 'interval must be "month" or "year".');
  if (!user.email) throw new HttpError(400, "Your account has no email address.");

  const db = adminClient();
  const { data: profile, error } = await db
    .from("profiles")
    .select("stripe_customer_id, subscription_status, age_confirmed_at, birth_year, birth_month")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
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
  if (profile?.subscription_status === "active" || profile?.subscription_status === "trialing") {
    throw new HttpError(409, "You already have Pro. Use “Manage billing” to change your plan.");
  }

  const customerId = profile?.stripe_customer_id ?? await createCustomer(user, secretKey);

  const { data: trialAvailable, error: trialError } = await db.rpc("trial_available", { email: user.email });
  if (trialError) throw new Error(trialError.message);

  const params: Record<string, string> = {
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl}/account?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=canceled`,
    // Always collect a card, including for the trial.
    payment_method_collection: "always",
    "subscription_data[metadata][user_id]": user.id,
  };
  if (trialAvailable) params["subscription_data[trial_period_days]"] = TRIAL_DAYS;

  const session = await stripeRequest<{ url: string }>(secretKey, "checkout/sessions", params);
  return json({ url: session.url, trial: Boolean(trialAvailable) });
}

async function createCustomer(user: { id: string; email: string | null }, secretKey: string): Promise<string> {
  const customer = await stripeRequest<{ id: string }>(secretKey, "customers", {
    email: user.email ?? "",
    "metadata[user_id]": user.id,
  });
  const { error } = await adminClient()
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return customer.id;
}

const PORTAL_FLOWS = ["payment_method_update", "subscription_cancel", "subscription_update"] as const;
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
      current_period_start?: number;
      current_period_end?: number;
      price: { unit_amount: number | null; currency: string; recurring: { interval: string } | null };
    }[];
  };
}

interface StripePaymentMethod {
  type: string;
  card?: { brand: string; last4: string; exp_month: number; exp_year: number };
}

async function latestSubscription(customer: string, secretKey: string): Promise<StripeSubscription | null> {
  const list = await stripeGet<{ data: StripeSubscription[] }>(secretKey, "subscriptions", {
    customer,
    status: "all",
    limit: "1",
    "expand[]": "data.default_payment_method",
  });
  return list.data[0] ?? null;
}

async function portal(userId: string, secretKey: string, appUrl: string, req: Request): Promise<Response> {
  const customer = await customerFor(userId);
  if (!customer) throw new HttpError(404, "You don't have a billing account yet.");
  const body = req.headers.get("content-length") === "0"
    ? {}
    : await readJson<{ flow?: string }>(req).catch(() => ({}));
  const flow = PORTAL_FLOWS.find((f) => f === (body as { flow?: string }).flow);
  const returnUrl = `${appUrl}/app/billing/manage/`;

  const params: Record<string, string> = { customer, return_url: returnUrl };
  if (flow) {
    params["flow_data[type]"] = flow;
    if (flow !== "payment_method_update") {
      // The subscription is looked up here, never taken from the request.
      const subscription = await latestSubscription(customer, secretKey);
      if (!subscription || subscription.status === "canceled") {
        throw new HttpError(409, "There's no subscription to change.");
      }
      params[`flow_data[${flow}][subscription]`] = subscription.id;
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

function noStore(body: unknown): Response {
  const res = json(body);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
