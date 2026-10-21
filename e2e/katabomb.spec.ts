import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Two tabs play a real KataBomb room against each other ("this device only" mode).

const WORDS = readFileSync('public/words/en.txt', 'utf8')
  .split('\n')
  .map((w) => w.trim());

/** A real word containing the prompt, for whoever holds the bomb. */
function wordFor(prompt: string, used: Set<string>): string {
  const word = WORDS.find((w) => w.length >= 4 && w.includes(prompt) && !used.has(w));
  if (!word) throw new Error(`no word for ${prompt}`);
  used.add(word);
  return word;
}

async function openRoom(host: Page, guest: Page) {
  for (const p of [host, guest]) {
    await p.addInitScript(() => localStorage.setItem('lepak.nickname', 'kaki'));
  }
  await host.goto('/katabomb');
  await host.getByRole('button', { name: 'Create room' }).click();
  await expect(host).toHaveURL(/\/katabomb\/r\/[A-Z0-9]{4}$/);
  await guest.goto(host.url());
  await expect(host.getByRole('button', { name: /kick kaki/i })).toBeVisible();
}

test('two players take turns and the bomb passes on a good word', async ({ context }) => {
  const host = await context.newPage();
  const guest = await context.newPage();
  await openRoom(host, guest);

  await host.getByRole('button', { name: 'Start game' }).click();
  const used = new Set<string>();

  // Play three good words, whoever's turn it is.
  for (let i = 0; i < 3; i++) {
    // Wait until one of the two tabs has the word box (it's their turn).
    await expect
      .poll(
        async () =>
          (await host.locator('#kb-word').isVisible()) ||
          (await guest.locator('#kb-word').isVisible()),
        { timeout: 15_000 },
      )
      .toBe(true);
    const holder = (await host.locator('#kb-word').isVisible()) ? host : guest;
    const other = holder === host ? guest : host;
    const box = holder.locator('#kb-word');
    const prompt = ((await box.getAttribute('placeholder')) ?? '').replace(/^Your turn: /, '');
    await box.fill(wordFor(prompt.toLowerCase(), used));
    await box.press('Enter');
    // The bomb moves to the other player.
    await expect(other.locator('#kb-word')).toBeVisible({ timeout: 10_000 });
  }
  await expect(host.getByText(/3 words used/i)).toBeVisible();
});

test('the host can kick someone, and they cannot come back', async ({ context }) => {
  const host = await context.newPage();
  const guest = await context.newPage();
  await openRoom(host, guest);

  await host.getByRole('button', { name: /kick kaki/i }).click();
  await expect(guest.getByText('The host removed you from this room.')).toBeVisible();
  await guest.reload();
  await expect(guest.getByText('The host removed you from this room.')).toBeVisible();
});
