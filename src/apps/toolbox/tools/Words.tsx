import { useState } from 'react';
import { minutesLabel, textStats } from '../logic/text';
import { TEXTAREA } from '../style';

export default function Words() {
  const [text, setText] = useState('');
  const s = textStats(text);
  const stats: [string, string][] = [
    ['Words', String(s.words)],
    ['Characters', String(s.characters)],
    ['No spaces', String(s.charactersNoSpaces)],
    ['Sentences', String(s.sentences)],
    ['Paragraphs', String(s.paragraphs)],
    ['Reading time', minutesLabel(s.readingMinutes)],
    ['Speaking time', minutesLabel(s.speakingMinutes)],
  ];
  return (
    <div className="flex flex-col gap-4">
      <label htmlFor="w-text" className="sr-only">
        Your text
      </label>
      <textarea
        id="w-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type your essay here."
        className={`${TEXTAREA} min-h-[40vh] resize-y font-sans text-base`}
      />
      <dl
        className="m-0 grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2"
        aria-live="polite"
      >
        {stats.map(([label, value]) => (
          <div key={label} className="border-3 border-ink p-3">
            <dd className="m-0 text-2xl font-black">{value}</dd>
            <dt className="font-mono text-xs uppercase">{label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
