# Lepak Hub: project brief for Claude Code

Read this whole file before writing any code. It explains what we are building, what we are building right now, and what we are deliberately not building yet.

---

## 1. What this project is

**Lepak Hub** (working name, wordmark `LEPAK.HUB`) is a free, open source web hub for students. "Lepak" is Malaysian slang for hanging out. The idea: one place where students can play party games, study together and use the small tools every class and group project needs.

- **Who it's for:** university and school students (starting with friends and classmates in Kuala Lumpur), plus lecturers and teachers who want something fun for class.
- **Who's building it:** a small group of student developers. This is a fun school project and an open source repo, not a startup. Keep things simple, cheap (free) and easy for new contributors to understand.
- **Core promise to users:** free, no ads, no signup needed to start. Pick a nickname and go.

### The long-term hub (for context only, NOT for now)

Apps planned for the hub, grouped by category:

| #   | App                                                                             | Category   | Status             |
| --- | ------------------------------------------------------------------------------- | ---------- | ------------------ |
| 001 | WordBomb                                                                        | Games      | **Building first** |
| 002 | Notes + Lepak Pages (publish notes or a dropped PDF/DOCX as a page with a slug) | Study      | Later              |
| 003 | Deadlines (shared class assignment tracker)                                     | Study      | Later              |
| 004 | Device Drop (P2P file transfer phone to laptop)                                 | Tools      | Later              |
| 005 | GeoGuess                                                                        | Games      | Later              |
| 006 | Study Room (shared focus timer)                                                 | Study      | Later              |
| 007 | Makan Split (bill splitter)                                                     | Social     | Later              |
| 008 | Free-Time Finder (group availability)                                           | Group work | Later              |

Also later: Quick Paste, Notes to Game, class mode (projector screen + phones as controllers), chat.

Design the architecture so these can be added as plugins later, but **do not build any of them now**.

---

## 2. Current focus (in this order)

We work in three phases. Finish and get sign-off on each before starting the next.

1. **Phase 1: Landing page** (brutalist black and white design, spec in section 6)
2. **Phase 2: Hub shell** (the app launcher after "Jom masuk": nickname, app grid, routing to apps)
3. **Phase 3: WordBomb** (first real app, multiplayer, spec in section 7)

If you are unsure which phase we are in, ask. Default: start with Phase 1 project setup + landing page.

---

## 3. Tech stack (decided)

| Area            | Choice                                        | Notes                                                                                        |
| --------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Language        | TypeScript, `strict: true`                    | Everywhere                                                                                   |
| Build           | **Vite + React**                              | Static SPA. Not Next.js, we don't need SSR                                                   |
| Routing         | React Router (or TanStack Router if simpler)  | Client side                                                                                  |
| Styling         | Tailwind CSS                                  | Custom brutalist components. Do not pull in a component library whose look fights the design |
| State           | React state + Zustand for shared stores       | Keep it light                                                                                |
| Multiplayer     | **Trystero** (WebRTC P2P)                     | No game server. See section 7                                                                |
| Validation      | Zod                                           | For P2P message schemas                                                                      |
| Tests           | Vitest                                        | Required for game logic                                                                      |
| Package manager | pnpm                                          |                                                                                              |
| Hosting         | Static host (Vercel / Netlify / GitHub Pages) | Free tier                                                                                    |
| Lint/format     | ESLint + Prettier                             |                                                                                              |

**Not in the stack yet:** Supabase, any backend, any database, auth. See section 9.

---

## 4. Architecture principles

1. **Static site only.** Everything runs in the browser. No server we have to run or pay for.
2. **Hub of apps (plugin style).** Each app lives in its own folder and exports a manifest. The hub reads the manifests and builds the app grid and routes automatically. Adding a new app should mean adding one folder and one line in a registry, nothing else.
3. **Guest first.** A nickname stored in `localStorage` is the identity. Generate a random `playerId` (UUID) on first visit and keep it.
4. **Host-authoritative multiplayer.** In multiplayer apps, the room creator's browser runs the game logic and broadcasts state. Other players only send intents ("I typed this word").
5. **Game logic is pure and tested.** Game rules live in plain TypeScript functions (state in, state out) with no React and no networking inside. Networking and UI wrap around them.
6. **Mobile first.** Many students will use phones. Every screen must work at 360px wide.

