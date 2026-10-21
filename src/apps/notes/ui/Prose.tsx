import { useEffect, useRef } from 'react';
import { drawDiagrams } from '../logic/convert';

/**
 * Shows rendered note HTML (already sanitised by renderMarkdown) and draws any
 * mermaid diagrams in it.
 */
export function Prose({ html, className = '' }: { html: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) void drawDiagrams(ref.current);
  }, [html]);
  return (
    <article
      ref={ref}
      className={`lp-prose ${className}`}
      // Sanitised by DOMPurify in renderMarkdown.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
