import { THEMES, type Deck } from '../logic/deck';
import { buildPptx, fileNameFor } from './pptx';

const deck: Deck = {
  title: 'Water: the cycle!',
  slides: [
    { layout: 'title', title: 'Water', subtitle: 'Year 6', notes: 'Hi' },
    { layout: 'section', title: 'Part 1', notes: '' },
    { layout: 'bullets', title: 'Evaporation', bullets: ['Sun heats water'], notes: 'Say this' },
    {
      layout: 'two-column',
      title: 'Compare',
      left: ['a'],
      right: ['b'],
      leftTitle: 'L',
      notes: '',
    },
    {
      layout: 'timeline',
      title: 'Steps',
      steps: [
        { label: '1', text: 'a' },
        { label: '2', text: 'b' },
      ],
      notes: '',
    },
    { layout: 'cards', title: 'Cards', cards: [{ title: 'x', text: 'y' }], notes: '' },
    { layout: 'quote', title: 'Q', quote: 'Water is life', author: 'Someone', notes: '' },
    { layout: 'big-number', title: 'Earth', number: '71%', numberLabel: 'is water', notes: '' },
  ],
};

describe('PowerPoint export', () => {
  it('builds a real .pptx (a zip file) with every layout', async () => {
    const pptx = await buildPptx(deck, THEMES[1]!);
    const data = (await pptx.write({ outputType: 'uint8array' })) as Uint8Array;
    expect(String.fromCharCode(data[0]!, data[1]!)).toBe('PK'); // zip signature
    expect(data.length).toBeGreaterThan(10_000);
  });

  it('makes a safe file name', () => {
    expect(fileNameFor('Water: the cycle!')).toBe('Water-the-cycle.pptx');
    expect(fileNameFor('???')).toBe('slides.pptx');
  });
});
