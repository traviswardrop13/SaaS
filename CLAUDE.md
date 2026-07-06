# Working with Travis

## Communication style
- Be concise. Default to a few sentences; use short bullets when listing.
- Lead with the answer or the thing that happened. Cut background, caveats,
  and strategy essays unless asked.
- One recommendation, not a menu. No recaps of prior context.
- Long-form only when explicitly asked ("go deep", "full plan").

## Project
Sona (speaksona.com) — kids' speech-practice PWA in public/, Next.js API
routes, Capacitor iOS shell that remote-loads the site. Rachel (wife) is a
licensed SLP. Solo founder, ships fast.

## Hard rules
- Merges to main/prod only on Travis's explicit go ("merge").
- In-game voice detection records/uploads nothing (local loudness only).
- No silence counted as reps; voice boosts never logged as SLP data.
- Never rewrite pushed git history. Push after every verified milestone.
