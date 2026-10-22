import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AppHeader } from '../components/AppHeader';
import { SITE } from '../lib/site';

// Privacy notice and terms of use. Plain words on purpose: most readers are students.
// Keep these in sync with what the code really does (retention times live in
// scripts/cleanup.mjs and database.rules.json).

const UPDATED = '21 October 2026';

function Mail() {
  return <a href={`mailto:${SITE.contact}`}>{SITE.contact}</a>;
}

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <title>{`${title.replace(/\.$/, '')} · Lepak.gg`}</title>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-gutter py-[clamp(32px,6vw,64px)]">
        <h1 className="heading-lg m-0">{title}</h1>
        <p className="mt-3 font-mono text-sm text-mute">Last updated {UPDATED}</p>
        <div className="legal mt-8 flex flex-col gap-4 text-[17px] [&_h2]:mt-6 [&_h2]:mb-0 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:uppercase [&_li]:mb-1.5 [&_p]:m-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border-2 [&_td]:border-ink [&_td]:p-2 [&_td]:align-top [&_th]:border-2 [&_th]:border-ink [&_th]:bg-ink [&_th]:p-2 [&_th]:text-left [&_th]:text-paper [&_ul]:m-0 [&_ul]:pl-5">
          {children}
        </div>
        <p className="mt-12 font-mono text-sm">
          <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> ·{' '}
          <Link to="/hub">Back to the hub</Link>
        </p>
      </main>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy.">
      <p>
        Lepak.gg is a free, open-source student project. There are no accounts, no ads and no
        tracking. This page says what we keep, why, and when it is deleted.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>You pick a nickname. We never ask for your email, phone or real name.</li>
        <li>Your browser gets a random guest ID so rooms and pages know it's you.</li>
        <li>Everything we store deletes itself after 1, 14 or 30 days (table below).</li>
        <li>No analytics, no ad cookies, no selling or sharing data with advertisers.</li>
      </ul>

      <h2>What we keep and for how long</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>What</th>
              <th>Why</th>
              <th>Deleted</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Game rooms (KataBomb, Bingo): nicknames, chat, words played, scores</td>
              <td>To run the game</td>
              <td>1 day after the room was last used</td>
            </tr>
            <tr>
              <td>Watch Together and Device Drop: room code, nicknames, chat, connection setup</td>
              <td>To connect your devices</td>
              <td>1 day after the room was last used</td>
            </tr>
            <tr>
              <td>Shared whiteboards: drawings and pictures you add</td>
              <td>So everyone sees the same board</td>
              <td>14 days after the last change</td>
            </tr>
            <tr>
              <td>Lepak Pages: notes and files you publish</td>
              <td>To show the page at its link</td>
              <td>30 days after the last visit or edit (or when you delete it)</td>
            </tr>
            <tr>
              <td>Notes on the wall (front page): your note, nickname, +1s and reports</td>
              <td>To collect ideas and bug reports, and keep the wall kind</td>
              <td>30 days after you post it (or when you or we take it down)</td>
            </tr>
            <tr>
              <td>Wall bans (only if you broke the wall rules)</td>
              <td>To stop repeat abuse</td>
              <td>30 days after the ban</td>
            </tr>
            <tr>
              <td>Votes for the next app</td>
              <td>To count votes</td>
              <td>30 days after you voted</td>
            </tr>
            <tr>
              <td>Guest ID</td>
              <td>To know which rooms and pages are yours</td>
              <td>30 days after your last visit</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Video in Watch Together and files in Device Drop go straight between the devices. They are
        never stored on our servers.
      </p>

      <h2>Stored on your own device</h2>
      <p>
        Your nickname, guest ID, solo whiteboard, citation list, AI Notes drafts (7 days) and game
        stats are saved in your browser (local storage). They stay there until you clear your
        browser data, and Lepak clears anything it hasn't used for 30 days. We don't use tracking
        cookies.
      </p>

      <h2>Who helps us run it</h2>
      <p>These services store or pass on data for us. Their servers may be outside Malaysia.</p>
      <ul>
        <li>
          <b>Google Firebase:</b> guest sign-in, game rooms, whiteboards, chat.
        </li>
        <li>
          <b>Supabase:</b> Lepak Pages and their files.
        </li>
        <li>
          <b>Vercel:</b> hosts the website and reads links you paste into Cite (only to find the
          title and author; we don't keep them).
        </li>
        <li>
          <b>Google Gemini:</b> AI Notes and AI Slides send the file or text you choose to Gemini to
          write the notes or slides. Notes for the wall are sent with your nickname so Gemini can
          check they're kind before they go up. We don't keep what's sent for checking. Google may
          use what's sent through its free tier to improve its products, so don't upload anything
          private.
        </li>
        <li>
          <b>Sentry:</b> if a page crashes, it gets the error, the page address (without anything
          after # or ?) and your browser type. Never your nickname, chat or content. Kept 30 days.
        </li>
        <li>
          <b>Google STUN servers:</b> help Watch Together and Device Drop find a direct route, which
          means they see your IP address.
        </li>
        <li>
          <b>Open data services:</b> Crossref, doi.org, Europe PMC and Open Library get the DOI or
          ISBN you look up in Cite. Open Trivia DB sends Trivia questions.
        </li>
      </ul>
      <p>Photo-to-text in Lepak Pages runs on your device. Your photo is not uploaded for it.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Delete your own pages any time from Lepak Pages.</li>
        <li>Clear your browser data to forget your guest ID and nickname.</li>
        <li>
          To see, fix or delete something we hold about you (Malaysia's Personal Data Protection Act
          2010 gives you this right), email <Mail />. Include the room code or page link, since we
          don't know who you are otherwise.
        </li>
      </ul>

      <h2>Younger users</h2>
      <p>
        Lepak.gg is made for students. If you're under 13, please ask a parent or teacher before
        publishing a page, and never put your full name, school, address or phone number in a
        nickname, chat or page.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If this changes, we'll update the date at the top. Questions: <Mail />.
      </p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms.">
      <p>By using Lepak.gg you agree to these terms. They're short, so please read them.</p>

      <h2>The deal</h2>
      <ul>
        <li>Lepak.gg is free, made by students, and comes as it is, with no guarantees.</li>
        <li>
          Things may break, change or go away. Don't keep your only copy of anything important here:
          rooms, boards and pages delete themselves (see <Link to="/privacy">Privacy</Link>).
        </li>
        <li>
          The code is open source under the {SITE.license} licence. That covers the code, not what
          people post.
        </li>
      </ul>

      <h2>Be decent</h2>
      <p>Don't use Lepak.gg to:</p>
      <ul>
        <li>bully, threaten, harass or share someone's private details;</li>
        <li>post hate, sexual content, or anything involving minors in a sexual way;</li>
        <li>break the law, cheat in exams, or share other people's work as your own;</li>
        <li>spread malware, phishing or scams, or pretend to be someone else;</li>
        <li>attack, overload or try to break into the site or its services.</li>
      </ul>
      <p>We can remove anything and close any room or page that breaks these rules.</p>

      <h2>What you post</h2>
      <ul>
        <li>What you write or upload stays yours.</li>
        <li>
          By publishing it, you let us store it and show it to anyone you share it with, for as long
          as it's on the site.
        </li>
        <li>
          Only publish things you have the right to share. Lecture slides, textbooks and other
          people's notes usually belong to someone else: ask them first.
        </li>
        <li>Pages are unlisted, not private. Anyone with the link can see them.</li>
      </ul>

      <h2>Report something</h2>
      <p>
        Found something that breaks these terms, or something you own the copyright to? Email{' '}
        <Mail /> with:
      </p>
      <ul>
        <li>the link (or room code),</li>
        <li>what's wrong, and for copyright, which work is yours,</li>
        <li>how to reach you.</li>
      </ul>
      <p>We'll look at it as soon as we can and take it down if it breaks the rules.</p>

      <h2>Names and other people's stuff</h2>
      <p>
        Lepak.gg isn't connected to any of the games, publishers or services it's inspired by or
        uses. Games marked "Inspired by" are our own versions; the original names (such as Wordle,
        Connections and GeoGuessr) belong to their owners. Trivia questions come from Open Trivia DB
        under CC BY-SA 4.0. Full credits are in the project's CREDITS file on GitHub.
      </p>

      <h2>Responsibility</h2>
      <p>
        As far as the law allows, the people who make Lepak.gg aren't responsible for losses from
        using it, from downtime, or from what other users post. These terms follow the laws of
        Malaysia.
      </p>

      <h2>Contact</h2>
      <p>
        <Mail />
      </p>
    </LegalPage>
  );
}
