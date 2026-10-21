// Unit converter. Each unit is a factor to the category's base unit
// (temperature is special-cased because it has offsets).

export interface Unit {
  id: string;
  label: string;
  factor: number; // how many base units in one of this unit
}

export interface Category {
  id: string;
  label: string;
  units: Unit[];
}

export const CATEGORIES: Category[] = [
  {
    id: 'length',
    label: 'Length',
    units: [
      { id: 'mm', label: 'Millimetres', factor: 0.001 },
      { id: 'cm', label: 'Centimetres', factor: 0.01 },
      { id: 'm', label: 'Metres', factor: 1 },
      { id: 'km', label: 'Kilometres', factor: 1000 },
      { id: 'in', label: 'Inches', factor: 0.0254 },
      { id: 'ft', label: 'Feet', factor: 0.3048 },
      { id: 'yd', label: 'Yards', factor: 0.9144 },
      { id: 'mi', label: 'Miles', factor: 1609.344 },
    ],
  },
  {
    id: 'mass',
    label: 'Mass',
    units: [
      { id: 'mg', label: 'Milligrams', factor: 0.001 },
      { id: 'g', label: 'Grams', factor: 1 },
      { id: 'kg', label: 'Kilograms', factor: 1000 },
      { id: 't', label: 'Tonnes', factor: 1_000_000 },
      { id: 'oz', label: 'Ounces', factor: 28.349523125 },
      { id: 'lb', label: 'Pounds', factor: 453.59237 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    units: [
      { id: 'c', label: 'Celsius', factor: 1 },
      { id: 'f', label: 'Fahrenheit', factor: 1 },
      { id: 'k', label: 'Kelvin', factor: 1 },
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    units: [
      { id: 'ml', label: 'Millilitres', factor: 0.001 },
      { id: 'l', label: 'Litres', factor: 1 },
      { id: 'm3', label: 'Cubic metres', factor: 1000 },
      { id: 'tsp', label: 'Teaspoons (US)', factor: 0.00492892159375 },
      { id: 'tbsp', label: 'Tablespoons (US)', factor: 0.01478676478125 },
      { id: 'cup', label: 'Cups (US)', factor: 0.2365882365 },
      { id: 'gal', label: 'Gallons (US)', factor: 3.785411784 },
    ],
  },
  {
    id: 'area',
    label: 'Area',
    units: [
      { id: 'cm2', label: 'Square centimetres', factor: 0.0001 },
      { id: 'm2', label: 'Square metres', factor: 1 },
      { id: 'km2', label: 'Square kilometres', factor: 1_000_000 },
      { id: 'ha', label: 'Hectares', factor: 10_000 },
      { id: 'ac', label: 'Acres', factor: 4046.8564224 },
      { id: 'ft2', label: 'Square feet', factor: 0.09290304 },
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    units: [
      { id: 'ms', label: 'Metres / second', factor: 1 },
      { id: 'kmh', label: 'Kilometres / hour', factor: 1 / 3.6 },
      { id: 'mph', label: 'Miles / hour', factor: 0.44704 },
      { id: 'kn', label: 'Knots', factor: 0.514444 },
    ],
  },
  {
    id: 'time',
    label: 'Time',
    units: [
      { id: 's', label: 'Seconds', factor: 1 },
      { id: 'min', label: 'Minutes', factor: 60 },
      { id: 'h', label: 'Hours', factor: 3600 },
      { id: 'd', label: 'Days', factor: 86400 },
      { id: 'wk', label: 'Weeks', factor: 604800 },
      { id: 'yr', label: 'Years (365.25 days)', factor: 31_557_600 },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    units: [
      { id: 'b', label: 'Bytes', factor: 1 },
      { id: 'kb', label: 'Kilobytes (1000)', factor: 1e3 },
      { id: 'mb', label: 'Megabytes (1000²)', factor: 1e6 },
      { id: 'gb', label: 'Gigabytes (1000³)', factor: 1e9 },
      { id: 'kib', label: 'Kibibytes (1024)', factor: 1024 },
      { id: 'mib', label: 'Mebibytes (1024²)', factor: 1024 ** 2 },
      { id: 'gib', label: 'Gibibytes (1024³)', factor: 1024 ** 3 },
    ],
  },
];

function toCelsius(v: number, from: string): number {
  if (from === 'f') return ((v - 32) * 5) / 9;
  if (from === 'k') return v - 273.15;
  return v;
}

function fromCelsius(c: number, to: string): number {
  if (to === 'f') return (c * 9) / 5 + 32;
  if (to === 'k') return c + 273.15;
  return c;
}

export function convert(value: number, categoryId: string, from: string, to: string): number {
  if (categoryId === 'temperature') return fromCelsius(toCelsius(value, from), to);
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const a = cat?.units.find((u) => u.id === from);
  const b = cat?.units.find((u) => u.id === to);
  if (!a || !b) return NaN;
  return (value * a.factor) / b.factor;
}
