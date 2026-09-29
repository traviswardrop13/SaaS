# Picture-book artwork — batch B

Generated 28 September 2026 with the built-in `image_gen.imagegen` tool. No CLI or API fallback. Source sentences read verbatim from the existing `STORIES` array in `public/library.html`; no story wording was changed. Reference board visually inspected: `/Users/traviswardrop/.codex/worktrees/crafted-redesign/SaaS/design/crafted-world/references/05-library-practice-feed-final.png`. It served as art-direction reference; no input images were supplied to initial generation calls.

Each atlas is 1536 × 1024 with exactly three columns and two rows. Each square 512 × 512 cell is one page, in row-major order. No captions, UI, gutter or frame. All final assets were inspected with `view_image`. The integration uses JPEG derivatives at `public/assets/books/{slug}.jpg` while generation initially saves PNGs at the paths below.

## lily

Initial workspace asset: `public/assets/books/lily.png`.

Selected generated source: `/Users/traviswardrop/.codex/generated_images/01a0e8b3-8cbc-7392-ba2a-c756ece34926/exec-24ba4024-c552-42f2-82f2-5658ef70da8d.png`.

### Exact initial prompt

```text
Use case: illustration-story.
Asset type: production six-page picture-book illustration atlas for the Sona children's reading app.
Generate ONE landscape image, exactly 1536 x 1024 pixels. It must be divided into EXACTLY THREE columns and TWO rows of equal 512 x 512 square panels. No gutters, no margins, no frames, no rounded corners. Vertical panel boundaries are at x=512 and 1024; horizontal boundary at y=512. Six distinct full-bleed complete scene illustrations in strict row-major page order. Every main subject stays within the central 75 percent of its own cell with comfortable scenery around them. Do not let any subject cross a cell boundary.
Art direction: a crafted little world with charming rounded sculpted storybook animals, softly modeled clay-like volume, subtle painterly grain and tactile surface details, lush layered foliage, soft warm sunlight, cream highlights, honey-gold warmth, muted leaf greens and sky blues. Rich polished illustration with soft depth; not flat vector art, not photorealistic, not plastic gloss. Preschool friendly, tender and playful. Character identity, proportions, facial features, fur, clothing and colors must remain identical across all six panels. Clear expressive eyes. Each panel fills its square edge-to-edge with scenic background; no blank outer background.
Absolutely NO text, letters, numerals, speech balloons, captions, labels, logos, UI, watermark, symbols for sound, or page numbers anywhere. These are pictures only; sentence copy will be added by software separately. NO Echo blue bird mascot. No extra narrative beats beyond the supplied six sentences.
Book: Lily the Lion.
Character continuity: Lily is an adorable golden lion cub with a fluffy round ochre mane, cream muzzle, tiny brown nose and friendly eyes. No clothing. Her ladybug companion has red wings with black spots. Setting: warm wildflower meadow with rounded green hills and leafy trees.
Six panels in strict row-major order:
Panel 1 (top left), original sentence as illustration reference only: "Lily the lion licks a lemon lollipop." Scene: Lily sits in the meadow happily licking a round yellow lemon lollipop held in her paw.
Panel 2 (top center), original sentence as illustration reference only: "Lily leaps over a little log." Scene: Lily leaps joyfully above one little fallen wooden log on the meadow path, her whole body visible.
Panel 3 (top right), original sentence as illustration reference only: "A ladybug lands on a leaf." Scene: Lily watches closely as a small red spotted ladybug lands on one broad green leaf held near her face; enough scale that the ladybug is clear.
Panel 4 (bottom left), original sentence as illustration reference only: "Lily laughs: la la la!" Scene: Lily laughs with open happy mouth and lifted paws in the meadow, the ladybug nearby. No music notes or letters.
Panel 5 (bottom center), original sentence as illustration reference only: "They look at a yellow balloon." Scene: Lily and the ladybug gaze at one bright yellow balloon floating just above them, its string descending into Lily's paw.
Panel 6 (bottom right), original sentence as illustration reference only: "Lily loves to play all day." Scene: Lily joyfully plays in a sunny field of little daisies, her ladybug friend nearby, welcoming gentle end-of-story feeling.
```

## kiki

