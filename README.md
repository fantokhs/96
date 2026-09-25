# خيمة الفنتوخ

مستوحاه من خيمة منيرة الماجد · theme: اليوم الوطني 96

A real-time family party game for gatherings. The TV is the stage, every phone is a controller, and the host is the judge. The default theme is **Saudi National Day 96**.

- **Host / Admin**: `/admin` creates (or reopens) a session, then `/control/CODE` runs it (any device, PIN).
- **Family link**: `/join/CODE`, one QR for joining the game or filling «وش تعرف عنه؟ 👀».
- **TV screen**: `/screen/CODE`, fullscreen and readable from across the room.
- **Players**: `/play/CODE`. Players scan the QR, type a name and join. No accounts.
- **Content manager**: `/admin/content`, protected by a PIN.
- **Test bench**: `/dev/CODE` shows the TV and 4 phones on one screen.

Version: **V1.7**

---

## Deploy (Vercel + Supabase), about 10 minutes

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com). Choose the region **Central EU (Frankfurt)**, which is where the Vercel functions run (`vercel.json`).
2. Open **SQL Editor**, paste all of [`supabase/setup.sql`](supabase/setup.sql), then click **Run**.
   This creates the tables, turns on row-level security and loads the 105 National Day 96 questions.
3. Open **Project Settings → API** and copy these three values:
   - Project URL
   - `anon` public key
   - `service_role` key (secret)

### 2. Vercel
1. Import this GitHub repo into Vercel. The framework is detected automatically.
2. Under **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `ADMIN_PIN` | any PIN for `/admin/content` |

3. Deploy. Then check `https://your-app.vercel.app/api/health`: it should show `"ok":true` and `"store":"supabase"`.
4. Open `https://your-app.vercel.app/admin`.

Pushes to `main` deploy to production automatically. Other branches get preview URLs.

> In production the app **refuses to run without Supabase** (API returns 503), because serverless instances don't share memory.
> `NEXT_PUBLIC_*` values are baked in at build time, so if you change them, redeploy.

---

## Run locally

```bash
npm install
npm run dev            # http://localhost:3000  (in-memory store, PIN 9696)
```

To play on your home Wi-Fi, run `npm run build && ALLOW_MEMORY_STORE=1 npm start` and open `http://<your-computer-ip>:3000/admin`.
Phones can then join over the LAN.

Checks:

```bash
npm run typecheck
npm run test:engine    # game-rule scenario on the pure engine
npm run build && ALLOW_MEMORY_STORE=1 ADMIN_PIN=9696 npm start &
npm run test:e2e       # real browsers: host + TV + 4 phones, full success scenario
```

---

## How a game works

```
LOBBY → CATEGORY_VOTE → CARD_PICK → QUESTION → (STEAL) → RESULT → next team … → GAME_OVER
```

- **Category vote**: the active team votes on their phones. On a tie, the TV asks them to change one vote. The host can pick a category at any time. A setting controls whether the vote happens every turn or every 3 turns.
- **Cards**: each category deals up to 6 face-down cards. A team member taps one and it flips on the TV. A question is never repeated in the same game (or in a rematch).
- **Answering**:
  - Multiple-choice and true/false questions: the team answers on their phones and the game checks the answer automatically.
  - Open questions: the team answers out loud and the host judges.
  - The host always sees the answer privately and has the final say.
- **Steal**: after a miss the host presses سرقة. With 2 teams the other team gets it automatically; with 3 teams the host chooses which. The stealing team gets 10 seconds for +50.
- **Fastest finger**: categories set to "⚡ أسرع إصبع" show a buzzer on every phone. The server locks the first press it receives. If that player answers wrong, the buzzer reopens for the other teams.
- **End**: after 10, 16 or 22 questions (even lengths, so both teams get the same number of turns). The TV dims, counts down 3-2-1, then reveals the winner with confetti and fireworks.

Host safety controls: pause/resume, skip, cancel a question, ±50 score adjustment, move/remove/balance players, end the game (with confirmation), mute the TV.

## Architecture

