# Contributing to Lepak.gg

Thanks for helping! Lepak.gg is a student project, so questions are welcome and no fix is too
small. Typos, a clearer button label, a new test: all good.

## Quick start (about 5 minutes)

You don't need any accounts or keys to start. Without them, the site runs in **"this device
only" mode**: multiplayer games work between tabs on your own computer.

```bash
corepack enable
pnpm install
pnpm dev
```

Open http://localhost:5173. To play KataBomb against yourself, open the same room link in a
second tab.

Want the real services (Firebase, Supabase, Gemini)? Copy `.env.example` to `.env.local` and
fill it in. See [README: Run it locally](README.md#run-it-locally) and
[Services](README.md#services).

## How we work

1. **Pick something.** Check the [issues](https://github.com/williamjonathanliem/lepak.gg/issues).
   For anything bigger than a small fix, comment first so two people don't build the same thing.
2. **Branch:** `git checkout -b feat/short-name` (or `fix/...`, `docs/...`).
3. **Commit** with [Conventional Commits](https://www.conventionalcommits.org):
   `feat: add join-with-code box`, `fix: marquee jumps on Safari`, `docs: explain room codes`.
4. **Open a pull request** and fill in what changed and how you tested it. CI runs everything
   below automatically.

## Checks (run these before opening a pull request)

```bash
pnpm lint           # ESLint
pnpm test           # unit tests (Vitest)
pnpm build          # type check + production build
pnpm format:check   # Prettier (pnpm format fixes it)
pnpm e2e            # browser tests (Playwright): needs Chrome installed
```

CI also runs a Lighthouse check (accessibility 95+, performance 90+) on every push.

## Where things live

| Folder                 | What's in it                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `src/apps/<app>/`      | One folder per app: `manifest.ts`, `index.tsx`, and usually `logic/`, `net/`, `ui/`  |
| `src/apps/registry.ts` | The list of all apps. The hub, menu and routes are built from it                     |
| `src/components/`      | Shared pieces: `AppHeader` (top bar + menu), `Button`, `Input`, `Marquee`...         |
| `src/lib/`             | Shared helpers: identity, room codes, Firebase, storage, direct connections (`rtc/`) |
| `src/pages/`           | Landing page, hub, Privacy and Terms                                                 |
| `src/copy/`            | Text for the landing page and hub                                                    |
| `api/`                 | Server functions on Vercel (Cite link lookup, AI Notes)                              |
| `database.rules.json`  | Firebase security rules: who may read and write what                                 |
| `supabase/`            | SQL for Lepak Pages (run in the Supabase SQL editor)                                 |
| `scripts/cleanup/`     | The nightly job that deletes old data                                                |
| `e2e/`                 | Playwright browser tests                                                             |

## Adding an app

The short version (full guide: [README: Add an app](README.md#add-an-app)):

1. Make `src/apps/<your-app>/manifest.ts`. Start with `status: 'planned'` so others can see
   what you're working on.
2. Add it to `src/apps/registry.ts`.
3. When it's playable, give it a `route`, a lazy `load`, and `status: 'beta'`. Add its id to
   `src/apps/registry.test.ts`.
4. Use `<AppHeader app={{ name, to, accent }} />` for the top bar.

## Ground rules

### Code

- **Rules are pure functions.** Game and app logic lives in `logic/` as plain TypeScript
  (state in, state out) with Vitest tests. No React or network code inside.
- **Check everything from the network.** Messages between players, server replies and AI
  output are checked with Zod before we use them.
- **Multiplayer is host-authoritative.** The host's browser runs the rules; other players only
  send what they want to do.
- **TypeScript strict**, no `any`. Keep comments short and useful, like the code around them.

### Design

- **Mobile first.** Check every screen at 360px wide.
- **Loud outside, calm inside.** The landing page and hub use the full brutalist look; inside
  apps the router adds `.calm` (thinner borders, normal-case buttons). Don't fight it.
- **Accessible.** Real `<button>`, `<a>` and `<label>`, visible focus, 44px touch targets, text
  contrast of at least 4.5:1, and respect `prefers-reduced-motion`.

### Words

- Plain, friendly and short. A little Malaysian flavour is welcome ("jom", "lepak", "makan").
- **No em dashes** in anything users see.
- **No made-up numbers.** No invented user counts, stats or testimonials. Write `[PLACEHOLDER]`
  if something is unknown.
- **Our own names.** Apps get their own names. If an app is based on someone else's game, say
  so in the tagline ("Inspired by NYT's Wordle.") but never use their name as ours.

### Free, safe and private

- **Free only.** Anything that needs a card, a paid plan or a new account: open an issue and
  ask the maintainers first.
- **Secrets never go in the code.** Anything starting with `VITE_` ships to every browser, so only
  public config goes there. Server keys (Gemini, service accounts) live in Vercel or GitHub
  secrets.
- **New data means three updates.** If your change stores something new:
  1. the database rules (`database.rules.json` or `supabase/`),
  2. the clean-up job (`scripts/cleanup/cleanup.mjs`): nothing lives forever,
  3. the [Privacy page](src/pages/Legal.tsx) and the README's "What is stored" table.
- **No tracking.** No analytics, ads or tracking cookies. `localStorage` is fine for things
  like settings and drafts.

### Licences

- New library or data set? Check its licence works in an AGPL-3.0 project. MIT, BSD, ISC,
  Apache-2.0, LGPL, GPL-3.0 and AGPL-3.0 are fine; "non-commercial only", "no derivatives" and
  GPL-2.0-only are not. Then add a row to [CREDITS.md](CREDITS.md) in the same pull request.
- Ask before copying code from another project, even an open one; keep its licence notice.

## Reporting things

- **Bugs:** open an issue with what you did, what you expected, what happened, and your
  browser and device. A screenshot helps a lot.
- **Security problems:** please don't open a public issue. Email
  [lepak.gg.my@gmail.com](mailto:lepak.gg.my@gmail.com) instead.
- **Content to take down** (copyright, abuse): email the same address with the link.

## Be kind

Be patient and friendly in issues and reviews; we're all learning. Review the code, not the
person. Harassment of any kind isn't welcome here.

## Licence

By contributing, you agree that your work is shared under the project's
[AGPL-3.0 licence](LICENSE).
