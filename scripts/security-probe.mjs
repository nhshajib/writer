import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const website = "https://typewit.com";
const functions = "https://jopggisumjlfitapkgjh.supabase.co/functions/v1";
async function probe(name, url, init, expected) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000), ...init });
  const body = await response.text();
  assert(expected.includes(response.status), `${name}: unexpected HTTP ${response.status}`);
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\\bsk_live_[A-Za-z0-9]{18,}/.test(body),
    `${name}: potential secret in response (redacted)`);
  console.log(JSON.stringify({ check: name, status: response.status, pass: true }));
  return response;
}
for (const path of ["/admin", "/dashboard/admin", "/wp-admin", "/.env", "/.env.local", "/.git/config"]) {
  await probe(path, website + path, {}, [403, 404]);
}
const home = await probe("homepage", website, {}, [200]);
assert.equal(home.headers.get("x-content-type-options"), "nosniff");
assert(home.headers.get("strict-transport-security")?.includes("max-age="));
assert(home.headers.get("content-security-policy")?.includes("frame-ancestors"));
assert(home.headers.get("referrer-policy"));
const fixture = "00000000-0000-4000-8000-000000000001";
for (const [path, body] of [
  ["/drips/" + fixture + "/pause", {}],
  ["/drips/" + fixture + "/engine", { op: "confirm", expected: 0, patch: { chunks_written: 1 } }],
  ["/billing/checkout", { interval: "day", price: 0, quantity: -1, role: "admin" }],
]) {
  await probe("unauthenticated " + path, functions + path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }, [401]);
}
await probe("forged Stripe event", functions + "/stripe-webhook", {
  method: "POST", headers: { "content-type": "application/json", "stripe-signature": "t=0,v1=invalid" },
  body: JSON.stringify({ id: "evt_security_fixture", type: "checkout.session.completed", data: { object: {} } }),
}, [400]);
await probe("worker requires tick secret", functions + "/drip-tick", {
  method: "POST", headers: { "content-type": "application/json" }, body: "{}",
}, [401, 403]);
const preflight = await probe("untrusted origin", functions + "/billing/checkout", {
  method: "OPTIONS", headers: { origin: "https://attacker.example.invalid", "access-control-request-method": "POST" },
}, [200, 204]);
assert.equal(preflight.headers.get("access-control-allow-origin"), null);

const files = execFileSync("git", ["ls-files", "-z"], { maxBuffer: 20 * 1024 * 1024 }).toString().split("\0").filter(Boolean);
const secretPattern = /\\b(?:sk_live_|sk_test_|rk_live_|whsec_|sb_secret_)[A-Za-z0-9]{18,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^:\\s"']+:[^@\\s"']+@/;
let scanned = 0;
for (const file of files) {
  if (!/\.(?:tsx?|sql|mjs|json|toml|ya?ml|md)$|(^|\/)\.env/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  assert(!secretPattern.test(text), `Potential committed secret in ${file}; rotate and investigate (value redacted).`);
  for (const token of text.match(/eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/g) ?? []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      assert(payload.role !== "service_role", `Service-role JWT in ${file} (value redacted).`);
    } catch (error) {
      if (error instanceof assert.AssertionError) throw error;
    }
  }
  scanned++;
}
const historicalEnv = execFileSync("git", [
  "log", "--all", "--format=", "--name-only", "--", ".env*", "**/.env*",
], { maxBuffer: 20 * 1024 * 1024 }).toString().split("\n").filter(Boolean);
assert(historicalEnv.every(path => path.endsWith(".example")), "Non-example .env file in Git history; investigate/rotate.");
console.log(JSON.stringify({ check: "source and env history scan", files: scanned, pass: true }));
