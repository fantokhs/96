// V1.6 end-to-end: simplified setup, early draft + share, universal /join, TV/control access,
// resume / restart / replay on the same code, recent-games dropdown.
//   BASE_URL=http://localhost:3000 node scripts/e2e-v16.mjs
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
const post = (p, b, h = {}) =>
  fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const state = (code) => fetch(`${BASE}/api/sessions/${code}`).then((r) => r.json());
const hostAct = (code, action) => post(`/api/sessions/${code}/act`, { role: "host", token: "9696", action });

const browser = await chromium.launch();
const laptop = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();

// ─── 1. Simplified setup ────────────────────────────────────────────────────
await laptop.goto(`${BASE}/admin`);
await laptop.getByText("وش تعرف عنه؟ 👀").first().waitFor();
for (const gone of ["الثيم", "3 فرق", "أول فريق يوصل", "تصويت الفئة", "الوقت والنقاط"]) {
  if ((await laptop.getByText(gone).count()) > 0) fail(`setup still shows «${gone}»`);
}
if ((await laptop.getByLabel(/اسم الفريق/).count()) !== 2) fail("expected exactly 2 team-name inputs");
for (const n of ["10 أسئلة", "16 سؤال", "22 سؤال"]) await laptop.getByRole("button", { name: n, exact: true }).waitFor();
if (!(await laptop.getByRole("button", { name: "16 سؤال", exact: true }).getAttribute("class")).includes("bg-gold")) fail("16 should be the default length");
await laptop.getByRole("button", { name: "إنشاء الجلسة" }).waitFor();
await laptop.screenshot({ path: `${SHOTS}/v16-01-setup.png`, fullPage: true });
log("setup: no theme / team count / colors / score target / vote frequency; lengths 10/16/22 (16 default) ✓");

// ─── 2. Personal card «جهّز الرابط» → draft session before final setup ─────
await laptop.getByLabel("اسم اللعبة").fill("عشاء الجمعة");
await laptop.getByLabel("اسم الفريق 1").fill("النشامى");
await laptop.getByRole("button", { name: "جهّز الرابط" }).click();
await laptop.getByTestId("draft-line").waitFor();
const code = (await laptop.getByTestId("draft-line").locator("b").textContent()).trim();
let st = await state(code);
if (!st.draft) fail("session should be a draft");
await laptop.getByTestId("personal-card").getByText("مشاركة الرابط").waitFor();
await laptop.getByTestId("personal-card").getByText("أسئلة جاهزة").waitFor();
log(`draft session ${code} created early; card shows «أسئلة جاهزة» + «مشاركة الرابط» ✓`);

// ─── 3. Universal /join works on the draft ─────────────────────────────────
const phone = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
await phone.goto(`${BASE}/join/${code}`);
await phone.getByText("عشاء الجمعة").waitFor();
await phone.getByText(code, { exact: true }).waitFor();
if ((await phone.getByRole("link", { name: /انضم للعبة/ }).getAttribute("href")) !== `/play/${code}`) fail("join → play href");
if ((await phone.getByRole("link", { name: /وش تعرف عنه/ }).getAttribute("href")) !== `/know/${code}`) fail("join → know href");
await phone.screenshot({ path: `${SHOTS}/v16-02-join.png` });
await phone.getByRole("link", { name: /وش تعرف عنه/ }).click();
await phone.getByText("وش تعرف عنكم العائلة؟").waitFor();
log("/join hub: «انضم للعبة» → /play, «وش تعرف عنه؟» → /know (works before setup is final) ✓");

// family fills info before the game exists
for (const [n, a] of [
  ["عزيز", { favorite_food: "شاورما", favorite_color: "أزرق", travel_destination: "اليابان" }],
  ["منيرة", { favorite_food: "سوشي", favorite_color: "وردي", travel_destination: "باريس" }],
  ["محمد", { favorite_food: "كبسة", favorite_color: "أسود", travel_destination: "دبي" }],
]) {
  const r = await post(`/api/know/${code}`, { action: "submit", name: n, mode: "other", answers: a, custom: [], nonce: `v16-${n}` });
  if (r.status !== 200) fail(`know submit ${r.status} ${r.error}`);
}
await laptop.getByTestId("personal-card").getByText("سؤال جاهز").waitFor({ timeout: 12000 });
await laptop.getByTestId("draft-line").getByText("3").first().waitFor();
await laptop.screenshot({ path: `${SHOTS}/v16-03-setup-draft-ready.png`, fullPage: true });
log(`personal card → ready (${(await laptop.getByTestId("draft-line").textContent()).trim()}) ✓`);

