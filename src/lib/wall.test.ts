import { checkNote, readNotes, sortNotes } from './wall';

describe('wall notes', () => {
  it('checks length and manners, and tidies spaces', () => {
    expect(checkNote(' hi ')).toEqual({ ok: false, error: 'too-short' });
    expect(checkNote('a'.repeat(141))).toEqual({ ok: false, error: 'too-long' });
    expect(checkNote('this is shit')).toEqual({ ok: false, error: 'rude' });
    expect(checkNote('dm me 0123456789')).toEqual({ ok: false, error: 'contact' });
    expect(checkNote('  more   games  pls ')).toEqual({ ok: true, text: 'more games pls' });
  });

  it('reads the database, skipping broken notes, and knows which are mine', () => {
    const notes = readNotes(
      {
        a: { text: 'one', kind: 'idea', color: 1, nick: 'ali', uid: 'me', updatedAt: 5 },
        b: { text: 'two', kind: 'nope', color: 0, nick: 'abu', uid: 'x', updatedAt: 6 },
        c: { text: 'three', kind: 'bug', color: 9, nick: 'siti', uid: 'x', updatedAt: 7 },
      },
      { a: { me: true, x: true }, c: { x: true } },
      { c: { a: true, b: true, me: true } },
      'me',
    );
    expect(notes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(notes[0]).toMatchObject({ plus: 2, mine: true, plussed: true });
    expect(notes[1]).toMatchObject({ plus: 1, mine: false, plussed: false, color: 1 });
    // three reports hide a note, unless an admin approved it
    expect(notes[1]).toMatchObject({ reports: 3, reported: true, hidden: true });
    expect(notes[0]!.hidden).toBe(false);
  });

  it('sorts by +1s (newest breaks ties) or by newest', () => {
    const notes = readNotes(
      {
        old: { text: 'old', kind: 'idea', nick: 'ab', updatedAt: 1 },
        mid: { text: 'mid', kind: 'idea', nick: 'ab', updatedAt: 2 },
        neu: { text: 'new', kind: 'idea', nick: 'ab', updatedAt: 3 },
      },
      { old: { x: true, y: true }, mid: { x: true } },
      null,
      'me',
    );
    expect(sortNotes(notes, 'top').map((n) => n.id)).toEqual(['old', 'mid', 'neu']);
    expect(sortNotes(notes, 'new').map((n) => n.id)).toEqual(['neu', 'mid', 'old']);
  });
});
