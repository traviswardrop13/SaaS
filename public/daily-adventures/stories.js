/* Planning content only. Physical modules own help, progress and completion.
   Keep every story unavailable until its game and earned ending are verified. */
window.DailyAdventureStories = [
  {
    "day": 4,
    "key": "waterwheel",
    "title": "The Thirsty Waterwheel Garden",
    "description": "Reconnect a little waterwheel, water the flowers and fill a wildlife pond.",
    "mechanic": "water-routing",
    "speechHelp": "Echo grows temporary broad leaf funnels around placed trough joins. They catch a slightly misaligned stream; the child must still build the route, operate the gate and deliver real water.",
    "youngerGoals": [
      "Guide spring water into the wheel.",
      "Water the herb bed.",
      "Water the flowerbed.",
      "Water the last flowerbed through the split channel.",
      "Fill the wildlife pond."
    ],
    "olderGoals": [
      "Feed the wheel's first intake from the spring.",
      "Complete the wheel's raised water route.",
      "Water the herb bed.",
      "Water the seedlings.",
      "Water the flowerbed.",
      "Water the berries.",
      "Split the flow to the last flowerbed.",
      "Fill the wildlife pond."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "Wake the wheel",
        "narration": [
          "Something is missing from the waterwheel garden.",
          "The flowers are drooping, the little pond is empty, and the wheel stands very still.",
          "Beside the spring, Gardener Mouse finds the trouble.",
          "The wooden water channels have come apart.",
          "Mouse needs help bringing water to the wheel.",
          "Fit a channel beneath the spring.",
          "Join the next one and open the gate.",
          "Here comes the water!"
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "A drink for the flowers",
        "narration": [
          "Splash, scoop, turn.",
          "The wheel is lifting water into the high garden channel.",
          "But the flowers are still waiting below.",
          "Turn a channel towards the first bed and watch its little bowl fill.",
          "Its flowers lift their heads when enough water arrives.",
          "Echo can grow broad leaf funnels around the joins.",
          "They catch a wobbly stream while you guide the water.",
          "Now make a path to the next thirsty bed."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "Share the stream",
        "narration": [
          "A butterfly settles on a new flower.",
          "Then another arrives.",
          "There is one flowerbed left, and the pond still needs water.",
          "Make two paths from the fork in the channel.",
          "One leads to the flowers.",
          "The other leads to the pond.",
          "Turn the gate and see where the water goes.",
          "Guide it until the last flowers open and the pond reaches its smooth stone edge."
        ]
      }
    ],
    "ending": [
      "Ducks paddle into the pond.",
      "Butterflies dance above the flowers.",
      "Mouse puts a little bench beside the turning wheel.",
      "The garden has water everywhere it needs it.",
      "You made the paths that brought it there."
    ],
    "done": {
      "title": "The garden is flowing!",
      "sub": "You watered the flowers and filled the wildlife pond."
    },
    "art": "/assets/crafted/daily/day04-waterwheel-garden-v1.webp",
    "endingArt": "/assets/crafted/daily/day04-waterwheel-ending-v1.webp",
    "ready": false
  },
  {
    "day": 5,
    "key": "postboat",
    "title": "The Little Island Postboat",
    "description": "Steer a small postboat through reed channels and deliver parcels to island neighbours.",
    "mechanic": "boat-steering-and-towing",
    "speechHelp": "Echo temporarily calms the current and reduces towline swing. The child still steers, collects cargo and docks the boat or raft.",
    "youngerGoals": [
      "Collect Mouse's parcel at the jetty.",
      "Deliver the parcel to Mouse's dock.",
      "Deliver the raincoat and books to Heron and Turtle.",
      "Attach Beaver's door raft to the postboat.",
      "Tow the door raft into Beaver's landing."
    ],
    "olderGoals": [
      "Collect the first two parcels at the jetty.",
      "Dock at Mouse's island and unload her curtains.",
      "Steer through the reed channel with Heron's parcel.",
      "Dock and deliver Heron's raincoat.",
      "Collect Turtle's book tin from the transfer jetty.",
      "Deliver the book tin to Turtle's dock.",
      "Attach and guide Beaver's wide door raft around the bend.",
      "Bring the raft into Beaver's landing and unload it."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "A small boat with a big job",
        "narration": [
          "Postmaster Otter has parcels for the island neighbours.",
          "His big boat cannot fit through the narrow reed channels.",
          "But the little postboat can.",
          "Otter needs a careful captain for today's deliveries.",
          "Pull up beside the jetty and collect the waiting parcels.",
          "The pictures show which island each parcel belongs to.",
          "Mouse's little blue door is just across the water."
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "Post through the reeds",
        "narration": [
          "Guide the boat into each small dock so its neighbour can lift out a parcel.",
          "Mouse's parcel holds new curtains.",
          "Heron's long parcel holds a bright raincoat.",
          "Turtle's little tin is full of books.",
          "The water bends around a thick patch of reeds.",
          "Echo can calm the current while you line up your boat.",
          "Choose the open channel and leave room for each turn.",
          "There are happy neighbours waiting at the next landing."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "Beaver's wide parcel",
        "narration": [
          "One delivery remains: Beaver's new front door.",
          "It is much too wide for the postboat.",
          "Otter has placed it on a little floating raft.",
          "Bring the boat alongside and attach the towline.",
          "Now guide both boat and raft around the bend.",
          "Give the raft room to turn behind you.",
          "At Beaver's island, bring it into the wide landing beside his house."
        ]
      }
    ],
    "ending": [
      "Beaver fits his new door and gives it a happy swing.",
      "Mouse opens her curtains, Heron wears his raincoat, and Turtle settles down with a book.",
      "Otter rings the little post bell.",
      "Every parcel has reached the home where it belongs."
    ],
    "done": {
      "title": "Every parcel is home!",
      "sub": "You delivered the island post and towed Beaver's new door."
    },
    "art": "/assets/crafted/daily/day05-postboat-harbour-v1.webp",
    "endingArt": "/assets/crafted/daily/day05-postboat-ending-v1.webp",
    "ready": false
  },
  {
    "day": 6,
    "key": "bakery",
    "title": "Breakfast at the Moonberry Bakery",
    "description": "Pour, stir, shape and bake breakfast buns for the bakery's morning visitors.",
    "mechanic": "tactile-cooking",
    "speechHelp": "Echo steadies pouring and temporarily widens the useful oven-heat band. Ingredients, dough shaping and finished batches still require the child's physical actions.",
    "youngerGoals": [
      "Pour the pictured ingredients and mix the first dough.",
      "Shape the round buns and place them on a tray.",
      "Prepare the curled buns, then the berry buns.",
      "Bake the batches and move them to the cooling rack.",
      "Arrange the finished breakfast in its picture baskets."
    ],
    "olderGoals": [
      "Pour flour and liquid to their picture lines.",
      "Stir until the ingredients combine into dough.",
      "Shape a tray of round buns.",
      "Mix and shape the curled-bun batch.",
      "Prepare the berry-bun dough.",
      "Press the berry centres and add their filling.",
      "Manage the oven heat and remove the finished batches.",
      "Arrange the cooled buns in the correct picture baskets."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "An empty breakfast tray",
        "narration": [
          "The bakery windows are glowing, but the breakfast trays are empty.",
          "Baker Badger has bowls, flour, moonberries and a recipe made of pictures.",
          "The neighbours will be hungry after their morning walk.",
          "Let's make their breakfast.",
          "Tip the flour into the bowl until it reaches the picture line.",
          "Add the next ingredient, then stir.",
          "Watch the separate ingredients become one soft, speckled ball of dough."
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "Three lovely shapes",
        "narration": [
          "The first dough is ready for round buns.",
          "Press each piece into its little shape and place it on the tray.",
          "Another batch needs a gentle curl.",
          "A third needs a flat middle for its berries.",
          "Echo can steady a wobbly pour and make the oven's warm spot easier to find.",
          "Badger dusts the counter while you prepare the remaining dough.",
          "The three trays are beginning to look delicious."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "Warm from the oven",
        "narration": [
          "Slide a tray into the oven and turn the heat towards the warm golden picture.",
          "The pale buns begin to rise.",
          "Watch their colour and bring them out when they look ready.",
          "Each finished batch needs a place on the cooling rack.",
          "Then arrange the round buns, berry buns and little curls in their picture baskets.",
          "Badger sets clean plates beside the counter."
        ]
      }
    ],
    "ending": [
      "The bakery door opens.",
      "Warm bread smells drift into the street.",
      "The neighbours choose their breakfast, and Badger puts one lovely bun in the window.",
      "You turned bowls of ingredients into a bakery full of breakfast."
    ],
    "done": {
      "title": "Breakfast is ready!",
      "sub": "You mixed, shaped and baked the bakery's morning buns."
    },
    "art": "/assets/crafted/daily/day06-moonberry-bakery-v1.webp",
    "endingArt": "/assets/crafted/daily/day06-bakery-ending-v1.webp",
    "ready": false
  },
  {
    "day": 7,
    "key": "bridge",
    "title": "Tortoise's New Front Door",
    "description": "Use a crane to finish a footbridge and help Tortoise move into his new house.",
    "mechanic": "crane-construction",
    "speechHelp": "Echo steadies the crane's hanging load and temporarily enlarges the landing tolerance. The child must position, rotate and lower each piece onto real supports.",
    "youngerGoals": [
      "Lift the first bridge support into place.",
      "Place the other support and a broad deck piece.",
      "Fit the middle planks onto their supports.",
      "Close the last gap and roll the test cart across.",
      "Guide Tortoise's moving cart to his new front door."
    ],
    "olderGoals": [
      "Position the first bank support with the crane.",
      "Rotate and lower the second support.",
      "Fit the first deck piece across both supports.",
      "Hoist the middle support into its resting place.",
      "Rotate and lower the second deck piece.",
      "Fit the remaining approach planks.",
      "Close the final gap and send the test cart across.",
      "Move Tortoise's loaded cart across the bridge to his door."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "A house across the stream",
        "narration": [
          "Tortoise has a new house with a round green door.",
          "His chair, books and favourite blanket are packed in a little moving cart.",
          "But the footbridge is being rebuilt.",
          "Its pieces are waiting beside the stream.",
          "Tortoise needs a finished way across.",
          "Move the crane above a broad support and lower the hook.",
          "Lift the piece towards its matching place beside the water."
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "A proper walking deck",
        "narration": [
          "Now the bridge needs the rest of its supports and a proper walking deck.",
          "Choose a plank and lift it.",
          "Turn it until it reaches both sides of its resting place.",
          "Echo can steady the hanging pieces, making them easier to lower.",
          "As each part fits, more of the bridge appears.",
          "Tortoise brings his cart closer.",
          "His blanket is tucked in, and his books are tied with a ribbon."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "The first crossing",
        "narration": [
          "One space remains in the deck.",
          "Find the piece that reaches across it and lower it onto the waiting supports.",
          "Now try the little test cart.",
          "Watch its wheels roll over the joins.",
          "When the whole deck is ready, help Tortoise guide his moving cart across.",
          "The chair, books and soft blanket all need to reach the path outside the green door."
        ]
      }
    ],
    "ending": [
      "Tortoise settles into his chair beside the window.",
      "His books are on the shelf and his blanket is on the bed.",
      "He opens his new front door wide.",
      "Your bridge helped his house become home."
    ],
    "done": {
      "title": "Welcome home, Tortoise!",
      "sub": "You built the bridge and brought his moving cart across."
    },
    "art": "/assets/crafted/daily/day07-tortoise-bridge-v1.webp",
    "endingArt": "/assets/crafted/daily/day07-bridge-ending-v1.webp",
    "ready": false
  },
  {
    "day": 8,
    "key": "lantern",
    "title": "The Glowworm Lantern Walk",
    "description": "Connect working circuits to light a woodland path and its gathering lantern.",
    "mechanic": "circuit-building",
    "speechHelp": "Echo sends a travelling light pulse through connected wires and briefly highlights reachable sockets. The child still chooses connections and closes switches.",
    "youngerGoals": [
      "Connect the first mushroom lamp to the power box.",
      "Build a working circuit for the near stepping stones.",
      "Light the far stepping stones with their own circuit.",
      "Connect the small lamps around the gathering circle.",
      "Complete the circuit that powers the great lantern."
    ],
    "olderGoals": [
      "Connect the first lamp's wire to the power source.",
      "Close its switch and complete a working circuit.",
      "Build the first stepping-stone circuit.",
      "Extend power to a second branch of lamps.",
      "Choose a shared-switch route for the next lamps.",
      "Complete the final stepping-stone circuit.",
      "Connect the gathering lamps without breaking their shared path.",
      "Complete and switch on the great lantern's circuit."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "Help the light find its way",
        "narration": [
          "Every evening, Glowworm leads a little walk through the mushroom woods.",
          "Tonight the lanterns are polished and ready.",
          "Their power cords lie in a muddle beside the path.",
          "Let's help the light find its way.",
          "Start with the nearest mushroom lamp.",
          "Join its cord to the glowing power box, then close the little switch.",
          "Watch for a warm circle of light beneath the mushroom."
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "Little round moons",
        "narration": [
          "The next lamps stand beside the stepping stones.",
          "Some share a switch, and some need a path of their own.",
          "Follow each cord with your finger and choose where it should join.",
          "Echo can send a bright pulse along the connected cords.",
          "Watch where it reaches.",
          "That moving light can help you choose the next connection.",
          "As you join the circuits, the stepping stones shine like little round moons."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "The gathering lantern",
        "narration": [
          "At the end of the walk stands the tallest lantern in the woods.",
          "Its light needs a path through the small gathering lamps first.",
          "Connect the waiting pieces and try their switches.",
          "See which lamps glow together and which still need a cord.",
          "When the last connection is ready, close the final switch.",
          "The great lantern can now fill the circle of seats with golden light."
        ]
      }
    ],
    "ending": [
      "Glowworm's neighbours follow the finished lantern path.",
      "They settle beneath the golden lantern to listen to the crickets.",
      "You connected every light that helped them find this lovely place together."
    ],
    "done": {
      "title": "The lantern walk is glowing!",
      "sub": "You connected the path lights and the great gathering lantern."
    },
    "art": "/assets/crafted/daily/day08-glowworm-lanterns-v1.webp",
    "endingArt": "/assets/crafted/daily/day08-lantern-ending-v1.webp",
    "ready": false
  },
  {
    "day": 9,
    "key": "trainline",
    "title": "All Aboard for Snowdrop Valley",
    "description": "Build railway routes and guide animal passengers to their valley stops.",
    "mechanic": "train-routing-and-dispatch",
    "speechHelp": "Echo temporarily slows the train and widens rail joins, helping with building, switches and platform stops. Only physically completed routes and actual passenger arrivals satisfy goals.",
    "youngerGoals": [
      "Build the track from the station to the first fork.",
      "Take Squirrel to the sledding-hill platform.",
      "Deliver Badger and the duck family to their picture stops.",
      "Connect the remaining track into a complete loop.",
      "Take the train crew around the loop and back to the station."
    ],
    "olderGoals": [
      "Lay the first straight and curved track pieces.",
      "Connect the main station to the first fork.",
      "Set the hill route and deliver Squirrel with the red sled.",
      "Build the branch towards the woodland cottages.",
      "Stop at the cottage platform so Badger can leave.",
      "Connect the pond branch and deliver the duck family.",
      "Join the remaining rails into a complete valley loop.",
      "Guide the crew's train around every stop and home to the station."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "The first valley train",
        "narration": [
          "Snowdrop Valley has three new train stops.",
          "Today is their first day.",
          "The train is ready, and so are its passengers.",
          "The track pieces are still waiting on the little builders' cart.",
          "Stationmaster Hare shows you the first destination: Squirrel's sledding hill.",
          "Join the rails from the station towards the first fork.",
          "The curved pieces will help the train follow the snowy hillside."
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "A stop for every neighbour",
        "narration": [
          "Set the switch towards the hill and guide Squirrel to the platform with the sled picture.",
          "Badger needs the woodland cottages.",
          "The duck family wants the pond stop.",
          "Build the next routes and turn the switches towards their picture signs.",
          "Echo can slow the train while you choose its next turn.",
          "Bring each carriage alongside the waiting platform.",
          "Then the right passengers can climb down and begin their day."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "A ride for the crew",
        "narration": [
          "The little train crew has watched everyone else travel.",
          "They would like a ride around the valley too.",
          "Connect the remaining rails into one complete loop.",
          "The train will pass the hill, cottages and pond before coming home.",
          "Set the final switch and welcome the crew aboard.",
          "Guide them through all three places you connected.",
          "The station bell is waiting for their return."
        ]
      }
    ],
    "ending": [
      "Sleds slide, cottage doors open, and ducks waddle towards the pond.",
      "The train returns with a carriage full of waving passengers.",
      "Every journey has somewhere to go because you built the way."
    ],
    "done": {
      "title": "Everyone reached their stop!",
      "sub": "You connected the valley and brought the crew's train home."
    },
    "art": "/assets/crafted/daily/day09-snowdrop-train-v1.webp",
    "endingArt": "/assets/crafted/daily/day09-trainline-ending-v1.webp",
    "ready": false
  },
  {
    "day": 10,
    "key": "kite",
    "title": "The Hilltop Patchwork Kite",
    "description": "Patch, stitch and balance a giant kite made from the neighbours' painted cloth squares.",
    "mechanic": "threading-tracing-and-balancing",
    "speechHelp": "Echo temporarily steadies the cloth, widens the stitching path and calms flight gusts. The child must place patches, stitch, thread, balance the tail and steer.",
    "youngerGoals": [
      "Place the cloth patches in the open sail spaces.",
      "Guide the thread along the first broad seam.",
      "Finish the remaining seams and thread the ribbon eyelets.",
      "Adjust the kite's tail after its test flight.",
      "Guide the balanced kite into the hilltop breeze."
    ],
    "olderGoals": [
      "Choose and place the first painted patch.",
      "Fit the remaining patches into the sail.",
      "Trace the first curved seam.",
      "Sew the second seam around the cloth corner.",
      "Complete the last seam without leaving an open edge.",
      "Thread the ribbons through their eyelets.",
      "Test the kite and redistribute its tail pieces.",
      "Launch and guide the balanced kite into steady flight."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "A flying picture",
        "narration": [
          "On the hill lies an enormous kite covered in tiny painted pictures.",
          "Everyone added a square.",
          "There is a flower, a boat, a spotted beetle and a bright blue moon.",
          "But the last cloth patches have not been sewn.",
          "The long tail is still in a basket.",
          "Goat would love to see this flying picture finished.",
          "Choose a patch that fits an open space and smooth it onto the sail."
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "Stitches and ribbons",
        "narration": [
          "Now the patches need seams to hold them together.",
          "Put the needle at the first picture dot.",
          "Guide the thread along the painted seam.",
          "Follow its bends until the loose edges meet.",
          "Echo can hold the fluttering cloth still and make the stitching path easier to follow.",
          "Finish the other seams.",
          "Then thread the bright ribbons through the round eyelets along the kite's lower edge."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "Find the balance",
        "narration": [
          "Goat lifts the kite for a small test.",
          "One side dips towards the grass.",
          "The tail needs arranging.",
          "Move a ribbon or a tail weight and try again.",
          "Watch which way the kite leans.",
          "When its tail hangs evenly, guide the finished kite up into the breeze.",
          "The great patchwork sail can carry all those tiny pictures together above the hill."
        ]
      }
    ],
    "ending": [
      "Goat holds the spool while everyone points to the pictures they painted.",
      "The kite moves gently across the blue sky.",
      "Your patches, stitches and careful balancing helped every little picture fly together."
    ],
    "done": {
      "title": "The patchwork kite is flying!",
      "sub": "You stitched its sail and balanced its bright ribbon tail."
    },
    "art": "/assets/crafted/daily/day10-patchwork-kite-v1.webp",
    "endingArt": "/assets/crafted/daily/day10-kite-ending-v1.webp",
    "ready": false
  },
  {
    "day": 11,
    "key": "nestlift",
    "title": "The Sandstone Nest Lift",
    "description": "Balance a basket lift to deliver blankets and soft toys to a high nest village.",
    "mechanic": "balance-and-counterweights",
    "speechHelp": "Echo temporarily damps the balance beam's sway and shows a pale landing preview. The child must choose and position counterweights to raise each real load.",
    "youngerGoals": [
      "Load, balance, lift and hand the first blanket into its nest.",
      "Deliver the rabbit toy to the second nest.",
      "Deliver the bear, snake and heavier blankets, choosing new counterweights for each load.",
      "Balance the enormous quilt and stop its basket at the highest landing.",
      "Slide the quilt basket into the upper nest."
    ],
    "olderGoals": [
      "Load the first blanket bundle and choose balancing stones.",
      "Raise, stop and hand the blanket into the first nest.",
      "Lift the small rabbit's bundle to its nest.",
      "Adjust the weights for the heavier bear bundle.",
      "Move the long snake bundle to its landing.",
      "Deliver the remaining blankets with a new weight arrangement.",
      "Balance the enormous quilt and manually stop at the highest platform.",
      "Bring the quilt basket into the upper nest doorway."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "Bundles below the nests",
        "narration": [
          "High in the sandstone village, the new nests have shelves, windows and little round beds.",
          "Their blankets and soft toys are waiting at the bottom of the winding stairs.",
          "The bundles are too wide for the steps.",
          "But there is a basket lift.",
          "Swallow shows you its long balance beam.",
          "Put a blanket bundle in one basket.",
          "Add stones to the other side and watch the beam move."
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "A soft delivery",
        "narration": [
          "Swallow tucks the first blanket into its little nest bed.",
          "Next come the soft toys.",
          "There is a small rabbit, a round bear and a very long stuffed snake.",
          "Their bundles weigh different amounts.",
          "Choose the stones, then turn the winch until the basket reaches its landing.",
          "Echo can calm the beam's wobble.",
          "He can also show a pale picture of where the loaded basket is heading."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "The highest quilt",
        "narration": [
          "The highest nest is waiting for one enormous quilt.",
          "Set it in the lift basket and look at the balance beam.",
          "This load needs a different arrangement.",
          "Choose the stones, turn the winch, and watch the quilt rise.",
          "When the basket reaches the top landing, help slide it through the round doorway.",
          "There is a wide nest bed inside, ready for its new quilt."
        ]
      }
    ],
    "ending": [
      "Soft toys peek from windows all over the village.",
      "Blankets curl around little beds, and the great quilt fits perfectly upstairs.",
      "You made every nest a softer place to rest."
    ],
    "done": {
      "title": "Every nest is cosy!",
      "sub": "You balanced the lift and delivered the blankets and soft toys."
    },
    "art": "/assets/crafted/daily/day11-sandstone-nestlift-v1.webp",
    "endingArt": "/assets/crafted/daily/day11-nestlift-ending-v1.webp",
    "ready": false
  },
  {
    "day": 12,
    "key": "concert",
    "title": "The Lily-Pad Concert",
    "description": "Explore pond instruments, practise short musical patterns and conduct a shared concert.",
    "mechanic": "musical-timing-and-arrangement",
    "speechHelp": "Echo temporarily slows musical cues, widens timing windows, softens reed pulls and broadens seating catches. Every note, placement and conducting entry still needs the child's action.",
    "youngerGoals": [
      "Try the drum, reed harp and chimes.",
      "Answer Frog's three-note and four-note drum phrases.",
      "Play Newt's four-note reed answer and Duck's three-note chime answer.",
      "Arrange the musicians and choose the opening instrument.",
      "Choose an ending, raise the baton, conduct nine player cues and play the final phrase."
    ],
    "olderGoals": [
      "Explore the drum and all three reed pitches.",
      "Try the chimes and discover their higher and lower notes.",
      "Answer Frog's three-note drum phrase.",
      "Play the drum's five-note reply.",
      "Follow Newt's five-note rising and falling reed phrase.",
      "Answer with Duck's four-note chime phrase.",
      "Place the musicians and choose their opening and ending.",
      "Raise the baton, conduct twelve player cues and play the chosen four-note ending."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "Three lovely sounds",
        "narration": [
          "Three pond musicians are getting ready for a concert.",
          "Frog has a drum, Newt has a reed harp, and Duck has bright little chimes.",
          "They each know a lovely part.",
          "But nobody is sure when to begin.",
          "Frog needs a conductor to help everyone play together.",
          "Try the instruments first.",
          "Tap the drum, pluck the reeds and touch the chimes.",
          "Each makes a different sound across the water."
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "Listen and answer",
        "narration": [
          "Frog plays a short pattern.",
          "Watch the bouncing picture dots, listen, and answer on the drum.",
          "Now Newt has a turn.",
          "Her notes rise and fall like tiny steps.",
          "Follow them on the reeds, then try Duck's chiming reply.",
          "Echo can slow the next phrase and give each note a little more room.",
          "Listen for the spaces between the sounds.",
          "Those quiet spaces help the musicians take their turns."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "One song together",
        "narration": [
          "The separate parts are ready to become one little concert.",
          "Place the musicians around the broad lily pad so you can see their instruments.",
          "Choose which sound will begin.",
          "Choose a soft chime finish or one cheerful drum roll.",
          "Raise your conductor's hand when you are ready.",
          "Follow the moving cue as the drum, reeds and chimes take their turns.",
          "Then play your chosen ending and let the last sound float across the pond."
        ]
      }
    ],
    "ending": [
      "The last sound ripples across the pond.",
      "The musicians look at one another and grin.",
      "Their neighbours pat the water with happy little splashes.",
      "You helped three separate players make one song together."
    ],
    "done": {
      "title": "What a lovely concert!",
      "sub": "You played the patterns and helped the musicians perform together."
    },
    "art": "/assets/crafted/daily/day12-lily-pad-concert-v1.webp",
    "endingArt": "/assets/crafted/daily/day12-concert-ending-v1.webp",
    "ready": false
  },
  {
    "day": 13,
    "key": "rooftops",
    "title": "Seeds Across the Rooftops",
    "description": "Aim a seed springboard to fill rooftop planters and grow a flowering arch.",
    "mechanic": "aiming-and-launching",
    "speechHelp": "Echo shows the next flight arc and temporarily calms the wind. The child still sets angle and strength and lands the seed pod in real soil; misses return to the tray.",
    "youngerGoals": [
      "Launch a seed pod into the nearest planter.",
      "Fill the low planter, then bounce a pod from the awning into its sheltered neighbour.",
      "Fill the tall, far and high rooftop planters.",
      "Land the first two climbing pods in the arch planter.",
      "Land the remaining three climbing pods to finish the flowering arch."
    ],
    "olderGoals": [
      "Set the springboard and land a seed in the nearest planter.",
      "Adjust launch strength to fill the next low planter.",
      "Aim above the first tall roof and fill its planter.",
      "Reach the far planter with a longer arc.",
      "Adjust for the rooftop breeze at the narrow planter.",
      "Use the awning's bounce to reach the sheltered planter.",
      "Aim the first two climbing pods into the arch planter.",
      "Land the remaining three climbing pods to complete the flowering arch."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "Seeds below the roofs",
        "narration": [
          "The rooftop planters are full of fresh soil.",
          "Every seed pod is still down in Gardener Bird's cart.",
          "The roofs are joined by narrow stairs, and the cart cannot climb them.",
          "Beside the cart stands a springboard made for seed pods.",
          "Bird needs help sending them up.",
          "Place a pod in its little cup.",
          "Pull the springboard back and point it towards the nearest planter."
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "A curved green journey",
        "narration": [
          "When a pod lands in the soil, Bird gives it a drink.",
          "Then two small leaves unfold.",
          "The next planters stand farther away and higher up.",
          "Change the springboard's angle and how far you pull it back.",
          "Watch each pod's curved journey.",
          "One planter hides beneath an awning.",
          "Bounce its pod from the striped fabric into the soil.",
          "Echo can show the next flight path and calm the rooftop breeze.",
          "Any pod that misses rolls down the return chute.",
          "It is ready for another launch."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "The flowering arch",
        "narration": [
          "Small green plants now line the roofs.",
          "One tall planter remains beside the old rooftop arch.",
          "It needs the climbing seed pods with curled green markings.",
          "Aim towards its wide bowl and send them into the soil.",
          "Bird waters each one as it lands.",
          "New stems climb the arch, reaching from one painted rooftop to the next.",
          "Flowers open along the green curve as the last seeds settle into their new home."
        ]
      }
    ],
    "ending": [
      "The empty rooftops have become a trail of little gardens.",
      "Bird flies beneath the flowering arch, then lands beside the springboard.",
      "You sent every seed to a place where it could grow."
    ],
    "done": {
      "title": "The rooftops are blooming!",
      "sub": "You landed the seed pods and grew a flowering rooftop arch."
    },
    "art": "/assets/crafted/daily/day13-rooftop-seeds-v1.webp",
    "endingArt": "/assets/crafted/daily/day13-rooftops-ending-v1.webp",
    "ready": false
  },
  {
    "day": 14,
    "key": "observatory",
    "title": "The Moving-Star Observatory",
    "description": "Join working gear trains to move a painted sun, orbiting moon and star carousel.",
    "mechanic": "gear-assembly",
    "speechHelp": "Echo highlights useful meshing edges and temporarily increases the snap tolerance near a valid mesh. The child still chooses, places and connects every gear.",
    "youngerGoals": [
      "Fit two small sun gears, then turn the drive wheel to raise the sun.",
      "Fit the small and medium moon gears, then turn the wheel.",
      "Fit the moon's turning route and spindle, then drive its orbit.",
      "Fit the first star-branch gear, then turn the wheel to test it.",
      "Fit the final star link and drive the sun, moon and stars together."
    ],
    "olderGoals": [
      "Fit the first small sun gear and turn the drive wheel.",
      "Fit the second sun gear, then drive the painted sun upwards.",
      "Fit the first moon gear and test its turning motion.",
      "Span the moon gap with medium and small gears, then test their direction.",
      "Remove the direct gear, fit two small idlers and test the reversed direction.",
      "Fit the moon spindle and drive the moon around its orbit.",
      "Fit and test the medium star-branch gear.",
      "Fit the final star link and manually drive all three sky mechanisms."
    ],
    "acts": [
      {
        "atYounger": 0,
        "atOlder": 0,
        "title": "A still wooden sky",
        "narration": [
          "Owl opens the round doors of the observatory.",
          "Inside is a painted wooden sky with a little sun, a silver moon and a ring of stars.",
          "Usually they turn above the seats.",
          "Tonight the drive wheel is ready, but the wooden sky stays still.",
          "Several gears are still waiting on the workbench.",
          "Owl needs help joining the moving parts.",
          "Fit a gear beside the drive wheel.",
          "Turn the round handle and watch its teeth begin to move."
        ]
      },
      {
        "atYounger": 1,
        "atOlder": 2,
        "title": "A journey for the moon",
        "narration": [
          "The first chain of gears lifts the little sun above a painted hill.",
          "Now the moon needs a path around its round wooden sky.",
          "Choose gears that can reach one another and place them on the waiting axles.",
          "Turn the drive wheel and watch which pieces move together.",
          "Echo can brighten the useful edges and help a nearby gear settle into place.",
          "Keep joining the moving pieces until the moon begins its smooth journey."
        ]
      },
      {
        "atYounger": 3,
        "atOlder": 6,
        "title": "Set the stars turning",
        "narration": [
          "One great circle of stars remains still.",
          "Its gears must share the turning motion with the sun and moon.",
          "Follow the movement from the drive wheel and build the final connection.",
          "Turn the drive wheel after fitting the last gear.",
          "The star circle begins to travel with the sun and moon.",
          "Painted pictures appear between its stars: a boat, a bridge, a flower and a patchwork kite.",
          "Owl opens the round ceiling shutters."
        ]
      }
    ],
    "ending": [
      "The wooden sky turns beneath the real one.",
      "Sun, moon, stars and little journey pictures move together above the seats.",
      "Owl settles beside you.",
      "Your careful work joined every moving part."
    ],
    "done": {
      "title": "The little sky is moving!",
      "sub": "You connected the sun, moon and moving-star carousel."
    },
    "art": "/assets/crafted/daily/day14-moving-star-observatory-v1.webp",
    "endingArt": "/assets/crafted/daily/day14-observatory-ending-v1.webp",
    "ready": false
  }
];
