// V1.7 end-to-end: host-paced flow, longer staged reactions, fast-mode prep, even game
// lengths (fair turns), old-length normalization, difficulty metadata + curve + manager.
//   BASE_URL=http://localhost:3000 node scripts/e2e-v17.mjs
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (p, b, h = {}) =>
  fetch(BASE + p, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
const state = (code) => fetch(`${BASE}/api/sessions/${code}`).then((r) => r.json());
const host = (code, action) => post(`/api/sessions/${code}/act`, { role: "host", token: "9696", action });
const create = (n, categoryIds) =>
  post("/api/sessions", { name: "اختبار", teams: [{ name: "الصقور" }, { name: "الذيابة" }], categoryIds, settings: { totalQuestions: n } });

// ─── 1. Game lengths: 10 / 16 / 22 fair turns + difficulty curve (API, real server) ───
const LV = { easy: 0, medium: 1, hard: 2 };
const curve = { early: [], mid: [], late: [] };
const byLevel = { easy: 0, medium: 0, hard: 0 };
for (const n of [10, 16, 22]) {
  const { code } = await create(n);
  if ((await state(code)).settings.totalQuestions !== n) fail(`create ${n}`);
  await host(code, { type: "start" });
  if ((await state(code)).phase.name !== "INTRO") fail("start should open the INTRO hold");
  await host(code, { type: "begin_round" });
  const turns = {};
  for (let guard = 0; guard < 200; guard++) {
    const s = await state(code);
    const p = s.phase;
    if (p.name === "GAME_OVER") break;
    if (p.name === "CATEGORY_VOTE") await host(code, { type: "close_vote" });
    else if (p.name === "CARD_PICK") await host(code, { type: "reveal_card" });
    else if (p.name === "QUESTION") {
      turns[p.teamId] = (turns[p.teamId] ?? 0) + 1;
      if (!p.hold || p.timer.endsAt !== null) fail("question must open on hold with the clock stopped");
      const hv = await host(code, { type: "start_timer" });
      const d = hv.host.difficulty ?? "medium";
      byLevel[d]++;
      const i = s.turn.questionsPlayed;
      (i < n / 3 ? curve.early : i < (2 * n) / 3 ? curve.mid : curve.late).push(LV[d]);
      await host(code, { type: "correct" });
    } else if (p.name === "RESULT") {
      const early = await host(code, { type: "next" });
      if (early.status !== 400) fail("«التالي» must be locked for the first ~1.5s of the reaction");
      await sleep(Math.max(0, p.lockUntil - s.serverNow) + 80);
      await host(code, { type: "next" });
    }
  }
  const s = await state(code);
  const [a, b] = s.teams.map((t) => turns[t.id] ?? 0);
  if (s.phase.name !== "GAME_OVER" || a !== n / 2 || b !== n / 2) fail(`${n}: turns ${a}/${b}`);
  log(`${n} questions → ${a}/${b} primary turns ✓`);
}
const avg = (x) => x.reduce((p, c) => p + c, 0) / x.length;
if (!(avg(curve.early) < avg(curve.mid) && avg(curve.mid) <= avg(curve.late) + 0.25)) fail(`curve ${avg(curve.early)} ${avg(curve.mid)} ${avg(curve.late)}`);
log(`difficulty curve (0 easy → 2 hard): early ${avg(curve.early).toFixed(2)} → mid ${avg(curve.mid).toFixed(2)} → late ${avg(curve.late).toFixed(2)} ✓`);
log(`questions played by level: ${JSON.stringify(byLevel)}`);

// ─── 2. Difficulty metadata + health ────────────────────────────────────────
const health = await (await fetch(`${BASE}/api/health`)).json();
if (health.version !== "V1.7" || !health.difficultyFeature || health.questions !== 130 || health.categories !== 11) fail(`health ${JSON.stringify(health)}`);
const content = await (await fetch(`${BASE}/api/admin/content`, { headers: { "x-admin-pin": "9696" } })).json();
const active = content.questions.filter((q) => q.active);
const counts = { easy: 0, medium: 0, hard: 0 };
for (const q of active) {
  if (!["easy", "medium", "hard"].includes(q.difficulty)) fail(`question ${q.id} has no difficulty`);
  counts[q.difficulty]++;
}
log(`all ${active.length} global questions classified: ${JSON.stringify(counts)} ✓`);

// ─── 3. Browser: setup lengths + old-session normalization ─────────────────
const browser = await chromium.launch();
const laptop = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
await laptop.goto(`${BASE}/admin`);
for (const n of ["10 أسئلة", "16 سؤال", "22 سؤال"]) await laptop.getByRole("button", { name: n, exact: true }).waitFor();
for (const n of ["15 سؤال", "20 سؤال"]) if (await laptop.getByRole("button", { name: n, exact: true }).count()) fail(`setup still offers «${n}»`);
if (await laptop.getByText("صعوبة").count()) fail("setup must not ask for difficulty");
if (!(await laptop.getByRole("button", { name: "16 سؤال", exact: true }).getAttribute("class")).includes("bg-gold")) fail("16 default");
for (const [old, want] of [[15, "16 سؤال"], [20, "22 سؤال"]]) {
  const { code, hostToken } = await create(10);
  await laptop.evaluate(([c, t]) => {
    localStorage.setItem(`96:host:${c}`, JSON.stringify(t));
    localStorage.setItem("96:recent", JSON.stringify([{ code: c, name: "قديمة", at: Date.now() }]));
  }, [code, hostToken]);
  // simulate a V1.6 session saved with the old length
  await laptop.route(`**/api/sessions/${code}`, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.settings.totalQuestions = old;
    await route.fulfill({ response: res, json: body });
  });
  await laptop.goto(`${BASE}/admin`);
  await laptop.getByLabel("الألعاب الأخيرة").selectOption(code);
  await laptop.waitForFunction((w) => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === w && b.className.includes("bg-gold")), want);
  log(`old session with ${old} questions loads as «${want}» ✓`);
  await laptop.unroute(`**/api/sessions/${code}`);
}

