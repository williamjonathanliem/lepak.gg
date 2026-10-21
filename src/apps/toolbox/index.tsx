import { Suspense } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router';
import { SITE } from '../../lib/site';
import { ACCENT } from './style';
import { TOOLS, type ToolGroup } from './tools';

// Toolbox: /tools (all tools) and /tools/:id (one tool). Everything runs on your device.

const GROUPS: ToolGroup[] = ['Study', 'Maths', 'Files', 'Design', 'Code'];

export default function Toolbox() {
  return (
    <div className="min-h-dvh">
      <header className="flex h-12 items-stretch justify-between border-b-3 border-ink">
        <Link
          to="/hub"
          className="flex items-center gap-2 px-gutter font-mono text-base font-bold no-underline"
        >
          <span aria-hidden="true" className="inline-block size-3.5 bg-ink" />
          {SITE.wordmark}
        </Link>
        <Link
          to="/tools"
          className="flex min-h-11 items-center gap-2 px-4 font-mono text-sm font-bold uppercase no-underline"
        >
          <span
            aria-hidden="true"
            className="inline-block size-2 ring-2 ring-ink"
            style={{ background: ACCENT }}
          />
          Toolbox
        </Link>
      </header>
      <Routes>
        <Route index element={<All />} />
        <Route path=":id" element={<One />} />
      </Routes>
    </div>
  );
}

function All() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-gutter py-[clamp(24px,5vw,56px)]">
      <title>Toolbox · Lepak.gg</title>
      <div>
        <h1 className="heading-lg m-0">Toolbox.</h1>
        <p className="mt-2 mb-0 max-w-xl text-mute">
          Small tools for assignments and projects. All free, nothing uploaded: it all runs on your
          device.
        </p>
      </div>
      {GROUPS.map((g) => {
        const tools = TOOLS.filter((t) => t.group === g);
        return (
          <section key={g} aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`} className="m-0 mb-3 font-mono text-sm font-bold uppercase">
              {g}
            </h2>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-3 p-0">
              {tools.map((t) => (
                <li key={t.id} className="flex">
                  <Link
                    to={`/tools/${t.id}`}
                    className="push flex w-full flex-col gap-1 border-3 border-ink bg-paper p-4 text-ink no-underline shadow-hard"
                  >
                    <span className="text-lg font-black uppercase">{t.name}</span>
                    <span className="text-sm text-mute">{t.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="m-0 font-mono text-xs text-mute">
        Tool ideas inspired by{' '}
        <a href="https://delphi.tools" className="underline">
          delphi.tools
        </a>
        .
      </p>
    </main>
  );
}

function One() {
  const { id } = useParams();
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) return <Navigate to="/tools" replace />;
  const Tool = tool.component;
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-gutter py-[clamp(24px,5vw,48px)]">
      <title>{`${tool.name} · Lepak.gg`}</title>
      <div>
        <Link to="/tools" className="inline-flex min-h-11 items-center font-mono text-sm underline">
          ← All tools
        </Link>
        <h1 className="heading-lg m-0 text-[clamp(32px,6vw,56px)]">{tool.name}</h1>
        <p className="mt-2 mb-0 text-mute">{tool.blurb}</p>
      </div>
      <Suspense fallback={<p className="font-mono">Loading...</p>}>
        <Tool />
      </Suspense>
    </main>
  );
}
