import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { DateTimePicker } from './DateTimePicker';

function Harness({ onPick }: { onPick: (ms: number | null) => void }) {
  const [value, setValue] = useState<number | null>(new Date(2026, 10, 3, 23, 59).getTime());
  return (
    <DateTimePicker
      label="Due"
      value={value}
      onChange={(ms) => {
        setValue(ms);
        onPick(ms);
      }}
    />
  );
}

describe('DateTimePicker', () => {
  it('shows the value in its parts and opens a calendar to pick a day', async () => {
    const picked: (number | null)[] = [];
    render(<Harness onPick={(ms) => picked.push(ms)} />);

    // The typed parts show the current value (3 Nov 2026, 11:59 pm).
    expect(screen.getByRole('spinbutton', { name: /day/i })).toHaveTextContent('03');
    expect(screen.getByRole('spinbutton', { name: /hour/i })).toHaveTextContent('11');

    fireEvent.click(screen.getByRole('button', { name: /open calendar/i }));
    const grid = await screen.findByRole('grid');
    expect(grid).toBeInTheDocument();

    // Pick the 10th: the day changes and the time is kept.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /10/ }));
    });
    const last = picked.at(-1)!;
    const d = new Date(last);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2026, 10, 10, 23, 59,
    ]);
  });
});
