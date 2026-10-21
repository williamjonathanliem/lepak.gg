import type { Difficulty, RejectReason } from './logic/types';

// KataBomb UI text. Plain, short, a bit of Malaysian flavour, no em dashes.

export const KB = {
  name: 'KataBomb',
  tagline: 'Type a word with the letters before the bomb pops.',
  howTo: [
    'You get 2 or 3 letters, like TIO.',
    'Type any real word that has them, like NATION or RATIO.',
    'Too slow and the bomb blows. You lose a life.',
    'No repeats. Last one standing wins.',
  ],
  create: 'Create room',
  join: 'Join',
  codeLabel: '> Room code',
  codePlaceholder: 'KJRW',
  badCode: '4 letters or numbers, like KJRW.',
  localMode:
    'Testing mode: rooms only work between tabs on this device. Open the room link in a second tab to play yourself.',
  notFound: "Can't find that room. It may have closed. Check the code?",
  connecting: 'Connecting...',
  error: 'Could not connect. Check your internet and try again.',
  back: 'Back',
  leave: 'Leave room',
  closeRoom: 'Close room',
  sound: 'Sound',
  soundOn: 'Sound: on',
  soundOff: 'Sound: off',

  lobby: 'Lobby',
  copyLink: 'Copy link',
  copied: 'Copied!',
  showQr: 'Show QR',
  hideQr: 'Hide QR',
  players: 'Players',
  host: 'HOST',
  you: 'YOU',
  ready: 'READY',
  watching: 'WATCHING',
  away: 'AWAY',
  kick: 'Kick',
  closed: 'The host left, so the room closed. Start a new one?',
  kicked: 'The host removed you from this room.',
  imReady: "I'm ready",
  notReady: 'Not ready',
  start: 'Start game',
  needTwo: 'Need at least 2 players. Send the code.',
  waitingHost: 'Waiting for the host to start.',
  loadingWords: 'Loading words...',
  settings: 'Settings',
  lives: 'Lives',
  fuse: 'Fuse (seconds)',
  difficulty: 'Prompts',
  speedUp: 'Fuse speeds up',
  on: 'On',
  off: 'Off',

  yourTurn: 'Your turn! Type a word with',
  theirTurn: (name: string) => `${name} is holding the bomb`,
  watchingNote: "You're watching. You'll play next match.",
  typeHere: 'type here',
  send: 'Send',
  usedCount: (n: number) => `${n} words used`,

  results: 'Results',
  winner: 'Winner',
  noWinner: 'Nobody survived',
  longest: 'Longest word',
  most: 'Most words',
  rematch: 'Rematch',
  toLobby: 'Back to lobby',
  waitRematch: 'Waiting for the host. Rematch?',
  toHub: 'Back to hub',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};

export function rejectMessage(reason: RejectReason, prompt: string): string {
  switch (reason) {
    case 'too-short':
      return 'Too short. 3 letters at least.';
    case 'too-long':
      return 'Too long.';
    case 'not-letters':
      return 'Letters only.';
    case 'missing-prompt':
      return `Doesn't contain ${prompt.toUpperCase()}.`;
    case 'already-used':
      return 'Already used.';
    case 'not-a-word':
      return 'Not a word.';
    case 'not-your-turn':
      return 'Not your turn.';
  }
}
