import { useState } from 'react';
import { BUTTON, INPUT, PLAIN_BUTTON, download } from '../style';
import { Field } from '../ui';

// PDF tools with pdf-lib, all in the browser: nothing is uploaded.

type Mode = 'merge' | 'split' | 'rotate' | 'images';
const MODES: { id: Mode; label: string; accept: string; multi: boolean }[] = [
  { id: 'merge', label: 'Merge PDFs', accept: 'application/pdf', multi: true },
  { id: 'split', label: 'Pick pages', accept: 'application/pdf', multi: false },
  { id: 'rotate', label: 'Rotate', accept: 'application/pdf', multi: false },
  { id: 'images', label: 'Photos to PDF', accept: 'image/png,image/jpeg', multi: true },
];

/** "1-3, 5" -> [0, 1, 2, 4] (zero-based), ignoring pages past the end. */
function parsePages(spec: string, count: number): number[] {
  const out: number[] = [];
  for (const part of spec.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let p = Math.min(a, b); p <= Math.max(a, b); p++)
      if (p >= 1 && p <= count) out.push(p - 1);
  }
  return out;
}

export default function Pdf() {
  const [mode, setMode] = useState<Mode>('merge');
  const [files, setFiles] = useState<File[]>([]);
  const [pages, setPages] = useState('1');
  const [angle, setAngle] = useState(90);
  const [status, setStatus] = useState<string | null>(null);
  const cfg = MODES.find((m) => m.id === mode)!;

  async function run() {
    if (!files.length) return;
    setStatus('Working...');
    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const out = await PDFDocument.create();
      if (mode === 'merge') {
        for (const f of files) {
          const src = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true });
          (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
        }
      } else if (mode === 'split' || mode === 'rotate') {
        const src = await PDFDocument.load(await files[0]!.arrayBuffer(), {
          ignoreEncryption: true,
        });
        const picked =
          mode === 'split' ? parsePages(pages, src.getPageCount()) : src.getPageIndices();
        if (!picked.length) return setStatus('No pages matched. Try "1-3, 5".');
        (await out.copyPages(src, picked)).forEach((p) => {
          if (mode === 'rotate') p.setRotation(degrees((p.getRotation().angle + angle) % 360));
          out.addPage(p);
        });
      } else {
        for (const f of files) {
          const bytes = await f.arrayBuffer();
          const img =
            f.type === 'image/png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
          // A4 page, image fitted inside with a small margin.
          const page = out.addPage([595.28, 841.89]);
          const scale = Math.min(555 / img.width, 801 / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h });
        }
      }
      const bytes = await out.save();
      download(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `lepak-${mode}.pdf`);
      setStatus(`Done: ${out.getPageCount()} page${out.getPageCount() === 1 ? '' : 's'}.`);
    } catch {
      setStatus('Could not read one of the files. Is it a normal, unlocked PDF or a JPG/PNG?');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="PDF tool" className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => {
              setMode(m.id);
              setFiles([]);
              setStatus(null);
            }}
            className={`min-h-11 cursor-pointer border-3 border-ink px-3 font-mono text-sm font-bold uppercase ${mode === m.id ? 'bg-ink text-paper' : 'bg-paper'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <label className={`${PLAIN_BUTTON} self-start`}>
        {cfg.multi ? 'Add files' : 'Pick a PDF'}
        <input
          type="file"
          accept={cfg.accept}
          multiple={cfg.multi}
          className="sr-only"
          onChange={(e) => {
            const picked = [...(e.target.files ?? [])];
            setFiles((f) => (cfg.multi ? [...f, ...picked] : picked));
            setStatus(null);
            e.target.value = '';
          }}
        />
      </label>

      {files.length > 0 && (
        <ol className="m-0 flex list-none flex-col border-3 border-ink p-0">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between gap-2 border-ink px-3 py-2 not-last:border-b-2"
            >
              <span className="truncate font-mono text-sm">
                {i + 1}. {f.name}
              </span>
              <span className="flex gap-1">
                {cfg.multi && i > 0 && (
                  <button
                    type="button"
                    aria-label={`Move ${f.name} up`}
                    onClick={() =>
                      setFiles((fs) =>
                        fs.map((x, j) => (j === i - 1 ? fs[i]! : j === i ? fs[i - 1]! : x)),
                      )
                    }
                    className="size-10 cursor-pointer border-2 border-ink bg-paper font-bold"
                  >
                    ↑
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                  className="size-10 cursor-pointer border-2 border-ink bg-paper font-bold"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {mode === 'split' && (
        <Field label='Pages to keep, e.g. "1-3, 5"' id="p-pages">
          <input
            id="p-pages"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            className={INPUT}
          />
        </Field>
      )}
      {mode === 'rotate' && (
        <Field label="Turn every page" id="p-angle">
          <select
            id="p-angle"
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            className={INPUT}
          >
            <option value={90}>90° clockwise</option>
            <option value={180}>180°</option>
            <option value={270}>90° anticlockwise</option>
          </select>
        </Field>
      )}

      <button
        type="button"
        disabled={!files.length}
        onClick={() => void run()}
        className={`${BUTTON} self-start`}
      >
        Make PDF
      </button>
      <p role="status" className="m-0 min-h-5 font-mono text-sm">
        {status}
      </p>
    </div>
  );
}