### Folder structure

```
lepak-hub/
  src/
    app/                 # app shell, router, providers
    pages/
      Landing.tsx
      Hub.tsx
    apps/
      registry.ts        # list of all app manifests
      wordbomb/
        manifest.ts
        logic/           # pure game rules + tests
        net/             # Trystero room + message schemas
        ui/              # React screens (lobby, game, results)
        index.tsx        # app entry component
    components/          # shared brutalist UI (Button, Input, Sticker, Marquee...)
    lib/
      identity.ts        # nickname + playerId in localStorage
      roomCode.ts        # code generation + validation
    styles/
  public/
    words/               # dictionary files
  CLAUDE.md
  README.md
  CONTRIBUTING.md
```

### App manifest shape

```ts
export type AppCategory = 'games' | 'study' | 'tools' | 'social' | 'group-work';

export interface AppManifest {
  id: string; // 'wordbomb'
  number: string; // '001', shown in the brutalist index
  name: string; // 'WordBomb'
  tagline: string; // one line for the grid card
  category: AppCategory;
  status: 'live' | 'beta' | 'planned';
  multiplayer: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  route: string; // '/wordbomb'
  load: () => Promise<{ default: React.ComponentType }>; // lazy import
}
```

`planned` apps show in the grid as "coming soon" cards but have no route yet.

---

## 5. Shared conventions

- **Room codes:** 4 characters, uppercase, from the alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no `0 O 1 I L` to avoid mix-ups). Case-insensitive input.
- **Room URLs:** `/r/:code` deep links straight into the lobby of the right app (encode the app id in the room or the route, e.g. `/wordbomb/r/KJRW`; pick one and keep it consistent).
- **Nickname rules:** 2 to 16 characters, trimmed, letters/numbers/spaces/`_`/`-`. Block a basic profanity list (use the `obscenity` npm package).
- **UI copy style:** plain, friendly, short. Light Malaysian flavour is welcome ("Jom masuk", "lepak", "kaki", "makan"). No em dashes in UI copy. No corporate phrasing.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`...).
- **Accessibility:** real `<button>`, `<a>`, `<label>` elements, visible focus states, text contrast at least 4.5:1, touch targets at least 44px, respect `prefers-reduced-motion`.
- **No placeholder lies:** don't invent user counts, stats or testimonials on any page. Use `[PLACEHOLDER]` text if something is unknown.

---

## 6. Phase 1: Landing page spec

The design was made on a design canvas ("Landing v2: brutalist B&W"). Rebuild it as real React + Tailwind components. Summary of the design:

### Visual system

- **Colours:** pure black `#000000` and white `#FFFFFF`. Greys only for secondary text: `#555555` on white, `#BDBDBD` on black, `#E5E5E5` for faint lines.
- **Fonts (Google Fonts):** `Archivo` (weights 400, 500, 700, 900) for headings and body, `Space Mono` (400, 700) for labels, UI and the typewriter.
- **Borders:** 3px solid black everywhere. Square corners (radius 0).
- **Shadows:** hard offset only, `6px 6px 0 #000`. Buttons "press in" on hover (translate 3px, shadow 3px) and on active (translate 6px, shadow 0).
- **Grid lines:** use the "gap on black background" trick: grid container `background: #000; gap: 3px`, cells white.
- **Section labels:** mono, like `// 002 :: THE INDEX`.
- Headings: Archivo 900, uppercase, very tight letter spacing (around `-0.045em`), line height around 0.9.

### Sections (top to bottom)

