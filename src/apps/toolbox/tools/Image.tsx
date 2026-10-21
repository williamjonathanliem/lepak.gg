import { useState } from 'react';
import { BUTTON, INPUT, download } from '../style';
import { Field } from '../ui';

type Format = 'image/png' | 'image/jpeg' | 'image/webp';
const EXT: Record<Format, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export default function Image() {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [width, setWidth] = useState('');
  const [format, setFormat] = useState<Format>('image/jpeg');
  const [quality, setQuality] = useState(85);
  const [out, setOut] = useState<{ url: string; blob: Blob } | null>(null);

  function load(f: File) {
    setFile(f);
    setOut(null);
    const i = new window.Image();
    i.onload = () => {
      setImg(i);
      setWidth(String(i.naturalWidth));
    };
    i.src = URL.createObjectURL(f);
  }

  async function convert() {
    if (!img) return;
    const w = Math.max(1, Math.min(10000, Number.parseInt(width, 10) || img.naturalWidth));
    const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'; // JPG has no transparency
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, format, quality / 100));
    if (blob) setOut({ url: URL.createObjectURL(blob), blob });
  }

  const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

  return (
    <div className="flex flex-col gap-4">
      <label className={`${BUTTON} self-start bg-paper`}>
        {file ? 'Pick another image' : 'Pick an image'}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) load(f);
          }}
        />
      </label>
      {img && file && (
        <>
          <p className="m-0 font-mono text-sm">
            {file.name}: {img.naturalWidth} × {img.naturalHeight}, {kb(file.size)}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Width (px), height follows" id="i-w">
              <input
                id="i-w"
                inputMode="numeric"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className={INPUT}
              />
            </Field>
            <Field label="Format" id="i-f">
              <select
                id="i-f"
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
                className={INPUT}
              >
                <option value="image/jpeg">JPG</option>
                <option value="image/png">PNG</option>
                <option value="image/webp">WebP</option>
              </select>
            </Field>
            <Field label={`Quality ${quality}%`} id="i-q">
              <input
                id="i-q"
                type="range"
                min={30}
                max={100}
                value={quality}
                disabled={format === 'image/png'}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="h-12 accent-black"
              />
            </Field>
          </div>
          <button type="button" className={`${BUTTON} self-start`} onClick={() => void convert()}>
            Convert
          </button>
        </>
      )}
      {out && file && (
        <div className="flex flex-col gap-3">
          <img
            src={out.url}
            alt="Converted result"
            className="max-h-80 self-start border-3 border-ink object-contain"
          />
          <p className="m-0 font-mono text-sm">
            New size: <b>{kb(out.blob.size)}</b> (was {kb(file.size)})
          </p>
          <button
            type="button"
            className={`${BUTTON} self-start`}
            onClick={() =>
              download(out.blob, `${file.name.replace(/\.[^.]+$/, '')}.${EXT[format]}`)
            }
          >
            Download
          </button>
        </div>
      )}
    </div>
  );
}
