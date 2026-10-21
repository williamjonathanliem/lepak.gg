# Lepak.gg

A free, open source hub for students. Play party games, study together and use the small tools every class and group project needs. No ads, no signup: pick a nickname and go.

"Lepak" is Malaysian slang for hanging out.

- **Live:** https://lepak-gg.vercel.app (not deployed yet)
- **License:** [MIT](LICENSE)
- **Repo:** https://github.com/williamjonathanliem/lepak.gg

## Run it locally

You need [Node.js](https://nodejs.org) 20 or newer. pnpm comes with Node through corepack.

```bash
corepack enable pnpm   # once per machine
pnpm install
pnpm dev               # http://localhost:5173
```

| Command           | What it does                    |
| ----------------- | ------------------------------- |
| `pnpm dev`        | Dev server with hot reload      |
| `pnpm build`      | Type-check and build to `dist/` |
| `pnpm preview`    | Serve the built site            |
| `pnpm test`       | Run the Vitest tests once       |
| `pnpm test:watch` | Re-run tests on save            |
| `pnpm lint`       | ESLint                          |
| `pnpm format`     | Prettier                        |

## Stack

Vite + React + TypeScript (strict), Tailwind CSS v4, React Router, Zod, Vitest. The site is a static app; the services below are all on free tiers.

## Services

Players never make an account. Each browser gets an invisible guest sign-in (Firebase anonymous auth), and every service checks that guest id.

| Service                               | What it does here                                                                                                                                            | Status                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| **Firebase** Realtime Database + Auth | Guest sign-in, live game rooms (KataBomb), chat, "Want this" votes                                                                                           | Live                      |
| **Supabase** Postgres + Storage       | Lepak Pages: notes, PDFs, HTML sites, and their files                                                                                                        | Planned                   |
| **Vercel**                            | Hosts the site; later a small server function for AI Notes                                                                                                   | Planned                   |
| **GitHub Actions**                    | Pings Supabase every 3 days so the free project doesn't pause ([workflow](.github/workflows/keep-supabase-awake.yml)); later, nightly clean-up of stale data | Live once secrets are set |

### Firebase setup

1. Copy `.env.example` to `.env.local` and fill in the web config from Firebase console > Project settings > Your apps.
2. Firebase console > Realtime Database > **Rules**: paste all of [`database.rules.json`](database.rules.json) and click **Publish**. Do this again every time that file changes.
3. Restart `pnpm dev` after changing `.env.local`.

Without `.env.local`, KataBomb still runs in "this device only" mode (tabs on one machine), which is handy for development.

### What is stored, and for how long

| Data                                                        | Where               | Kept                                          |
| ----------------------------------------------------------- | ------------------- | --------------------------------------------- |
| Game rooms, bingo, Watch Together / Device Drop rooms, chat | Firebase            | Deleted 1 day after the room was last used    |
| Shared whiteboards (drawings, pictures)                     | Firebase            | Deleted 14 days after the last change         |
| Votes for the next app                                      | Firebase            | 30 days                                       |
| Pages and uploaded files                                    | Supabase            | Deleted after 30 days without a visit or edit |
| Guest accounts (anonymous sign-in)                          | Firebase + Supabase | Deleted after 30 days unused                  |
| Nickname, guest id, stats, solo board, citations            | Your browser        | Cleared after 30 days unused                  |

The nightly [clean-up job](.github/workflows/cleanup.yml) does the deleting ([script](scripts/cleanup/cleanup.mjs)). It needs four GitHub secrets, listed at the top of the workflow. Try it with **Run workflow** and _dry run_ ticked first. The same numbers are on the [Privacy page](src/pages/Legal.tsx); change both together.

Pages are **unlisted** by default: only people with the link can open them.

### HTML hosting (invite only)

Lepak Pages can host plain HTML sites, but only for people who enter the invite code. Uploaded HTML is shown inside a locked-down frame on a separate origin, so it can't read anyone's sign-in or Lepak data. Ask the project owner for a code. The code itself lives only in the database, never in this repo.

### Secrets

Anything in `VITE_*` variables ships to every browser, so only public config goes there. Real secrets (Supabase service key, Firebase admin key, Gemini key, the HTML invite code) live only in Vercel / GitHub Actions / Supabase settings.

## Project layout

```
src/
  app/          router
  pages/        Landing, Hub, NotFound (landing/ holds the landing sections)
  apps/         one folder per hub app + registry.ts
  components/   shared brutalist UI: Button, Input, Sticker, Marquee, Typewriter, SectionLabel, IndexCard
  copy/         UI text, kept out of components so it can be translated later
  lib/          identity (nickname + playerId), room codes, typewriter logic, site constants
  styles/       Tailwind entry + design tokens
public/words/   dictionaries (for WordBomb)
```

## Add an app

Every app is one folder plus one line in the registry.

1. Create `src/apps/<your-app>/manifest.ts`:

   ```ts
   import type { AppManifest } from '../types';

   export const yourApp: AppManifest = {
     id: 'your-app',
     number: '009',
     name: 'Your App',
     tagline: 'One line about it.',
     category: 'tools',
     accent: '#4fd1e8', // the app's one colour; black text must stay readable on it
     status: 'planned', // shows as "coming soon", no route yet
     multiplayer: false,
   };
   ```

2. Add `yourApp` to the `APPS` list in `src/apps/registry.ts`.

That's it: the card shows up in The Index and the marquee.

When the app is ready to open, switch it to `status: 'beta'` (or `'live'`) and add a route and a lazy loader:

```ts
  status: 'beta',
  route: '/your-app',
  load: () => import('./index'), // index.tsx default-exports your app component
```

The router picks it up from the registry automatically. Keep rules in plain functions under `logic/` with tests, and keep networking under `net/`.

## Design

Brutalist black and white. Tokens live in `src/styles/index.css` (`ink`, `paper`, `mute`, `shadow-hard`, `px-gutter`...). Use those instead of raw hex values. Borders are 3px, corners are square, and shadows are hard offsets. Every screen must work at 360px wide.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to help, and [CLAUDE.md](CLAUDE.md) for the full project brief. Open-source libraries and data we use are listed in [CREDITS.md](CREDITS.md).

## Checks on every push

- **CI** ([workflow](.github/workflows/ci.yml)): lint, tests, build, then a Lighthouse check (accessibility must stay at 95+).
- **CodeQL** ([workflow](.github/workflows/codeql.yml)): GitHub's free security scan.
- **Dependabot** ([config](.github/dependabot.yml)): pull requests for dependency updates.

## Contributors

Everyone who helps gets credited here. Install the [all-contributors bot](https://allcontributors.org/docs/en/bot/installation), then comment `@all-contributors please add @username for code` on any issue or pull request.

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- ALL-CONTRIBUTORS-LIST:END -->
