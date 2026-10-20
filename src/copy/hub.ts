// Hub copy. Plain, friendly, short. No em dashes.

export const HUB = {
  title: 'Hub',
  hello: (nick: string) => `Hai, ${nick}.`,
  sub: 'Pick something to play. Everything is free, no signup.',
  edit: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  nicknameLabel: 'Nickname',
  joinTitle: 'Got a code?',
  joinLabel: '> Room code',
  joinHint: 'Codes are for KataBomb rooms for now.',
  join: 'Join',
  badCode: '4 letters or numbers, like KJRW.',
  playNow: 'Play now',
  playNowNote: 'ready to go',
  comingSoon: 'Coming soon',
  comingSoonBlurb: 'Tap "Want this" on the ones you want first. Most votes gets built next.',
  dailyDone: (n: number) => `#${n} done ✓`,
  dailyWaiting: (n: number) => `#${n} waiting`,
  players: (min?: number, max?: number) =>
    min && max ? `${min} to ${max} players` : 'Solo, daily',
  backHome: 'Back to the landing page',
};