Initial workspace asset: `public/assets/books/kiki.png`.

Selected generated source: `/Users/traviswardrop/.codex/generated_images/01a0e8b3-8cbc-7392-ba2a-c756ece34926/exec-52b20057-0521-445e-a5c5-31322c6cd8af.png`.

### Exact initial prompt

```text
Use case: illustration-story.
Asset type: production six-page picture-book illustration atlas for the Sona children's reading app.
Generate ONE landscape image, exactly 1536 x 1024 pixels. It must be divided into EXACTLY THREE columns and TWO rows of equal 512 x 512 square panels. No gutters, no margins, no frames, no rounded corners. Vertical panel boundaries are at x=512 and 1024; horizontal boundary at y=512. Six distinct full-bleed complete scene illustrations in strict row-major page order. Every main subject stays within the central 75 percent of its own cell with comfortable scenery around them. Do not let any subject cross a cell boundary.
Art direction: a crafted little world with charming rounded sculpted storybook animals, softly modeled clay-like volume, subtle painterly grain and tactile surface details, lush layered foliage, soft warm sunlight, cream highlights, honey-gold warmth, muted leaf greens and sky blues. Rich polished illustration with soft depth; not flat vector art, not photorealistic, not plastic gloss. Preschool friendly, tender and playful. Character identity, proportions, facial features, fur, clothing and colors must remain identical across all six panels. Clear expressive eyes. Each panel fills its square edge-to-edge with scenic background; no blank outer background.
Absolutely NO text, letters, numerals, speech balloons, captions, labels, logos, UI, watermark, symbols for sound, or page numbers anywhere. These are pictures only; sentence copy will be added by software separately. NO Echo blue bird mascot. No extra narrative beats beyond the supplied six sentences.
Book: Kiki the Koala.
Character continuity: Kiki is an adorable small gray koala with huge soft round ears, charcoal oval nose, warm brown eyes, pale belly, and a sage green apron. The kind king is a friendly older human man with a soft rounded face, small golden crown and muted terracotta cape. Keep both exactly consistent across scenes. Setting: cozy woodland cottage and nearby sunny garden.
Six panels in strict row-major order:
Panel 1 (top left), original sentence as illustration reference only: "Kiki the koala bakes a cake." Scene: Kiki stands at a wooden kitchen table making a small golden cake, holding a wooden mixing spoon; cozy soft light, simple baking bowl.
Panel 2 (top center), original sentence as illustration reference only: "A kind king comes with a key." Scene: The smiling friendly king visits Kiki's cottage doorway holding one large gold key; Kiki welcomes him.
Panel 3 (top right), original sentence as illustration reference only: "The king flies a colorful kite." Scene: In the garden the same king holds the string of a colorful diamond kite in the blue sky, with Kiki watching happily.
Panel 4 (bottom left), original sentence as illustration reference only: "Kiki gives the king a cookie." Scene: Kiki offers the king one golden cookie at the garden table, their smiling faces clearly visible.
Panel 5 (bottom center), original sentence as illustration reference only: "A cat and a cow come to play." Scene: Kiki and the king greet a little cream cat and friendly black-and-white cow in the garden meadow; all four easily legible.
Panel 6 (bottom right), original sentence as illustration reference only: "What a cool day for Kiki!" Scene: Happy Kiki rests in the sunny garden with the king, cat and cow nearby, cake on the little wooden table; calm cheerful celebration.
```

## shelly

Initial workspace asset: `public/assets/books/shelly.png`.

Selected generated source: `/Users/traviswardrop/.codex/generated_images/01a0e8b3-8cbc-7392-ba2a-c756ece34926/exec-559b9183-1325-4560-aed8-57e2d6f2947e.png`.

### Exact initial prompt

