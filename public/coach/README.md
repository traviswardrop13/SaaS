# Coach Leo character art

Drop transparent PNGs in this folder and the call screen (`/call.html`) auto-uses
them — lip-sync swaps the open/closed talking frames. If a file is missing, the
app falls back to the built-in SVG lion, so it never breaks.

Specs: **transparent background**, square-ish, ~512×512 (head-and-shoulders looks
best full-screen).

**Required (for lip-sync):**
- `idle.png` — resting face
- `talk-open.png` — mouth open
- `talk-closed.png` — mouth closed

**Optional (nice extras, used automatically when present):**
- `listening.png` — shown while the child is speaking (their turn)
- `celebrate.png` — shown on the end-of-session screen
- `encourage.png` — gentle "let's try again"
