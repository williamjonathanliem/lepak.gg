import { useEffect, useState } from 'react';
import { fromBase64, sha256, toBase64 } from '../logic/text';
import { TEXTAREA } from '../style';
import { Output } from '../ui';

const safe = (fn: () => string) => {
  try {
    return fn();
  } catch {
    return '(not valid for this)';
  }
};

export default function Encode() {
  const [text, setText] = useState('Selamat pagi!');
  const [hash, setHash] = useState('');

  useEffect(() => {
    let alive = true;
    void sha256(text).then((h) => alive && setHash(h));
    return () => {
      alive = false;
    };
  }, [text]);

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor="e-in" className="font-mono text-xs uppercase">
        Text
      </label>
      <textarea
        id="e-in"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={`${TEXTAREA} min-h-32`}
      />
      <Output label="Base64 encode" value={safe(() => toBase64(text))} />
      <Output label="Base64 decode" value={safe(() => fromBase64(text))} />
      <Output label="URL encode" value={safe(() => encodeURIComponent(text))} />
      <Output label="URL decode" value={safe(() => decodeURIComponent(text))} />
      <Output label="SHA-256 hash" value={hash} />
    </div>
  );
}