- **Next.js 16 (App Router) + TypeScript + Tailwind 4**. The UI is Arabic-first and RTL, using the IBM Plex Sans Arabic font.
- **One authoritative game document per session**, stored as the `sessions.state` jsonb.
  - All rules live in a pure reducer: `src/lib/game/engine.ts`.
  - Writes use optimistic concurrency (a `version` column), so simultaneous votes and buzzes never overwrite each other.
- **All reads and writes go through the API routes using the service role.**
  - Browsers never touch the database. RLS is on with no public policies.
  - Answers never reach the TV or phones until the result is revealed.
- **Realtime**: after each change the server sends a small "version changed" ping over Supabase Realtime Broadcast (or SSE when running locally). Each client then re-fetches its own role-filtered view.
  - Clients also poll every few seconds, so a dropped socket only delays updates.
  - Refreshing any screen restores the full state.
- **Timers are server timestamps**. Clients render countdowns using a corrected clock. Timed transitions (vote deadline, auto-card, next turn) are applied by the server only once the deadline has passed.
- **Host authorization**: a random host token is returned once. The server stores only its SHA-256 hash. Each player gets their own token, kept in their phone's localStorage.
- **Photos**: resized and center-cropped in the browser (256px), then stored in the `media` table and served from `/api/media/:id`.
- **Sounds**: original WebAudio synth effects (flip, tick, correct, wrong, steal, score, buzzer, winner fanfare). No copyrighted audio.
  To use your own licensed celebration track, drop it at `public/audio/celebration.mp3` and it replaces the fanfare.

### Content
- Default content lives in [`src/content/seed.ts`](src/content/seed.ts): 8 categories and 105 questions.
- Regenerate the SQL with `npm run seed:sql`.
- Add or edit categories and questions (text, multiple-choice, true/false, image, complete-the-phrase) at `/admin/content`.

### Themes
- A theme is a `themes` row plus its categories and questions (`theme_id`).
- Colors and patterns are per category, so a Ramadan or World Cup theme is just new content. No code changes are needed.

## «وش تعرف عنه؟ 👀» (V1.5)

- **Before the gathering:** share `/know/CODE` (fourth card on the control screen, with «نسخ رسالة الدعوة»).
  - Anyone can fill in facts about themselves or anyone else: 15 optional light questions plus up to 3 custom questions.
  - One phone can fill in for many people.
  - The same name from another device adds to that person's profile and never overwrites.
- **Storage:** data is session-scoped and kept in its own document, a separate `KNOW:<CODE>` row in the existing `sessions` table.
  - No schema change was needed.
  - It never touches the global `questions` table.
- **At «ابدأ اللعبة»:** the category is generated deterministically, with no AI.
  - Wrong options come from other family members' answers to the same field, then curated fallback pools.
  - Cards rotate fairly between people.
  - A team isn't asked about its own linked player when another question exists.
- **When it's playable:** at ≥ 6 questions about ≥ 2 people.
- **Host panel:** counts, a toggle, «تحديث» during a game, review (disable, pick among conflicting answers, delete).
- **Tests:** `npm run test:personal`, `node scripts/e2e-personal.mjs`.

## V1.6: simpler setup, sessions vs game runs

- **Session vs game run.** A session keeps its code, name, team names, «وش تعرف عنه؟» data and category choices.
  - «إعادة اللعب» / «إعادة من البداية» start a new *run* (`run` + `history` in the game document). They reset scores, turn, board, used questions, timer, winner, votes and buzzer.
  - The code stays the same.
- **Setup (`/admin`).**
  - Game name, plus a dropdown with «لعبة جديدة» and the 5 most recent sessions on this device (`96:recent`, also filled by any control device).
  - Two team names (fixed green / gold colours) and 10/15/20 questions (default 15).
  - The category vote happens every round. There are no theme, team-count, colour, target-score or advanced settings.
- **Selecting a recent session** loads it into the form:
  - unfinished → «استكمال اللعبة» / «إعادة من البداية»;
  - finished → «إعادة اللعب» (with «عرض النتائج السابقة»);
  - draft → «اكمل إنشاء اللعبة».
  - Server: `POST /api/sessions/CODE/configure` (host token or PIN).
