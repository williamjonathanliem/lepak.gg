import { renderMarkdown, withBase } from './convert';

describe('renderMarkdown', () => {
  it('typesets inline and display maths with KaTeX', async () => {
    const html = await renderMarkdown('Energy: $E = mc^2$\n\n$$\\frac{a}{b}$$');
    expect(html).toContain('class="katex"');
    expect(html).toContain('katex-display');
    expect(html).not.toContain('data-math');
  });

  it('leaves prices alone', async () => {
    const html = await renderMarkdown('Nasi lemak $5 and teh $10');
    expect(html).not.toContain('katex');
    expect(html).toContain('$5 and teh $10');
  });

  it('does not treat code as maths', async () => {
    const html = await renderMarkdown('`$x$` and\n\n```\n$$y$$\n```');
    expect(html).not.toContain('katex');
  });

  it('strips scripts and event handlers', async () => {
    const html = await renderMarkdown('<script>alert(1)</script><img src=x onerror=alert(2)> hi');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });

  it('does not let maths smuggle in HTML', async () => {
    const html = await renderMarkdown('$\\href{javascript:alert(1)}{x}$ $<img src=x onerror=1>$');
    // KaTeX may echo the rejected command as red error text; what matters is that nothing
    // became a real link, image or event handler.
    const doc = document.createElement('template');
    doc.innerHTML = html;
    expect(doc.content.querySelectorAll('[href^="javascript"], a, img').length).toBe(0);
    expect(doc.content.querySelectorAll('[onerror]').length).toBe(0);
  });

  it('opens links in a new tab safely', async () => {
    const html = await renderMarkdown('[site](https://example.com)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it('keeps mermaid blocks for the diagram step', async () => {
    const html = await renderMarkdown('```mermaid\ngraph TD; A-->B\n```');
    expect(html).toContain('language-mermaid');
  });
});

describe('withBase', () => {
  it('adds a base tag inside head, or at the start', () => {
    expect(withBase('<html><head><title>x</title></head></html>', 'https://f/a/')).toContain(
      '<head><base href="https://f/a/">',
    );
    expect(withBase('<p>hi</p>', 'https://f/')).toBe('<base href="https://f/"><p>hi</p>');
  });
});
