# Developing Lepak.gg

How to run it, how it's built, and what it stores. Before you change anything, read
[CONTRIBUTING.md](CONTRIBUTING.md): anything beyond a small fix needs an approved issue first.

## Run it locally

You need [Node.js](https://nodejs.org) 22 or newer. pnpm comes with Node through corepack.

```bash
corepack enable pnpm   # once per machine
pnpm install
pnpm dev               # http://localhost:5173
```

Without any keys the site runs in **"this device only" mode**: multiplayer works between tabs on your own computer, and the AI tools are switched off. That's all you need to work on almost everything.

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `pnpm dev`          | Dev server with hot reload                         |
| `pnpm build`        | Type-check and build to `dist/`                    |
| `pnpm preview`      | Serve the built site                               |
| `pnpm test`         | Run the Vitest tests once                          |
| `pnpm test:watch`   | Re-run tests on save                               |
| `pnpm lint`         | ESLint                                             |
| `pnpm format`       | Prettier                                           |
| `pnpm format:check` | Prettier, check only                               |
| `pnpm e2e`          | Browser tests (Playwright): needs Chrome installed |

## Stack

Vite + React + TypeScript (strict), Tailwind CSS v4, React Router, Zod, Vitest. The site is a static app with a few server functions on Vercel. Live rooms and the Wall use Firebase; Lepak Pages uses Supabase; the AI tools use Gemini. Everything runs on free tiers.

Players never make an account. Each browser gets an invisible guest sign-in, and the database rules in [`database.rules.json`](database.rules.json) decide who may read and write what. For security, the AI tools only answer requests that carry that guest sign-in, so bots can't use up the free AI.

## What is stored, and for how long

| Data                                                                                        | Where               | Kept                                          |
| ------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------- |
| Game rooms (incl. Sudoku Race, Ketik Race), bingo, Watch Together / Device Drop rooms, chat | Firebase            | Deleted 1 day after the room was last used    |
| Shared whiteboards (drawings, pictures)                                                     | Firebase            | Deleted 14 days after the last change         |
| Wall notes and votes                                                                        | Firebase            | 30 days                                       |
| Pages and uploaded files                                                                    | Supabase            | Deleted after 30 days without a visit or edit |
| Guest accounts (anonymous sign-in)                                                          | Firebase + Supabase | Deleted after 30 days unused                  |
| Nickname, guest id, stats, solo board, citations                                            | Your browser        | Cleared after 30 days unused                  |

A nightly [clean-up job](.github/workflows/cleanup.yml) does the deleting. The same numbers are on the [Privacy page](src/pages/Legal.tsx); they change together.

Pages are **unlisted** by default: only people with the link can open them.

## Project layout

```
src/
  app/          router
  pages/        Landing, Hub, Admin, Privacy and Terms (landing/ holds the landing sections)
  apps/         one folder per hub app + registry.ts
  components/   shared UI
  copy/         UI text, kept out of components so it can be translated later
  lib/          identity, room codes, Firebase, shared helpers
  styles/       Tailwind entry + design tokens
api/            server functions on Vercel
public/words/   dictionaries
docs/images/    screenshots for the README
```

## Checks on every push

- **CI** ([workflow](.github/workflows/ci.yml)): lint, tests, build, then a Lighthouse check (accessibility 95+, performance 90+).
- **CodeQL** ([workflow](.github/workflows/codeql.yml)): GitHub's free security scan.
- **Dependabot** ([config](.github/dependabot.yml)): pull requests for dependency updates.
