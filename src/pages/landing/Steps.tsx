import { Doodle } from '../../components/Doodle';
import { STEPS } from '../../copy/landing';

export function Steps() {
  return (
    <section aria-label="How it works" className="border-b-3 border-ink">
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-[3px] bg-ink p-0">
        {STEPS.map((step, i) => {
          const last = i === STEPS.length - 1;
          return (
            <li
              key={step.title}
              className={`flex flex-col gap-3.5 px-gutter py-[clamp(32px,4vw,56px)] ${last ? 'bg-ink text-paper' : 'bg-paper'}`}
            >
              <div
                aria-hidden="true"
                className="flex items-start gap-2 text-[clamp(72px,9vw,128px)] leading-[0.8] font-black tracking-[-0.06em]"
              >
                {i + 1}
                {i === 0 && <Doodle name="squiggle" delay={0.2} className="mt-3 w-20" />}
                {i === 1 && <Doodle name="sparkle" filled className="size-8 animate-wiggle" />}
                {last && <Doodle name="heart" delay={0.4} className="mt-1 size-9 animate-bob" />}
              </div>
              <h3 className="m-0 text-[26px] font-black tracking-[-0.02em] uppercase">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h3>
              <p className={`m-0 ${last ? 'text-mute-dark' : 'text-mute'}`}>{step.body}</p>
              {'chat' in step && step.chat && (
                <div
                  aria-hidden="true"
                  className="mt-2 max-w-[260px] -rotate-2 self-start border-3 border-paper px-3.5 py-2.5 font-mono text-sm"
                >
                  <span className="block text-xs text-mute-dark">{step.chat.from}</span>
                  {step.chat.text}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
