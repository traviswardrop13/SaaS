# Customize: crafted setting pass

Date: 28 September 2026. Scope: `public/customize.html`, the page-local `public/crafted-customize.css`, six setting WebPs, and these records. No books, shared character catalog, `sona.js`, or `crafted-family.css` were changed.

The preview now uses a painted setting and wood-framed portrait badge. Native buttons replace the clickable divs, with selected checks and `aria-pressed`. The Done action stays above the phone safe area; choice changes still save immediately through the existing profile API. All eight buddies retain their original identities, names, colors and distinguishing features. Their portraits are now painted toy badges based on a contact sheet of the existing catalog and the original design board; the original SVGs remain as image-load fallbacks. The legacy `leo` alias is visually marked as Pip (the existing catalog fallback) without rewriting saved values. Outfit selection and beta ownership logic are preserved.

Six painted scene panels were generated in one atlas with the built-in imagegen tool, guided by the original game design board. Source, exact prompt, crops and production paths are in `customize-v2-assets.json`. The original SVG landscapes remain behind the images as loading/failure fallbacks. The original reference remains unchanged. These assets do not replace shared buddy artwork. Eight page-local 288×288 portrait WebPs were added afterward to remove the flat SVG look in the preview and picker; exact prompt, source and crop provenance is in `customize-v2-portraits.json`.

## Focused validation

30 checks passed at 393×852 (safe areas 59/34) and 320×568 (20/0), using real button clicks. All eight characters selected correctly, Crown/Beach choices updated and survived reload, no horizontal overflow, Done remained visible, final scene remained reachable above the footer, Done navigated back to play, and no page JavaScript errors occurred. Six scene images loaded on both sizes, and all eight exported portrait assets were verified at 288×288. The 30 interaction checks were rerun after replacing the portrait rendering. Screenshots and the temporary QA source/log are in `customize-v2/`.

This is browser mobile QA, not a physical iPhone install. Full release checks belong to the integrating root task. No commit or push made by this pass.