```text
Use case: illustration-story.
Asset type: production six-page picture-book illustration atlas for the Sona children's reading app.
Generate ONE landscape image, exactly 1536 x 1024 pixels. It must be divided into EXACTLY THREE columns and TWO rows of equal 512 x 512 square panels. No gutters, no margins, no frames, no rounded corners. Vertical panel boundaries are at x=512 and 1024; horizontal boundary at y=512. Six distinct full-bleed complete scene illustrations in strict row-major page order. Every main subject stays within the central 75 percent of its own cell with comfortable scenery around them. Do not let any subject cross a cell boundary.
Art direction: a crafted little world with charming rounded sculpted storybook animals, softly modeled clay-like volume, subtle painterly grain and tactile surface details, lush layered foliage, soft warm sunlight, cream highlights, honey-gold warmth, muted leaf greens and sky blues. Rich polished illustration with soft depth; not flat vector art, not photorealistic, not plastic gloss. Preschool friendly, tender and playful. Character identity, proportions, facial features, fur, clothing and colors must remain identical across all six panels. Clear expressive eyes. Each panel fills its square edge-to-edge with scenic background; no blank outer background.
Absolutely NO text, letters, numerals, speech balloons, captions, labels, logos, UI, watermark, symbols for sound, or page numbers anywhere. These are pictures only; sentence copy will be added by software separately. NO Echo blue bird mascot. No extra narrative beats beyond the supplied six sentences.
Book: Shelly the Sheep.
Character continuity: Shelly is a little cream-white sheep with puffy curly wool, pale peach face and ears, expressive brown eyes, tiny hooves, and lilac shoes. Her friend is one little bright coral fish with kind eyes who stays in water or a clearly visible glass bowl aboard the ship. Setting: cozy seaside harbor and warm wooden sailing ship, soft pale blue sea.
Six panels in strict row-major order:
Panel 1 (top left), original sentence as illustration reference only: "Shelly the sheep shines her shoes." Scene: Shelly sits on a harbor bench carefully polishing one lilac shoe with a little cloth; matching other shoe on foot.
Panel 2 (top center), original sentence as illustration reference only: "She shows a shiny shell to a fish." Scene: Shelly kneels at the shallow sea edge showing one pearly shiny shell to a friendly coral fish poking up from the water.
Panel 3 (top right), original sentence as illustration reference only: "They sail on a big ship. Shhh!" Scene: Shelly stands on the broad deck of a big beautiful wooden sailing ship, coral fish beside her in a water-filled clear glass bowl, cream sails and blue sea visible.
Panel 4 (bottom left), original sentence as illustration reference only: "Shelly makes a wish on a star." Scene: Under a softly deep blue night sky on the ship deck, Shelly clasps her little hooves and looks up to one radiant star.
Panel 5 (bottom center), original sentence as illustration reference only: "She sips a milkshake — so fresh." Scene: Shelly sips a pale strawberry milkshake through a straw at a wooden deck table, coral fish in glass bowl nearby.
Panel 6 (bottom right), original sentence as illustration reference only: "Shhh… Shelly is sleeping now." Scene: Shelly sleeps peacefully in a cozy ship cabin bed, lilac shoes set beside it, moonlight through round porthole and soft cream blanket.
```

## charlie

Initial workspace asset: `public/assets/books/charlie.png`.

Selected generated source: `/Users/traviswardrop/.codex/generated_images/01a0e8b3-8cbc-7392-ba2a-c756ece34926/exec-08bc4c38-23b4-4ff9-ad6b-9253b5b56570.png`.

### Exact initial prompt

