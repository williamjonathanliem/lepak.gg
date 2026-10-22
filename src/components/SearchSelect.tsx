import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
} from 'react-aria-components';

// A dropdown you can type into to search, in our style, built on React Aria's ComboBox
// (keyboard, screen readers and filtering handled for us). Good for long lists like
// currencies.

export interface SearchItem {
  id: string;
  /** What's shown and searched. */
  label: string;
  /** A second, quieter line. */
  detail?: string;
}

interface Props {
  label: string;
  items: readonly SearchItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export function SearchSelect({ label, items, value, onChange, placeholder }: Props) {
  return (
    <ComboBox
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key !== null) onChange(String(key));
      }}
      defaultItems={items}
      menuTrigger="focus"
      className="flex flex-col gap-1"
    >
      <Label className="font-mono text-xs font-bold uppercase">{label}</Label>
      <div className="flex min-h-11 items-stretch border-3 border-ink bg-paper focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-ink">
        <Input
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 text-base outline-none"
        />
        <Button
          aria-label="Show all"
          className="min-w-11 cursor-pointer border-0 border-l-3 border-ink bg-paper font-mono outline-none data-[focus-visible]:bg-ink data-[focus-visible]:text-paper"
        >
          ▾
        </Button>
      </div>
      <Popover
        offset={4}
        className="w-(--trigger-width) min-w-64 overflow-auto border-3 border-ink bg-paper shadow-hard outline-none"
      >
        <ListBox<SearchItem> className="max-h-72 outline-none">
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className="flex cursor-pointer items-baseline justify-between gap-3 border-b-2 border-ink/10 px-3 py-2.5 outline-none last:border-b-0 data-[focused]:bg-ink data-[focused]:text-paper data-[selected]:font-bold"
            >
              <span>{item.label}</span>
              {item.detail && <span className="font-mono text-xs opacity-70">{item.detail}</span>}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
