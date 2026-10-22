/* Each Days 4-14 game's own words around Codex's physical controller (keyed
   by the controller's key in window.DailyAdventureGames): its title, the start
   card, the help pill, the banner, the canvas's spoken description and its
   end card. ONE copy, read by the page families get (story-game.html) and by
   the test host the games were verified on (tests/_daily-adventure.mjs), so
   a game never says one thing in its suite and another on a phone. Every
   line here is Rachel's to read (they tell a child what to do). ES5 data. */
window.DailyAdventurePages = {
  waterwheel:{
    title:'The Waterwheel',sub:'Fix the waterwheel',progressLabel:'0 parts placed',
    canvasLabel:'A waterwheel and garden waiting for water. Say each word two times, connect the wooden troughs, and open the water gate.',
    banner:"Let's fix the waterwheel!",helpText:'Wider leaves',helpLabel:'Optional extra help: say your word two times again for wider leaf joins',
    startCopy:'Say each word two times. Connect the wooden troughs and open the gate to bring water to the garden.',helpCopy:'Stuck? Say your word again for wider leaf joins.',
    primerCopy:'Say each word two times to get the water route ready.',pauseCopy:'Your wheel is waiting right here.',
    intro:'Say each word two times to get the water route ready. Connect the troughs and open the water gate.',
    done:{title:'The waterwheel turns!',sub:'You fixed the wheel and sent the water flowing.'}
  },
  postboat:{
    title:'The Little Island Postboat',sub:'Deliver the island post',progressLabel:'0 deliveries made',
    canvasLabel:'A postboat among island docks and reed channels. Say each word two times, steer to the right dock, and move the waiting cargo.',
    banner:"The island post is waiting!",helpText:'Calm water',helpLabel:'Optional extra help: say your word two times again for calmer current and less towline swing',
    startCopy:'Say each word two times. Steer the postboat, pull up beside the right dock, and carry each parcel home.',helpCopy:'Stuck? Say your word again for calmer current and a steadier towline.',
    primerCopy:'Say each word two times to get the postboat ready.',pauseCopy:'Your postboat is waiting right here.',
    intro:'Say each word two times to get the postboat ready. Steer beside the right dock and move the parcel.',
    done:{title:'Every parcel is home!',sub:"You delivered the island post and towed Beaver's new door."}
  },
  bakery:{
    title:'Breakfast at the Moonberry Bakery',sub:'Mix, shape and bake breakfast',progressLabel:'0 bakery jobs finished',
    canvasLabel:'A bakery counter with bowls, dough, trays, an oven and picture baskets. Say each word two times, then pour, stir, shape and bake.',
    banner:'The breakfast trays are empty.',helpText:'Steady tools',helpLabel:'Optional extra help: say your word two times again for steadier pouring and a wider useful oven heat band',
    startCopy:'Say each word two times. Pour and stir the dough, shape the buns, and bake breakfast.',helpCopy:'Stuck? Say your word again for steadier pouring and easier oven heat.',
    primerCopy:'Say each word two times to get the next bakery job ready.',pauseCopy:'Your breakfast is waiting right here.',
    intro:'Say each word two times to get the next bakery job ready. Use the pictures to pour, mix, shape and bake.',
    done:{title:'Breakfast is ready!',sub:"You mixed, shaped and baked the bakery's morning buns."}
  },
  bridge:{
    title:"Tortoise's New Front Door",sub:'Build the bridge and move home',progressLabel:'0 bridge jobs finished',
    canvasLabel:"A crane, bridge pieces, a stream and Tortoise's moving cart. Say each word two times, then lift, rotate and lower the pieces onto their supports.",
    banner:'A new house waits across the stream.',helpText:'Steady load',helpLabel:'Optional extra help: say your word two times again for a steadier hanging load and a wider landing area',
    startCopy:'Say each word two times. Use the crane to build the bridge, then guide the moving cart across.',helpCopy:'Stuck? Say your word again for a steadier load and an easier landing.',
    primerCopy:'Say each word two times to get the next bridge job ready.',pauseCopy:'Your bridge is waiting right here.',
    intro:'Say each word two times to get the next bridge job ready. Lift, turn and lower the pieces onto their supports.',
    done:{title:'Welcome home, Tortoise!',sub:'You built the bridge and brought his moving cart across.'}
  },
  lantern:{
    title:'The Glowworm Lantern Walk',sub:'Connect the woodland lights',progressLabel:'0 lamps lit',
    canvasLabel:'A woodland path with mushroom lamps, loose cords, sockets and switches. Say each word two times, join the cords and close the switches to carry power to the lamps.',
    banner:'The woodland lamps are waiting.',helpText:'Light pulse',helpLabel:'Optional extra help: say your word two times again to follow a light pulse along connected cords and reveal reachable sockets',
    startCopy:'Say each word two times. Connect the waiting cords and close the switches to light the woodland path.',helpCopy:'Stuck? Say your word again to follow a light pulse through your connected cords.',
    primerCopy:'Say each word two times to get the next lantern job ready.',pauseCopy:'Your lantern path is waiting right here.',
    intro:'Say each word two times. Join the waiting cords, then close the switches to light the path.',
    done:{title:'The lantern walk is glowing!',sub:'You connected the path lights and the great gathering lantern.'}
  },
  trainline:{
    title:'All Aboard for Snowdrop Valley',sub:'Build the valley railway',progressLabel:'0 railway jobs finished',
    canvasLabel:'A valley railway with loose track, switches, passenger pictures and platforms. Say each word two times, join the rails, route the train and stop at the right platform.',
    banner:'The valley train is waiting.',helpText:'Slow train',helpLabel:'Optional extra help: say your word two times again to slow the moving train while you set switches and line up with platforms',
    startCopy:'Say each word two times. Join the rails, set the switches and bring each passenger to their pictured stop.',helpCopy:'Stuck? Say your word again for a slower train and more time at the platforms.',
    primerCopy:'Say each word two times to get the next railway job ready.',pauseCopy:'Your railway is waiting right here.',
    intro:'Say each word two times. Join the rails, set the switches, and stop beside the passenger pictures.',
    done:{title:'Everyone reached their stop!',sub:"You connected the valley and brought the crew's train home."}
  },
  kite:{
    title:'The Hilltop Patchwork Kite',sub:'Stitch and balance the kite',progressLabel:'0 kite jobs finished',
    canvasLabel:'A patchwork kite with loose cloth, painted seam paths, ribbon eyelets and a balancing tail. Say each word two times, then fit, stitch, thread and balance the real kite.',
    banner:'The hilltop kite is waiting.',helpText:'Steady cloth',helpLabel:'Optional extra help: say your word two times again to steady the fluttering cloth and widen the stitching path',
    startCopy:'Say each word two times. Fit the cloth patches, stitch the seams, thread the ribbons and balance the tail.',helpCopy:'Stuck? Say your word again for steadier cloth and an easier stitching path.',
    primerCopy:'Say each word two times to get the next kite job ready.',pauseCopy:'Your kite is waiting right here.',
    intro:'Say each word two times. Fit patches, follow the stitches, thread the ribbons, and balance the kite tail.',
    done:{title:'The patchwork kite is flying!',sub:'You stitched its sail and balanced its bright ribbon tail.'}
  },
  nestlift:{
    title:'The Sandstone Nest Lift',sub:'Balance and deliver the nest bundles',progressLabel:'0 lift jobs finished',
    canvasLabel:'A sandstone nest village with a basket lift, real blanket and toy loads and movable counterweights. Say each word two times, balance each load and guide it into its matching nest.',
    banner:'The nest bundles are waiting.',helpText:'Steady lift',helpLabel:'Optional extra help: say your word two times again to damp the balance beam sway and see the real basket landing preview',
    startCopy:'Say each word two times. Load the lift, move the counterweights and bring each bundle to its nest.',helpCopy:'Stuck? Say your word again for steadier balance and a landing preview.',
    primerCopy:'Say each word two times to get the next lift job ready.',pauseCopy:'Your nest lift is waiting right here.',
    intro:'Say each word two times. Load the basket, move the counterweights, and guide each bundle into its nest.',
    done:{title:'Every nest is cosy!',sub:'You balanced the lift and delivered the blankets and soft toys.'}
  },
  concert:{
    title:'The Lily-Pad Concert',sub:'Play and conduct the pond concert',progressLabel:'0 concert jobs finished',
    canvasLabel:'Pond musicians with a drum, reed harp and chimes. Say each word two times, play their real musical patterns, then arrange and conduct the shared concert.',
    banner:'The pond musicians are waiting.',helpText:'Slower phrase',helpLabel:'Optional extra help: say your word two times again for a slower musical cue and a wider timing window',
    startCopy:'Say each word two times. Try the instruments, answer their patterns and conduct the concert.',helpCopy:'Stuck? Say your word again for slower cues and more room for each note.',
    primerCopy:'Say each word two times to get the next concert job ready.',pauseCopy:'Your concert is waiting right here.',
    intro:'Say each word two times. Try the instruments, play their patterns, and guide the pond concert.',
    done:{title:'What a lovely concert!',sub:'You played the patterns and helped the musicians perform together.'}
  },
  rooftops:{
    title:'Seeds Across the Rooftops',sub:'Aim seeds into rooftop gardens',progressLabel:'0 rooftop jobs finished',
    canvasLabel:'A seed springboard below rooftop planters, a bouncing awning and a flowering arch. Say each word two times, aim and pull the springboard, then land the seed pods in real soil.',
    banner:'The rooftop soil is waiting.',helpText:'Calm breeze',helpLabel:'Optional extra help: say your word two times again to calm the rooftop wind and preview the next real seed flight',
    startCopy:'Say each word two times. Aim the springboard and choose its pull to send seed pods into the rooftop planters.',helpCopy:'Stuck? Say your word again for a calmer breeze and a preview of the next flight.',
    primerCopy:'Say each word two times to get the next rooftop job ready.',pauseCopy:'Your rooftop gardens are waiting right here.',
    intro:'Say each word two times. Aim and pull the springboard to send seeds into rooftop soil.',
    done:{title:'The rooftops are blooming!',sub:'You landed the seed pods and grew a flowering rooftop arch.'}
  },
  observatory:{
    title:'The Moving-Star Observatory',sub:'Join the wooden sky gears',progressLabel:'0 observatory jobs finished',
    canvasLabel:'A wooden observatory with loose gears, a drive wheel, sun lift, moon orbit and star carousel. Say each word two times, then choose gears and join real meshing teeth.',
    banner:'The little wooden sky is still.',helpText:'Bright teeth',helpLabel:'Optional extra help: say your word two times again to highlight useful meshing edges and widen the catch near a valid gear connection',
    startCopy:'Say each word two times. Choose and place gears to connect the sun, moon and moving stars.',helpCopy:'Stuck? Say your word again for brighter meshing edges and an easier nearby gear catch.',
    primerCopy:'Say each word two times to get the next observatory job ready.',pauseCopy:'Your wooden sky is waiting right here.',
    intro:'Say each word two times. Choose and place gears to move the sun, moon, and stars.',
    done:{title:'The little sky is moving!',sub:'You connected the sun, moon and moving-star carousel.'}
  }
};
