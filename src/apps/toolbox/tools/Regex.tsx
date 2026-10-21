import { useState } from 'react';
import { INPUT, TEXTAREA } from '../style';
import { Field } from '../ui';

const MAX_MATCHES = 500;

export default function Regex() {
  const [pattern, setPattern] = useState('\\b\\w+@\\w+\\.\\w+\\b');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('Email ali@uni.my or mei@school.edu by Friday.');

  let error: string | null = null;
  const matches: { index: number; text: string; groups: string[] }[] = [];
  try {
    const re = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
    for (const m of text.matchAll(re)) {
      if (m[0] === '' && matches.length > MAX_MATCHES) break;
      matches.push({ index: m.index ?? 0, text: m[0], groups: m.slice(1).map((g) => g ?? '') });
      if (matches.length >= MAX_MATCHES) break;
    }
  } catch (e) {
    error = (e as Error).message;
  }

  // Highlight matches in the text.
  const parts: { t: string; hit: boolean }[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.text === '') continue;
    if (m.index > pos) parts.push({ t: text.slice(pos, m.index), hit: false });
    parts.push({ t: m.text, hit: true });
    pos = m.index + m.text.length;
  }
  parts.push({ t: text.slice(pos), hit: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label="Pattern" id="r-pat">
          <input
            id="r-pat"
            value={pattern}
            spellCheck={false}
            onChange={(e) => setPattern(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Flags" id="r-flags">
          <input
            id="r-flags"
            value={flags}
            maxLength={6}
            spellCheck={false}
            onChange={(e) => setFlags(e.target.value.replace(/[^dgimsuy]/g, ''))}
            className={INPUT}
          />
        </Field>
      </div>
      <Field label="Test text" id="r-text">
        <textarea
          id="r-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`${TEXTAREA} min-h-32`}
        />
      </Field>
      {error ? (
        <p role="alert" className="m-0 font-mono text-sm font-bold">
          ! {error}
        </p>
      ) : (
        <>
          <p className="m-0 font-mono text-sm" aria-live="polite">
            <b>{matches.length}</b> match{matches.length === 1 ? '' : 'es'}
          </p>
          <p className="m-0 border-3 border-ink p-3 font-mono text-sm break-words whitespace-pre-wrap">
            {parts.map((p, i) =>
              p.hit ? (
                <mark key={i} className="bg-[#7ee081] px-0.5">
                  {p.t}
                </mark>
              ) : (
                <span key={i}>{p.t}</span>
              ),
            )}
          </p>
          {matches.some((m) => m.groups.length) && (
            <ol className="m-0 font-mono text-xs">
              {matches.map((m, i) => (
                <li key={i}>
                  {m.text} → {m.groups.map((g, j) => `$${j + 1}=${g}`).join(', ')}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
