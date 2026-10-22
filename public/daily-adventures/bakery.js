/* Day 6: caught ingredients, circular mixing, three real dough gestures,
   controlled baking and a child's basket arrangement. SayPlay owns speech. */
(function () {
  "use strict";
  var api, cv, ctx, layer, root, helpEl, bannerEl, toolButton, actionButton, levelButton, trayButton, heatInput, statusEl, caption, batchButtons = [], bunButtons = [], listeners = [], art = {};
  var W = 390, H = 844, work = { top: 150, height: 560 }, bowl = {}, board = {}, tray = {}, oven = {}, rack = {}, baskets = [], tool = { x: 0, y: 0 }, toolW = 80, toolH = 65;
  var count = 5, younger = true, active = false, paused = false, away = false, destroyed = false, initialized = false, won = false, reduceMotion = false;
  var stage = -1, taskIndex = 0, selectedBatch = 0, goals = [], batches = [], completed = [], gesture = null, particles = [], splashes = [], power = 0;
  var clock = 0, raf = 0, last = 0, doneAt = 0, emission = 0, misses = 0, effort = 0, gainAt = 0, manualDistance = 0, caught = 0, spilled = 0, pourChecks = 0, levelUses = 0, ovenRemovals = 0, sortDrops = 0, said = {};
  var setHeat = 0.15, actualHeat = 0.15, heatTouched = false, heatTouches = 0, ovenBatch = -1;
  var KEYS = ["round", "curl", "berry"], NAMES = ["round buns", "curled buns", "berry buns"], POWER = 12, TAU = Math.PI * 2;
  function $(id) { return document.getElementById(id); }
  function clamp(n, low, high) { return Math.max(low, Math.min(high, n)); }
  function distance(a, b) { var x = a.x - b.x, y = a.y - b.y; return Math.sqrt(x * x + y * y); }
  function point(x, y) { return { x: x * W, y: work.top + y * work.height }; }
  function normal(p) { return { x: p.x / W, y: p.y / H }; }
  function angle(n) { while (n > Math.PI) n -= TAU; while (n < -Math.PI) n += TAU; return n; }
  function canPlay() { return active && !paused && !away && !won && !destroyed && !document.hidden; }
  function task() { return stage >= 0 && goals[stage] ? goals[stage][taskIndex] : null; }
  function batch() { return batches[selectedBatch]; }
  function phase() { var t = task(); if (!t) return "waiting"; if (t.type === "pour") return batch().flourChecked ? "pourLiquid" : "pourFlour"; if (t.type === "shape") return "shape" + (selectedBatch === 0 ? "Round" : selectedBatch === 1 ? "Curl" : "Berry"); return t.type; }
  function assistance() { var threshold = younger ? [1, 2] : [2, 3], a = misses >= threshold[1] ? 2 : misses >= threshold[0] ? 1 : 0, seconds = younger ? [2.5, 5] : [4, 8]; return Math.max(a, effort >= seconds[1] ? 2 : effort >= seconds[0] ? 1 : 0); }
  // Keep essential tool directions behind this game's current owned line.
  // Pause retries only the current task; later words never inherit its queue.
  var directionQueue = [], directionBusy = false, directionActive = null, directionGeneration = 0;
  function directionScope() { return stage + ":" + taskIndex + ":" + selectedBatch + ":" + phase(); }
  function clearDirections(retry) {
    var interrupted = directionActive;
    directionGeneration++; directionBusy = false; directionActive = null;
    if (!retry) { directionQueue = []; return; }
    if (interrupted && interrupted.scope === directionScope()) {
      delete said[interrupted.key];
      if (!directionQueue.some(function (item) { return item.key === interrupted.key && item.scope === interrupted.scope; })) directionQueue.unshift(interrupted);
    }
  }
  function flushDirections() {
    if (directionBusy || !canPlay() || !api || !api.instruct) return;
    var scope = directionScope();
    while (directionQueue.length) {
      var item = directionQueue.shift();
      if (item.scope !== scope || said[item.key]) continue;
      var token = directionGeneration, result;
      directionBusy = true; directionActive = item; said[item.key] = true;
      try { result = api.instruct(item.text); } catch (e) { result = Promise.resolve(); }
      function finished() {
        if (token !== directionGeneration) return;
        directionBusy = false; directionActive = null; flushDirections();
      }
      Promise.resolve(result).then(finished, finished);
      return;
    }
  }
  function say(key, text) {
    if (said[key] || !api || !api.instruct) return;
    var scope = directionScope();
    if (!directionQueue.some(function (item) { return item.key === key && item.scope === scope; })) directionQueue.push({key:key, text:text, scope:scope});
    flushDirections();
  }
  function sound(key) { if (api && api.sfx) { try { api.sfx(key); } catch (e) {} } }
  function banner(text) { if (bannerEl) bannerEl.textContent = text; if (statusEl) statusEl.textContent = text; }
  function on(el, name, fn, opts) { el.addEventListener(name, fn, opts || false); listeners.push([el, name, fn, opts || false]); }
  function rect(el) { if (!el) return null; var r = el.getBoundingClientRect(), c = cv.getBoundingClientRect(); return { x: (r.left + r.width / 2 - c.left) / W, y: (r.top + r.height / 2 - c.top) / H, width: r.width / W, height: r.height / H }; }
  function inside(p, box, pad) { pad = pad || 0; return p.x >= box.x - box.w / 2 - pad && p.x <= box.x + box.w / 2 + pad && p.y >= box.y - box.h / 2 - pad && p.y <= box.y + box.h / 2 + pad; }
  function makeGoals() {
    function t(type, b) { return { type: type, batch: b }; }
    goals = younger ? [
      [t("pour",0),t("mix",0)], [t("shape",0)], [t("pour",1),t("mix",1),t("shape",1),t("pour",2),t("mix",2),t("shape",2)], [t("bake",-1)], [t("arrange",-1)]
    ] : [[t("pour",0)],[t("mix",0)],[t("shape",0)],[t("pour",1),t("mix",1),t("shape",1)],[t("pour",2),t("mix",2)],[t("shape",2)],[t("bake",-1)],[t("arrange",-1)]];
  }
  function makeBatches() {
    batches = KEYS.map(function (key, index) {
      var buns = []; for (var n = 0; n < (younger ? 3 : 4); n++) buns.push({ index: n, formed: false, onTray: false, sorted: false, press: [false,false,false,false,false], pressTravel: 0, trace: 0, well: false, filled: false });
      return { key: key, index: index, flour: 0, liquid: 0, flourTarget: 1, liquidTarget: 0.65, flourChecked: false, liquidChecked: false, mix: 0, sweep: 0, quads: [false,false,false,false], buns: buns, trayState: "staging", bake: 0, baked: false, cooled: false };
    });
  }
  function amountBand() { return younger ? 0.12 : 0.075; }
  function ingredient() { return phase() === "pourFlour" ? "flour" : "liquid"; }
  function ingredientTarget() { return ingredient() === "flour" ? batch().flourTarget : batch().liquidTarget; }
  function pourCatch() { return bowl.r * (assistance() >= 2 ? 1.65 : assistance() >= 1 ? 1.18 : 0.84) * (power > 0 ? 1.25 : 1); }
  function pourJitter() { return W * (ingredient() === "flour" ? 0.025 : 0.018) * (power > 0 ? 0.34 : 1); }
  function ringTolerance() { return Math.max(12, bowl.r * (younger ? 0.20 : 0.15)) * (power > 0 ? 1.45 : 1) * (assistance() ? 1.45 : 1); }
  function stampRadius() { return board.bunR * (younger ? 0.45 : 0.34) * (power > 0 ? 1.3 : 1) * (assistance() ? 1.35 : 1); }
  function traceTolerance() { return Math.max(8, board.bunR * (younger ? 0.30 : 0.22)) * (power > 0 ? 1.35 : 1) * (assistance() >= 2 ? 2.1 : assistance() ? 1.5 : 1); }
  function heatBand() { var half = (younger ? 0.105 : 0.065) + (power > 0 ? 0.08 : 0) + (assistance() >= 2 ? 0.22 : assistance() ? 0.10 : 0); return { low: Math.max(0.10,0.56-half), high: Math.min(0.90,0.56+half) }; }
  function usefulHeat() { var band = heatBand(); return actualHeat >= band.low && actualHeat <= band.high; }
  function activeBun() { var b = batch(); if (!b) return null; for (var i = 0; i < b.buns.length; i++) if (!b.buns[i].onTray) return b.buns[i]; return null; }
  function pressTargets() { return [[0,0],[-0.5,0],[0.5,0],[0,-0.5],[0,0.5]].map(function (p) { return { x: board.x + p[0] * board.bunR, y: board.y + p[1] * board.bunR }; }); }
  function tracePoints() { var out = [], n = younger ? 34 : 44; for (var i = 0; i < n; i++) { var t = i / (n - 1), a = -Math.PI / 2 + t * Math.PI * 3.5, r = board.bunR * (1 - t * 0.75); out.push({ x: board.x + Math.cos(a) * r, y: board.y + Math.sin(a) * r }); } return out; }
  function slot(index) { var b = batch(), n = b ? b.buns.length : 3, col = n === 3 ? index : index % 2, row = n === 3 ? 0 : Math.floor(index / 2); return { x: tray.x + (col - (n === 3 ? 1 : 0.5)) * tray.w * (n === 3 ? 0.29 : 0.37), y: tray.y + (row - (n === 3 ? 0 : 0.5)) * tray.h * 0.40 }; }
  function sourceBun(index) { var n = batch().buns.length; return point((index + 1) / (n + 1), 0.26); }
  function bunPoint(bun) { if (gesture && gesture.kind === "bunDrag" && gesture.bun === bun) return { x: gesture.x, y: gesture.y }; if (phase() === "arrange") return bun.sorted ? basketBunPoint(selectedBatch,bun.index) : sourceBun(bun.index); return bun.onTray ? slot(bun.index) : { x: board.x, y: board.y }; }
  function basketBunPoint(index, n) { var bs = baskets[index]; return { x: bs.x + ((n % 2) - 0.5) * bs.rx * 0.60, y: bs.y - bs.ry * 0.25 - Math.floor(n / 2) * 8 }; }
  function toolHome() { return phase() === "shapeBerry" ? point(0.79,0.18) : phase() === "mix" ? { x: bowl.x + bowl.r * 0.76, y: bowl.y } : point(0.20,0.18); }
  function nozzle() { return { x: tool.x + toolW * 0.35, y: tool.y - toolH * 0.28 }; }
  function taskInstruction() {
    var p = phase(), kind = NAMES[selectedBatch], text;
    if (p === "pourFlour" || p === "pourLiquid") text = "Hold the " + (p === "pourFlour" ? "flour cup" : "jug") + " over the bowl. Pour to the picture line. Let go, then tap the check.";
    else if (p === "mix") text = "Hold the spoon. Stir in circles around the bowl until the dough comes together.";
    else if (p === "shapeRound") text = "Rub the little dough dots. Pick up the round bun and drag it onto the tray.";
    else if (p === "shapeCurl") text = "Follow the curling rope from its glowing tip. Drag the finished bun onto the tray.";
    else if (p === "shapeBerry") text = "Rub a well in the middle. Add berries with the spoon, then drag the bun onto its tray.";
    else if (p === "bake") text = "Drag a tray into the oven. Set heat to gold. When golden, drag it onto the rack.";
    else text = "Match each bun to its picture basket. The little bun pictures choose the next tray.";
    banner(p === "pourFlour" ? "Pour flour to its picture line" : p === "pourLiquid" ? "Pour liquid to its picture line" : p === "mix" ? "Stir in circles" : p === "bake" ? "Warm the trays, then move them to the rack" : p === "arrange" ? "A matching basket for every bun" : "Shape the " + kind + ", then fill their tray");
    say("task-" + taskIndex + "-" + p, text);
  }
  function beginTask() { var t = task(); if (t && t.batch >= 0) selectedBatch = t.batch; else if (t && t.type === "arrange") selectedBatch = 0; else if (t && t.type === "bake") selectedBatch = 0; tool = toolHome(); emission = 0; gainAt = clock; taskInstruction(); hud(); }
  function finishTask() {
    if (!canPlay() || doneAt) return; cancelGesture();
    if (taskIndex < goals[stage].length - 1) { taskIndex++; beginTask(); return; }
    active = false; power = 0; completed.push(stage); doneAt = clock + 0.95; sound("correct"); if (api && api.cheer) { try { api.cheer(phase() === "arrange" ? "Breakfast is ready!" : "Lovely baking!"); } catch (e) {} } banner(phase() === "arrange" ? "Breakfast is ready for the neighbours!" : "A lovely batch, made by you!"); hud();
  }
  function miss(text) { var before = assistance(); misses++; if (text) banner(text); if (assistance() > before) say("gentle-" + assistance(), "Take your time. The glowing picture gives your hands more room."); hud(); }
  function checkIngredient() {
    if (!canPlay() || gesture || (phase() !== "pourFlour" && phase() !== "pourLiquid")) return; var b = batch(), key = ingredient(), goal = ingredientTarget(), amount = b[key], band = amountBand(); pourChecks++;
    if (amount < goal - band) { miss("A little more. Hold the cup above the bowl."); say("more", "A little more. Hold the cup above the bowl until it reaches the picture line."); return; }
    if (amount > goal + band) { miss("Tap the flat spoon to level off the extra."); say("level", "Tap the flat spoon picture to level off the extra. Your dough stays in the bowl."); return; }
    b[key + "Checked"] = true; particles = particles.filter(function (d) { return d.batch !== selectedBatch || d.kind !== key; }); sound("tap");
    if (key === "flour") { tool = toolHome(); taskInstruction(); hud(); } else finishTask();
  }
  function levelOff() { if (!canPlay() || gesture || (phase() !== "pourFlour" && phase() !== "pourLiquid")) return; var key = ingredient(), b = batch(), goal = ingredientTarget(); if (b[key] <= goal + amountBand()) return; b[key] = goal; particles = particles.filter(function (d) { return d.batch !== selectedBatch || d.kind !== key; }); levelUses++; banner("Level with the picture! Tap the check picture."); sound("tap"); hud(); }
  function pointEvent(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  function release(g) { if (!g || g.keyboard) return; try { if (g.surface.hasPointerCapture(g.id)) g.surface.releasePointerCapture(g.id); } catch (e) {} }
  function cancelGesture() { if (!gesture) return; var g = gesture; gesture = null; if (g.kind === "berrySpoon") tool = { x: g.origin.x, y: g.origin.y }; emission = 0; release(g); }
  function capture(e, g) { gesture = g; g.id = e.pointerId; g.surface = e.currentTarget; g.keyboard = false; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} hud(); }
  function downTool(e) {
    if (!canPlay() || gesture || (e.button != null && e.button !== 0)) return; var p = phase(), at = pointEvent(e); if (["pourFlour","pourLiquid","mix","shapeBerry"].indexOf(p) < 0) return;
    if (e.currentTarget === cv && distance(at,tool) > Math.max(40,toolW * 0.6)) return;
    var bun = activeBun(); if (p === "shapeBerry" && (!bun || !bun.well || bun.filled)) return; e.preventDefault();
    capture(e,{ kind: p === "mix" ? "mix" : p === "shapeBerry" ? "berrySpoon" : "pour", from: p, offset: { x: at.x-tool.x,y: at.y-tool.y }, origin: { x: tool.x,y:tool.y }, previous: { x:tool.x,y:tool.y }, previousAngle: null, work: 0 });
  }
  function moveTool(at) {
    var g = gesture, old = { x:tool.x,y:tool.y }, p = phase(); tool.x = clamp(at.x,18,W-18); tool.y = clamp(at.y,work.top+12,p === "pourFlour" || p === "pourLiquid" ? bowl.y - toolH * 0.10 : work.top+work.height-12);
    if (g && g.kind === "mix") mixMove(old,tool); if (g) { g.work += distance(old,tool); manualDistance += distance(old,tool); } hud();
  }
  function mixMove(old,p) {
    var g = gesture, b = batch(), dx = p.x-bowl.x, dy = p.y-bowl.y, r = Math.sqrt(dx*dx+dy*dy), wanted = bowl.r*0.76, valid = assistance() >= 2 ? r>bowl.r*0.15 && r<bowl.r*1.3 : Math.abs(r-wanted)<=ringTolerance();
    if (!valid) { g.previousAngle = null; return; } var a = Math.atan2(dy,dx), q = Math.min(3,Math.floor((a+Math.PI)/(Math.PI/2))); b.quads[q] = true;
    if (g.previousAngle !== null) { var da = angle(a-g.previousAngle); if (Math.abs(da)<0.65 && distance(old,p)>0.3) { b.sweep += Math.abs(da); if (b.quads.every(function (v) { return v; })) { var target = younger ? TAU*1.4 : TAU*1.9; b.mix=clamp(b.sweep/target,0,1); gainAt=clock; } } }
    g.previousAngle=a; if (b.mix>=1) finishTask();
  }
  function downBun(e,index) {
    if (!canPlay() || gesture || (e.button != null && e.button!==0)) return; var p=phase(), b=batch(), bun=b.buns[index], at=pointEvent(e); if (!bun) return;
    if (p==="arrange") { if (bun.sorted) return; e.preventDefault(); var from=sourceBun(index); capture(e,{kind:"bunDrag",bun:bun,index:index,from:"rack",x:from.x,y:from.y,origin:from,start:at,offset:{x:at.x-from.x,y:at.y-from.y},travel:0}); return; }
    if (p.indexOf("shape")!==0 || bun!==activeBun()) return; e.preventDefault();
    if (bun.formed) { var start=bunPoint(bun); capture(e,{kind:"bunDrag",bun:bun,index:index,from:"board",x:start.x,y:start.y,origin:start,start:at,offset:{x:at.x-start.x,y:at.y-start.y},travel:0}); }
    else if (p==="shapeBerry" && bun.well) { banner("Pick up the berry spoon and fill the little well."); say("berry-spoon","Pick up the berry spoon and put its berries in the little well."); }
    else { capture(e,{kind:p==="shapeCurl"?"curl":"press",bun:bun,index:index,point:at,previous:at,work:0}); shapeMove(at); }
  }
  function shapeMove(at) {
    var g=gesture,bun=g&&g.bun;if(!bun)return;var p=phase(),old=g.previous||at,travel=distance(old,at);g.previous=at;g.point=at;g.work+=travel;manualDistance+=travel;
    if(bun.formed||g.kind==="press"&&bun.well)return;
    if(g.kind==="press") {
      if(distance(at,board)>board.bunR*1.35)return;bun.pressTravel+=travel;var targets=pressTargets();targets.forEach(function(q,i){if(distance(q,at)<=stampRadius())bun.press[i]=true;});
      var needed=younger?4:5,hit=bun.press.filter(function(v){return v;}).length;
      if(hit>=needed&&bun.pressTravel>=board.bunR*(p==="shapeBerry"?0.55:0.85)){if(p==="shapeBerry"){bun.well=true;banner("A little well! Fill it with the berry spoon.");}else{bun.formed=true;banner("A round bun! Pick it up and move it to the tray.");}sound("tap");gainAt=clock;}
    } else if(g.kind==="curl") {
      var path=tracePoints(),steps=Math.max(1,Math.ceil(travel/5));for(var n=0;n<=steps;n++){var q={x:old.x+(at.x-old.x)*n/steps,y:old.y+(at.y-old.y)*n/steps};while(bun.trace<path.length&&distance(q,path[bun.trace])<=traceTolerance()){bun.trace++;gainAt=clock;}}
      if(bun.trace>=path.length){bun.formed=true;banner("A lovely curl! Pick it up and move it to the tray.");sound("tap");}
    }
    hud();
  }
  function move(e) {
    if(!gesture||gesture.keyboard||e.pointerId!==gesture.id||!canPlay())return;e.preventDefault();var p=pointEvent(e),g=gesture;
    if(g.kind==="pour"||g.kind==="mix"||g.kind==="berrySpoon")moveTool({x:p.x-g.offset.x,y:p.y-g.offset.y});
    else if(g.kind==="bunDrag"||g.kind==="trayDrag"){g.x=clamp(p.x-g.offset.x,16,W-16);g.y=clamp(p.y-g.offset.y,work.top+8,work.top+work.height-8);g.travel=Math.max(g.travel,distance(p,g.start));manualDistance+=distance(g.previous||p,p);g.previous=p;hud();}
    else shapeMove(p);
  }
  function finishBunDrop(g) {
    if(g.travel<8)return;var b=batch(),bun=g.bun,p={x:g.x,y:g.y};
    if(phase()==="arrange"){
      var target=baskets[selectedBatch],room=assistance()>=2?1.35:assistance()?1.15:1,dx=(p.x-target.x)/(target.rx*room),dy=(p.y-target.y)/(target.ry*room),nearest=0;
      for(var k=1;k<baskets.length;k++)if(Math.abs(p.x-baskets[k].x)<Math.abs(p.x-baskets[nearest].x))nearest=k;
      var valid=nearest===selectedBatch&&dx*dx+dy*dy<=1.4;
      if(valid){bun.sorted=true;sortDrops++;sound("tap");if(b.buns.every(function(x){return x.sorted;})){var next=-1;for(var n=0;n<batches.length;n++)if(batches[n].buns.some(function(x){return !x.sorted;})){next=n;break;}if(next<0)finishTask();else{selectedBatch=next;banner("Choose the matching picture basket for this tray.");}}}
      else miss("Try the basket with this bun's picture.");return;
    }
    var to=slot(bun.index),valid=distance(p,to)<=Math.max(22, W*0.07)||(assistance()>=2&&inside(p,tray,W*0.18));
    if(valid&&bun.formed){bun.onTray=true;sound("tap");if(b.buns.every(function(x){return x.onTray;}))finishTask();else{tool=toolHome();banner("Another little bun is ready to shape.");}}
    else miss("Move the shaped bun to its glowing tray space.");
  }
  function dropBerry() { var bun=activeBun();if(bun&&bun.well&&!bun.filled&&distance(tool,board)<=board.bunR*(assistance()?1.15:0.72)){bun.filled=true;bun.formed=true;sound("tap");banner("Berries in the well! Move the bun to its tray.");}else miss("Put the berry spoon into the little well.");tool=toolHome(); }
  function trayPoint(b) { if(gesture&&gesture.kind==="trayDrag"&&gesture.batch===b.index)return{x:gesture.x,y:gesture.y};return b.trayState==="oven"?{x:oven.x,y:oven.y}:b.trayState==="rack"?{x:rack.x,y:rack.y}:point(0.70,0.73); }
  function downTray(e) { if(!canPlay()||phase()!=="bake"||gesture||(e.button!=null&&e.button!==0))return;var b=batch();if(b.trayState==="rack")return;e.preventDefault();var p=pointEvent(e),from=trayPoint(b);capture(e,{kind:"trayDrag",batch:selectedBatch,from:b.trayState,x:from.x,y:from.y,origin:from,start:p,offset:{x:p.x-from.x,y:p.y-from.y},travel:0}); }
  function dropTray(g) {
    if(g.travel<8)return;var b=batches[g.batch],p={x:g.x,y:g.y};
    if(g.from==="staging"){
      if((ovenBatch<0||ovenBatch===g.batch)&&inside(p,oven,assistance()?30:12)){b.trayState="oven";ovenBatch=g.batch;sound("tap");banner("Turn the heat handle to the golden picture.");}
      else miss(ovenBatch>=0?"Move the first tray to the rack before adding another.":"Slide the tray into the oven opening.");
    }else if(g.from==="oven"){
      if(!b.baked){miss("The buns need a little more golden warmth.");say("early-tray","The buns need a little more golden warmth. Your tray is safe in the oven.");return;}
      if(inside(p,rack,assistance()?35:16)){b.trayState="rack";b.cooled=true;ovenBatch=-1;ovenRemovals++;sound("tap");if(batches.every(function(q){return q.cooled;}))finishTask();else{for(var n=0;n<batches.length;n++)if(!batches[n].cooled){selectedBatch=n;break;}banner("A finished tray! Put the next tray in the oven.");}}
      else miss("Bring the golden buns onto the cooling rack.");
    }
  }
  function up(e) { if(!gesture||gesture.keyboard||e.pointerId!==gesture.id)return;e.preventDefault();var g=gesture;gesture=null;release(g);if(e.type!=="pointerup"||!canPlay()){if(g.kind==="berrySpoon")tool=g.origin;emission=0;hud();return;}if(g.kind==="bunDrag")finishBunDrop(g);else if(g.kind==="berrySpoon")dropBerry();else if(g.kind==="trayDrag")dropTray(g);emission=0;hud();draw(); }
  function toolKey(e) {
    if(!canPlay()||(gesture&&!gesture.keyboard))return;var key=e.key;
    if(key==="Escape"){e.preventDefault();cancelGesture();hud();return;}
    if(key==="Enter"||key===" "){e.preventDefault();if(e.repeat)return;if(gesture){var g=gesture;gesture=null;if(g.kind==="berrySpoon")dropBerry();}else{var p=phase(),bun=activeBun();if(p==="shapeBerry"&&(!bun||!bun.well||bun.filled))return;gesture={kind:p==="mix"?"mix":p==="shapeBerry"?"berrySpoon":"pour",keyboard:true,origin:{x:tool.x,y:tool.y},previousAngle:null,work:0};}hud();return;}
    var step=e.shiftKey?3:12,p={x:tool.x,y:tool.y};if(key==="ArrowLeft")p.x-=step;else if(key==="ArrowRight")p.x+=step;else if(key==="ArrowUp")p.y-=step;else if(key==="ArrowDown")p.y+=step;else return;e.preventDefault();moveTool(p);
  }
  function bunKey(e,index) {
    if(!canPlay()||(gesture&&!gesture.keyboard))return;var b=batch(),bun=b.buns[index],key=e.key;if(!bun)return;
    if(key==="Escape"){e.preventDefault();cancelGesture();hud();return;}
    if(key==="Enter"||key===" "){e.preventDefault();if(e.repeat)return;if(gesture){var old=gesture;gesture=null;if(old.kind==="bunDrag")finishBunDrop(old);}else{var p=bunPoint(bun);if(phase()==="arrange"||bun.formed)gesture={kind:"bunDrag",keyboard:true,bun:bun,index:index,from:phase()==="arrange"?"rack":"board",x:p.x,y:p.y,origin:p,travel:0};else if(!bun.well)gesture={kind:phase()==="shapeCurl"?"curl":"press",keyboard:true,bun:bun,index:index,point:p,previous:p,work:0};}hud();return;}
    if(!gesture||gesture.bun!==bun)return;var g=gesture,at=g.kind==="bunDrag"?{x:g.x,y:g.y}:{x:g.point.x,y:g.point.y},step=e.shiftKey?3:10;if(key==="ArrowLeft")at.x-=step;else if(key==="ArrowRight")at.x+=step;else if(key==="ArrowUp")at.y-=step;else if(key==="ArrowDown")at.y+=step;else return;e.preventDefault();if(g.kind==="bunDrag"){g.x=at.x;g.y=at.y;g.travel+=step;}else shapeMove(at);hud();
  }
  function trayKey(e) { if(!canPlay()||phase()!=="bake"||(gesture&&!gesture.keyboard))return;var key=e.key,b=batch();if(key==="Escape"){e.preventDefault();cancelGesture();hud();return;}if(key==="Enter"||key===" "){e.preventDefault();if(e.repeat)return;if(gesture){var g=gesture;gesture=null;dropTray(g);}else{var p=trayPoint(b);gesture={kind:"trayDrag",keyboard:true,batch:selectedBatch,from:b.trayState,x:p.x,y:p.y,origin:p,travel:0};}hud();return;}if(!gesture||gesture.kind!=="trayDrag")return;var step=e.shiftKey?3:12;if(key==="ArrowLeft")gesture.x-=step;else if(key==="ArrowRight")gesture.x+=step;else if(key==="ArrowUp")gesture.y-=step;else if(key==="ArrowDown")gesture.y+=step;else return;e.preventDefault();gesture.travel+=step;hud(); }
  function makeButton(id,label,className) { var b=document.createElement("button");b.id=id;b.type="button";b.className=className;b.setAttribute("aria-label",label);root.appendChild(b);return b; }
  function iconButton(b,svg,text) { b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+svg+'</svg><span>'+text+'</span>'; }
  function controls() {
    root=document.createElement("div");root.className="bakery-controls";layer.appendChild(root);
    toolButton=makeButton("bakeryTool","Cooking tool. Enter picks up or puts down. Arrow keys move.","bakery-handle bakery-tool");on(toolButton,"pointerdown",downTool);on(toolButton,"keydown",toolKey);
    actionButton=makeButton("bakeryAction","Check the ingredient against its picture line","bakery-action");iconButton(actionButton,'<path d="M4 12l5 5L20 5M4 21h16"/>',"Check line");on(actionButton,"click",checkIngredient);
    levelButton=makeButton("bakeryLevel","Level off extra ingredient with the flat spoon","bakery-level");iconButton(levelButton,'<path d="M2 15h20M5 7c0-4 9-4 9 0s-9 4-9 0Zm9 0h8"/>',"Level extra");on(levelButton,"click",levelOff);
    trayButton=makeButton("bakeryTray","Baking tray. Enter picks up, arrow keys move, Enter puts down, Escape cancels.","bakery-handle bakery-tray");on(trayButton,"pointerdown",downTray);on(trayButton,"keydown",trayKey);
    for(var n=0;n<4;n++)(function(i){var b=makeButton("bakeryBun"+i,"Dough bun "+(i+1)+". Press and move to shape. Pick up the formed bun and drag it to its space.","bakery-handle bakery-bun");bunButtons.push(b);on(b,"pointerdown",function(e){downBun(e,i);});on(b,"keydown",function(e){bunKey(e,i);});})(n);
    for(var j=0;j<3;j++)(function(i){var b=makeButton("bakeryBatch"+i,"Choose "+NAMES[i],"bakery-batch bakery-batch-"+KEYS[i]);b.innerHTML='<img src="/assets/crafted/daily/day06-bun-'+KEYS[i]+'-v1.webp" alt=""><span>'+NAMES[i]+'</span>';batchButtons.push(b);on(b,"click",function(){if(canPlay()&&!gesture&&(phase()==="bake"||phase()==="arrange")){selectedBatch=i;hud();draw();}});})(j);
    heatInput=document.createElement("input");heatInput.type="range";heatInput.min="0";heatInput.max="100";heatInput.step="1";heatInput.value="15";heatInput.id="bakeryHeat";heatInput.className="bakery-heat";heatInput.setAttribute("aria-label","Oven heat. Move the handle to the golden picture.");root.appendChild(heatInput);
    on(heatInput,"input",function(){if(!canPlay()||phase()!=="bake")return;setHeat=Number(heatInput.value)/100;heatTouched=true;heatTouches++;var band=heatBand();if(setHeat<band.low||setHeat>band.high){if(heatTouches%4===0)miss("Move the heat handle into the golden picture.");}hud();});
    caption=document.createElement("div");caption.className="bakery-caption";root.appendChild(caption);statusEl=document.createElement("div");statusEl.className="bakery-sr";statusEl.setAttribute("role","status");statusEl.setAttribute("aria-live","polite");root.appendChild(statusEl);
    [cv,toolButton,trayButton].concat(bunButtons).forEach(function(el){if(el===cv)on(el,"pointerdown",downTool);on(el,"pointermove",move);on(el,"pointerup",up);on(el,"pointercancel",up);on(el,"lostpointercapture",up);});
    if(helpEl)on(helpEl,"click",function(){if(canPlay()&&!gesture&&api&&api.practice)api.practice();});
    on(window,"resize",fit);on(window,"blur",function(){cancelGesture();hud();});on(document,"visibilitychange",function(){if(document.hidden)pause();});on(window,"pagehide",function(){away=true;pause();if(raf)cancelAnimationFrame(raf);raf=0;});on(window,"pageshow",function(){away=false;last=0;if(!raf&&!destroyed)raf=requestAnimationFrame(frame);hud();});
  }
  function fit() {
    if(!cv||!ctx)return;cancelGesture();var oldW=W,oldWork=work,oldTool={x:tool.x/Math.max(1,W),y:(tool.y-work.top)/Math.max(1,work.height)},r=cv.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,r.width);H=Math.max(1,r.height);cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    var top=110;if(bannerEl){var br=bannerEl.getBoundingClientRect();if(br.bottom>r.top&&br.top<r.bottom)top=Math.max(12,br.top-r.top+(W>H&&H<500?52:78)+8);}work={top:top,height:Math.max(110,H-top-126)};
    var bc=point(0.50,0.52);bowl={x:bc.x,y:bc.y,r:Math.min(W*0.205,work.height*0.27)};var bp=point(0.34,0.52);board={x:bp.x,y:bp.y,w:W*0.58,h:work.height*0.66,bunR:Math.min(W*0.105,work.height*0.18)};
    var tp=point(0.79,0.59);tray={x:tp.x,y:tp.y,w:W*0.29,h:Math.min(work.height*0.40,W*0.27)};var op=point(0.29,0.40);oven={x:op.x,y:op.y,w:W*0.40,h:work.height*0.33};var rp=point(0.77,0.43);rack={x:rp.x,y:rp.y,w:W*0.34,h:work.height*0.35};
    baskets=[0.18,0.5,0.82].map(function(x,i){var p=point(x,0.76);return{x:p.x,y:p.y,rx:W*0.13,ry:Math.min(W*0.10,work.height*0.14),key:KEYS[i]};});
    toolW=clamp(W*0.23,62,94);toolH=toolW*0.82;tool={x:oldTool.x*W,y:work.top+oldTool.y*work.height};if(!active)tool=toolHome();root.style.height=H+"px";var heat=point(0.5,0.86);heatInput.style.left=(W*0.13)+"px";heatInput.style.top=(heat.y-22)+"px";heatInput.style.width=(W*0.74)+"px";last=0;hud();draw();
  }
  function positionHandle(el,p,w,h) { el.style.left=p.x+"px";el.style.top=p.y+"px";el.style.width=Math.max(44,w||44)+"px";el.style.height=Math.max(44,h||44)+"px"; }
  function hud() {
    if(!root)return;var p=phase(),allowed=canPlay(),b=batch(),isPour=p==="pourFlour"||p==="pourLiquid",isShape=p.indexOf("shape")===0,ab=activeBun();
    toolButton.hidden=!(isPour||p==="mix"||p==="shapeBerry"&&ab&&ab.well&&!ab.filled);toolButton.disabled=!allowed;positionHandle(toolButton,tool,isPour?toolW:48,isPour?toolH:48);toolButton.setAttribute("aria-pressed",gesture&&(gesture.kind==="pour"||gesture.kind==="mix"||gesture.kind==="berrySpoon")?"true":"false");
    actionButton.hidden=!isPour;actionButton.disabled=!allowed||!!gesture;levelButton.hidden=!isPour||!b||b[ingredient()]<=ingredientTarget()+amountBand();levelButton.disabled=!allowed||!!gesture;
    bunButtons.forEach(function(el,i){var bun=b&&b.buns[i],visible=!!bun&&(p==="arrange"?!bun.sorted:isShape&&bun===ab);el.hidden=!visible;el.disabled=!allowed;if(visible){var at=bunPoint(bun);positionHandle(el,at,p==="arrange"?48:board.bunR*2,p==="arrange"?48:board.bunR*2);el.setAttribute("aria-pressed",gesture&&gesture.bun===bun?"true":"false");}});
    trayButton.hidden=p!=="bake"||!b||b.trayState==="rack";trayButton.disabled=!allowed;if(b)positionHandle(trayButton,trayPoint(b),Math.max(66,W*0.20),Math.max(44,work.height*0.13));
    heatInput.hidden=p!=="bake";heatInput.disabled=!allowed;heatInput.setAttribute("aria-valuetext",Math.round(actualHeat*100)+" percent warm; "+(usefulHeat()?"in the golden picture":"outside the golden picture"));
    batchButtons.forEach(function(el,i){el.hidden=p!=="bake"&&p!=="arrange";el.disabled=!allowed||!!gesture;el.setAttribute("aria-pressed",selectedBatch===i?"true":"false");el.style.left=(W*(0.17+i*0.33))+"px";});
    if(helpEl){helpEl.disabled=!allowed||!!gesture;var span=helpEl.querySelector("span");if(span)span.textContent="Steady hands";else helpEl.textContent="Steady hands";helpEl.classList.toggle("powered",power>0&&active);}
    caption.textContent=power>0&&active?"Steady hands · a wider golden heat picture":p==="bake"?"Move the heat handle to the golden picture":"Follow the picture with your hands";publish();
  }
  function publish() {
    if(!cv)return;var p=phase(),b=batch(),band=heatBand(),stamps=pressTargets(),spiral=tracePoints(),bs=normal(bowl),wd=normal(board),sp=nozzle(),tp=normal(tray),op=normal(oven),rp=normal(rack);
    window.__dailyBakery={active:active,paused:paused,away:away,won:won,stage:stage,stages:count,taskIndex:taskIndex,phase:p,batch:selectedBatch,completedGoals:completed.slice(),power:power,powerDuration:POWER,misses:misses,effort:effort,assistance:assistance(),manualDistance:manualDistance,caught:caught,spilled:spilled,pourChecks:pourChecks,levelUses:levelUses,ovenRemovals:ovenRemovals,sortDrops:sortDrops,
      bowl:{x:bs.x,y:bs.y,r:bowl.r/W,mouth:{x:bs.x,y:bs.y,rx:pourCatch()/W,ry:bowl.r*0.18/H},ringRadius:bowl.r*0.76/W,ringTolerance:ringTolerance()/W},tool:{x:tool.x/W,y:tool.y/H,kind:p,spout:normal(sp),control:rect(toolButton),held:!!gesture&&(gesture.kind==="pour"||gesture.kind==="mix"||gesture.kind==="berrySpoon")},pourCatch:pourCatch()/W,pourJitter:pourJitter()/W,amountBand:amountBand(),
      board:{x:wd.x,y:wd.y,w:board.w/W,h:board.h/H,bunRadius:board.bunR/W,stampRadius:stampRadius()/W,pressTargets:stamps.map(normal),traceTolerance:traceTolerance()/W,tracePoints:spiral.map(normal)},
      batches:batches.map(function(q){return{key:q.key,index:q.index,flour:q.flour,liquid:q.liquid,flourTarget:q.flourTarget,liquidTarget:q.liquidTarget,flourChecked:q.flourChecked,liquidChecked:q.liquidChecked,mix:q.mix,sweep:q.sweep,quadrants:q.quads.slice(),trayState:q.trayState,bake:q.bake,baked:q.baked,cooled:q.cooled,buns:q.buns.map(function(bun){var at=q.index===selectedBatch?bunPoint(bun):{x:0,y:0},sl=q.index===selectedBatch?slot(bun.index):{x:0,y:0};return{index:bun.index,x:at.x/W,y:at.y/H,formed:bun.formed,onTray:bun.onTray,sorted:bun.sorted,press:bun.press.slice(),pressTravel:bun.pressTravel,trace:bun.trace,traceRequired:spiral.length,well:bun.well,filled:bun.filled,slot:normal(sl),control:q.index===selectedBatch?rect(bunButtons[bun.index]):null};})};}),
      tray:{x:tp.x,y:tp.y,w:tray.w/W,h:tray.h/H,position:b?normal(trayPoint(b)):null},oven:{x:op.x,y:op.y,w:oven.w/W,h:oven.h/H,batch:ovenBatch},rack:{x:rp.x,y:rp.y,w:rack.w/W,h:rack.h/H},
      heat:{setpoint:setHeat,actual:actualHeat,touched:heatTouched,touches:heatTouches,band:band,useful:usefulHeat(),bakeSeconds:younger?3.5:4.0,control:rect(heatInput)},baskets:baskets.map(function(q){return{key:q.key,x:q.x/W,y:q.y/H,rx:q.rx/W,ry:q.ry/H};}),
      controls:{tool:rect(toolButton),action:rect(actionButton),level:!levelButton.hidden?rect(levelButton):null,tray:rect(trayButton),heat:rect(heatInput),batches:batchButtons.map(rect),buns:bunButtons.map(rect),help:rect(helpEl)},particles:particles.map(function(d){return{x:d.x/W,y:d.y/H,kind:d.kind,batch:d.batch};}),pointer:gesture?{kind:gesture.kind,id:gesture.id==null?"keyboard":gesture.id,keyboard:!!gesture.keyboard,index:gesture.index,from:gesture.from,x:gesture.x/W,y:gesture.y/H}:null,celebrating:doneAt>0,doneIn:doneAt?Math.max(0,doneAt-clock):0,width:W,height:H,work:{x:0,y:work.top/H,width:1,height:work.height/H},reduceMotion:reduceMotion,coordinates:"Positions normalized to dailyCanvas; r/rx/lengths use canvas width; ry/h use canvas height. Amounts are ingredient-volume units; heat is 0..1. Read-only snapshot."};
  }
  function image(key) { var i=art[key];return i&&i.complete&&i.naturalWidth?i:null; }
  function ellipse(x,y,rx,ry,fill,stroke,line) { ctx.beginPath();ctx.ellipse(x,y,Math.max(0.1,rx),Math.max(0.1,ry),0,0,TAU);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line||1;ctx.stroke();} }
  function roundRect(x,y,w,h,r) { r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath(); }
  function woodRect(x,y,w,h,r) {ctx.fillStyle="#c6a571";roundRect(x,y,w,h,r);ctx.fill();var i=image("wood");if(i){ctx.save();ctx.clip();ctx.globalAlpha=0.5;ctx.globalCompositeOperation="multiply";ctx.drawImage(i,x,y,w,h);ctx.restore();}ctx.strokeStyle="#9c8059";ctx.lineWidth=1.5;ctx.stroke();}
  function background() {var bg=image("bg");if(bg){var scale=Math.max(W/bg.naturalWidth,H/bg.naturalHeight),w=bg.naturalWidth*scale,h=bg.naturalHeight*scale,counter=work.top+work.height*0.18,top=clamp(counter-h*0.40,H-h,0);ctx.drawImage(bg,(W-w)/2,top,w,h);}else{var g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#e6dcc1");g.addColorStop(1,"#ba9667");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}ctx.fillStyle="rgba(249,242,215,.95)";roundRect(6,H-119,W-12,113,17);ctx.fill();ctx.strokeStyle="rgba(126,111,78,.22)";ctx.lineWidth=1;ctx.stroke();}
  function bunArt(key,x,y,r,progress,well,filled) {var baked=image("bun-"+key);if(baked&&progress>=0.98){ctx.drawImage(baked,x-r,y-r,r*2,r*2);return;}ctx.save();ctx.translate(x,y);var g=ctx.createRadialGradient(-r*0.2,-r*0.3,r*0.1,0,0,r);g.addColorStop(0,progress>0?"#eed39a":"#edddb3");g.addColorStop(0.7,progress>0?"#d5b278":"#dbc79a");g.addColorStop(1,progress>0?"#b68c55":"#bea77d");ellipse(0,2,r,r*0.79,"rgba(100,76,42,.17)");ellipse(0,0,r*0.94,r*0.76,g,"#b29a70",1);
    if(key==="round"){ctx.strokeStyle="#d4bf94";ctx.lineWidth=3;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-r*0.36,-r*0.28);ctx.lineTo(r*0.36,r*0.24);ctx.moveTo(r*0.33,-r*0.29);ctx.lineTo(-r*0.33,r*0.25);ctx.stroke();}
    if(key==="curl"){ctx.strokeStyle="#b99f71";ctx.lineWidth=3;ctx.lineCap="round";ctx.beginPath();for(var n=0;n<60;n++){var a=n/59*Math.PI*3.6,rr=r*(0.68-n/59*0.56),px=Math.cos(a)*rr,py=Math.sin(a)*rr*0.76;if(n)ctx.lineTo(px,py);else ctx.moveTo(px,py);}ctx.stroke();}
    if(key==="berry"&&well){ellipse(0,0,r*0.47,r*0.34,filled?"#796189":"#c6ad7e","#b29a70",1);if(filled){for(var k=0;k<5;k++){var a=k*TAU/5;ellipse(Math.cos(a)*r*0.22,Math.sin(a)*r*0.15,r*0.12,r*0.10,"#8b7399","#bda1bb",0.6);}}}ctx.restore(); }
  function bowlArt() {var im=image("bowl"),r=bowl.r;if(im)ctx.drawImage(im,bowl.x-r*1.38,bowl.y-r*1.38,r*2.76,r*2.76);else ellipse(bowl.x,bowl.y,r*1.38,r*1.38,"#ced9cb","#8faba4",3);var b=batch();ctx.save();ctx.beginPath();ctx.arc(bowl.x,bowl.y,r*1.08,0,TAU);ctx.clip();ellipse(bowl.x,bowl.y,r*1.1,r*1.1,"#e8dbb2");if(b){var flour=clamp(b.flour/b.flourTarget,0,1),liquid=clamp(b.liquid/b.liquidTarget,0,1);ellipse(bowl.x,bowl.y+10,r*(0.25+flour*0.75),r*(0.20+flour*0.70),"#eee3c2");if(liquid>0){ctx.globalAlpha=0.22+liquid*0.45;ellipse(bowl.x,bowl.y,r*liquid,r*liquid,"#c8b17a");ctx.globalAlpha=1;}for(var n=0;n<28;n++){var a=n*2.4,rr=r*(0.15+(n%7)/9);ellipse(bowl.x+Math.cos(a)*rr,bowl.y+Math.sin(a)*rr,1.3,1.0,b.key==="berry"?"#a89ab0":"#bca678");}if(b.mix>0){ctx.strokeStyle="#c3aa75";ctx.lineWidth=2;for(var j=0;j<3;j++){ctx.beginPath();ctx.arc(bowl.x,bowl.y,r*(0.3+j*0.2),b.sweep*0.1,b.sweep*0.1+Math.PI*1.7);ctx.stroke();}}}ctx.restore();
    if(phase()==="mix"){ctx.strokeStyle=power>0?"#f2efc9":"rgba(245,244,220,.9)";ctx.lineWidth=assistance()?5:3;ctx.setLineDash([5,7]);ctx.beginPath();ctx.arc(bowl.x,bowl.y,r*0.76,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle="#7d9f91";ctx.lineWidth=5;ctx.beginPath();ctx.arc(bowl.x,bowl.y+r*0.03,r*1.47,-Math.PI/2,-Math.PI/2+TAU*(b?b.mix:0));ctx.stroke();}}
  function recipeCard(key,x,y) {var b=batch(),target=key==="flour"?b.flourTarget:b.liquidTarget,amount=b[key],w=38,h=61;ctx.fillStyle="rgba(250,246,222,.94)";roundRect(x-w/2,y-h/2,w,h,9);ctx.fill();ctx.strokeStyle="#ada380";ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=key==="flour"?"#ddd4b0":"#9dc4c0";var fill=clamp(amount/1.4,0,1)*(h-12);ctx.fillRect(x-w/2+6,y+h/2-6-fill,w-12,fill);var line=y+h/2-6-target/1.4*(h-12);ctx.strokeStyle="#6a8d80";ctx.lineWidth=2;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x-w/2+3,line);ctx.lineTo(x+w/2-3,line);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#6d7d61";ctx.font="700 10px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText(key==="flour"?"Flour":"Liquid",x,y+h/2+12);}
  function trayArt(b,x,y,w,h) {ctx.fillStyle="#9ba6a0";roundRect(x-w/2,y-h/2,w,h,7);ctx.fill();ctx.strokeStyle="#6f817a";ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle="#dce0c5";ctx.lineWidth=2;roundRect(x-w/2+4,y-h/2+4,w-8,h-8,4);ctx.stroke();var old=tray;if(phase()==="bake"){b.buns.forEach(function(bun,i){var n=b.buns.length,col=n===3?i:i%2,row=n===3?0:Math.floor(i/2),px=x+(col-(n===3?1:0.5))*w*(n===3?0.29:0.37),py=y+(row-(n===3?0:0.5))*h*0.4;bunArt(b.key,px,py,Math.min(w*0.16,h*0.27),b.bake,bun.well,bun.filled);});}else b.buns.forEach(function(bun){var q=slot(bun.index);if(bun.onTray)bunArt(b.key,q.x,q.y,Math.min(tray.w*0.16,tray.h*0.29),0,bun.well,bun.filled);else{ctx.strokeStyle="rgba(243,241,215,.9)";ctx.lineWidth=2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.ellipse(q.x,q.y,Math.min(tray.w*0.17,tray.h*0.30),Math.min(tray.w*0.14,tray.h*0.24),0,0,TAU);ctx.stroke();ctx.setLineDash([]);}});}
  function shapeArt() {var b=batch(),bun=activeBun();woodRect(board.x-board.w/2,board.y-board.h/2,board.w,board.h,16);trayArt(b,tray.x,tray.y,tray.w,tray.h);if(!bun)return;
    if(phase()==="shapeCurl"&&!bun.formed){var path=tracePoints();ctx.strokeStyle="#c4aa77";ctx.lineWidth=board.bunR*0.27;ctx.lineCap="round";ctx.beginPath();path.forEach(function(q,i){if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.stroke();ctx.strokeStyle="#e7d8ae";ctx.lineWidth=board.bunR*0.15;ctx.stroke();for(var n=bun.trace;n<path.length;n+=4){var q=path[n];ellipse(q.x,q.y,n===bun.trace?5:2.6,n===bun.trace?5:2.6,n===bun.trace?"#eff4cf":"#f8edce","#9ba67a",1);}ctx.strokeStyle="#8da58a";ctx.lineWidth=3;ctx.beginPath();for(var i=0;i<bun.trace;i++){var pt=path[i];if(i)ctx.lineTo(pt.x,pt.y);else ctx.moveTo(pt.x,pt.y);}ctx.stroke();}
    else{var bp=bunPoint(bun);bunArt(b.key,bp.x,bp.y,board.bunR,0,bun.well,bun.filled);if(!bun.formed&&!bun.well){var targets=pressTargets();targets.forEach(function(q,i){ellipse(q.x,q.y,bun.press[i]?3:5,bun.press[i]?3:5,bun.press[i]?"#9eaf82":"#f5eac3","#aab48e",1);});}}
    if(phase()==="shapeBerry"&&!bun.filled){var hp=toolHome();ellipse(hp.x,hp.y,23,14,"#b1c5c0","#6e9387",2);for(var k=0;k<7;k++)ellipse(hp.x+Math.cos(k*2.3)*11,hp.y+Math.sin(k*2.3)*6,4,3,"#8f7d9c","#b8a2bd",0.7);}}
  function ovenArt() {var b=batch(),band=heatBand();ctx.fillStyle="#c6b68e";roundRect(oven.x-oven.w*0.61,oven.y-oven.h*0.8,oven.w*1.22,oven.h*1.7,14);ctx.fill();ctx.strokeStyle="#9a8c6e";ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=usefulHeat()?"#dbc48d":"#b4ab87";roundRect(oven.x-oven.w/2,oven.y-oven.h/2,oven.w,oven.h,10);ctx.fill();ctx.fillStyle="#766d55";roundRect(oven.x-oven.w*0.46,oven.y-oven.h*0.43,oven.w*0.92,oven.h*0.86,8);ctx.fill();ctx.strokeStyle="#d7c394";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(oven.x-oven.w*0.40,oven.y+oven.h*0.21);ctx.lineTo(oven.x+oven.w*0.40,oven.y+oven.h*0.21);ctx.stroke();
    woodRect(rack.x-rack.w/2,rack.y-rack.h/2,rack.w,rack.h,9);ctx.strokeStyle="#8e876a";ctx.lineWidth=2;for(var n=-3;n<=3;n++){ctx.beginPath();ctx.moveTo(rack.x-rack.w*0.43,rack.y+n*rack.h*0.11);ctx.lineTo(rack.x+rack.w*0.43,rack.y+n*rack.h*0.11);ctx.stroke();}
    batches.forEach(function(q){if(q.trayState==="oven"&&!(gesture&&gesture.kind==="trayDrag"&&gesture.batch===q.index))trayArt(q,oven.x,oven.y,oven.w*0.85,oven.h*0.68);});
    if(b&&b.trayState!=="oven"){var pos=trayPoint(b);trayArt(b,pos.x,pos.y,W*0.27,Math.max(45,work.height*0.20));}else if(gesture&&gesture.kind==="trayDrag"){trayArt(b,gesture.x,gesture.y,W*0.27,Math.max(45,work.height*0.20));}
    var bar=point(0.5,0.86),w=W*0.74;ctx.fillStyle="rgba(245,237,204,.9)";roundRect(bar.x-w/2,bar.y-8,w,16,8);ctx.fill();ctx.fillStyle="#d7c286";roundRect(bar.x-w/2+band.low*w,bar.y-8,(band.high-band.low)*w,16,6);ctx.fill();ctx.strokeStyle="#8d9d7a";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bar.x-w/2+actualHeat*w,bar.y-16);ctx.lineTo(bar.x-w/2+actualHeat*w,bar.y+16);ctx.stroke();ctx.fillStyle="#6d775a";ctx.font="700 11px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText("Golden warmth",bar.x,bar.y-23);
    if(ovenBatch>=0){var q=batches[ovenBatch];ctx.fillStyle="rgba(245,237,204,.95)";roundRect(oven.x-oven.w*0.5,oven.y+oven.h*0.62,oven.w,8,4);ctx.fill();ctx.fillStyle="#a5b48a";roundRect(oven.x-oven.w*0.5,oven.y+oven.h*0.62,Math.max(1,oven.w*q.bake),8,4);ctx.fill();}}
  function basketArt() {baskets.forEach(function(q,i){ctx.fillStyle="#c6aa76";roundRect(q.x-q.rx,q.y-q.ry,q.rx*2,q.ry*2,10);ctx.fill();ctx.strokeStyle="#9b8158";ctx.lineWidth=1.5;ctx.stroke();ctx.strokeStyle="#ddca9b";ctx.lineWidth=2;for(var n=-2;n<=2;n++){ctx.beginPath();ctx.moveTo(q.x-q.rx*0.92,q.y+n*q.ry*0.28);ctx.lineTo(q.x+q.rx*0.92,q.y+n*q.ry*0.28);ctx.stroke();}bunArt(KEYS[i],q.x,q.y-q.ry-18,15,1,true,true);batches[i].buns.forEach(function(bun){if(bun.sorted){var p=basketBunPoint(i,bun.index);bunArt(KEYS[i],p.x,p.y,15,1,true,true);}});});var b=batch();if(b)b.buns.forEach(function(bun){if(!bun.sorted){var p=bunPoint(bun);bunArt(b.key,p.x,p.y,Math.min(24,W*0.065),1,true,true);}});}
  function toolArt() {var p=phase();if(p==="pourFlour"||p==="pourLiquid"){ctx.save();ctx.translate(tool.x,tool.y);if(p==="pourLiquid"&&image("jug")){var im=image("jug");ctx.drawImage(im,-toolW/2,-toolH/2,toolW,toolH);}else{ctx.fillStyle="#c6ad7b";roundRect(-toolW*0.46,-toolH*0.30,toolW*0.77,toolH*0.75,9);ctx.fill();ctx.strokeStyle="#9c8357";ctx.lineWidth=2;ctx.stroke();ellipse(-toolW*0.07,-toolH*0.27,toolW*0.38,toolH*0.18,"#eee4c4","#a9956a",1.5);ctx.fillStyle="#d5bf8d";ctx.beginPath();ctx.moveTo(toolW*0.24,-toolH*0.35);ctx.lineTo(toolW*0.45,-toolH*0.28);ctx.lineTo(toolW*0.26,-toolH*0.11);ctx.fill();}ctx.restore();}
    else if(p==="mix"||p==="shapeBerry"&&activeBun()&&activeBun().well&&!activeBun().filled){var sp=image("spoon"),w=W*0.26;if(sp)ctx.drawImage(sp,tool.x-w*0.13,tool.y-w*0.16,w,w*sp.naturalHeight/sp.naturalWidth);else{ctx.strokeStyle="#b99c68";ctx.lineWidth=7;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(tool.x,tool.y);ctx.lineTo(tool.x+38,tool.y+32);ctx.stroke();ellipse(tool.x,tool.y,10,7,"#ddc795");}if(p==="shapeBerry")for(var n=0;n<4;n++)ellipse(tool.x+(n%2?3:-3),tool.y+(n<2?-2:2),3,2.4,"#8b7397");}}
  function draw() {if(!ctx||destroyed)return;ctx.clearRect(0,0,W,H);background();var p=phase();if(p==="pourFlour"||p==="pourLiquid"||p==="mix"){bowlArt();if(p!=="mix"){var left=point(0.15,0.50),right=point(0.86,0.50);recipeCard("flour",left.x,left.y);recipeCard("liquid",right.x,right.y);}}else if(p.indexOf("shape")===0)shapeArt();else if(p==="bake")ovenArt();else if(p==="arrange")basketArt();
    particles.forEach(function(d){ellipse(d.x,d.y,d.kind==="flour"?2.5:2,d.kind==="flour"?2:3,d.kind==="flour"?"#f1e6c3":"#accdc6","rgba(248,249,226,.7)",0.5);});splashes.forEach(function(s){ctx.globalAlpha=Math.max(0,1-s.age/0.4);ellipse(s.x,s.y,3+s.age*18,2+s.age*7,"rgba(246,239,210,.6)");});ctx.globalAlpha=1;toolArt();
    if(power>0&&active){ctx.fillStyle="rgba(239,244,211,.94)";roundRect(W-112,work.top+2,100,22,10);ctx.fill();ctx.fillStyle="#657e5b";ctx.font="700 11px system-ui,sans-serif";ctx.textAlign="center";ctx.fillText("Steady hands",W-62,work.top+17);}}
  function tick(dt) {
    if(paused||away||destroyed||document.hidden)return;clock+=dt;splashes.forEach(function(s){s.age+=dt;});splashes=splashes.filter(function(s){return s.age<0.4;});if(doneAt){if(clock>=doneAt){doneAt=0;hud();if(api&&api.done)api.done();}else publish();return;}if(!canPlay()){publish();return;}power=Math.max(0,power-dt);var p=phase(),g=gesture;
    if(g&&g.kind==="pour") {emission+=dt;if(clock-gainAt>0.6)effort+=dt;while(emission>=0.055){emission-=0.055;var sp=nozzle(),jitter=pourJitter(),drop={x:sp.x,y:sp.y,vx:(Math.random()-0.5)*jitter*1.6,vy:55,kind:ingredient(),batch:selectedBatch,value:0.028,age:0};if(assistance()>=2){var dy=Math.max(5,bowl.y-sp.y),t=(-55+Math.sqrt(55*55+2*300*dy))/300;drop.vx=(bowl.x-sp.x)/Math.max(0.08,t);}particles.push(drop);}}
    if(g&&(g.kind==="mix"||g.kind==="press"||g.kind==="curl")&&g.work>0&&clock-gainAt>0.6){effort+=dt;g.work=0;}
    for(var n=particles.length-1;n>=0;n--){var d=particles[n],old=d.y;d.vy+=300*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.age+=dt;if(old<bowl.y&&d.y>=bowl.y){if(Math.abs(d.x-bowl.x)<=pourCatch()){var b=batches[d.batch];if(!b[d.kind+"Checked"]){b[d.kind]=Math.min(1.45,b[d.kind]+d.value);caught++;gainAt=clock;splashes.push({x:d.x,y:bowl.y,age:0});}}else{spilled++;if(g&&g.kind==="pour")effort+=0.12;}particles.splice(n,1);}else if(d.age>3||d.y>H+20){particles.splice(n,1);spilled++;}}
    if(p==="bake"){actualHeat+=(setHeat-actualHeat)*Math.min(1,dt*1.6);if(ovenBatch>=0&&heatTouched){var b=batches[ovenBatch],lifted=g&&g.kind==="trayDrag"&&g.from==="oven";if(!lifted&&usefulHeat()){b.bake=Math.min(1,b.bake+dt/(younger?3.5:4));if(b.bake>=1&&!b.baked){b.baked=true;banner("Golden buns! Bring their tray to the cooling rack.");sound("tap");}}}}
    hud();
  }
  function frame(now) {if(destroyed)return;var dt=last?Math.min(0.05,(now-last)/1000):0;last=now;tick(dt);draw();raf=requestAnimationFrame(frame);}
  function onWord(index) {if(destroyed||index<0||index>=count)return;if(stage!==index||!active)clearDirections(false);if(stage===index&&active){paused=false;power=POWER;flushDirections();hud();return;}cancelGesture();stage=index;taskIndex=0;active=true;paused=false;won=false;power=POWER;doneAt=0;misses=0;effort=0;last=0;said={};beginTask();draw();}
  function pause() {clearDirections(true);paused=true;last=0;cancelGesture();hud();draw();}
  function reset() {clearDirections(false);cancelGesture();makeBatches();completed=[];stage=-1;taskIndex=0;selectedBatch=0;active=false;paused=false;won=false;power=0;clock=0;last=0;doneAt=0;particles=[];splashes=[];emission=0;misses=0;effort=0;manualDistance=0;caught=0;spilled=0;pourChecks=0;levelUses=0;ovenRemovals=0;sortDrops=0;setHeat=0.15;actualHeat=0.15;heatTouched=false;heatTouches=0;ovenBatch=-1;heatInput.value="15";said={};tool=toolHome();banner("The bakery's breakfast trays are waiting.");hud();draw();}
  function finale() {clearDirections(false);cancelGesture();active=false;paused=false;power=0;doneAt=0;won=completed.length>=count&&batches.every(function(b){return b.baked&&b.cooled&&b.buns.every(function(x){return x.sorted;});});banner(won?"Breakfast is ready for the neighbours!":"The bakery is ready for your next batch.");hud();draw();}
  function destroy() {clearDirections(false);if(!initialized)return;destroyed=true;cancelGesture();if(raf)cancelAnimationFrame(raf);raf=0;listeners.forEach(function(l){l[0].removeEventListener(l[1],l[2],l[3]);});listeners=[];if(root&&root.parentNode)root.parentNode.removeChild(root);if(cv)cv.classList.remove("daily-bakery-canvas");if(helpEl){helpEl.classList.remove("bakery-help","powered");helpEl.disabled=false;}initialized=false;active=false;stage=-1;publish();}
  window.DailyAdventureGames=window.DailyAdventureGames||{};
  window.DailyAdventureGames.bakery={
    init:function(a,n){if(initialized)destroy();api=a;count=n===8?8:5;younger=count===5;destroyed=false;initialized=true;away=false;cv=$("dailyCanvas");layer=$("dailyControls");helpEl=$("dailyHelp");bannerEl=$("dailyBanner");if(!cv||!layer)throw new Error("Bakery needs dailyCanvas and dailyControls");ctx=cv.getContext("2d");cv.classList.add("daily-bakery-canvas");if(helpEl)helpEl.classList.add("bakery-help");reduceMotion=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);batchButtons=[];bunButtons=[];makeGoals();makeBatches();controls();
      [["bg","/assets/crafted/daily/day06-moonberry-bakery-v1.webp"],["bowl","/assets/crafted/game/cake-bowl-v1.webp"],["jug","/assets/crafted/game/cake-jug-v1.webp"],["spoon","/assets/crafted/game/cake-spoon-v1.webp"],["wood","/assets/crafted/painted-wood-ivory.webp"]].concat(KEYS.map(function(key){return["bun-"+key,"/assets/crafted/daily/day06-bun-"+key+"-v1.webp"];})).forEach(function(p){var i=new Image();i.onload=function(){draw();};i.src=p[1];art[p[0]]=i;});fit();reset();raf=requestAnimationFrame(frame);},
    onWord:onWord,onHelp:function(){if(destroyed||!active||doneAt)return;paused=false;power=POWER;last=0;flushDirections();banner("Steady hands! The pictures give your hands more room.");hud();draw();},pause:pause,resume:function(playing){paused=playing===false;last=0;if(playing!==false)flushDirections();hud();draw();},reset:reset,finale:finale,finish:finale,destroy:destroy
  };
})();
