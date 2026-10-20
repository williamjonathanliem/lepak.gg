import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../../components/Button';
import { Input, InputError } from '../../../components/Input';
import { NICKNAME_ERRORS } from '../../../copy/landing';
import { getNickname, saveNickname } from '../../../lib/identity';

/** Asks for a nickname first if this browser has none (e.g. someone opened a room link). */
export function NicknameGate({ children }: { children: (nickname: string) => ReactNode }) {
  const [nickname, setNickname] = useState(getNickname);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (nickname) return <>{children(nickname)}</>;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = saveNickname(draft);
    if (result.ok) setNickname(result.value);
    else setError(NICKNAME_ERRORS[result.error]);
  }

  return (
    <main className="mx-auto w-full max-w-xl px-gutter py-16">
      <h1 className="heading-lg m-0">First, a nickname.</h1>
      <form noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-2.5">
        <label htmlFor="gate-nick" className="font-mono text-[13px] uppercase">
          {'> Pick a nickname'}
        </label>
        <div className="flex flex-wrap gap-3.5">
          <Input
            id="gate-nick"
            autoFocus
            autoComplete="nickname"
            spellCheck={false}
            maxLength={32}
            placeholder="kopiboi"
            value={draft}
            error={error}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            className="flex-[1_1_200px]"
          />
          <Button type="submit" className="h-15 px-6">
            Jom
          </Button>
        </div>
        <InputError id="gate-nick" error={error} />
      </form>
    </main>
  );
}
