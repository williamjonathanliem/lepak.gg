// Landing page copy. Kept in one place so translations (BM etc.) can slot in later.
// House style: plain, friendly, short. No em dashes.

import type { NicknameError } from '../lib/identity';

export const NAV = {
  index: 'Index',
  wall: 'Wall',
  class: 'Class',
  source: 'Source',
  enter: '[ Enter ]',
};

export const HERO = {
  label: 'Welcome',
  est: 'EST. 2026, KUALA LUMPUR',
  hello: 'Hello,',
  /** Edit this list to change the typewriter words. */
  typedWords: ['Students', 'Learners', 'Educators(?)', 'Night owls'],
  ariaLabel: 'Hello, students, learners, educators(?) and night owls',
  sub: 'Play, study and share in one hub. Party games, class bingo, watch parties, phone-to-laptop file drops and notes you can publish as a page. Free, open source, no signup.',
  nicknameLabel: '> Pick a nickname',
  nicknamePlaceholder: 'kopiboi',
  submit: 'Jom masuk',
  formNote: 'takes 2 secs',
  stickers: {
    noSignup: 'NO SIGNUP',
    free: '100% FREE',
    // A joke, and the hover owns up to it straight away.
    kopi: { front: '☕ FREE KOPI FOR EVERYONE*', back: '*bring your own kopi lah' },
    certified: { main: ['Lepak.gg', 'Certified'], sub: '✦ free forever ✦' },
  },
};

export const NICKNAME_ERRORS: Record<NicknameError, string> = {
  'too-short': 'At least 2 characters.',
  'too-long': '16 characters max.',
  'bad-chars': 'Letters, numbers, spaces, _ and - only.',
  profane: 'Pick something your lecturer can see.',
};

export const INDEX = {
  label: 'The Index',
  heading: ['The', 'Index.'],
  note: 'start here!',
  blurb:
    'Everything in the hub, grouped. Games to play with friends, a daily puzzle habit, and the study tools you wish someone showed you in week one.',
  counts: (live: number, soon: number) => `${live} live now · ${soon} on the way`,
  live: 'Live',
  soon: 'Soon',
  showMore: (n: number) => `+ ${n} more`,
  showLess: 'Show less',
};

export const DEMO = {
  label: 'Live now',
  footnote: 'No signup. Pick a nickname, send the code to your group chat, go.',
  tabs: [
    {
      id: 'play',
      tab: 'Play',
      heading: ['Jom,', 'play.'],
      body: 'Party games for the group chat and the whole class. Type fast in KataBomb, call numbers in Bingo, or turn lecture slides into a live quiz.',
      links: [
        { label: 'KataBomb', to: '/katabomb', color: '#ff7a45' },
        { label: 'Bingo', to: '/bingo', color: '#ffd23f' },
        { label: 'Notes → Game', to: '/notes-game', color: '#ff8fd0' },
      ],
    },
    {
      id: 'study',
      tab: 'Study',
      heading: ['Study', 'smarter.'],
      body: 'Drop your slides into AI Notes. Get notes, flashcards that come back right before you forget, and quizzes with an exam mode. Or focus together in a Study Room.',
      links: [
        { label: 'AI Notes', to: '/ai-notes', color: '#ffd23f' },
        { label: 'AI Slides', to: '/ai-slides', color: '#b9a2ff' },
        { label: 'Study Room', to: '/study', color: '#4fd1e8' },
      ],
    },
    {
      id: 'hangout',
      tab: 'Hang out',
      heading: ['Makan,', 'then split.'],
      body: 'Snap the receipt, tap who had what, send it to WhatsApp. Spin the wheel for “makan mana?”, then watch something together.',
      links: [
        { label: 'Makan Split', to: '/split', color: '#ffb86b' },
        { label: 'Spin the Wheel', to: '/wheel', color: '#b9a2ff' },
        { label: 'Watch Together', to: '/watch', color: '#ff8fd0' },
      ],
    },
  ],
} as const;