1. **Top bar:** `LEPAK.HUB` wordmark with a small black square, nav links `Index`, `Pages`, `Source`, and a black `[ Enter ]` button. Sections divided by 3px borders.
2. **Hero:**
   - Small mono line: `// 001 :: WELCOME` and `EST. 2026, KUALA LUMPUR`.
   - Huge mono `Hello,` and below it a black block with white text that **types and deletes** words in a loop: `Students`, `Learners`, `Educators`, `Night owls`, with a blinking block cursor. Type speed about 85ms per character, pause about 1.7s on a full word. The word list should be easy to edit (one array constant).
   - `h1` must have an `aria-label` with the full static sentence; the animated text is `aria-hidden`. Respect reduced motion (show the first word, no animation).
   - Subcopy: "Play, study and share in one hub. Party games, shared deadlines, notes you can publish as a page. Free, open source, no signup."
   - Nickname input (label "> Pick a nickname", placeholder `kopiboi`) and a black `JOM MASUK →` button with hard shadow. Submitting saves the nickname and goes to the hub (Phase 2 route; for Phase 1, route to a stub `/hub` page).
   - Rotated stickers top right: `NO SIGNUP` (white), `100% FREE` (black), round `OPEN SOURCE` badge. Decorative, `aria-hidden`.
3. **Marquee:** black strip, white Archivo 900 uppercase, infinite scroll of app names separated by `/`. Pause or stop for reduced motion.
4. **The Index:** big heading `THE INDEX.`, then the 8 app cards from section 1, built from the app registry (not hard-coded). Each card: number, category or status tag, big uppercase name, one-line description. Hover inverts the cell to black. WordBomb shows a `LIVE FIRST` tag.
5. **Lepak Pages teaser:** "DROP A PDF. GET A LINK." with a numbered 3-step list and a dashed drop zone + `/n/` slug input + `PUBLISH` button. **This is a visual teaser only.** No upload logic. Mark it "Coming soon".
6. **Steps:** three cells with giant numbers 1, 2, 3: Pick a nickname / Open an app / Send the code. Third cell is inverted (black).
7. **Open source block:** black background, "BUILT BY STUDENTS. FORKABLE BY ANYONE.", a terminal-style `pre` with `git clone [REPO URL]`, and a `VIEW ON GITHUB ↗` button.
8. **Footer:** small links (GitHub, Report a bug, Contribute, Top) and a giant `LEPAK.` word across the bottom.

### Phase 1 done when

- Pixel-close to the design at desktop (1440px) and clean at 360px mobile.
- Typewriter, marquee and hover states work, reduced motion respected.
- Lighthouse: Accessibility 95+, Performance 90+.
- Nickname saves to `localStorage` and routes to `/hub` stub.
- Deployed to a free static host preview.

---

## 7. Phase 3: WordBomb spec (read now, build later)

### Rules

- Players take turns. On your turn you see a **prompt**: 2 or 3 letters (e.g. `TIO`, `ANG`).
- Type any real word that **contains** the prompt, anywhere in the word.
- Word must: be in the dictionary, be at least 3 letters, contain only letters, not have been used earlier in this match. Case-insensitive.
- Valid word: the bomb passes to the next alive player with a new prompt.
- Timer runs out on your turn: you lose a life, the bomb passes, new prompt.
- 0 lives: you're out. Last player alive wins.
- After the match: results screen with placements, then **Rematch** (same room, same players) or back to the hub.

### Settings (host can change in lobby)

- Lives: 1 to 5, default 3
- Turn timer: 5 to 20 seconds, default 10
- Prompt difficulty: easy / normal / hard (controls how many dictionary words must contain the prompt, e.g. easy at least 1000, normal at least 300, hard at least 50)
- Language: English only for v1 (keep the dictionary pluggable for BM and Bahasa Indonesia later)
- Max players: 8

### Dictionary

- Use a public domain English word list such as **ENABLE**. Store in `public/words/en.txt`, lowercase, one word per line.
- Precompute a prompt list (2 and 3 letter substrings with their word counts) with a small Node script in `scripts/`, output `public/words/en-prompts.json`. Don't compute this in the browser at runtime.
- Load the dictionary lazily into a `Set` only when a game starts.

### Networking (Trystero)

