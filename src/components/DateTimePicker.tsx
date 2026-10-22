import {
  fromDate,
  getLocalTimeZone,
  toCalendarDateTime,
  type CalendarDateTime,
} from '@internationalized/date';
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Label,
  Popover,
} from 'react-aria-components';

// A date and time picker in our style, built on React Aria (keyboard, screen readers and
// every locale handled for us). Type into the day / month / year / time parts, or open the
// calendar. Values are plain milliseconds in local time; null when empty.

interface Props {
  label: string;
  value: number | null;
  onChange: (ms: number | null) => void;
  /** The time a new pick starts at, e.g. 23:59 for deadlines. */
  defaultHour?: number;
  defaultMinute?: number;
  accent?: string;
}

const NAV =
  'grid size-11 cursor-pointer place-items-center border-3 border-ink bg-paper font-mono font-bold outline-none data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-ink data-[pressed]:translate-x-0.5 data-[pressed]:translate-y-0.5';

export function DateTimePicker({
  label,
  value,
  onChange,
  defaultHour = 23,
  defaultMinute = 59,
  accent = '#ffd23f',
}: Props) {
  const tz = getLocalTimeZone();
  const current: CalendarDateTime | null =
    value === null ? null : toCalendarDateTime(fromDate(new Date(value), tz));
  const today = toCalendarDateTime(fromDate(new Date(), tz));
  const placeholder = today.set({ hour: defaultHour, minute: defaultMinute, second: 0 });

  return (
    <DatePicker
      value={current}
      onChange={(d) => onChange(d ? d.toDate(tz).getTime() : null)}
      placeholderValue={placeholder}
      granularity="minute"
      hourCycle={12}
      shouldForceLeadingZeros
      className="group flex flex-col gap-1"
    >
      <Label className="font-mono text-xs font-bold uppercase">{label}</Label>
      <Group className="flex min-h-11 items-stretch border-3 border-ink bg-paper group-data-[invalid]:border-hot focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ink">
        <DateInput className="flex min-w-0 flex-1 flex-wrap items-center px-2 py-1 text-base">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="px-[1px] tabular-nums outline-none data-[focused]:bg-ink data-[focused]:text-paper data-[placeholder]:text-mute data-[type=literal]:px-0.5"
            />
          )}
        </DateInput>
        <Button
          aria-label="Open calendar"
          className="min-w-11 cursor-pointer border-0 border-l-3 border-ink font-mono text-lg outline-none data-[focus-visible]:bg-ink data-[focus-visible]:text-paper"
          style={{ background: accent }}
        >
          ▦
        </Button>
      </Group>
      <Popover
        placement="bottom start"
        offset={6}
        className="border-3 border-ink bg-paper p-3 shadow-hard outline-none data-[entering]:animate-pop"
      >
        <Dialog className="outline-none">
          <Calendar>
            <header className="flex items-center justify-between gap-2 pb-3">
              <Button slot="previous" className={NAV}>
                ←
              </Button>
              <Heading className="m-0 font-mono text-sm font-bold uppercase" />
              <Button slot="next" className={NAV}>
                →
              </Button>
            </header>
            <CalendarGrid className="border-separate border-spacing-0.5">
              {(date) => (
                <CalendarCell
                  date={date}
                  className="grid size-10 cursor-pointer place-items-center border-2 border-transparent font-mono text-sm outline-none hover:border-ink data-[disabled]:cursor-default data-[disabled]:opacity-30 data-[focus-visible]:border-ink data-[outside-month]:invisible data-[selected]:border-ink data-[selected]:bg-ink data-[selected]:text-paper"
                />
              )}
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </DatePicker>
  );
}
