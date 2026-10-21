import { apaAuthors, cite, initials, inText, toHtml, toPlain, type Source } from './cite';

const journal: Source = {
  type: 'journal',
  authors: [
    { first: 'Siti Nur', last: 'Rahman' },
    { first: 'Wei Ming', last: 'Tan' },
  ],
  date: { year: 2023 },
  title: 'Sleep and exam performance in university students',
  container: 'Journal of Student Health',
  volume: '12',
  issue: '3',
  pages: '45-67',
  doi: '10.1234/jsh.2023.045',
};

const book: Source = {
  type: 'book',
  authors: [{ first: 'Aminah', last: 'Yusof' }],
  date: { year: 2020 },
  title: 'Introduction to statistics',
  edition: '2',
  publisher: 'Penerbit Universiti',
};

const website: Source = {
  type: 'website',
  authors: [{ first: '', last: 'World Health Organization', org: true }],
  date: { year: 2024, month: 3, day: 5 },
  title: 'Healthy diet',
  container: 'World Health Organization',
  url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
};

const today = { year: 2026, month: 10, day: 21 };

describe('names', () => {
  it('makes initials, including hyphenated names', () => {
    expect(initials('Siti Nur')).toBe('S. N.');
    expect(initials('Jean-Paul')).toBe('J.-P.');
  });

  it('lists APA authors with "&" and the 21+ rule', () => {
    const p = (n: number) => ({ first: 'A', last: `L${n}` });
    expect(apaAuthors([p(1)])).toBe('L1, A.');
    expect(apaAuthors([p(1), p(2)])).toBe('L1, A., & L2, A.');
    expect(apaAuthors([p(1), p(2), p(3)])).toBe('L1, A., L2, A., & L3, A.');
    const many = apaAuthors(Array.from({ length: 22 }, (_, i) => p(i + 1)));
    expect(many).toContain('L19, A., . . . L22, A.');
    expect(many).not.toContain('L20');
  });
});

describe('APA 7', () => {
  it('formats a journal article', () => {
    expect(toPlain(cite(journal, 'apa'))).toBe(
      'Rahman, S. N., & Tan, W. M. (2023). Sleep and exam performance in university students. ' +
        'Journal of Student Health, 12(3), 45–67. https://doi.org/10.1234/jsh.2023.045',
    );
    // journal name and volume in italics
    expect(toHtml(cite(journal, 'apa'))).toContain(
      '<i>Journal of Student Health</i>, <i>12</i>(3)',
    );
  });

  it('formats a book with edition', () => {
    expect(toPlain(cite(book, 'apa'))).toBe(
      'Yusof, A. (2020). Introduction to statistics (2nd ed.). Penerbit Universiti.',
    );
  });

  it('formats a web page and drops the site name when it matches the author', () => {
    expect(toPlain(cite(website, 'apa'))).toBe(
      'World Health Organization. (2024, March 5). Healthy diet. ' +
        'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    );
  });

  it('puts the title first and uses n.d. when needed', () => {
    const s: Source = { ...website, authors: [], date: {} };
    expect(toPlain(cite(s, 'apa'))).toMatch(
      /^Healthy diet\. \(n\.d\.\)\. World Health Organization\./,
    );
  });

  it('makes in-text citations', () => {
    expect(inText(journal, 'apa')).toBe('(Rahman & Tan, 2023)');
    expect(inText(book, 'apa')).toBe('(Yusof, 2020)');
    expect(
      inText(
        { ...book, authors: [book.authors[0]!, journal.authors[0]!, journal.authors[1]!] },
        'apa',
      ),
    ).toBe('(Yusof et al., 2020)');
  });
});

describe('MLA 9', () => {
  it('formats a journal article', () => {
    expect(toPlain(cite(journal, 'mla'))).toBe(
      'Rahman, Siti Nur, and Wei Ming Tan. “Sleep and exam performance in university students.” ' +
        'Journal of Student Health, vol. 12, no. 3, 2023, pp. 45–67, https://doi.org/10.1234/jsh.2023.045.',
    );
  });

  it('formats a book', () => {
    expect(toPlain(cite(book, 'mla'))).toBe(
      'Yusof, Aminah. Introduction to statistics. 2nd ed., Penerbit Universiti, 2020.',
    );
  });

  it('makes in-text citations', () => {
    expect(inText(journal, 'mla')).toBe('(Rahman and Tan)');
  });
});

describe('Harvard', () => {
  it('formats a web page with an accessed date', () => {
    expect(toPlain(cite(website, 'harvard', today))).toBe(
      'World Health Organization (2024) Healthy diet. Available at: ' +
        'https://www.who.int/news-room/fact-sheets/detail/healthy-diet (Accessed: 21 October 2026).',
    );
  });

  it('formats a journal article', () => {
    expect(toPlain(cite(journal, 'harvard', today))).toBe(
      'Rahman, S. N. and Tan, W. M. (2023) ‘Sleep and exam performance in university students’, ' +
        'Journal of Student Health, 12(3), pp. 45–67. Available at: https://doi.org/10.1234/jsh.2023.045.',
    );
  });

  it('makes in-text citations', () => {
    expect(inText(journal, 'harvard')).toBe('(Rahman and Tan, 2023)');
  });
});

describe('safety', () => {
  it('escapes HTML in rich text', () => {
    expect(toHtml(cite({ ...book, title: '<script>x</script>' }, 'apa'))).not.toContain('<script>');
  });
});
