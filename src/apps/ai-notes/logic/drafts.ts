// AI Notes drafts: every set of notes you make is kept on this device for a week, so you
// can come back to it without spending another AI run. See lib/drafts.ts.

import { createDraftStore, draftAge as age, type Draft } from '../../../lib/drafts';
import { NotesSchema, type Notes } from './notes';

const store = createDraftStore<Notes>('lepak.ainotes.drafts', NotesSchema, { days: 7, max: 10 });

export const DRAFT_DAYS = store.days;
export type NotesDraft = Draft<Notes>;

export const loadDrafts = (now?: number) => store.load(now);
export const saveDraft = (notes: Notes, now?: number) => store.save(notes, now);
export const deleteDraft = (id: string, now?: number) => store.remove(id, now);
export const draftAge = (savedAt: number, now?: number) => age(savedAt, DRAFT_DAYS, now);
