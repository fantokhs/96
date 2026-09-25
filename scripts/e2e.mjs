// End-to-end check of the V1 success scenario with real browsers:
// host + TV + 4 phones. Run against a running server:
//   npm run build && npm start   (in another terminal)
//   BASE_URL=http://localhost:3000 npm run test:e2e
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require(`${execSync("npm root -g").toString().trim()}/playwright`);
}
const { chromium, devices } = pw;

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "test-results";
mkdirSync(SHOTS, { recursive: true });

const log = (...a) => console.log("•", ...a);
const fail = (m) => {
  throw new Error(m);
};

const browser = await chromium.launch();
const tvCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const hostCtx = await browser.newContext({ viewport: { width: 430, height: 932 } });
const tv = await tvCtx.newPage();
const host = await hostCtx.newPage();

// 1. Host creates game (defaults: الصقور vs الذيابة, 10 questions)
await host.goto(`${BASE}/admin`);
await host.getByRole("button", { name: "10 أسئلة" }).click(); // V1.6 default is 15
await host.getByText("إنشاء الجلسة").click();
await host.waitForURL(/\/control\/[A-Z0-9]{4}$/);
const code = host.url().split("/").pop();
log("session", code);
await host.getByText("ابدأ اللعبة").waitFor();

// 2. TV opens, QR appears
await tv.goto(`${BASE}/screen/${code}`);
await tv.getByText("ابدأ العرض").click();
await tv.locator("svg").filter({ has: tv.locator("path") }).first().waitFor();
if (!(await tv.getByText(code, { exact: true }).isVisible())) fail("TV lobby has no code");
log("TV lobby with QR ✓");