- `appId: 'lepak-hub'`, room id = `wordbomb-<CODE>`.
- The **host** (room creator) holds the authoritative game state and runs the timer.
- Messages are typed and validated with Zod. Suggested set:
  - client → host: `join { playerId, nickname }`, `ready { ready }`, `submitWord { word }`, `typing { text }` (throttled, for showing live typing to others)
  - host → all: `state { ...fullSnapshot }`, `wordResult { playerId, word, valid, reason? }`, `kicked { reason }`
- Host broadcasts a **full state snapshot** after every change (simple and robust; the state is small).
- **Reconnect:** a player who refreshes rejoins with the same `playerId` and gets their seat back during the match.
- **Host leaves (v1):** match ends and everyone returns to the lobby with a message. Host migration is a later improvement.
- If P2P connections prove unreliable on campus Wi-Fi, we may switch the transport to Supabase Realtime broadcast later. Keep networking behind a small interface (`RoomTransport`) so it can be swapped.

### Screens

1. **WordBomb home:** Create room / Join with code / short how-to-play.
2. **Lobby:** room code big, copy link button, QR code (use a QR library, e.g. `qrcode`), player list with ready state, host settings, Start button (host only, needs at least 2 players).
3. **Game:** bomb with prompt in the centre, timer ring, current player highlighted, everyone's lives, the active player's live typing visible to all, input auto-focused on your turn, used-word feedback ("already used", "not a word", "doesn't contain TIO").
4. **Results:** placements, longest word, most words, Rematch button.

### Tests required (Vitest)

- Word validation (all rejection reasons)
- Turn order skipping eliminated players
- Life loss and elimination, win detection
- Prompt picking respects difficulty
- Room code generation uses only the allowed alphabet

---

## 8. Phase 2: Hub shell (outline)

- Route `/hub`. If no nickname, send to the landing nickname input.
- Header with nickname (editable) and the wordmark.
- App grid built from `registry.ts`, same brutalist card style as The Index, grouped or filterable by category.
- Live apps open their route. Planned apps show a "coming soon" state.
- "Join with code" box available from the hub.
- Lazy-load each app so the hub stays fast.

---

## 9. Check with the owner first

The old "do not build" list is lifted (2026-10-20). Backends, databases, sign-in, uploads and new apps are all allowed now, as long as they stay **free**. Before adding any of these, describe the plan and get a yes:

- A new service or account (Firebase, Supabase, a TURN server, any paid tier or anything that needs a card).
- Sign-in beyond the nickname, or storing personal data.
- File uploads and hosting.
- Analytics, tracking, ads or cookies beyond `localStorage`.
- Big new dependencies (UI kits, animation libraries, frameworks).
- Anything that changes the stack in section 3.

Still holds: don't name things after other products' trademarks (e.g. not "GeoGuessr", "Wordle" or "Connections"). Pick our own names.

---

## 10. Open questions (ask, don't assume)

- Final name and domain (`lepakhub.com`, `lepak.gg`, `lepakhub.app`?). Use `[DOMAIN]` until decided.
- License: decided 2026-10-23: AGPL-3.0 (LICENSE file).
- GitHub org/repo URL: use `[REPO URL]`.
- Room URL format (`/r/:code` vs `/wordbomb/r/:code`).
- Max upload size for future Lepak Pages: `[MAX SIZE]`.

---

## 11. First tasks for you

1. Scaffold the repo: Vite + React + TS (strict), Tailwind, React Router, ESLint, Prettier, Vitest, pnpm.
2. Add the folder structure from section 4, `registry.ts` with all 8 manifests (WordBomb `live`-ish placeholder route, the rest `planned`).
3. Add `lib/identity.ts` and `lib/roomCode.ts` with tests.
4. Build the brutalist shared components: `Button` (hard shadow press), `Input`, `Sticker`, `Marquee`, `Typewriter`, `SectionLabel`, `IndexCard`.
5. Build the landing page (section 6) using those components and the registry.
6. Add a `/hub` stub page.
7. Write `README.md` (what it is, how to run, how to add an app) and `CONTRIBUTING.md`.
8. Stop and summarise what was built and anything you were unsure about before moving to Phase 2.
