import { useState } from 'react';
import { addDays, daysBetween, parseDate, toIso, weekdaysBetween } from '../logic/dates';
import { INPUT } from '../style';
import { Field } from '../ui';

const todayIso = () => toIso(new Date());

export default function Dates() {
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState('');
  const [plus, setPlus] = useState('14');

  const a = parseDate(from);
  const b = parseDate(to);
  const n = Number.parseInt(plus, 10);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-xl font-black uppercase">How long until...</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" id="d-from">
            <input
              id="d-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="To (deadline, exam...)" id="d-to">
            <input
              id="d-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>
        {a && b && (
          <p className="m-0 border-3 border-ink bg-[#7ee081] p-4 text-lg" aria-live="polite">
            <b className="text-3xl">{daysBetween(a, b)}</b> days · <b>{weekdaysBetween(a, b)}</b>{' '}
            weekdays · <b>{(daysBetween(a, b) / 7).toFixed(1)}</b> weeks
          </p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="m-0 text-xl font-black uppercase">Add days</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" id="d-start">
            <input
              id="d-start"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Days to add (can be negative)" id="d-plus">
            <input
              id="d-plus"
              inputMode="numeric"
              value={plus}
              onChange={(e) => setPlus(e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>
        {a && Number.isFinite(n) && (
          <p className="m-0 border-3 border-ink p-4 text-lg" aria-live="polite">
            {addDays(a, n).toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </section>
    </div>
  );
}