// ─── 4. Browser: result / reaction pacing on the TV ────────────────────────
const { code } = await create(10, ["nd96-saudi", "nd96-speed"]);
const tv = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await tv.goto(`${BASE}/screen/${code}`);
await tv.getByText("ابدأ العرض").click();
const phones = [];
for (const [name, team] of [["سارة", "الصقور"], ["نورة", "الذيابة"]]) {
  const p = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
  await p.goto(`${BASE}/play/${code}`);
  await p.getByPlaceholder("اكتب اسمك").fill(name);
  await p.getByRole("button", { name: team, exact: true }).click();
  await p.getByText("ادخل اللعبة").click();
  await p.getByText(`أهلاً ${name}!`).waitFor();
  phones.push(p);
}
await host(code, { type: "start" });
await tv.getByText("جاهزين؟").waitFor({ timeout: 6000 });
await tv.screenshot({ path: `${SHOTS}/v17-01-intro.png` });
await host(code, { type: "begin_round" });

/** Sample the TV's reaction overlay every 100ms: when each stage was first seen and when it ended. */
async function watchReaction(page, ms = 8000) {
  return page.evaluate(async (ms) => {
    const t0 = performance.now();
    const seen = {};
    let end = null;
    let any = false;
    while (performance.now() - t0 < ms) {
      const el = document.querySelector("[data-reaction]");
      const st = el?.getAttribute("data-reaction");
      if (st) {
        any = true;
        seen[st] ??= Math.round(performance.now() - t0);
      } else if (any && end === null) end = Math.round(performance.now() - t0);
      await new Promise((r) => setTimeout(r, 100));
    }
    return { seen, end };
  }, ms);
}
async function playTo(teamIdx, category) {
  let s = await state(code);
  if (s.phase.name === "CATEGORY_VOTE") await host(code, { type: "override_category", categoryId: category });
  await host(code, { type: "reveal_card" });
  s = await state(code);
  if (s.phase.name !== "QUESTION" || !s.phase.hold) fail("expected question prep");
  return s;
}

// correct
await playTo(0, "nd96-saudi");
await phones[0].getByText("انتظر المقدم").waitFor();
await host(code, { type: "start_timer" });
const watchCorrect = watchReaction(tv);
await sleep(150);
await host(code, { type: "correct" });
const rc = await watchCorrect;
await tv.screenshot({ path: `${SHOTS}/v17-02-after-correct.png` });
const dur = (r) => (r.end ?? 8000) - (r.seen.impact ?? 0);
if (!(r => r.seen.impact !== undefined && r.seen.main > r.seen.impact && r.seen.freeze > r.seen.main)(rc)) fail(`correct stages ${JSON.stringify(rc)}`);
if (dur(rc) < 3000 || dur(rc) > 5600) fail(`correct reaction lasted ${dur(rc)}ms`);
if ((await state(code)).phase.name !== "RESULT") fail("result auto-advanced");
log(`correct reaction: impact → main @${rc.seen.main - rc.seen.impact}ms → freeze @${rc.seen.freeze - rc.seen.impact}ms → ends @${dur(rc)}ms; still on RESULT for the host ✓`);
await host(code, { type: "next" });

