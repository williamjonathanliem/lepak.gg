// Landing page copy. Kept in one place so translations (BM etc.) can slot in later.
// House style: plain, friendly, short. No em dashes.

import type { NicknameError } from '../lib/identity';

export const NAV = {
  index: 'Index',
  pages: 'Study',
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
  stickers: { noSignup: 'NO SIGNUP', free: '100% FREE', openSource: ['OPEN', 'SOURCE'] },
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
  heading: ['Jom,', 'try it.'],
  body: 'Games, a shared whiteboard, watch parties, file drops and Lepak Pages are live. No signup, just a nickname. Send the code to your group chat and go.',
  games: [
    { label: 'KataBomb', to: '/katabomb', color: '#ff7a45' },
    { label: 'Bingo', to: '/bingo', color: '#ffd23f' },
    { label: 'Watch Together', to: '/watch', color: '#ff8fd0' },
    { label: 'Device Drop', to: '/drop', color: '#4fd1e8' },
    { label: 'Whiteboard', to: '/whiteboard', color: '#b9a2ff' },
    { label: 'Lepak Pages', to: '/pages', color: '#7ee081' },
  ],
};

export const STUDY = {
  label: 'Study kit',
  badge: 'New',
  sticker: 'AI inside',
  heading: ['Drop your notes.', 'Pick what you need.'],
  body: 'Lecture slides, a PDF or a Word file. Turn it into study notes and flashcards, a deck you can present, or a page you can share with the class.',
  options: {
    notes: {
      title: 'Study notes',
      blurb: 'Summary, key terms, flashcards and a quick quiz.',
      button: 'Make notes',
    },
    slides: {
      title: 'Slides',
      blurb: 'Check the plan, then present or download as PowerPoint.',
      button: 'Make slides',
    },
    page: {
      title: 'A shareable page',
      blurb: 'Publish it with its own link or QR. Unlisted by default.',
      button: 'Publish',
    },
  },
  dropTitle: 'Drop a file here',
  dropNow: 'Drop it!',
  browse: 'or tap to choose',
  another: 'Pick another file',
  dropHint: '.pdf / .pptx / .docx / .txt',
  pick: 'Now pick what to make:',
  orStart: 'Or start without a file:',
};

export const STEPS = [
  {
    title: 'Pick a nickname',
    body: 'No email, no password. Just a name your friends know.',
  },
  {
    title: 'Open an app',
    body: 'A party game, a whiteboard, a watch party, a file drop. All free, all in one place.',
  },
  {
    title: 'Send the code',
    body: 'Four letters in the group chat. Everyone is in.',
    chat: { from: 'aiman', text: 'jom main, code KJRW' },
  },
];

export const SOURCE = {
  label: 'Source',
  heading: ['Built by students.', 'Forkable by anyone.'],
  body: 'Every app is one folder. Got an idea? Build it and open a pull request.',
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