- **Draft sessions.** «جهّز الرابط» on the «وش تعرف عنه؟ 👀» card creates the session early, so `/join` and `/know` work before setup is finished.
  - Drafts idle for 7 days, with no players and no personal submissions, are removed by a throttled best-effort sweep.
  - Nothing else is ever deleted.
- **Control screen groups:**
  1. العائلة واللاعبون: QR → `/join/CODE`.
  2. العرض والتحكم: «ابدأ العرض» new window + control QR + PIN.
  3. وش تعرف عنه؟: counts, share/copy, review.
- **TV lobby:** only the family QR. It never shows the control link or PIN.
- **Tests:** `node scripts/e2e-v16.mjs`.

## V1.7: presenter-paced game show, longer reactions, difficulty curve

- **The host sets the pace.** The engine still owns rules, votes, scores and sync, but important moments wait for the presenter:
  1. «ابدأ اللعبة» opens the TV screen «الجولة الأولى — الصقور ضد الذيابة — جاهزين؟». The host presses «ابدأ الجولة».
  2. Category vote: a 15-second window with «اعتماد التصويت الآن». If everyone votes early, the screen doesn't jump; the host sees «اكتمل التصويت» and presses «اعرض النتيجة».
  3. «تم اختيار …» plus a 3-2-1 on TV and phones. Category taps can never become card or answer taps.
  4. **Question prep (hold).** The question is shown in full, phones show «انتظر المقدم…» with the options disabled, and the clock is not running. This hold is the discussion time.
  5. «ابدأ الوقت» brings a «جاوب الآن!» flash, then answers count and the 20-second timer runs (+5 / pause / resume in the tools).
     - For fastest-finger categories («تحدي السرعة»), the TV shows «استعدوا». After «ابدأ التحدي» comes 3-2-1 انطلق!, then fast automatic play.
  6. The result stays on screen. «التالي» advances; it is locked for the first 1.5 seconds. A 60-second safety fallback is the only auto-advance.
- **Staged reactions (TV):**
  - Stages: impact flash with the score (0.7s), then the main character animation, then about 1.5s of photo-worthy freeze with a camera flash.
  - Durations: correct about 4.5s, wrong about 4.3s, steal about 5s.
  - New variants: flex, money throw, bow, victory selfie, pointing, swagger entrance, flag wave, camel ride; crying, walking away, dramatic collapse, hiding, shocked, bonked, dragged off, sitting sad, disbelief; trophy grab, chased thief, sneaky tiptoe.
  - One follow-up sound per reaction (applause / laugh / whoosh).
- **Game length:** 10 / 16 / 22 (default 16).
  - Old sessions: 15 → 16 and 20 → 22.
  - A skipped turn still counts as that team's turn, so turns are always equal (5/5, 8/8, 11/11).
- **Difficulty (selection only; points unchanged):**
  - Every global question is `easy | medium | hard`. The classification of the 130 questions is in `src/content/difficulty.ts`.
  - The game follows a curve: easy early, medium in the middle, hard late (10 → 4/4/2, 16 → 6/6/4, 22 → 8/8/6).
  - Players still pick the category; the flipped card gets the closest-difficulty unused question in it, falling back gracefully.
  - Players and the TV never see difficulty. The host sees a subtle badge.
  - «وش تعرف عنه؟» questions are treated as medium internally.
- **Question manager:** a difficulty chip per question, a «الصعوبة» field (default «متوسط»), and a filter by level.
- **Database:** run [`supabase/migrations/20260925000000_v1_7_difficulty.sql`](supabase/migrations/20260925000000_v1_7_difficulty.sql) once in the Supabase SQL editor.
  - It is additive: a nullable `difficulty` column plus fills for NULL rows only.
  - Until it runs, the app still works. It uses the built-in classification and keeps host edits in a small `META:DIFFICULTY` document.
  - After it runs, the app back-fills NULLs automatically.
  - `/api/health` shows `difficultyFeature` and `difficultyStorage` (`column` | `fallback`).
- **Tests:** `npm run test:engine` (fairness, curve, fallback, lengths), `node scripts/e2e-v17.mjs`.
