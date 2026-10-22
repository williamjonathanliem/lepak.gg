import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Input, InputError } from '../../components/Input';
import { SectionLabel } from '../../components/SectionLabel';
import { Doodle, HandNote } from '../../components/Doodle';
import { HoloSticker } from '../../components/HoloSticker';
import { Sticker } from '../../components/Sticker';
import { Typewriter } from '../../components/Typewriter';
import { HERO, NICKNAME_ERRORS } from '../../copy/landing';
import { getNickname, saveNickname } from '../../lib/identity';
import { NICKNAME_ID, focusNickname } from './nickname';

export function Hero() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [nickname, setNickname] = useState(() => getNickname() ?? '');
  const [error, setError] = useState<string | null>(null);

  // /hub sends people here as /#nickname when they have no nickname yet
  useEffect(() => {
    if (hash === `#${NICKNAME_ID}`) focusNickname();
  }, [hash]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = saveNickname(nickname);
    if (!result.ok) {
      setError(NICKNAME_ERRORS[result.error]);
      focusNickname();
      return;
    }
    navigate('/hub');
  }

  return (
    <section
      id="top"
      className="relative border-b-3 border-ink px-gutter pt-[clamp(48px,8vw,120px)] pb-[clamp(56px,7vw,100px)]"
    >
      <div className="mb-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm">
        <SectionLabel number="001" title={HERO.label} />
        <span className="text-mute">{HERO.est}</span>
      </div>

      <h1
        aria-label={HERO.ariaLabel}
        className="m-0 min-h-[2.05em] font-mono text-[clamp(44px,9vw,148px)] leading-none font-bold tracking-[-0.04em]"
      >
        <span aria-hidden="true" className="block">
          {HERO.hello}
          <Doodle
            name="sparkle"
            filled
            delay={0.3}
            className="ml-[0.1em] inline-block size-[0.35em] -translate-y-[0.55em] animate-wiggle"
          />
        </span>
        <Typewriter words={HERO.typedWords} />
      </h1>

      <div className="mt-[clamp(40px,6vw,72px)] flex flex-wrap items-end justify-between gap-10">
        <p className="m-0 max-w-[560px] flex-[1_1_380px] text-[clamp(19px,2vw,24px)] leading-[1.35] font-medium">
          {HERO.sub}
        </p>
        <form
          noValidate
          onSubmit={onSubmit}
          className="relative flex max-w-[560px] flex-[1_1_420px] flex-col gap-2.5"
        >
          <div className="pointer-events-none absolute right-2 bottom-full mb-1 flex items-end gap-1 sm:right-10">
            <HandNote rotate={-5}>{HERO.formNote}</HandNote>
            <Doodle name="arrow-down" delay={0.8} className="h-12 w-8 translate-y-3" />
          </div>
          <label htmlFor={NICKNAME_ID} className="font-mono text-[13px] uppercase">
            {HERO.nicknameLabel}
          </label>
          <div className="flex flex-wrap gap-3.5">
            <Input
              id={NICKNAME_ID}
              name="nickname"
              autoComplete="nickname"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={32}
              placeholder={HERO.nicknamePlaceholder}
              value={nickname}
              error={error}
              onChange={(e) => {
                setNickname(e.target.value);
                if (error) setError(null);
              }}
              className="flex-[1_1_220px]"
            />
            <Button type="submit" className="h-15 px-[26px] text-[17px]">
              {HERO.submit}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="square"
                aria-hidden="true"
              >
                <path d="M4 12h15M13 6l6 6-6 6" />
              </svg>
            </Button>
          </div>
          <InputError id={NICKNAME_ID} error={error} />
        </form>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[clamp(24px,5vw,64px)] right-[clamp(16px,4vw,56px)] flex origin-top-right flex-col items-end gap-3.5 max-sm:scale-75 sm:[&>*]:pointer-events-auto"
      >
        <Doodle
          name="sparkle"
          delay={1}
          className="absolute top-2 -left-10 size-7 animate-wiggle max-sm:hidden"
        />
        <Sticker variant="light" rotate={4} bob>
          {HERO.stickers.noSignup}
        </Sticker>
        <Sticker variant="dark" rotate={-3} bob bobDelay={0.6}>
          {HERO.stickers.free}
        </Sticker>
        <Sticker
          variant="light"
          rotate={-6}
          bob
          bobDelay={1.1}
          className="group relative bg-[#ffd23f]! max-sm:hidden"
        >
          <span className="group-hover:invisible">{HERO.stickers.kopi.front}</span>
          <span className="invisible absolute inset-0 grid place-items-center group-hover:visible">
            {HERO.stickers.kopi.back}
          </span>
        </Sticker>
        <Doodle
          name="sparkle"
          filled
          delay={1.2}
          className="absolute bottom-24 -left-6 size-4 max-sm:hidden"
        />
        <HoloSticker rotate={10} sub={HERO.stickers.certified.sub} className="max-sm:hidden">
          {HERO.stickers.certified.main[0]}
          <br />
          {HERO.stickers.certified.main[1]}
        </HoloSticker>
      </div>
    </section>
  );
}
