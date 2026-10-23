# Contributing to Lepak.gg

Thanks for wanting to help. Lepak.gg is made and run by one student, [William Jonathan](https://github.com/williamjonathanliem), who decides what goes into it. Small fixes are always welcome. Bigger changes start with a conversation, so nobody spends a weekend on something that can't be merged.

## The short version

1. **Small fix** (typo, broken link, clearer label, a missing test): just open a pull request.
2. **Anything bigger** (a feature, a new app, a redesign, a new library, a change to how data
   is stored): open an issue first and **wait for a maintainer to label it `approved`**.
   Pull requests for unapproved work may be closed without review.
3. The maintainers have the final say on what is merged, how it looks and what it's called.
   They may ask for changes, rework your pull request, or decline it.

## Quick start (about 5 minutes)

You don't need any accounts or keys. Without them, the site runs in **"this device only"
mode**: multiplayer works between tabs on your own computer, and the AI tools are off.

```bash
corepack enable
pnpm install
pnpm dev
```

Open http://localhost:5173. To play KataBomb against yourself, open the same room link in a
second tab.

**The keys and services stay with the owner.** Contributors don't get access to the production
Firebase, Supabase, Vercel or Gemini accounts, or to any user data. If your approved change
really needs a live service, make your own free test project for development and say so in
the issue; never point your copy at the live one.

## How it works

1. **Find or open an issue.** Check the
   [issues](https://github.com/williamjonathanliem/lepak.gg/issues). Comment on one you'd like
   to take, and wait to be assigned so two people don't build the same thing.
2. **Branch:** `git checkout -b feat/short-name` (or `fix/...`, `docs/...`).
3. **Commit** with [Conventional Commits](https://www.conventionalcommits.org):
   `feat: add join-with-code box`, `fix: marquee jumps on Safari`, `docs: explain room codes`.
4. **Open a pull request** that links the issue, says what changed and how you tested it. Keep
   it to one thing. CI runs every check below.

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

| Folder                 | What's in it                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `src/apps/<app>/`      | One folder per app: `manifest.ts`, `index.tsx`, and usually `logic/`, `net/`, `ui/` |
| `src/apps/registry.ts` | The list of all apps. The hub, menu and routes are built from it                    |
| `src/components/`      | Shared pieces: `AppHeader` (top bar + menu), `Button`, `Input`, `Marquee`...        |
| `src/lib/`             | Shared helpers: identity, room codes, Firebase, storage, direct connections         |
| `src/pages/`           | Landing page, hub, admin, Privacy and Terms                                         |
| `src/copy/`            | Text for the landing page and hub                                                   |
| `api/`                 | Server functions on Vercel                                                          |
| `database.rules.json`  | Firebase security rules: who may read and write what                                |
| `e2e/`                 | Playwright browser tests                                                            |

## New apps

New apps are the owner's decision. Propose one in an issue: what it does, who it's for, and why it
belongs in Lepak.gg. If it's approved, a maintainer gives it a number and a name, and you build
it in its own folder under `src/apps/`, added to `src/apps/registry.ts`. Ask in the issue if
you're unsure how; you'll be pointed to an existing app to copy the shape from.

## Ground rules

### Code

- **Rules are pure functions.** Game and app logic lives in `logic/` as plain TypeScript
  (state in, state out) with Vitest tests. No React or network code inside.
- **Check everything from the network.** Messages between players, server replies and AI
  output are checked with Zod before they're used.
- **Multiplayer is host-authoritative.** The host's browser runs the rules; other players only
  send what they want to do.
- **TypeScript strict**, no `any`. Keep comments short and useful, like the code around them.

### Design

- **Follow the existing look.** Brutalist black and white, tokens from `src/styles/index.css`,
  3px borders, square corners, hard shadows. Design changes need an approved issue.
- **Mobile first.** Check every screen at 360px wide.
- **Accessible.** Real `<button>`, `<a>` and `<label>`, visible focus, 44px touch targets, text
  contrast of at least 4.5:1, and respect `prefers-reduced-motion`.

### Words

- Plain, friendly and short. A little Malaysian flavour is welcome ("jom", "lepak", "makan").
- **No em dashes** in anything users see.
- **No made-up numbers.** No invented user counts, stats or testimonials.
- **Original names.** Apps get their own names. If an app is based on someone else's game, say
  so in the tagline ("Inspired by NYT's Wordle.") but never use their name as ours.

### Free, safe and private

- **Free only.** Nothing that needs a card, a paid plan or a new account.
- **No secrets in the code.** Anything starting with `VITE_` ships to every browser, so only
  public config goes there.
- **New data needs approval**, and then three updates in the same pull request: the database
  rules, the clean-up job (nothing lives forever), and the [Privacy page](src/pages/Legal.tsx)
  plus the "What is stored" table in [DEVELOPMENT.md](DEVELOPMENT.md).
- **No tracking.** No analytics, ads or tracking cookies.

### Licences

- New library or data set? Ask in the issue first. Its licence must work in an AGPL-3.0
  project (MIT, BSD, ISC, Apache-2.0, LGPL, GPL-3.0, AGPL-3.0 are fine; "non-commercial only",
  "no derivatives" and GPL-2.0-only are not). Add a row to [CREDITS.md](CREDITS.md).
- Don't copy code from other projects without asking first.

## The name and logo

Contributing doesn't give you any rights to the **Lepak.gg name, wordmark or logo**. They
aren't covered by the code licence (see the [README](README.md#licence-name-and-logo)). Please
don't publish or host a copy under the Lepak.gg name, or present your work as an official
Lepak.gg app or release.

## Reporting things

- **Bugs:** open an issue with what you did, what you expected, what happened, and your
  browser and device. A screenshot helps a lot.
- **Security problems:** don't open a public issue. Email
  [lepak.gg.my@gmail.com](mailto:lepak.gg.my@gmail.com).
- **Content to take down** (copyright, abuse): email the same address with the link.

## Be kind

Be patient and friendly in issues and reviews; we're all learning. Review the code, not the
person. Harassment of any kind isn't welcome, and maintainers may remove comments or block
people who don't follow this.

## Your contribution

By opening a pull request, you confirm that the work is your own (or you have the right to
share it) and you agree it's licensed under the project's [AGPL-3.0 licence](LICENSE). Merged
contributors are credited in the README.
