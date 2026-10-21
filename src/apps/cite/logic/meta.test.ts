import { detectId, mapCsl, mapEuropePmc, mapPageMeta } from './lookup';
import { parseDateParts, parseMeta } from './meta';

const journalPage = `<!doctype html><html><head>
<title>Some article | Journal site</title>
<meta name="citation_title" content="Sleep &amp; memory in students">
<meta name="citation_author" content="Rahman, Siti Nur">
<meta name="citation_author" content="Wei Ming Tan">
<meta name="citation_publication_date" content="2015/10/02">
<meta name="citation_journal_title" content="Journal of Student Health">
<meta name="citation_volume" content="12"><meta name="citation_issue" content="3">
<meta name="citation_firstpage" content="45"><meta name="citation_lastpage" content="67">
<meta property="og:site_name" content="Journal site">
</head><body>...</body></html>`;

const newsPage = `<html><head>
<meta property="og:title" content="Rain expected across Klang Valley - The Daily">
<meta property="og:site_name" content="The Daily">
<meta property="article:published_time" content="2026-10-20T08:00:00Z">
<meta name='author' content='Aminah Yusof'>
</head></html>`;

describe('parseMeta', () => {
  it('reads Google Scholar citation tags', () => {
    const m = parseMeta(journalPage, 'https://example.org/a');
    expect(m).toMatchObject({
      title: 'Sleep & memory in students',
      authors: ['Rahman, Siti Nur', 'Wei Ming Tan'],
      date: '2015/10/02',
      journal: 'Journal of Student Health',
      volume: '12',
      issue: '3',
      firstPage: '45',
      lastPage: '67',
    });
  });

  it('falls back to Open Graph and author tags', () => {
    const m = parseMeta(newsPage);
    expect(m.title).toBe('Rain expected across Klang Valley - The Daily');
    expect(m.siteName).toBe('The Daily');
    expect(m.authors).toEqual(['Aminah Yusof']);
  });

  it('uses <title> when nothing else is there', () => {
    expect(parseMeta('<title>Just a page</title>').title).toBe('Just a page');
  });
});

describe('JSON-LD', () => {
  it('reads article date, authors and publisher, skipping broken blocks', () => {
    const html = `<script type="application/ld+json">{ not json</script>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"NewsArticle","headline":"Budget 2027 explained","datePublished":"2026-10-10T09:00:00+08:00",
         "author":[{"@type":"Person","name":"Lim Wei Jie"}],"publisher":{"@type":"Organization","name":"The Daily"}}]}</script>`;
    const m = parseMeta(html);
    expect(m).toMatchObject({
      title: 'Budget 2027 explained',
      date: '2026-10-10T09:00:00+08:00',
      authors: ['Lim Wei Jie'],
      siteName: 'The Daily',
    });
  });

  it('falls back to the web address for the site name', () => {
    const s = mapPageMeta(parseMeta('<title>Healthy diet</title>'), 'https://www.who.int/x');
    expect(s.container).toBe('who.int');
  });
});

describe('parseDateParts', () => {
  it('reads common date shapes', () => {
    expect(parseDateParts('2015/10/02')).toEqual({ year: 2015, month: 10, day: 2 });
    expect(parseDateParts('2026-10-20T08:00:00Z')).toEqual({ year: 2026, month: 10, day: 20 });
    expect(parseDateParts('2019')).toEqual({ year: 2019 });
    expect(parseDateParts(undefined)).toEqual({});
  });
});

describe('detectId', () => {
  it('recognises PubMed Central, PubMed and arXiv links before DOIs', () => {
    expect(detectId('https://pmc.ncbi.nlm.nih.gov/articles/PMC4594631/')).toEqual({
      kind: 'pmc',
      id: 'PMC4594631',
    });
    expect(detectId('https://pubmed.ncbi.nlm.nih.gov/26438191/')).toEqual({
      kind: 'pmid',
      id: '26438191',
    });
    expect(detectId('https://arxiv.org/abs/1706.03762')).toEqual({
      kind: 'arxiv',
      id: '1706.03762',
    });
  });

  it('treats other links as web pages, with or without https://', () => {
    expect(detectId('https://www.bbc.com/news/x')).toEqual({
      kind: 'url',
      id: 'https://www.bbc.com/news/x',
    });
    expect(detectId('who.int/news')).toEqual({ kind: 'url', id: 'https://who.int/news' });
  });
});

describe('mappers', () => {
  it('maps a journal page and splits "Family, Given" names', () => {
    const s = mapPageMeta(parseMeta(journalPage), 'https://example.org/a');
    expect(s.type).toBe('journal');
    expect(s.authors).toEqual([
      { first: 'Siti Nur', last: 'Rahman' },
      { first: 'Wei Ming', last: 'Tan' },
    ]);
    expect(s.pages).toBe('45-67');
    expect(s.date).toEqual({ year: 2015, month: 10, day: 2 });
  });

  it('maps a news page and trims the site name off the title', () => {
    const s = mapPageMeta(parseMeta(newsPage), 'https://thedaily.my/rain');
    expect(s).toMatchObject({
      type: 'website',
      title: 'Rain expected across Klang Valley',
      container: 'The Daily',
      url: 'https://thedaily.my/rain',
    });
  });

  it('maps Europe PMC results', () => {
    const s = mapEuropePmc({
      title: 'Deep learning.',
      authorList: { author: [{ firstName: 'Yann', lastName: 'LeCun' }] },
      journalInfo: {
        volume: '521',
        issue: '7553',
        printPublicationDate: '2015-05-28',
        journal: { title: 'Nature' },
      },
      pageInfo: '436-444',
      doi: '10.1038/nature14539',
    });
    expect(s).toMatchObject({
      type: 'journal',
      title: 'Deep learning',
      container: 'Nature',
      volume: '521',
      pages: '436-444',
      date: { year: 2015, month: 5, day: 28 },
    });
  });

  it('maps doi.org CSL JSON (e.g. arXiv)', () => {
    const s = mapCsl({
      type: 'article',
      title: 'Attention Is All You Need',
      author: [{ given: 'Ashish', family: 'Vaswani' }],
      issued: { 'date-parts': [[2017]] },
      publisher: 'arXiv',
      DOI: '10.48550/arXiv.1706.03762',
    });
    expect(s).toMatchObject({ type: 'website', container: 'arXiv', date: { year: 2017 } });
  });
});
