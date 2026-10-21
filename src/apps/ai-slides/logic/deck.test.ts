import {
  DeckSchema,
  OutlineSchema,
  addSection,
  addSlide,
  deckToMarkdown,
  deleteSlide,
  duplicateSlide,
  linesToPairs,
  moveSlide,
  pairsToLines,
  linesToList,
  moveSection,
  removeSection,
  themeById,
  type Deck,
  type Outline,
} from './deck';

const outline: Outline = {
  title: 'Vaccines',
  subtitle: 'How they work',
  sections: [
    { heading: 'A', points: ['a1'] },
    { heading: 'B', points: [] },
    { heading: 'C', points: [] },
  ],
};

describe('outline editing', () => {
  it('moves, removes and adds slides', () => {
    expect(moveSection(outline, 0, 1).sections.map((s) => s.heading)).toEqual(['B', 'A', 'C']);
    expect(moveSection(outline, 0, -1)).toBe(outline); // can't go above the first
    expect(removeSection(outline, 1).sections.map((s) => s.heading)).toEqual(['A', 'C']);
    expect(addSection(outline, 0).sections.map((s) => s.heading)).toEqual([
      'A',
      'New slide',
      'B',
      'C',
    ]);
  });

  it('never removes the last slide', () => {
    const one = { ...outline, sections: [{ heading: 'Only', points: [] }] };
    expect(removeSection(one, 0)).toBe(one);
  });

  it('turns typed lines into points, dropping bullets and blanks', () => {
    expect(linesToList('- one\n\n• two\n  three  ')).toEqual(['one', 'two', 'three']);
  });
});

describe('deck format', () => {
  const deck: Deck = {
    title: 'Vaccines',
    slides: [
      { layout: 'title', title: 'Vaccines', subtitle: 'How they work', notes: '' },
      {
        layout: 'bullets',
        title: 'Defense squad',
        bullets: ['B cells', 'T cells'],
        notes: 'Say hi',
      },
      { layout: 'quote', title: 'Quote', quote: 'Prevention is better than cure', notes: '' },
    ],
  };

  it('checks what the AI sent', () => {
    expect(DeckSchema.safeParse(deck).success).toBe(true);
    expect(DeckSchema.safeParse({ title: 'x', slides: [{ layout: 'weird' }] }).success).toBe(false);
    expect(OutlineSchema.safeParse(outline).success).toBe(true);
  });

  it('writes markdown for Lepak Pages', () => {
    const md = deckToMarkdown(deck);
    expect(md).toContain('# Vaccines');
    expect(md).toContain('*How they work*');
    expect(md).toContain('## Defense squad\n\n- B cells\n- T cells');
    expect(md).toContain('> Prevention is better than cure');
  });

  it('falls back to the first theme', () => {
    expect(themeById('nope').id).toBe('paper');
  });
});

describe('deck editing', () => {
  const deck: Deck = {
    title: 'T',
    slides: [
      { layout: 'title', title: 'A', notes: '' },
      { layout: 'bullets', title: 'B', bullets: ['x'], notes: '' },
    ],
  };

  it('adds, duplicates, moves and deletes slides', () => {
    const added = addSlide(deck, 0, 'timeline');
    expect(added.slides.map((s) => s.layout)).toEqual(['title', 'timeline', 'bullets']);
    expect(added.slides[1]!.steps).toHaveLength(3);
    const dup = duplicateSlide(deck, 1);
    expect(dup.slides.map((s) => s.title)).toEqual(['A', 'B', 'B']);
    dup.slides[2]!.bullets!.push('changed');
    expect(deck.slides[1]!.bullets).toEqual(['x']); // a real copy, not shared
    expect(moveSlide(deck, 1, -1).slides.map((s) => s.title)).toEqual(['B', 'A']);
    expect(deleteSlide(deck, 0).slides.map((s) => s.title)).toEqual(['B']);
    expect(deleteSlide(deleteSlide(deck, 0), 0).slides).toHaveLength(1); // never empty
  });

  it('turns "label: text" lines into steps and back', () => {
    const pairs = linesToPairs('1914: War starts\n\nArmistice');
    expect(pairs).toEqual([
      { a: '1914', b: 'War starts' },
      { a: 'Armistice', b: '' },
    ]);
    expect(pairsToLines(pairs)).toBe('1914: War starts\nArmistice');
  });
});
