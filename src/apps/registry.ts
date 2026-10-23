import { isRouted, type AppManifest, type RoutedAppManifest } from './types';
import { katabomb } from './katabomb/manifest';
import { notes } from './notes/manifest';
import { deadlines } from './deadlines/manifest';
import { deviceDrop } from './device-drop/manifest';
import { geoguess } from './geoguess/manifest';
import { studyRoom } from './study-room/manifest';
import { makanSplit } from './makan-split/manifest';
import { freeTimeFinder } from './free-time-finder/manifest';
import { aiNotes } from './ai-notes/manifest';
import { notesToGame } from './notes-to-game/manifest';
import { wordl } from './wordl/manifest';
import { connections } from './connections/manifest';
import { strands } from './strands/manifest';
import { spellingBee } from './spelling-bee/manifest';
import { miniCrossword } from './mini-crossword/manifest';
import { letterBoxed } from './letter-boxed/manifest';
import { tiles } from './tiles/manifest';
import { pips } from './pips/manifest';
import { sudoku } from './sudoku/manifest';
import { whiteboard } from './whiteboard/manifest';
import { trivia } from './trivia/manifest';
import { cite } from './cite/manifest';
import { toolbox } from './toolbox/manifest';
import { bingo } from './bingo/manifest';
import { watch } from './watch/manifest';
import { aiSlides } from './ai-slides/manifest';
import { coinFlip } from './coin-flip/manifest';
import { spinWheel } from './spin-wheel/manifest';
import { sudokuRace } from './sudoku-race/manifest';

// Adding an app: create src/apps/<id>/manifest.ts, then add it to this list.
export const APPS: readonly AppManifest[] = [
  katabomb,
  notes,
  deadlines,
  deviceDrop,
  geoguess,
  studyRoom,
  makanSplit,
  freeTimeFinder,
  aiNotes,
  notesToGame,
  wordl,
  connections,
  strands,
  spellingBee,
  miniCrossword,
  letterBoxed,
  tiles,
  pips,
  sudoku,
  whiteboard,
  trivia,
  cite,
  toolbox,
  bingo,
  watch,
  aiSlides,
  coinFlip,
  spinWheel,
  sudokuRace,
];

export const ROUTED_APPS: readonly RoutedAppManifest[] = APPS.filter(isRouted);