// 3. Four players join from phones, 2 per team
const phones = [];
const names = [
  ["سارة", "الصقور"],
  ["فهد", "الصقور"],
  ["نورة", "الذيابة"],
  ["خالد", "الذيابة"],
];
for (const [name, team] of names) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/${code}`);
  await page.getByPlaceholder("اكتب اسمك").fill(name);
  if (name === "سارة") {
    // upload a small generated photo
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC",
      "base64",
    );
    await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
    await page.getByText("إزالة الصورة").waitFor();
    await page.getByText("👩 أنثى").click();
  }
  await page.getByRole("button", { name: team, exact: true }).click();
  await page.getByText("ادخل اللعبة").click();
  await page.getByText(`أهلاً ${name}!`).waitFor();
  phones.push({ name, team, page, ctx });
}
for (const [name] of names) await tv.getByText(name).first().waitFor();
await tv.screenshot({ path: `${SHOTS}/01-tv-lobby.png` });
await phones[0].page.screenshot({ path: `${SHOTS}/02-phone-lobby.png` });
log("4 players joined, visible on TV ✓");

const score = async (team) => {
  const txt = await host.locator(".panel", { hasText: team }).first().locator(".num").first().textContent();
  return Number(txt);
};
// Screens sync independently (each re-fetches after a ping), so wait for the value.
const expectScore = async (team, want, ms = 8000) => {
  const end = Date.now() + ms;
  let got;
  while (Date.now() < end) {
    got = await score(team);
    if (got === want) return;
    await host.waitForTimeout(150);
  }
  fail(`${team}: expected ${want}, got ${got}`);
};

// 4. Start → الصقور vote
await host.getByText("ابدأ اللعبة").click();
await phones[0].page.getByText("صوّت للفئة").waitFor();
await phones[2].page.getByText("يختارون الفئة").waitFor();
await tv.screenshot({ path: `${SHOTS}/03-tv-vote.png` });
await phones[0].page.screenshot({ path: `${SHOTS}/04-phone-vote.png` });
for (const ph of phones.slice(0, 2)) await ph.page.getByRole("button", { name: /^من هو؟/ }).click();
await tv.getByText("اختاروا الكرت").waitFor();
log("vote → winning category ✓");
await tv.waitForTimeout(700);
await tv.screenshot({ path: `${SHOTS}/05-tv-cards.png` });

// 5. Team picks card 4 → flip → question + timer; host sees answer
await phones[1].page.getByRole("button", { name: "4", exact: true }).click();
await host.getByText("الإجابة (لك فقط)").waitFor();
const answer1 = await host.locator(".text-goldlight").filter({ hasText: /.+/ }).last().textContent();
await tv.waitForTimeout(1200);
if (await tv.getByText(answer1, { exact: true }).count()) fail("answer leaked on TV");
await tv.screenshot({ path: `${SHOTS}/06-tv-question.png` });
await host.screenshot({ path: `${SHOTS}/07-host-question.png` });
log("card flipped, question on TV, answer only on host ✓");

// 6. Host marks correct → +100
await host.getByText("✓ إجابة صحيحة").click();
await tv.getByText("+100").first().waitFor();
await tv.waitForTimeout(900);
await tv.screenshot({ path: `${SHOTS}/08-tv-correct.png` });
await expectScore("الصقور", 100);
log("الصقور +100 ✓");

// 7. Auto-advance → الذيابة. They vote سعودي وبس (all multiple-choice), pick a card, answer wrong
await phones[2].page.getByText("صوّت للفئة").waitFor({ timeout: 15000 });
for (const ph of phones.slice(2)) await ph.page.getByRole("button", { name: /^سعودي وبس/ }).click();
await phones[2].page.getByRole("button", { name: "1", exact: true }).click();
await host.getByText("الإجابة (لك فقط)").waitFor();
const answer2 = (await host.locator(".rounded-2xl.border-2 .text-goldlight").textContent()).trim();
await phones[2].page.locator("button:has(span.rounded-full.bg-deep)").first().waitFor();
const options = await phones[2].page.locator("button:has(span.rounded-full.bg-deep)").allTextContents();
const wrongIdx = options.findIndex((o) => !o.endsWith(answer2));
// team consensus: one vote is not the team answer; the 2nd matching vote locks it
await phones[2].page.locator("button:has(span.rounded-full.bg-deep)").nth(wrongIdx).click();
await phones[2].page.getByText("صوّت 1 من 2").waitFor();
if (await host.getByText("اختاروا إجابة خاطئة").count()) fail("single vote locked the team answer");
await phones[3].page.locator("button:has(span.rounded-full.bg-deep)").nth(wrongIdx).click();
await host.getByText("اختاروا إجابة خاطئة").waitFor();
await tv.screenshot({ path: `${SHOTS}/09-tv-wrong.png` });
log("الذيابة answered wrong ✓");

// 8. Host activates steal → الصقور steals from phone → +50
await host.getByText("⚡ سرقة ← الصقور").click();
await tv.getByText("سرقة!").first().waitFor();
await phones[0].page.getByText("فرصة سرقة").waitFor();
await tv.screenshot({ path: `${SHOTS}/10-tv-steal.png` });
await phones[0].page.locator("button:has(span.rounded-full.bg-deep)", { hasText: answer2 }).click();
await phones[1].page.getByText("فرصة سرقة").first().waitFor();
await phones[1].page.locator("button:has(span.rounded-full.bg-deep)", { hasText: answer2 }).click();
try {
  await tv.getByText("+50").first().waitFor({ timeout: 8000 });
} catch (e) {
  await tv.screenshot({ path: `${SHOTS}/fail-tv.png` });
  await phones[0].page.screenshot({ path: `${SHOTS}/fail-phone.png` });
  await host.screenshot({ path: `${SHOTS}/fail-host.png` });
  console.log("answer2=", answer2, "options=", options, "wrongIdx=", wrongIdx);
  throw e;
}
await expectScore("الصقور", 150);
await expectScore("الذيابة", 0);
log("steal +50 → الصقور 150 ✓");

// 9. Refresh TV mid-game → state restored
await host.getByText("التالي ←").click();
await tv.reload();
await tv.getByText("ابدأ العرض").click();
await tv.getByText("150").first().waitFor();
log("TV refresh restores state ✓");

// 10. Refresh a phone → same player
await phones[1].page.reload();
await phones[1].page.getByText("فهد").first().waitFor();
if (await phones[1].page.getByPlaceholder("اكتب اسمك").count()) fail("phone lost identity");
log("phone refresh keeps player ✓");

// 11. Play out remaining questions from the host console
let guard = 0;
while (guard++ < 40) {
  const label = await host.locator("header .text-sm").first().textContent();
  if (label.includes("انتهت اللعبة")) break;
  if (await host.getByText("اختيار الفئة يدوياً").isVisible().catch(() => false)) {
    await host.locator("section.panel button.rounded-xl").first().click();
  } else if (await host.getByText("أو اختر عنهم").isVisible().catch(() => false)) {
    await host.locator("section.panel button.aspect-\\[5\\/6\\]:not([disabled])").first().click();
  } else if (await host.getByText("✓ إجابة صحيحة").isVisible().catch(() => false)) {
    // alternate: الذيابة get their points too
    await host.getByText("✓ إجابة صحيحة").click();
  } else if (await host.getByText("التالي ←").isVisible().catch(() => false)) {
    await host.getByText("التالي ←").click();
  }
  await host.waitForTimeout(250);
}

// 12. Winner screen
await tv.getByText("الفائز", { exact: true }).waitFor({ timeout: 15000 });
await tv.waitForTimeout(1500);
await tv.screenshot({ path: `${SHOTS}/11-tv-winner.png` });
await phones[0].page.screenshot({ path: `${SHOTS}/12-phone-over.png` });
// 10 questions: Q1 100 (الصقور), Q2 steal 50 (الصقور), Q3–Q10 all correct at 100 alternating starting with الصقور
await expectScore("الصقور", 150 + 4 * 100);
await expectScore("الذيابة", 4 * 100);
const s1 = await score("الصقور");
const s2 = await score("الذيابة");
const winnerText = await tv.locator(".anim-pop").first().textContent();
if (!winnerText.includes("الصقور")) fail("wrong winner on TV");
log(`winner screen ✓ — الصقور ${s1} / الذيابة ${s2}`);

await browser.close();
console.log("\nE2E: success scenario passed ✓");