// wrong (الذيابة) → steal by الصقور
await playTo(1, "nd96-saudi");
await host(code, { type: "start_timer" });
await sleep(1300);
const w = watchReaction(tv);
await sleep(150);
await host(code, { type: "wrong" });
const rw = await w;
if (dur(rw) < 3000 || dur(rw) > 5600) fail(`wrong reaction lasted ${dur(rw)}ms`);
log(`wrong reaction lasted ~${dur(rw)}ms (3–5s) ✓`);
await host(code, { type: "undo" }); // back to the question → try the steal path
let s = await state(code);
if (s.phase.name !== "QUESTION") fail("undo should restore the question");
await host(code, { type: "steal" });
await sleep(2200);
const st = watchReaction(tv, 9000);
await sleep(150);
const before = (await state(code)).teams[0].score;
await host(code, { type: "correct" });
const rs = await st;
const after = (await state(code)).teams[0].score;
if (after - before !== 50) fail(`steal points ${before} → ${after}`);
if (dur(rs) < 3000 || dur(rs) > 6000) fail(`steal reaction lasted ${dur(rs)}ms`);
log(`steal reaction lasted ~${dur(rs)}ms, +50 applied ✓`);
await sleep(1600);
await host(code, { type: "next" });

// ─── 5. Fast mode: «تحدي السرعة» prep → «ابدأ التحدي» → 3-2-1 → buzz ───────
await playTo(0, "nd96-speed");
await tv.getByText("استعدوا").first().waitFor();
await phones[1].getByText("استعدوا").waitFor();
await tv.screenshot({ path: `${SHOTS}/v17-03-speed-prep.png` });
if ((await state(code)).phase.timer.endsAt !== null) fail("speed timer started before the host");
await host(code, { type: "start_timer" });
await tv.getByText("انطلق!").first().waitFor({ timeout: 6000 });
await phones[1].getByRole("button", { name: "اضغط أولاً" }).click();
await tv.getByText("اللاعب الأسرع").waitFor();
log("speed category: «استعدوا» hold → «ابدأ التحدي» → 3-2-1 انطلق! → buzz locks ✓");

// ─── 6. Question manager: difficulty field + filter + default for new ──────
const admin = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
await admin.goto(`${BASE}/admin/content`);
await admin.locator('input[type="password"]').fill("9696");
await admin.getByRole("button", { name: "دخول" }).click();
await admin.getByText("كل المستويات").waitFor();
await admin.getByRole("button", { name: /^صعب/ }).first().click();
await admin.screenshot({ path: `${SHOTS}/v17-04-manager-filter.png` });
await admin.getByRole("button", { name: /^كل المستويات/ }).click();
const firstQ = content.questions.find((q) => q.categoryId === content.categories[0].id);
const target = firstQ.difficulty === "hard" ? "easy" : "hard";
await admin.locator(".panel", { hasText: firstQ.question }).first().getByRole("button", { name: { easy: "سهل", hard: "صعب" }[target], exact: true }).click();
await sleep(600);
const after2 = await (await fetch(`${BASE}/api/admin/content`, { headers: { "x-admin-pin": "9696" } })).json();
if (after2.questions.find((q) => q.id === firstQ.id).difficulty !== target) fail("difficulty change not saved");
await post("/api/admin/content", { kind: "question", item: { ...firstQ } }, { "x-admin-pin": "9696" }); // restore
const created = await post("/api/admin/content", { kind: "question", item: { categoryId: firstQ.categoryId, question: "سؤال اختبار V1.7", answer: "x", type: "TEXT", active: false } }, { "x-admin-pin": "9696" });
if (created.item.difficulty !== "medium") fail("new questions default to medium");
await fetch(`${BASE}/api/admin/content?id=${created.item.id}`, { method: "DELETE", headers: { "x-admin-pin": "9696" } });
log("question manager: filter by difficulty, per-question change saved, new questions default «متوسط» ✓");

const h2 = await (await fetch(`${BASE}/api/health`)).json();
if (h2.questions !== 130) fail("global question count changed");
await browser.close();
console.log("\nE2E V1.7: passed ✓");
