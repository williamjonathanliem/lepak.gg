import { detectId, mapCrossref, mapOpenLibrary, splitName } from './lookup';

describe('detectId', () => {
  it('finds DOIs, bare or as links', () => {
    expect(detectId('10.1234/jsh.2023.045')).toEqual({ kind: 'doi', id: '10.1234/jsh.2023.045' });
    expect(detectId('https://doi.org/10.1038/nature12373.')).toEqual({
      kind: 'doi',
      id: '10.1038/nature12373',
    });
  });

  it('finds ISBN-10 and ISBN-13 with or without dashes', () => {
    expect(detectId('978-0-13-468599-1')).toEqual({ kind: 'isbn', id: '9780134685991' });
    expect(detectId('0-306-40615-X')).toEqual({ kind: 'isbn', id: '030640615X' });
  });

  it('rejects anything else', () => {
    expect(detectId('hello')).toBeNull();
    expect(detectId('12345')).toBeNull();
  });
});

describe('splitName', () => {
  it('takes the last word as the family name', () => {
    expect(splitName('Siti Nur Rahman')).toEqual({ first: 'Siti Nur', last: 'Rahman' });
    expect(splitName('Plato')).toEqual({ first: '', last: 'Plato' });
  });
});

describe('mapCrossref', () => {
  it('maps a journal article', () => {
    const s = mapCrossref({
      type: 'journal-article',
      title: ['Sleep and exams'],
      author: [{ given: 'Wei Ming', family: 'Tan' }, { name: 'Study Group' }],
      issued: { 'date-parts': [[2023, 5, 2]] },
      'container-title': ['Journal of Student Health'],
      volume: '12',
      issue: '3',
      page: '45-67',
      DOI: '10.1234/x',
    });
    expect(s).toMatchObject({
      type: 'journal',
      title: 'Sleep and exams',
      container: 'Journal of Student Health',
      volume: '12',
      issue: '3',
      pages: '45-67',
      doi: '10.1234/x',
      date: { year: 2023, month: 5, day: 2 },
    });
    expect(s.authors).toEqual([
      { first: 'Wei Ming', last: 'Tan' },
      { first: '', last: 'Study Group', org: true },
    ]);
  });

  it('treats books as books with just a year', () => {
    const s = mapCrossref({
      type: 'book',
      title: ['Stats'],
      issued: { 'date-parts': [[2020, 1]] },
    });
    expect(s.type).toBe('book');
    expect(s.date).toEqual({ year: 2020 });
  });
});

describe('mapOpenLibrary', () => {
  it('maps a book', () => {
    const s = mapOpenLibrary({
      title: 'Effective Java',
      authors: [{ name: 'Joshua Bloch' }],
      publishers: [{ name: 'Addison-Wesley' }],
      publish_date: 'Dec 27, 2017',
    });
    expect(s).toMatchObject({
      type: 'book',
      title: 'Effective Java',
      publisher: 'Addison-Wesley',
      date: { year: 2017 },
      authors: [{ first: 'Joshua', last: 'Bloch' }],
    });
  });
});
