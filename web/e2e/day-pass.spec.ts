import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fillNewSession, toStep } from "./helpers";
const SESSION = { access_token: "e2e-token", refresh_token: "e2e-refresh", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now()/1000)+86400, user: { id: "u1", aud: "authenticated", role: "authenticated", email: "fixture@example.invalid", user_metadata: {}, app_metadata: { provider: "email", providers: ["email"] } } };
test.beforeEach(async ({page,request}) => {
  await request.post("/__test/reset");
  await page.addInitScript(s=>localStorage.setItem("sb-localhost-auth-token",JSON.stringify(s)),SESSION);
});
test("Day Pass shows its expiry, keeps advanced Pro features gated and sends writing hours", async ({page,request}) => {
  await request.post("/__test/profile",{data:{plan:"free",subscription_status:null,day_pass_expires_at:new Date(Date.now()+86400000).toISOString()}});
  await page.goto("/app/billing/");
  await expect(page.getByText("Day Pass",{exact:true}).first()).toBeVisible();
  await expect(page.getByText(/Expires .*no renewal/)).toBeVisible();
  await page.goto("/app/new/");
  await fillNewSession(page,{title:"Window fixture",text:"First approved sentence. Second approved sentence.",atTiming:async()=>{
    await page.getByLabel("Write only during chosen hours").check();
    await page.getByLabel("Writing time zone",{exact:true}).fill("UTC");
    await page.getByLabel("Write from",{exact:true}).fill("00:00");
    await page.getByLabel("Write until",{exact:true}).fill("23:59");
    await expect(page.getByLabel("Final revision pass (Pro)",{exact:true})).toBeDisabled();
  }});
  await page.getByRole("button",{name:"Start session",exact:true}).click();
  await page.waitForURL(/\/app\/session\/?\?id=/);
  const { requests }=await (await request.get("/__test/requests")).json();
  const created=requests.find((r:{method:string;path:string})=>r.method==="POST"&&r.path==="/functions/v1/drips");
  expect(created.body.work_window).toEqual({start:"00:00",end:"23:59",time_zone:"UTC"});
  expect(created.body.revision_sweep).toBe(false);
});
test("Pro approves final revisions and replays only confirmed actions without document writes", async ({page,request})=>{
  await page.goto("/app/new/");
  await fillNewSession(page,{title:"Replay fixture",text:"Approved sentence. Final sentence.",atTiming:async()=>{
    await page.getByLabel("Final revision pass (Pro)",{exact:true}).check();
  }});
  await expect(page.getByText(/I also approve the enabled simulated mistakes/)).toBeVisible();
  await page.getByRole("button",{name:"Start session",exact:true}).click();
  await page.waitForURL(/\/app\/session\/?\?id=/);
  const id=new URL(page.url()).searchParams.get("id");
  await request.post("/__test/advance",{data:{id,written:100000}});
  await page.reload();
  const beforeReplay=await (await request.get("/__test/requests")).json();
  expect(beforeReplay.requests.filter((r:{path:string})=>/\/playback$/.test(r.path))).toHaveLength(0);
  await page.getByRole("tab",{name:"Playback",exact:true}).click();
  await expect(page.getByText(/does not edit your document/)).toBeVisible();
  const slider=page.getByRole("slider");
  await slider.focus();
  await slider.press("End");
  await expect(page.getByLabel("Session playback text",{exact:true})).toHaveText("Approved sentence. Final sentence.");
  const { requests }=await (await request.get("/__test/requests")).json();
  expect(requests.filter((r:{method:string;path:string})=>r.method==="POST"&&/\/engine$/.test(r.path))).toHaveLength(0);
});
test("Free mobile keeps work hours gated and pricing exposes the nonrenewing $4.99 offer", async ({page,request})=>{
  await request.post("/__test/profile",{data:{plan:"free",subscription_status:null}});
  await page.setViewportSize({width:390,height:844});
  await page.goto("/app/new/");
  await toStep(page,4);
  await expect(page.getByLabel("Write only during chosen hours")).toBeDisabled();
  await expect(page.getByLabel("Final revision pass (Pro)",{exact:true})).toBeDisabled();
  await page.goto("/pricing/");
  await expect(page.getByText("$4.99",{exact:true}).first()).toBeVisible();
  await expect(page.getByText(/no renewal/i).first()).toBeVisible();
  await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished)));
  expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa"]).analyze()).violations).toEqual([]);
});
