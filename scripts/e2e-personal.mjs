// V1.5/V1.6 «وش تعرف عنه؟ 👀» end-to-end: questionnaire → host readiness → personal question in play.
//   BASE_URL=http://localhost:3000 node scripts/e2e-personal.mjs
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
const post = (p, b) => fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());

const browser = await chromium.launch();
const laptop = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await laptop.goto(`${BASE}/admin`);
await laptop.getByText("وش تعرف عنه؟ 👀").first().waitFor();
await laptop.getByText("إنشاء الجلسة").click();
await laptop.waitForURL(/\/control\/[A-Z0-9]{4}$/);
const code = laptop.url().split("/").pop();
log("session", code);

// ─── One phone fills for three people ───────────────────────────────────────
const phoneA = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
await phoneA.goto(`${BASE}/know/${code}`);
await phoneA.getByText("وش تعرف عنكم العائلة؟").waitFor();
await phoneA.screenshot({ path: `${SHOTS}/k1-home.png` });

async function fill(page, answers) {
  try { return await fill0(page, answers); } catch (e) { await page.screenshot({ path: `${SHOTS}/fail-fill.png` }); throw e; }
}
async function fill0(page, answers) {
  for (const a of answers) {
    const input = page.locator("input.field").first();
    await input.waitFor();
    if (a === null) await page.getByRole("button", { name: "تخطي" }).click();
    else {
      await input.fill(a);
      await page.getByRole("button", { name: "التالي" }).click();
    }
  }
}
async function sendNow(page, name) {
  await page.getByRole("button", { name: "إرسال الآن" }).click();
  await page.getByText(`حفظنا معلومات`).waitFor();
  if (!(await page.getByText(name).first().isVisible())) fail(`done screen missing ${name}`);
}

await phoneA.getByRole("button", { name: "بعبي عن نفسي" }).click();
await phoneA.locator("#kname").fill("عزيز");
await phoneA.getByRole("button", { name: "يلا نبدأ" }).click();
await phoneA.getByText("وش أكثر أكلة تحبها؟").waitFor(); // self wording
await fill(phoneA, ["شاورما", "أزرق", "اليابان"]);
await phoneA.screenshot({ path: `${SHOTS}/k2-question.png` });
await sendNow(phoneA, "عزيز");
await phoneA.screenshot({ path: `${SHOTS}/k3-done.png` });

await phoneA.getByRole("button", { name: "أضف شخص ثاني" }).click();
await phoneA.getByRole("button", { name: "بعبي عن أحد" }).click();
await phoneA.locator("#kname").fill("منيرة");
await phoneA.getByRole("button", { name: "ابدأ" }).click();
await phoneA.getByText("وش أكلة منيرة المفضلة؟").waitFor(); // other-person wording
await fill(phoneA, ["سوشي"]);
await sendNow(phoneA, "منيرة");

await phoneA.getByRole("link", { name: /انضم للعبة/ }).waitFor(); // V1.6 primary CTA → /play
await phoneA.getByRole("button", { name: "بعبي عن أحد" }).click();
await phoneA.locator("#kname").fill("محمد");
await phoneA.getByRole("button", { name: "ابدأ" }).click();
await phoneA.getByText("وش أكلة محمد المفضلة؟").waitFor(); // name check is async — wait for the first question
await fill(phoneA, ["كبسة", "أسود", "دبي", "الزحمة", "السفر", "شاي", null, "القهوة", "العطور", "النوم", "كنافة"]);
await sendNow(phoneA, "محمد");
const playHref = await phoneA.getByRole("link", { name: /انضم للعبة/ }).getAttribute("href");
if (playHref !== `/play/${code}`) fail(`join CTA → ${playHref}`);
await phoneA.getByRole("button", { name: "أضف شخص ثاني" }).click();
for (const n of ["عزيز", "منيرة", "محمد"]) await phoneA.getByText("عبّيت عن").locator("..").getByText(n).waitFor();
log("one phone → 3 profiles (3, 1, 10 answers) ✓");

// ─── Another device adds to the same person ─────────────────────────────────
const phoneB = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
await phoneB.goto(`${BASE}/know/${code}`);
await phoneB.getByRole("button", { name: "بعبي عن أحد" }).click();
await phoneB.locator("#kname").fill(" عزيز ");
await phoneB.getByRole("button", { name: "ابدأ" }).click();
await phoneB.getByText("عزيز موجود مسبقاً").waitFor();
await phoneB.screenshot({ path: `${SHOTS}/k4-exists.png` });
await phoneB.getByRole("button", { name: "أكمل معلوماته" }).click();
// food / color / travel already answered → first question is a missing one
await phoneB.getByText("وش أكثر شيء ينرفز عزيز؟").waitFor();
await fill(phoneB, ["التأخير"]);
await sendNow(phoneB, "عزيز");
log("second device merged into existing عزيز (only missing questions asked) ✓");

