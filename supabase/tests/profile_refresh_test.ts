import { assertEquals } from "jsr:@std/assert@1.0.13";
import { ProfileRefreshGuard } from "../../web/lib/profileRefresh.ts";

interface Profile {
  email: boolean;
  age: string | null;
  plan: string;
}
const initial: Profile = { email: true, age: null, plan: "pro" };

Deno.test("profile refresh: JSONB key order retires confirmed defaults and later device changes are accepted", () => {
  interface Settings {
    defaults: { rhythm: string; minutes: number; nested: { enabled: boolean; amount: number } };
  }
  const guard = new ProfileRefreshGuard<Settings>(["defaults"]);
  guard.record({ defaults: { rhythm: "natural", minutes: 45, nested: { enabled: true, amount: 1 } } });
  const echoed: Settings = { defaults: { minutes: 45, nested: { amount: 1, enabled: true }, rhythm: "natural" } };
  assertEquals(guard.accept(echoed, guard.begin()), echoed);
  const otherDevice: Settings = { defaults: { rhythm: "steady", minutes: 30, nested: { amount: 2, enabled: false } } };
  assertEquals(guard.accept(otherDevice, guard.begin()), otherDevice);
});

Deno.test("profile refresh: old snapshots cannot undo saved preferences or confirmed onboarding", () => {
  const guard = new ProfileRefreshGuard<Profile>(["email", "age"]);
  const old = guard.begin();
  guard.record({ email: false, age: "confirmed", plan: "pro" });
  assertEquals(guard.accept({ ...initial, plan: "free" }, old), {
    email: false,
    age: "confirmed",
    plan: "free",
  });
  const fresh = guard.begin();
  const server = { email: false, age: "confirmed", plan: "free" };
  assertEquals(guard.accept(server, fresh), server);
  assertEquals(guard.accept(initial, old), null);
  assertEquals(guard.accept({ ...server, email: true }, guard.begin())?.email, true);
});

Deno.test("profile refresh: failed saves can roll back and account switches invalidate old reads", () => {
  const guard = new ProfileRefreshGuard<Profile>(["email", "age"]);
  guard.record({ email: false });
  const inFlight = guard.begin();
  guard.record({ email: true });
  assertEquals(guard.accept({ ...initial, email: false }, inFlight)?.email, true);
  const previousAccount = guard.begin();
  guard.reset();
  assertEquals(guard.accept(initial, previousAccount), null);
  assertEquals(guard.accept({ ...initial, email: false }, guard.begin())?.email, false);
});
