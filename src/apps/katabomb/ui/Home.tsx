import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/Button';
import { Doodle, HandNote } from '../../../components/Doodle';
import { Input, InputError } from '../../../components/Input';
import { SectionLabel } from '../../../components/SectionLabel';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from '../../../lib/roomCode';
import { KB } from '../copy';
import { roomMode } from '../net/connect';
import { NicknameGate } from './NicknameGate';

export function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function create() {
    navigate(`/katabomb/r/${generateRoomCode()}`, { state: { create: true } });
  }

  function join(e: FormEvent) {
    e.preventDefault();
    if (!isValidRoomCode(code)) return setError(KB.badCode);
    navigate(`/katabomb/r/${normalizeRoomCode(code)}`);
  }

  return (
    <NicknameGate>
      {(nickname) => (
        // Fits the screen: hero sized by screen height, panels fill the rest. No page scroll.
        <main className="flex h-full min-h-0 flex-col">
          {roomMode === 'local' && <LocalBanner />}
          <section className="relative shrink-0 border-b-3 border-ink px-gutter py-[clamp(12px,3vh,40px)]">
            <SectionLabel number="001" title="KataBomb" />
            <h1 className="mt-2 mb-0 font-sans text-[clamp(40px,min(11vw,10vh),150px)] leading-[0.85] font-black tracking-[-0.05em] uppercase">
              Kata
              <br />
              Bomb.
            </h1>
            <Doodle
              name="bomb"
              className="absolute top-[clamp(16px,4vh,48px)] right-[clamp(16px,5vw,80px)] size-[clamp(64px,min(14vw,16vh),170px)] animate-wiggle"
            />
            <p className="mt-[clamp(8px,2vh,20px)] mb-0 max-w-xl text-[clamp(16px,2vw,22px)] font-medium">
              {KB.tagline}{' '}
              <span className="font-mono text-sm text-mute">Playing as {nickname}</span>
            </p>
            <details className="mt-2 md:hidden">
              <summary className="min-h-11 cursor-pointer font-mono text-sm font-bold uppercase">
                How to play
              </summary>
              <ol className="mt-2 mb-0 flex list-none flex-col gap-1.5 p-0">
                {KB.howTo.map((line, i) => (
                  <li key={line} className="flex gap-3 font-mono text-[13px]">
                    <strong>{String(i + 1).padStart(2, '0')}</strong>
                    {line}
                  </li>
                ))}
              </ol>
            </details>
          </section>

          <div className="grid min-h-0 flex-1 auto-rows-fr gap-[3px] bg-ink md:grid-cols-3">
            <div className="relative flex min-h-0 flex-col justify-center gap-4 bg-paper px-gutter py-4">
              <h2 className="m-0 text-[clamp(22px,3vh,28px)] font-black uppercase">Host</h2>
              <Button onClick={create} className="h-16 self-start px-8 text-lg">
                {KB.create}
              </Button>
              <HandNote rotate={-5} className="absolute top-4 right-6">
                you're the boss
              </HandNote>
            </div>
            <form
              noValidate
              onSubmit={join}
              className="flex min-h-0 flex-col justify-center gap-2 bg-paper px-gutter py-4"
            >
              <h2 className="m-0 text-[clamp(22px,3vh,28px)] font-black uppercase">Join</h2>
              <label htmlFor="room-code" className="font-mono text-[13px] uppercase">
                {KB.codeLabel}
              </label>
              <div className="flex flex-wrap gap-3.5">
                <Input
                  id="room-code"
                  value={code}
                  error={error}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={KB.codePlaceholder}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  className="w-40 flex-none text-2xl tracking-[0.3em] uppercase"
                />
                <Button type="submit" className="h-15 px-6">
                  {KB.join}
                </Button>
              </div>
              <InputError id="room-code" error={error} />
            </form>
            <div className="min-h-0 overflow-y-auto bg-ink px-gutter py-4 text-paper max-md:hidden">
              <h2 className="m-0 text-[clamp(22px,3vh,28px)] font-black uppercase">How to play</h2>
              <ol className="mt-3 mb-0 flex list-none flex-col gap-2.5 p-0">
                {KB.howTo.map((line, i) => (
                  <li key={line} className="flex gap-3 font-mono text-[15px]">
                    <strong>{String(i + 1).padStart(2, '0')}</strong>
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </main>
      )}
    </NicknameGate>
  );
}

export function LocalBanner() {
  return (
    <p role="note" className="m-0 border-b-3 border-ink bg-soft px-gutter py-3 font-mono text-sm">
      {KB.localMode}
    </p>
  );
}
