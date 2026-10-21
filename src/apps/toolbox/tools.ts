import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// Every tool in the Toolbox. Adding one: write tools/YourTool.tsx (default export) and add a line here.
// Ideas inspired by delphi.tools (0BSD); everything here is our own code and runs on your device.

export type ToolGroup = 'Study' | 'Maths' | 'Files' | 'Design' | 'Code';

export interface Tool {
  id: string; // also the URL: /tools/<id>
  name: string;
  blurb: string;
  group: ToolGroup;
  component: LazyExoticComponent<ComponentType>;
}

export const TOOLS: Tool[] = [
  {
    id: 'words',
    name: 'Word counter',
    blurb: 'Words, characters, reading and speaking time.',
    group: 'Study',
    component: lazy(() => import('./tools/Words')),
  },
  {
    id: 'dates',
    name: 'Days until',
    blurb: 'Days and school days until a deadline or exam.',
    group: 'Study',
    component: lazy(() => import('./tools/Dates')),
  },
  {
    id: 'paper',
    name: 'Paper sizes',
    blurb: 'A4, A3, Letter and more, in mm, cm, inches and pixels.',
    group: 'Study',
    component: lazy(() => import('./tools/Paper')),
  },
  {
    id: 'calc',
    name: 'Scientific calculator',
    blurb: 'sin, log, powers, brackets. Degrees or radians.',
    group: 'Maths',
    component: lazy(() => import('./tools/Calc')),
  },
  {
    id: 'units',
    name: 'Unit converter',
    blurb: 'Length, mass, temperature, data and more.',
    group: 'Maths',
    component: lazy(() => import('./tools/Units')),
  },
  {
    id: 'bases',
    name: 'Number bases',
    blurb: 'Binary, octal, decimal and hex.',
    group: 'Maths',
    component: lazy(() => import('./tools/Bases')),
  },
  {
    id: 'pdf',
    name: 'PDF tools',
    blurb: 'Merge, split, rotate, and turn photos into a PDF.',
    group: 'Files',
    component: lazy(() => import('./tools/Pdf')),
  },
  {
    id: 'image',
    name: 'Image converter',
    blurb: 'Resize and convert to PNG, JPG or WebP.',
    group: 'Files',
    component: lazy(() => import('./tools/Image')),
  },
  {
    id: 'qr',
    name: 'QR maker',
    blurb: 'Turn a link or text into a QR code.',
    group: 'Files',
    component: lazy(() => import('./tools/Qr')),
  },
  {
    id: 'colour',
    name: 'Colour + contrast',
    blurb: 'HEX, RGB, HSL, and a readability check.',
    group: 'Design',
    component: lazy(() => import('./tools/Colour')),
  },
  {
    id: 'encode',
    name: 'Encode + hash',
    blurb: 'Base64, URL encoding and SHA-256.',
    group: 'Code',
    component: lazy(() => import('./tools/Encode')),
  },
  {
    id: 'regex',
    name: 'Regex tester',
    blurb: 'Try a regular expression and see every match.',
    group: 'Code',
    component: lazy(() => import('./tools/Regex')),
  },
];
