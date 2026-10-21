import { useEffect, useState } from 'react';
import { BUTTON, TEXTAREA, download } from '../style';

export default function Qr() {
  const [text, setText] = useState('https://lepak-gg.vercel.app');
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!text.trim()) return;
    void import('qrcode').then((QR) =>
      QR.toDataURL(text, { margin: 2, width: 512, color: { dark: '#000000', light: '#ffffff' } })
        .then((url) => alive && setSrc(url))
        .catch(() => alive && setSrc(null)),
    );
    return () => {
      alive = false;
    };
  }, [text]);

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor="qr-in" className="font-mono text-xs uppercase">
        Link or text
      </label>
      <textarea
        id="qr-in"
        value={text}
        maxLength={1500}
        onChange={(e) => setText(e.target.value)}
        className={`${TEXTAREA} min-h-24`}
      />
      {text.trim() && src && (
        <div className="flex flex-wrap items-end gap-4">
          <img
            src={src}
            width={256}
            height={256}
            alt={`QR code for ${text}`}
            className="border-3 border-ink"
          />
          <button
            type="button"
            className={BUTTON}
            onClick={() =>
              void fetch(src)
                .then((r) => r.blob())
                .then((b) => download(b, 'qr-code.png'))
            }
          >
            Download PNG
          </button>
        </div>
      )}
    </div>
  );
}
