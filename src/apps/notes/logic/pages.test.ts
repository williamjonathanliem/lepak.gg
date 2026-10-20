import {
  checkSlug,
  classifyFile,
  cleanSitePath,
  findEntry,
  mimeFor,
  newEditKey,
  rememberPage,
  slugify,
  stripCommonFolder,
  withSuffix,
  type MyPage,
} from './pages';

describe('slugs', () => {
  it('turns titles into slugs', () => {
    expect(slugify('Bio Chapter 3: Cells!')).toBe('bio-chapter-3-cells');
    expect(slugify('  Résumé — Café  ')).toBe('resume-cafe');
    expect(slugify('!!!')).toBe('');
  });

  it('caps length without a trailing dash', () => {
    const s = slugify('a'.repeat(39) + ' b');
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-')).toBe(false);
  });

  it('checks slugs like the database does', () => {
    expect(checkSlug('ab')).toBe('too-short');
    expect(checkSlug('a'.repeat(41))).toBe('too-long');
    expect(checkSlug('-bio')).toBe('bad-chars');
    expect(checkSlug('Bio')).toBe('bad-chars');
    expect(checkSlug('admin')).toBe('reserved');
    expect(checkSlug('bio-chapter-3')).toBeNull();
  });

  it('adds a short random suffix', () => {
    const s = withSuffix('bio-notes', () => 0);
    expect(s).toBe('bio-notes-aaaa');
    expect(checkSlug(s)).toBeNull();
    expect(withSuffix('', () => 0)).toBe('page-aaaa');
  });
});

describe('edit keys', () => {
  it('are long and url safe', () => {
    const k = newEditKey();
    expect(k.length).toBeGreaterThanOrEqual(30);
    expect(k).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('differ every time', () => {
    expect(newEditKey()).not.toBe(newEditKey());
  });
});

describe('files', () => {
  it('sorts dropped files by type', () => {
    expect(classifyFile('notes.MD')).toBe('markdown');
    expect(classifyFile('essay.docx')).toBe('docx');
    expect(classifyFile('slides.pdf')).toBe('pdf');
    expect(classifyFile('site.zip')).toBe('zip');
    expect(classifyFile('index.html')).toBe('html');
    expect(classifyFile('virus.exe')).toBe('unsupported');
  });

  it('knows content types for site files', () => {
    expect(mimeFor('a/b/style.css')).toBe('text/css');
    expect(mimeFor('app.js')).toBe('text/javascript');
    expect(mimeFor('setup.exe')).toBeNull();
  });

  it('drops unsafe or junk zip paths', () => {
    expect(cleanSitePath('site/index.html')).toBe('site/index.html');
    expect(cleanSitePath('../../etc/passwd.txt')).toBeNull();
    expect(cleanSitePath('__MACOSX/site/._index.html')).toBeNull();
    expect(cleanSitePath('site/.DS_Store')).toBeNull();
    expect(cleanSitePath('site/img/')).toBeNull();
    expect(cleanSitePath('site/run.exe')).toBeNull();
    expect(cleanSitePath('site\\css\\a.css')).toBe('site/css/a.css');
  });

  it('strips one shared top folder', () => {
    expect(stripCommonFolder(['my-site/index.html', 'my-site/css/a.css'])).toEqual([
      'index.html',
      'css/a.css',
    ]);
    expect(stripCommonFolder(['index.html', 'css/a.css'])).toEqual(['index.html', 'css/a.css']);
  });

  it('finds the page to open first', () => {
    expect(findEntry(['css/a.css', 'index.html', 'about.html'])).toBe('index.html');
    expect(findEntry(['docs/guide/start.html', 'docs/home.html'])).toBe('docs/home.html');
    expect(findEntry(['a.css'])).toBeNull();
  });
});

describe('my pages', () => {
  const page = (slug: string, createdAt: number): MyPage => ({
    slug,
    title: slug,
    kind: 'note',
    editKey: 'k',
    createdAt,
  });

  it('keeps newest first and replaces duplicates', () => {
    let list = rememberPage([], page('a', 1));
    list = rememberPage(list, page('b', 2));
    list = rememberPage(list, { ...page('a', 3), title: 'new' });
    expect(list.map((p) => p.slug)).toEqual(['a', 'b']);
    expect(list[0]!.title).toBe('new');
  });
});
