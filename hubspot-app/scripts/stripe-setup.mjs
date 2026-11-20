#!/usr/bin/env node
// Creates the Stripe product + monthly per-location price, and (optionally) the
// webhook endpoint, then prints the values to paste into .env.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs [--amount 25] [--currency usd] [--webhook-url https://api.example.com/billing/webhook]
//
// Test keys only unless you pass --live.

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const key = process.env.STRIPE_SECRET_KEY;
if (!key) exit("Set STRIPE_SECRET_KEY first (a test key starts with sk_test_).");
if (key.startsWith("sk_live_") && !args.includes("--live")) exit("That is a LIVE key. Use a test key, or pass --live if you really mean it.");

const amount = Number(flag("amount", "25"));
if (!Number.isFinite(amount) || amount <= 0) exit("Pass the monthly price per location, e.g. --amount 25");
const currency = flag("currency", "usd");

const form = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    Array.isArray(v)
      ? v.map((item, i) => form({ [i]: item }, prefix ? `${prefix}[${k}]` : k)).flat()
      : v && typeof v === "object"
        ? form(v, prefix ? `${prefix}[${k}]` : k)
        : [`${encodeURIComponent(prefix ? `${prefix}[${k}]` : k)}=${encodeURIComponent(v)}`],
  );

async function stripe(path, body) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form(body).join("&"),
  });
  const json = await res.json();
  if (!res.ok) exit(`Stripe said: ${json.error?.message ?? res.status}`);
  return json;
}

const product = await stripe("/products", { name: "ReviewTune (per location)" });
const price = await stripe("/prices", {
  product: product.id,
  unit_amount: Math.round(amount * 100),
  currency,
  recurring: { interval: "month" },
});
console.log(`\nSTRIPE_PRICE_ID=${price.id}`);

const webhookUrl = flag("webhook-url");
if (webhookUrl) {
  const hook = await stripe("/webhook_endpoints", {
    url: webhookUrl,
    enabled_events: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
      "invoice.paid",
    ],
  });
  console.log(`STRIPE_WEBHOOK_SECRET=${hook.secret}`);
} else {
  console.log("STRIPE_WEBHOOK_SECRET=  (run `stripe listen --forward-to localhost:4020/billing/webhook` and copy the whsec_ it prints)");
}
console.log("\nThen set STRIPE_SECRET_KEY and BILLING_ENFORCED=true in hubspot-app/.env and restart the API.");

function exit(message) {
  console.error(message);
  process.exit(1);
}