// ─── 4. Finish setup («اكمل إنشاء اللعبة») → post-create groups ────────────
await laptop.getByRole("button", { name: "22 سؤال", exact: true }).click();
await laptop.getByRole("button", { name: "اكمل إنشاء اللعبة" }).click();
await laptop.waitForURL(new RegExp(`/control/${code}$`));
st = await state(code);
if (st.draft) fail("draft flag should clear after setup");
if (st.teams.length !== 2 || st.teams[0].name !== "النشامى" || st.teams[0].color !== "#22A06B" || st.teams[1].color !== "#D6A63A") fail(`teams ${JSON.stringify(st.teams)}`);
if (st.settings.totalQuestions !== 22 || st.settings.voteEvery !== 1 || st.settings.targetScore !== null) fail(`settings ${JSON.stringify(st.settings)}`);
for (const t of ["العائلة واللاعبون", "العرض والتحكم", "من هنا يقدرون يدخلون اللعبة أو يعبّون وش تعرف عنه؟", "ابدأ العرض 📺", "نسخ رابط العرض", "امسح الكود بالآيباد أو أي جهاز تبي تتحكم منه", "مشاركة الرابط", "نسخ الرابط"]) {
  await laptop.getByText(t).first().waitFor();
}
await laptop.getByText("رمز الدخول:").getByText("9696").waitFor();
await laptop.getByText(`/join/${code}`).first().waitFor();
await laptop.screenshot({ path: `${SHOTS}/v16-04-control-groups.png`, fullPage: true });
log("same code kept; 2 teams (green/gold), 22 questions, vote every round; 3 post-create groups ✓");

// ─── 5. TV: one QR to /join, no control QR ──────────────────────────────────
const tv = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await tv.goto(`${BASE}/screen/${code}`);
await tv.getByText("ابدأ العرض").click();
await tv.getByText("امسح الكود وانضم").waitFor();
await tv.getByText("ومن نفس الرابط تقدر تعبّي وش تعرف عنه؟ 👀").waitFor();
await tv.getByText(`/join/${code}`).waitFor();
const tvText = await tv.locator("body").innerText();
if (/control|9696|رمز الدخول/.test(tvText)) fail("TV must not show control access");
if ((await tv.locator("svg[height]").filter({ has: tv.locator("path") }).count()) < 1) fail("TV QR missing");
await tv.screenshot({ path: `${SHOTS}/v16-05-tv-lobby.png` });
log("TV lobby: join QR + «امسح الكود وانضم», personal line, no control QR/PIN ✓");

// ─── 6. iPad control with PIN, recents on that device ──────────────────────
const ipad = await (await browser.newContext({ ...devices["iPad Pro 11"] })).newPage();
await ipad.goto(`${BASE}/control/${code}`);
await ipad.locator("input").first().fill("1234");
await ipad.getByRole("button", { name: "دخول" }).click();
await ipad.getByText("الرمز غير صحيح").waitFor();
await ipad.locator("input").first().fill("9696");
await ipad.getByRole("button", { name: "دخول" }).click();
await ipad.getByRole("button", { name: "ابدأ اللعبة" }).waitFor();
await ipad.goto(`${BASE}/admin`);
await ipad.getByLabel("الألعاب الأخيرة").locator(`option[value="${code}"]`).waitFor({ state: "attached" });
log("iPad: wrong PIN refused, 9696 opens control; session appears in its recent list ✓");

// players join through /join → /play
const players = [];
for (const [n, team] of [["سارة", "النشامى"], ["نورة", "الذيابة"]]) {
  const p = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await p.goto(`${BASE}/join/${code}`);
  await p.getByRole("link", { name: /انضم للعبة/ }).click();
  await p.getByPlaceholder("اكتب اسمك").fill(n);
  await p.getByRole("button", { name: team, exact: true }).click();
  await p.getByText("ادخل اللعبة").click();
  await p.getByText(`أهلاً ${n}!`).waitFor();
  players.push(p);
}
log("players joined via the universal link ✓");

// ─── 7. Unfinished run → resume / restart ───────────────────────────────────
await hostAct(code, { type: "start" });
st = await state(code);
if (!st.categories.some((c) => c.id === "personal")) fail("personal category should be in the game");
await hostAct(code, { type: "pick_category", categoryId: st.categories.find((c) => c.id !== "personal").id }).catch(() => {});
await laptop.goto(`${BASE}/admin`);
await laptop.getByLabel("الألعاب الأخيرة").selectOption(code);
await laptop.getByRole("button", { name: "استكمال اللعبة" }).waitFor();
await laptop.getByRole("button", { name: "إعادة من البداية" }).waitFor();
if ((await laptop.getByLabel("اسم اللعبة").inputValue()) !== "عشاء الجمعة") fail("selecting a session should load its name");
if ((await laptop.getByLabel("اسم الفريق 1").inputValue()) !== "النشامى") fail("selecting a session should load team names");
if (!(await laptop.getByRole("button", { name: "22 سؤال", exact: true }).getAttribute("class")).includes("bg-gold")) fail("should load length 22");
await laptop.screenshot({ path: `${SHOTS}/v16-06-resume.png`, fullPage: true });
await laptop.getByRole("button", { name: "استكمال اللعبة" }).click();
await laptop.waitForURL(new RegExp(`/control/${code}$`));
if ((await state(code)).phase.name === "LOBBY") fail("resume must not reset the run");
await laptop.goto(`${BASE}/admin`);
await laptop.getByLabel("الألعاب الأخيرة").selectOption(code);
await laptop.getByRole("button", { name: "إعادة من البداية" }).click();
await laptop.waitForURL(new RegExp(`/control/${code}$`));
st = await state(code);
if (st.phase.name !== "LOBBY" || st.run !== 2 || st.turn.questionsPlayed !== 0 || st.teams.some((t) => t.score !== 0)) fail(`restart ${st.phase.name} run ${st.run}`);
if (st.players.length !== 2) fail("restart should keep players");
log("unfinished run: resume keeps it, restart → run 2, same code, scores 0, players kept ✓");

