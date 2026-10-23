# Credits

Lepak.gg is built on other people's open-source work. Their licences let us use it for free,
on the condition that we keep their names and licence notices. Thank you all.

Our own features have our own names (KataBomb, Lepak Pages, Papan...). The libraries
underneath keep theirs.

## Libraries

| Library                                                                                                                                                                                                       | Used for                                                | Licence              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------- |
| [React](https://react.dev)                                                                                                                                                                                    | Everything on screen                                    | MIT                  |
| [React Router](https://reactrouter.com)                                                                                                                                                                       | Page routing                                            | MIT                  |
| [Vite](https://vite.dev)                                                                                                                                                                                      | Building the site                                       | MIT                  |
| [Tailwind CSS](https://tailwindcss.com)                                                                                                                                                                       | Styling                                                 | MIT                  |
| [Zod](https://zod.dev)                                                                                                                                                                                        | Checking multiplayer messages                           | MIT                  |
| [Firebase JS SDK](https://github.com/firebase/firebase-js-sdk)                                                                                                                                                | Guest sign-in, live rooms, chat, votes                  | Apache-2.0           |
| [supabase-js](https://github.com/supabase/supabase-js)                                                                                                                                                        | Lepak Pages storage                                     | MIT                  |
| [obscenity](https://github.com/jo3-l/obscenity)                                                                                                                                                               | Nickname and chat filter                                | MIT                  |
| [qrcode](https://github.com/soldair/node-qrcode)                                                                                                                                                              | Room and page QR codes                                  | MIT                  |
| [marked](https://github.com/markedjs/marked)                                                                                                                                                                  | Markdown in Pages                                       | MIT                  |
| [DOMPurify](https://github.com/cure53/DOMPurify)                                                                                                                                                              | Cleaning Pages content                                  | Apache-2.0 / MPL-2.0 |
| [mammoth](https://github.com/mwilliamson/mammoth.js)                                                                                                                                                          | Word to note conversion                                 | BSD-2-Clause         |
| [Turndown](https://github.com/mixmark-io/turndown)                                                                                                                                                            | HTML to markdown                                        | MIT                  |
| [docx-preview](https://github.com/VolodymyrBaydalka/docxjs)                                                                                                                                                   | Showing Word files with their layout                    | Apache-2.0           |
| [fflate](https://github.com/101arrowz/fflate)                                                                                                                                                                 | Opening .zip sites                                      | MIT                  |
| [KaTeX](https://katex.org)                                                                                                                                                                                    | Maths in Pages                                          | MIT                  |
| [Mermaid](https://mermaid.js.org)                                                                                                                                                                             | Diagrams in Pages                                       | MIT                  |
| [Excalidraw](https://github.com/excalidraw/excalidraw)                                                                                                                                                        | Whiteboard drawing surface                              | MIT                  |
| [pdf-lib](https://github.com/Hopding/pdf-lib)                                                                                                                                                                 | Toolbox PDF tools                                       | MIT                  |
| [Archivo](https://fonts.google.com/specimen/Archivo), [Space Mono](https://fonts.google.com/specimen/Space+Mono), [Caveat](https://fonts.google.com/specimen/Caveat) via [Fontsource](https://fontsource.org) | Fonts, bundled with the site                            | SIL OFL 1.1          |
| [Genkit](https://genkit.dev) + [Google GenAI plugin](https://github.com/firebase/genkit)                                                                                                                      | AI Notes (Gemini)                                       | Apache-2.0           |
| [PptxGenJS](https://github.com/gitbrent/PptxGenJS)                                                                                                                                                            | AI Slides: PowerPoint download                          | MIT                  |
| [Yjs](https://github.com/yjs/yjs)                                                                                                                                                                             | Live co-editing of Lepak Pages notes                    | MIT                  |
| [Sentry JavaScript SDK](https://github.com/getsentry/sentry-javascript)                                                                                                                                       | Crash reports                                           | MIT                  |
| [Upstash Ratelimit](https://github.com/upstash/ratelimit-js) / [Redis](https://github.com/upstash/redis-js)                                                                                                   | Rate limit for Cite's link lookup                       | MIT                  |
| [Playwright](https://playwright.dev)                                                                                                                                                                          | End-to-end browser tests                                | Apache-2.0           |
| [Tesseract.js](https://github.com/naptha/tesseract.js)                                                                                                                                                        | "Snap to text": reading photos of notes, on your device | Apache-2.0           |

Toolbox tool ideas come from [delphi.tools](https://delphi.tools) ([licence: 0BSD](https://github.com/1612elphi/delphitools-cli)); our versions are written from scratch.

## Data

| Source                                                                                  | Used for                                                                                       | Licence                |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| [ENABLE word list](https://github.com/dolph/dictionary)                                 | KataBomb and Letterlock dictionaries                                                           | Public domain          |
| [Open Trivia Database](https://opentdb.com)                                             | Trivia questions (loaded live, not stored here)                                                | CC BY-SA 4.0           |
| [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) | Cite: DOI autofill                                                                             | Metadata free to reuse |
| [Open Library API](https://openlibrary.org/developers/api)                              | Cite: ISBN autofill                                                                            | Open data              |
| Letterlock answers, Groupthink puzzles                                                  | Written for Lepak.gg                                                                           | MIT (this repo)        |
| Word Weave themes, Domino Logic, Mosaic and Sudoku puzzles                              | Written or generated for Lepak.gg                                                              | MIT (this repo)        |
| Hive Mind and Edgewise puzzles                                                          | Built from the ENABLE word list (scripts/build-games.mjs)                                      | Public domain          |
| Pocket Crossword clues                                                                  | Written with Google Gemini once at build time, checked by script (scripts/build-crossword.mjs) | MIT (this repo)        |

AI Slides' outline-first flow (plan, check, then build) was inspired by [presentation-ai](https://github.com/allweonedev/presentation-ai) (MIT). Our code is written from scratch.

When you add a library or data set, add a row here in the same pull request.

## Art and sound

| Source                                                                                                           | Used for                                          | Licence |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------- |
| [Kenney](https://kenney.nl): Racing Pack, Space Shooter Remastered, Animal Pack, Sci-fi Sounds, Interface Sounds | Ketik Race cars, track, space ships, avatars, sfx | CC0 1.0 |
