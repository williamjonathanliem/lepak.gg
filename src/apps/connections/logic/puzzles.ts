// Original puzzles written for Lepak.gg. 4 groups of 4, level 0 (easiest) to 3 (trickiest).
// Red herrings are fine, but every word must belong to exactly one group.
// Adding puzzles at the end is safe; reordering changes which puzzle lands on which day.

export interface Group {
  title: string;
  words: readonly [string, string, string, string];
  level: 0 | 1 | 2 | 3;
}

export interface Puzzle {
  id: number;
  groups: readonly [Group, Group, Group, Group];
}

export const PUZZLES: readonly Puzzle[] = [
  {
    id: 1,
    groups: [
      { level: 0, title: 'Planets', words: ['MARS', 'VENUS', 'SATURN', 'EARTH'] },
      { level: 1, title: 'Things with keys', words: ['PIANO', 'KEYBOARD', 'MAP', 'LOCK'] },
      { level: 2, title: '___ball', words: ['FOOT', 'BASKET', 'SNOW', 'EYE'] },
      { level: 3, title: 'Hidden animals', words: ['CARPET', 'BEARD', 'SCOWL', 'ANTHEM'] },
    ],
  },
  {
    id: 2,
    groups: [
      { level: 0, title: 'Colours', words: ['RED', 'BLUE', 'GREEN', 'PINK'] },
      { level: 1, title: 'Malaysian food', words: ['SATAY', 'LAKSA', 'RENDANG', 'CENDOL'] },
      { level: 2, title: 'In a classroom', words: ['CHALK', 'DESK', 'PROJECTOR', 'WHITEBOARD'] },
      { level: 3, title: '___ bear', words: ['POLAR', 'TEDDY', 'GUMMY', 'SUN'] },
    ],
  },
  {
    id: 3,
    groups: [
      { level: 0, title: 'Weather', words: ['RAIN', 'SNOW', 'HAIL', 'FOG'] },
      { level: 1, title: 'Chess pieces', words: ['KING', 'QUEEN', 'ROOK', 'PAWN'] },
      {
        level: 2,
        title: 'Fruits that are also colours',
        words: ['ORANGE', 'LIME', 'PLUM', 'PEACH'],
      },
      { level: 3, title: '___fly', words: ['BUTTER', 'DRAGON', 'FIRE', 'HOUSE'] },
    ],
  },
  {
    id: 4,
    groups: [
      { level: 0, title: 'Has wheels', words: ['BICYCLE', 'CART', 'TROLLEY', 'SKATEBOARD'] },
      { level: 1, title: 'Kopitiam drinks', words: ['TEH', 'KOPI', 'MILO', 'SIRAP'] },
      { level: 2, title: 'Instruments', words: ['DRUM', 'FLUTE', 'VIOLIN', 'HARP'] },
      { level: 3, title: '___stick', words: ['CHOP', 'LIP', 'JOY', 'YARD'] },
    ],
  },
  {
    id: 5,
    groups: [
      { level: 0, title: 'Body parts', words: ['ARM', 'LEG', 'NOSE', 'KNEE'] },
      { level: 1, title: 'Things you do online', words: ['LIKE', 'SHARE', 'FOLLOW', 'POST'] },
      { level: 2, title: 'In your wallet', words: ['CARD', 'CASH', 'RECEIPT', 'PHOTO'] },
      { level: 3, title: 'Hidden body parts', words: ['SHIP', 'SHINY', 'EARN', 'LAPTOP'] },
    ],
  },
  {
    id: 6,
    groups: [
      { level: 0, title: 'Shapes', words: ['CIRCLE', 'SQUARE', 'TRIANGLE', 'OVAL'] },
      { level: 1, title: 'Uni stress', words: ['QUIZ', 'MIDTERM', 'FINAL', 'VIVA'] },
      { level: 2, title: 'Ways to say hi', words: ['HELLO', 'HEY', 'YO', 'HOWDY'] },
      { level: 3, title: '___fish', words: ['STAR', 'JELLY', 'SWORD', 'CAT'] },
    ],
  },
  {
    id: 7,
    groups: [
      { level: 0, title: 'Pets', words: ['DOG', 'RABBIT', 'HAMSTER', 'PARROT'] },
      { level: 1, title: 'Sticky things', words: ['GLUE', 'TAPE', 'HONEY', 'GUM'] },
      { level: 2, title: 'Malaysian states', words: ['PERAK', 'JOHOR', 'KEDAH', 'SABAH'] },
      { level: 3, title: 'Hidden numbers', words: ['OFTEN', 'WEIGHT', 'CANINE', 'STONE'] },
    ],
  },
  {
    id: 8,
    groups: [
      { level: 0, title: 'Kitchen tools', words: ['WHISK', 'LADLE', 'SPATULA', 'KNIFE'] },
      { level: 1, title: 'Phone parts', words: ['SCREEN', 'BATTERY', 'CAMERA', 'SPEAKER'] },
      { level: 2, title: '___cake', words: ['CUP', 'PAN', 'CHEESE', 'SPONGE'] },
      { level: 3, title: 'Anagrams of STOP', words: ['POTS', 'TOPS', 'SPOT', 'OPTS'] },
    ],
  },
  {
    id: 9,
    groups: [
      { level: 0, title: 'Big cats', words: ['LION', 'TIGER', 'LEOPARD', 'JAGUAR'] },
      { level: 1, title: 'Things you charge', words: ['PHONE', 'WATCH', 'EARBUDS', 'POWERBANK'] },
      { level: 2, title: 'Numbers in Malay', words: ['SATU', 'DUA', 'TIGA', 'EMPAT'] },
      { level: 3, title: 'Add LAND for a country', words: ['ICE', 'FIN', 'POL', 'THAI'] },
    ],
  },
  {
    id: 10,
    groups: [
      { level: 0, title: 'Breakfast', words: ['EGG', 'TOAST', 'CEREAL', 'PANCAKE'] },
      { level: 1, title: 'Animal sounds', words: ['MOO', 'OINK', 'QUACK', 'BARK'] },
      { level: 2, title: 'Parts of a tree', words: ['ROOT', 'BRANCH', 'LEAF', 'TRUNK'] },
      { level: 3, title: '___light', words: ['SUN', 'MOON', 'FLASH', 'TRAFFIC'] },
    ],
  },
  {
    id: 11,
    groups: [
      { level: 0, title: 'Racket sports', words: ['TENNIS', 'BADMINTON', 'SQUASH', 'PADEL'] },
      { level: 1, title: 'Have scales', words: ['FISH', 'PIANO', 'MAP', 'SNAKE'] },
      {
        level: 2,
        title: 'Malaysian fruits',
        words: ['DURIAN', 'RAMBUTAN', 'MANGOSTEEN', 'CEMPEDAK'],
      },
      { level: 3, title: '___cup', words: ['TEA', 'WORLD', 'BUTTER', 'HIC'] },
    ],
  },
  {
    id: 12,
    groups: [
      { level: 0, title: 'In the sky', words: ['CLOUD', 'SUN', 'MOON', 'STAR'] },
      { level: 1, title: 'Code words', words: ['LOOP', 'BUG', 'ARRAY', 'CLASS'] },
      { level: 2, title: 'School subjects', words: ['MATH', 'HISTORY', 'ART', 'BIOLOGY'] },
      { level: 3, title: 'Things you can break', words: ['RECORD', 'PROMISE', 'HEART', 'SILENCE'] },
    ],
  },
];