// ─── 8. Completed run → replay ─────────────────────────────────────────────
await hostAct(code, { type: "start" });
await hostAct(code, { type: "adjust_score", teamId: "t1", delta: 100 }).catch(() => {});
await hostAct(code, { type: "end_game" });
if ((await state(code)).phase.name !== "GAME_OVER") fail("expected GAME_OVER");
await laptop.goto(`${BASE}/admin`);
await laptop.getByLabel("الألعاب الأخيرة").selectOption(code);
await laptop.getByRole("button", { name: "إعادة اللعب" }).waitFor();
await laptop.getByText("عرض النتائج السابقة").click();
await laptop.getByText("النشامى:").waitFor();
await laptop.screenshot({ path: `${SHOTS}/v16-07-replay.png`, fullPage: true });
await laptop.getByRole("button", { name: "إعادة اللعب" }).click();
await laptop.waitForURL(new RegExp(`/control/${code}$`));
st = await state(code);
if (st.code !== code || st.run !== 3 || st.phase.name !== "LOBBY" || st.teams.some((t) => t.score !== 0)) fail(`replay run ${st.run} ${st.phase.name}`);
if (st.history.length < 2 || !st.history.at(-1).finished) fail("history should record finished run");
const know = await (await fetch(`${BASE}/api/know/${code}`)).json();
if (know.people !== 3) fail("personal data must survive replays");
log(`completed run: «إعادة اللعب» → run 3 on ${code}, history ${st.history.length}, personal data kept (${know.people} people) ✓`);

// ─── 9. Recent dropdown shows at most 5 ────────────────────────────────────
await laptop.evaluate(() => {
  const list = Array.from({ length: 8 }, (_, i) => ({ code: `ZZ${i}${i}`, name: `لعبة ${i}`, at: Date.now() - i * 1000 }));
  localStorage.setItem("96:recent", JSON.stringify(list));
});
await laptop.goto(`${BASE}/admin`);
await laptop.getByLabel("الألعاب الأخيرة").locator("option").nth(1).waitFor({ state: "attached" });
const opts = await laptop.getByLabel("الألعاب الأخيرة").locator("option").allTextContents();
if (opts.length !== 6 || opts[0] !== "لعبة جديدة" || opts[1] !== "لعبة 0 • ZZ00") fail(`dropdown ${JSON.stringify(opts)}`);
log(`recent dropdown: «لعبة جديدة» + 5 most recent («${opts[1]}») ✓`);

// ─── 10. API: always two teams, lengths ────────────────────────────────────
const r3 = await post("/api/sessions", { name: "x", teams: [{ name: "أ", color: "#000000" }, { name: "ب", color: "#ffffff" }, { name: "ج", color: "#123456" }], settings: { totalQuestions: 10, voteEvery: 3, targetScore: 500 } });
const s3 = await state(r3.code);
if (s3.teams.length !== 2 || s3.teams[0].color !== "#22A06B" || s3.settings.voteEvery !== 1 || s3.settings.targetScore !== null || s3.settings.totalQuestions !== 10) fail(`api create ${JSON.stringify(s3.settings)}`);
const bad = await post(`/api/sessions/${r3.code}/configure`, { token: "nope", totalQuestions: 15 });
if (bad.status !== 401) fail("configure must require host auth");
log("API: 3 teams requested → 2 fixed (green/gold), vote every round, no score target; configure needs PIN/token ✓");

const health = await (await fetch(`${BASE}/api/health`)).json();
if (!/^V1\.[6-9]/.test(health.version) || health.questions !== 130 || health.categories !== 11) fail(`health ${JSON.stringify(health)}`);
log(`health: ${health.version}, ${health.categories} categories / ${health.questions} questions ✓`);

await browser.close();
console.log("\nE2E V1.6: passed ✓");
