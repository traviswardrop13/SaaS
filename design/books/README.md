# Sona books — crafted-world redesign

The references are the five original Sona design boards recovered from the earlier Sona chat, copied unchanged into `references/`. Board 05 is the final library/practice/Feed Echo direction; board 01 is its earlier variant. None of the five includes a dedicated book screen.

## Scope

- `public/library.html`: book shelf and six-page picture-book reader.
- `public/books.css`: cream paper, brown type, teal actions, illustrated covers, responsive reader, page progress and keyboard access.
- `public/assets/books/*.jpg`: one six-scene illustration atlas per existing book, three columns by two rows, in reading order. The reader crops each scene in CSS; titles, story text, controls and progress remain live HTML.

All 13 titles and all 78 sentences are unchanged. Focus-sound filtering, read-aloud fallback, individual word playback, per-child completion stars, and the existing additional library activities are preserved. The requested read-and-repeat prototype is documented in `READ_REPEAT_REVIEW.md`. Home still labels Books as coming soon and has no reader link.

## Artwork

Created with the built-in image-generation tool using the original board as the visual reference. Exact prompts and source paths are recorded in `art-prompts-a.md`, `art-prompts-b.md` and `art-prompts-c.md`. Each book is one six-panel illustration atlas. Production copies are JPEG quality 88, converted without cropping or changing dimensions. Original generated PNGs are retained by the image tool; local working copies are under `output/books-preview/source-art/`.

The first scene doubles as the cover illustration. A missing artwork file falls back to the existing book or page illustration. Cover images load lazily.

## Local review

Serve `public/` and open `/library.html`. The current review server is `http://127.0.0.1:8194/library.html`. A child focused on R sees the five R books; play mode sees all 13, as before.

Validation results and phone screenshots are stored locally in `output/books-preview/`. A full battery is required before pushing, per AGENTS.md.

### Initial visual redesign verification — 28 September 2026

- Syntax suite: pass.
- Existing read-aloud, library compatibility, child persistence and Home/filtering suites: 212 assertions passed, all four process exit codes 0.
- TypeScript: pass, exit 0.
- Browser walkthrough: 13 books, all 78 scenes loaded, every page/finish/replay/close path exercised, all 13 completion stars recorded. No page errors.
- Layouts checked at 320×568, 390×844, 430×932 and 1024×768. At 844×390 the existing app portrait guard remains active.
- Parsed story catalog matches the original exactly: all 13 titles and 78 sentences unchanged.
- Full release battery has not been run; this work remains local and unpushed.