```text
Use case: illustration-story.
Asset type: production six-page picture-book illustration atlas for the Sona children's reading app.
Generate ONE landscape image, exactly 1536 x 1024 pixels. It must be divided into EXACTLY THREE columns and TWO rows of equal 512 x 512 square panels. No gutters, no margins, no frames, no rounded corners. Vertical panel boundaries are at x=512 and 1024; horizontal boundary at y=512. Six distinct full-bleed complete scene illustrations in strict row-major page order. Every main subject stays within the central 75 percent of its own cell with comfortable scenery around them. Do not let any subject cross a cell boundary.
Art direction: a crafted little world with charming rounded sculpted storybook animals, softly modeled clay-like volume, subtle painterly grain and tactile surface details, lush layered foliage, soft warm sunlight, cream highlights, honey-gold warmth, muted leaf greens and sky blues. Rich polished illustration with soft depth; not flat vector art, not photorealistic, not plastic gloss. Preschool friendly, tender and playful. Character identity, proportions, facial features, fur, clothing and colors must remain identical across all six panels. Clear expressive eyes. Each panel fills its square edge-to-edge with scenic background; no blank outer background.
Absolutely NO text, letters, numerals, speech balloons, captions, labels, logos, UI, watermark, symbols for sound, or page numbers anywhere. These are pictures only; sentence copy will be added by software separately. NO Echo blue bird mascot. No extra narrative beats beyond the supplied six sentences.
Book: Charlie the Chick.
Character continuity: Charlie is a tiny round golden-yellow chick with fluffy tactile down, large warm brown eyes, small orange beak and orange feet. No clothing. His friend is a small chestnut chipmunk with cream belly and clear dark-and-cream back stripes. Setting: idyllic countryside train journey, soft green trees and warm wooden picnic furniture.
Six panels in strict row-major order:
Panel 1 (top left), original sentence as illustration reference only: "Charlie the chick chews chewy cherries." Scene: Charlie happily nibbles a ripe red cherry beside a small bowl of cherries at a picnic table.
Panel 2 (top center), original sentence as illustration reference only: "Charlie rides the choo-choo train." Scene: Charlie rides inside a charming teal-and-rust red steam train carriage, his face and wings visible in its open window, countryside behind.
Panel 3 (top right), original sentence as illustration reference only: "He munches cheese at lunch." Scene: Charlie sits at a wooden lunch table eating a piece of yellow cheese, sunlit garden station nearby.
Panel 4 (bottom left), original sentence as illustration reference only: "A chipmunk sits on a chair." Scene: Charlie's friendly chipmunk companion sits centered on a little wooden chair at the picnic table, Charlie watches beside the chair.
Panel 5 (bottom center), original sentence as illustration reference only: "They share chocolate chips. Crunch!" Scene: Charlie and the chipmunk smile while sharing a small shallow bowl of individual chocolate chips at the picnic table.
Panel 6 (bottom right), original sentence as illustration reference only: "Charlie chirps: cheep, cheep, cheep." Scene: Charlie stands happily in soft grass lifting his tiny wings and opening his beak in a cheerful chirp, chipmunk beside him. No letters or sound symbols.
```

## theo

Initial workspace asset: `public/assets/books/theo.png`.

Selected generated source: `/Users/traviswardrop/.codex/generated_images/01a0e8b3-8cbc-7392-ba2a-c756ece34926/exec-5fe3c725-a2c7-48a2-8a10-cad7ee8c3146.png`.

### Exact initial prompt

```text
Use case: illustration-story.
Asset type: production six-page picture-book illustration atlas for the Sona children's reading app.
Generate ONE landscape image, exactly 1536 x 1024 pixels. It must be divided into EXACTLY THREE columns and TWO rows of equal 512 x 512 square panels. No gutters, no margins, no frames, no rounded corners. Vertical panel boundaries are at x=512 and 1024; horizontal boundary at y=512. Six distinct full-bleed complete scene illustrations in strict row-major page order. Every main subject stays within the central 75 percent of its own cell with comfortable scenery around them. Do not let any subject cross a cell boundary.
Art direction: a crafted little world with charming rounded sculpted storybook animals, softly modeled clay-like volume, subtle painterly grain and tactile surface details, lush layered foliage, soft warm sunlight, cream highlights, honey-gold warmth, muted leaf greens and sky blues. Rich polished illustration with soft depth; not flat vector art, not photorealistic, not plastic gloss. Preschool friendly, tender and playful. Character identity, proportions, facial features, fur, clothing and colors must remain identical across all six panels. Clear expressive eyes. Each panel fills its square edge-to-edge with scenic background; no blank outer background.
Absolutely NO text, letters, numerals, speech balloons, captions, labels, logos, UI, watermark, symbols for sound, or page numbers anywhere. These are pictures only; sentence copy will be added by software separately. NO Echo blue bird mascot. No extra narrative beats beyond the supplied six sentences.
Book: Theo the Sloth.
Character continuity: Theo is a gentle round little taupe-brown sloth with a cream face, warm dark eye patches, friendly black-brown eyes and three small rounded teeth. Soft long arms and a little sage neck scarf, consistent throughout except bath scarf set aside. Setting: cozy forest treetop home with natural wood and cream textiles.
Six panels in strict row-major order:
Panel 1 (top left), original sentence as illustration reference only: "Theo the sloth thinks happy thoughts." Scene: Theo relaxes on a sturdy tree branch with dreamy smiling expression looking out over sunlit forest. No thought bubbles.
Panel 2 (top center), original sentence as illustration reference only: "Theo counts: one, two, three!" Scene: Theo carefully points to exactly three smooth acorns arranged in a row on a little wooden table; his gaze directed at them. No numbers.
Panel 3 (top right), original sentence as illustration reference only: "He gives a big thumbs up." Scene: A clear friendly portrait of Theo in his forest home lifting one rounded cartoon hand in an unmistakable single thumbs-up gesture, pleased expression.
Panel 4 (bottom left), original sentence as illustration reference only: "Theo brushes his three teeth." Scene: Theo stands at a small wash basin brushing his mouth with a toothbrush, showing exactly three small rounded teeth, tiny foam and a mirror.
Panel 5 (bottom center), original sentence as illustration reference only: "Then a warm bath — both feet in." Scene: Theo sits happily in a modest cozy wooden bathtub full of warm bubbles with both feet visibly inside the tub, tasteful animal illustration, no clothing except bubbles and scarf hanging nearby.
Panel 6 (bottom right), original sentence as illustration reference only: "Thank you, moon. Theo says goodnight." Scene: Theo tucked under a cream blanket in his treetop bed, looking gently through round window at a luminous moon, calm blue twilight.
```

