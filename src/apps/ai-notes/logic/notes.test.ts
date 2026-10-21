import { NotesSchema, aiFileChecks, bingoWords, slideText, toMarkdown, type Notes } from './notes';

const notes: Notes = {
  title: 'Photosynthesis',
  summary: 'Plants turn light into food.',
  keyPoints: ['Happens in chloroplasts'],
  terms: [
    { term: 'Chlorophyll', meaning: 'Green pigment' },
    { term: 'Calvin cycle', meaning: 'Fixes CO2' },
  ],
  flashcards: [
    { front: 'Stroma', back: 'Where the Calvin cycle happens' },
    { front: 'What does ATP do?', back: 'Carries energy' },
  ],
  quiz: [{ question: 'Where?', options: ['Chloroplast', 'Nucleus'], answer: 0, why: 'Because.' }],
};

describe('AI notes helpers', () => {
  it('accepts good notes and rejects junk from the server', () => {
    expect(NotesSchema.safeParse(notes).success).toBe(true);
    expect(NotesSchema.safeParse({ title: 'x' }).success).toBe(false);
  });

  it('writes markdown for Lepak Pages', () => {
    const md = toMarkdown(notes);
    expect(md).toContain('# Photosynthesis');
    expect(md).toContain('- **Chlorophyll**: Green pigment');
    expect(md).toContain('*Answer: Chloroplast. Because.*');
    expect(md).toContain('AI can get things wrong');
  });

  it('picks short bingo words, no questions, no repeats', () => {
    expect(bingoWords(notes)).toEqual(['Chlorophyll', 'Calvin cycle', 'Stroma']);
  });

  it('reads the text out of a slide', () => {
    const xml =
      '<p:sld><a:p><a:r><a:t>Cell </a:t></a:r><a:r><a:t>biology</a:t></a:r></a:p>' +
      '<a:p><a:r><a:t>Mitochondria &amp; ATP</a:t></a:r></a:p><a:p></a:p></p:sld>';
    expect(slideText(xml)).toBe('Cell biology\nMitochondria & ATP');
  });
});

describe('dropped file checks', () => {
  it('passes good files and flags bad ones', () => {
    const MB = 1024 * 1024;
    expect(aiFileChecks({ name: 'slides.PPTX', size: 8 * MB }).every((c) => c.ok)).toBe(true);
    const bigPdf = aiFileChecks({ name: 'book.pdf', size: 5 * MB });
    expect(bigPdf[1]).toEqual({ label: 'Size: 5.0 MB of 3.0 MB max', ok: false });
    expect(aiFileChecks({ name: 'song.mp3', size: 1000 })[0]!.ok).toBe(false);
  });
});