export const CLASS = {
  label: 'For lecturers',
  sticker: 'Class mode',
  heading: ['Bring the', 'whole class.'],
  body: 'Put it on the projector, students join on their phones with a 4-letter code. No student accounts, no app to install, nothing to pay.',
  apps: [
    {
      title: 'Live quiz from your slides',
      blurb: 'Drop your lecture PDF. AI writes the questions, everyone answers on their phone.',
      to: '/notes-game',
      color: '#ff8fd0',
    },
    {
      title: 'Revision bingo',
      blurb: 'Your key terms on everyone’s card. You call, they mark, first line wins.',
      to: '/bingo',
      color: '#ffd23f',
    },
    {
      title: 'One deadline board',
      blurb: 'Add due dates once. The class sees countdowns and adds them to their calendars.',
      to: '/deadlines',
      color: '#7ee081',
    },
    {
      title: 'Focus sessions',
      blurb: 'A shared Pomodoro timer for tutorials and study clubs.',
      to: '/study',
      color: '#4fd1e8',
    },
  ],
};

export const WALL = {
  label: 'The wall',
  sticker: 'Say it',
  heading: ['Stick an idea.', 'Vote the best.'],
  body: 'Want a new game? Found a bug? Love something? Stick a note on the wall. Tap +1 on the ones you agree with. We read every note and build the top ones first.',
  howTo: [
    'Tap a pad (or drag a sheet) to take a note.',
    'Write it short, 140 letters max. Enter sticks it.',
    'Every note is checked before it goes up. One a minute each.',
    'Tap +1 if you agree. Report anything nasty.',
    'Notes come down after 30 days.',
  ],
  textLabel: 'Your note',
  placeholder: 'Add a Malay version of KataBomb pls',
  kindLabel: 'What is it?',
  kinds: { idea: 'Idea', bug: 'Bug', love: 'Love it' },
  colorLabel: 'Colour',
  colorNames: ['Yellow', 'Pink', 'Green', 'Blue'],
  nickLabel: 'Your nickname',
  nickPlaceholder: 'Your nickname',
  takeOne: 'Take a note',
  takeLabel: (colour: string) => `Take a ${colour.toLowerCase()} note`,
  dropHere: 'Drop it on the wall',
  draftLabel: 'Your new note',
  cancel: 'Bin it',
  post: 'Stick it',
  posting: 'Sticking...',
  left: (n: number) => `${n} left`,
  errors: {
    'too-short': 'A bit more than that, please.',
    'too-long': 'Keep it to 140 letters.',
    rude: 'Keep it friendly, please.',
    contact: 'No links, emails or phone numbers, please.',
    nick: 'Pick a nickname first (2 to 16 letters).',
    slow: 'One note a minute. Try again soon.',
    banned: 'You can’t post on the wall right now.',
    unsafe: 'This one can’t go on the wall. Keep it kind and about the site.',
    'self-harm':
      'We can’t post this, but we hear you. Please talk to someone: Befrienders KL, 03-7627 2929, any time.',
    busy: 'Our checker is busy. Try again in a minute.',
    signin: 'Could not connect. Reload the page and try again.',
    setup: 'The wall can’t take new notes yet. We’re on it.',
    failed: 'Could not stick that. Check your internet and try again.',
  },
  posted: 'Stuck! Thanks.',
  sortLabel: 'Sort notes',
  sort: { top: 'Top', new: 'New' },
  by: (nick: string) => `by ${nick}`,
  plus: '+1',
  plusLabel: (n: number, on: boolean) => `${on ? 'Remove your +1' : 'Plus one this'}. ${n} so far.`,
  remove: 'Take down',
  team: 'Team',
  pinned: 'Pinned',
  report: 'Report',
  reported: 'Reported',
  empty: 'Nothing here yet. Be the first to stick a note.',
  loading: 'Loading the wall...',
  offline: 'The wall is offline right now. Try again later.',
  showMore: (n: number) => `+ ${n} more notes`,
  showLess: 'Show fewer',
};

export const SOURCE = {
  label: 'Source',
  heading: ['Built by learners.', 'Forkable by anyone.'],
  body: 'Every app is one folder. Got an idea? Build it and open a pull request. AGPL-3.0: fork it freely, just keep your copy open too.',
  github: 'View on GitHub ↗',
  note: 'fuelled by kopi ais',
};

export const FOOTER = {
  tagline: 'An open source student project. Made in Malaysia.',
  links: {
    github: 'GitHub',
    bug: 'Report a bug',
    contribute: 'Contribute',
    privacy: 'Privacy',
    terms: 'Terms',
    top: 'Top ↑',
  },
  bigWord: 'Lepak.',
  note: 'see you inside',
};