// ─── A 4th person via API for readiness, then the host panel ───────────────
await post(`/api/know/${code}`, { action: "submit", name: "هلا", mode: "other", answers: { favorite_food: "فول", favorite_color: "أبيض", travel_destination: "باريس" }, custom: [], nonce: "hala-1" });
await laptop.reload();
await laptop.getByText("الأشخاص:").first().waitFor();
await laptop.getByText("سؤال جاهز").first().waitFor({ timeout: 10000 });
await laptop.screenshot({ path: `${SHOTS}/k5-host.png`, fullPage: true });
const sum = await (await fetch(`${BASE}/api/know/${code}/host`, { headers: { "x-host-token": "9696" } })).json();
if (sum.total !== 4 || !sum.ready) fail(`host summary ${JSON.stringify({ total: sum.total, ready: sum.ready })}`);
log(`host panel: ${sum.total} people, ${sum.count} ready questions ✓`);
if (sum.profiles.find((p) => p.name === "عزيز").answers.length !== 4) fail("Aziz should have 4 fields after merge");

// ─── Play it ────────────────────────────────────────────────────────────────
const tv = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await tv.goto(`${BASE}/screen/${code}`);
await tv.getByText("ابدأ العرض").click();
const phones = [];
for (const [name, team] of [["عزيز", "الصقور"], ["سارة", "الصقور"], ["نورة", "الذيابة"]]) {
  const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await page.goto(`${BASE}/play/${code}`);
  await page.getByPlaceholder("اكتب اسمك").fill(name);
  await page.getByRole("button", { name: team, exact: true }).click();
  await page.getByText("ادخل اللعبة").click();
  await page.getByText(`أهلاً ${name}!`).waitFor();
  phones.push(page);
}
await laptop.getByRole("button", { name: "ابدأ اللعبة" }).click();
for (const ph of phones.slice(0, 2)) await ph.getByRole("button", { name: /^وش تعرف عنه/ }).click();
await phones[0].getByText("اختر كرت").waitFor();
await phones[0].getByRole("button", { name: "1", exact: true }).click();
await laptop.getByText("الإجابة (لك فقط)").waitFor();
const st = await (await fetch(`${BASE}/api/sessions/${code}`)).json();
const q = st.phase.question;
if (!q.about) fail("expected a personal question");
if (q.about.name === "عزيز") fail("team الصقور (with عزيز) got a question about عزيز");
log(`personal question: «${q.question}» (about ${q.about.name}, not own team) ✓`);
const answer = (await laptop.locator(".rounded-2xl.border-2 .text-goldlight").textContent()).trim();
const correct = q.options.indexOf(answer);
const wrong = (correct + 1) % q.options.length;
const opts = (p) => p.locator("button:has(span.rounded-full.bg-deep)");
await opts(phones[0]).nth(wrong).click(); // after 3-2-1 (click waits until enabled)
await phones[0].getByText("صوّت 1 من 2").waitFor();
await tv.screenshot({ path: `${SHOTS}/k6-tv-question.png` });
await opts(phones[1]).nth(correct).click();
await opts(phones[0]).nth(correct).click(); // change vote → majority
await tv.getByText(`«${answer}»`).waitFor();
await tv.waitForTimeout(700);
await tv.screenshot({ path: `${SHOTS}/k7-tv-reveal.png` });
log("team consensus locked the answer; TV reveal shows the real answer ✓");

// undo, then host marks it again
await laptop.getByText("أدوات المضيف").click();
await laptop.getByText("تراجع عن آخر حركة").click();
await laptop.getByText("الإجابة (لك فقط)").waitFor();
let s2 = await (await fetch(`${BASE}/api/sessions/${code}`)).json();
if (s2.teams[0].score !== 0) fail("undo should revert the score");
await laptop.getByText("✓ إجابة صحيحة").click();
await laptop.getByText("التالي ←").click();

// الذيابة (1 player): wrong → steal by الصقور
await phones[2].getByText("صوّت للفئة").waitFor({ timeout: 15000 });
await phones[2].getByRole("button", { name: /^وش تعرف عنه/ }).click();
await phones[2].getByText("اختر كرت").waitFor();
await phones[2].getByRole("button", { name: "2", exact: true }).click();
await laptop.getByText("الإجابة (لك فقط)").waitFor();
const q2 = (await (await fetch(`${BASE}/api/sessions/${code}`)).json()).phase.question;
const a2 = (await laptop.locator(".rounded-2xl.border-2 .text-goldlight").textContent()).trim();
if (q2.options) {
  const c2 = q2.options.indexOf(a2);
  await opts(phones[2]).nth((c2 + 1) % q2.options.length).click();
  await laptop.getByText("اختاروا إجابة خاطئة").waitFor();
  await laptop.getByText("⚡ سرقة ← الصقور").click();
  for (const ph of phones.slice(0, 2)) await opts(ph).nth(c2).click();
} else {
  await laptop.getByText("⚡ سرقة ← الصقور").click();
  await laptop.getByText("✓ إجابة صحيحة").click();
}
await tv.getByText("+50").first().waitFor({ timeout: 8000 });
s2 = await (await fetch(`${BASE}/api/sessions/${code}`)).json();
if (s2.teams[0].score !== 150 || s2.teams[1].score !== 0) fail(`scores ${s2.teams.map((t) => t.score)}`);
log("steal on a personal question: الصقور 150 / الذيابة 0 ✓");

// global content untouched
const health = await (await fetch(`${BASE}/api/health`)).json();
if (health.questions !== 130 || health.categories !== 11) fail(`global counts changed ${health.questions}/${health.categories}`);
log(`global content untouched: ${health.categories} categories / ${health.questions} questions ✓`);

await browser.close();
console.log("\nE2E personal: passed ✓");
