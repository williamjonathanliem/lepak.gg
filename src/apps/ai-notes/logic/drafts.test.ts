import { DRAFT_DAYS, deleteDraft, draftAge, loadDrafts, saveDraft } from './drafts';
import type { Notes } from './notes';

const notes = (title: string): Notes => ({
  title,
  summary: 's',
  keyPoints: [],
  terms: [],
  flashcards: [],
  quiz: [],
});
const DAY = 24 * 60 * 60 * 1000;

describe('AI notes drafts', () => {
  beforeEach(() => localStorage.clear());

  it('keeps notes for 7 days, newest first', () => {
    const t = 1_000_000_000_000;
    saveDraft(notes('old'), t);
    saveDraft(notes('new'), t + DAY);
    expect(loadDrafts(t + 2 * DAY).map((d) => d.data.title)).toEqual(['new', 'old']);
    // old is now past 7 days, new is not
    expect(loadDrafts(t + DRAFT_DAYS * DAY).map((d) => d.data.title)).toEqual(['new']);
  });

  it('keeps only the 10 newest and can delete one', () => {
    const t = 1_000_000_000_000;
    for (let i = 0; i < 12; i++) saveDraft(notes(`n${i}`), t + i);
    const all = loadDrafts(t + 20);
    expect(all).toHaveLength(10);
    expect(all[0]!.data.title).toBe('n11');
    expect(deleteDraft(all[0]!.id, t + 20)).toHaveLength(9);
  });

  it('ignores broken saved data', () => {
    localStorage.setItem('lepak.ainotes.drafts', '[{"id":1},"junk"]');
    expect(loadDrafts()).toEqual([]);
  });

  it('says how old a draft is', () => {
    const t = 1_000_000_000_000;
    expect(draftAge(t, t)).toEqual({ saved: 'today', left: 'kept 7 more days' });
    expect(draftAge(t, t + 3 * DAY)).toEqual({ saved: '3 days ago', left: 'kept 4 more days' });
    expect(draftAge(t, t + 6 * DAY).left).toBe('deleted tomorrow');
  });
});
