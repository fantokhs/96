# خيمة الفنتوخ

مستوحاه من خيمة منيرة الماجد · theme: اليوم الوطني 96

A real-time family party game for gatherings. The TV is the stage, every phone is a controller, and the host is the judge. The default theme is **Saudi National Day 96**.

- **Host / Admin**: `/admin` creates a game, then `/host/CODE` runs it.
- **TV screen**: `/screen/CODE`, fullscreen and readable from across the room.
- **Players**: `/play/CODE`. Players scan the QR, type a name and join. No accounts.
- **Content manager**: `/admin/content`, protected by a PIN.
- **Test bench**: `/dev/CODE` shows the TV and 4 phones on one screen.

Version: **V1.3**

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
- **End**: after 10, 15 or 20 questions, or when a team reaches a target score. The TV dims, counts down 3-2-1, then reveals the winner with confetti and fireworks.

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