## Theo repair history

The first output (`/Users/traviswardrop/.codex/generated_images/01a0e8b3-8cbc-7392-ba2a-c756ece34926/exec-5a79c4e8-43e3-421f-9f12-cdcec6982215.png`) showed too many teeth while brushing. A first precise edit improved the mouth but still showed four teeth; a second precise edit produced exactly three visible teeth, as the existing sentence requires. Only that panel's mouth changed. Final output was inspected and copied over the intermediate workspace PNG before integration.

### First repair prompt

```text
Use case: precise-object-edit.
Edit this six-panel children's story illustration atlas. Preserve the exact 1536x1024 canvas and exact 3-column by 2-row panel geometry, all backgrounds, colors, lighting, the sloth's identity, all characters, all props, and every panel's composition. The only change is Theo's mouth and teeth in the bottom-left panel (panel four, brushing teeth). The story sentence is "Theo brushes his three teeth." Give him EXACTLY THREE TOTAL teeth: three small rounded cream teeth all along the upper edge of an otherwise dark smiling open mouth. No other teeth anywhere inside that mouth, no lower teeth, no extra rows. Keep his green toothbrush, paw and a modest amount of foam, but make the exactly three teeth clearly readable and countable. All five other panels remain unchanged. No added text, numbers, borders or gaps.
```

First repair output: `/Users/traviswardrop/.codex/generated_images/01a0e8b3-8cbc-7392-ba2a-c756ece34926/exec-0ea3adac-b7cd-444f-b476-1ee167c60d5e.png`.

### Second repair prompt

```text
Precise image correction. Preserve all six scenes and the 3x2 layout EXACTLY, and change ONLY the mouth in the bottom-left brushing-teeth scene. It currently still has FOUR teeth. Replace its entire upper row of teeth with exactly THREE LARGE ROUND RECTANGULAR TEETH that are visibly separated and easy to count: one left tooth, one middle tooth, one right tooth. Draw a simple dark open smiling mouth with exactly these three separate off-white teeth hanging from its top; no tiny extra tooth at either corner, no lower teeth. Each tooth must be larger so exactly THREE fill the width of the smile. Keep toothbrush touching the leftmost tooth and reduce the foam enough that all three are easy to count. Every other part of the image stays identical. No lettering or numbers.
```

Final output: `/Users/traviswardrop/.codex/generated_images/01a0e8b3-8cbc-7392-ba2a-c756ece34926/exec-5fe3c725-a2c7-48a2-8a10-cad7ee8c3146.png`.



Production integration: final delivery files are `public/assets/books/*.jpg` (JPEG quality 88, unchanged dimensions). Intermediate PNGs were moved to `output/books-preview/source-art/`; generated originals remain at the recorded source paths.
