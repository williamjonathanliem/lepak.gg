# Contributing to Lepak.gg

Thanks for helping. This is a student project, so questions are welcome and nothing here is too small.

## Getting started

1. Fork the repo and clone your fork.
2. Install and run it (see [README.md](README.md#run-it-locally)).
3. Make a branch: `git checkout -b feat/short-name`.

## Before you open a pull request

Run these. All four should pass.

```bash
pnpm lint
pnpm test
pnpm build
pnpm format:check
```

## Ground rules

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org): `feat: add join-with-code box`, `fix: marquee jumps on Safari`, `chore: bump deps`.
- **Static only.** No backend, database, accounts, analytics, ads or cookies. If your idea needs one, open an issue to discuss first.
- **Game and app rules are pure functions** (state in, state out) with Vitest tests. No React or networking inside them.
- **Mobile first.** Check your change at 360px wide.
- **Accessible.** Real `<button>`, `<a>` and `<label>` elements, visible focus, 44px touch targets, text contrast of at least 4.5:1, and respect `prefers-reduced-motion`.
- **Copy** is plain, friendly and short. A little Malaysian flavour is good ("jom", "lepak", "makan"). No em dashes. Put UI text in `src/copy/`, not inline in components.
- **No made-up numbers.** Don't invent user counts, stats or testimonials. Write `[PLACEHOLDER]` if something is unknown.
- **No real brand names** of other games or products as app names.

## Adding a new app

See [README.md](README.md#add-an-app). Start with a `planned` manifest so others can see what you're working on, then open an issue describing the idea.

## Reporting bugs

Open an issue with what you did, what you expected and what happened. Include your browser and device.
