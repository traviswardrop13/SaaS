/* Optional story presentation for a physical SayPlay controller. The caller
   owns access, day selection and rewards; SayPlay owns voice and speech. */
(function () {
  "use strict";
  function wrap(story, game) {
    if (!story || !game) throw new Error("A story and physical game are required");
    var api, total = 5, current = -1, seen = {}, pending = null, paused = false, generation = 0;
    var physicalInstruction = null, endingOwed = false;
    var card, title, picture, words, next, replay, previousFocus, callback, listeners = [];
    function on(el, event, fn) { el.addEventListener(event, fn); listeners.push([el, event, fn]); }
    function publish() {
      window.__dailyNarration = { day: story.day, stage: current, total: total, open: !!pending,
        mode: pending ? pending.mode : endingOwed ? "ending-wait" : null, act: pending ? pending.act : null,
        speaking: !!pending && pending.speaking, paused: paused,
        physicalEndingEarned: endingOwed || !!pending && pending.mode === "ending", seen: Object.keys(seen) };
    }
    function build() {
      if (!document.getElementById("dailyNarrationStyle")) {
        var link = document.createElement("link"); link.id = "dailyNarrationStyle"; link.rel = "stylesheet";
        link.href = "/daily-adventures/narration.css"; document.head.appendChild(link);
      }
      card = document.createElement("section"); card.id = "dailyStoryCard"; card.hidden = true;
      card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-labelledby", "dailyStoryTitle");
      card.innerHTML = '<div class="daily-story-sheet"><img id="dailyStoryArt" alt=""><div class="daily-story-copy"><p class="daily-story-eyebrow"></p><h1 id="dailyStoryTitle"></h1><p id="dailyStoryWords" aria-live="polite"></p><div class="daily-story-actions"><button id="dailyStoryReplay" type="button" class="cream-pill" aria-label="Hear the story again"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Zm12 0a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button><button id="dailyStoryNext" type="button" class="act-pill"><span>Let\u2019s help!</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" fill="currentColor"/></svg></button></div></div></div>';
      document.body.appendChild(card); title = card.querySelector("h1"); picture = card.querySelector("img");
      words = card.querySelector("#dailyStoryWords"); next = card.querySelector("#dailyStoryNext"); replay = card.querySelector("#dailyStoryReplay");
      on(next, "click", function () {
        if (!pending || pending.speaking || paused) return;
        var action = callback; close(); if (action) action();
      });
      on(replay, "click", function () { if (pending && !pending.speaking && !paused) { pending.line = 0; speak(); } });
      on(card, "keydown", function (e) {
        if (e.key !== "Tab" || !pending) return;
        // While voice owns the card, focus stays on its readable heading.
        var controls = [replay, next].filter(function (b) { return !b.disabled; });
        if (!controls.length) { e.preventDefault(); title.focus(); return; }
        var first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === title)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === title)) { e.preventDefault(); first.focus(); }
      });
      on(picture, "error", function () { picture.hidden = true; });
      title.tabIndex = -1;
    }
    function close() {
      generation++; pending = null; callback = null; endingOwed = false; physicalInstruction = null; if (card) card.hidden = true;
      if (previousFocus && document.contains(previousFocus) && !previousFocus.disabled) { try { previousFocus.focus(); } catch (e) {} }
      publish();
    }
    function speak() {
      if (!pending || paused) return;
      var item = pending, token = ++generation; item.speaking = true;
      next.disabled = true; replay.disabled = true; publish();
      // The existing fallback has a short-utterance watchdog. Feed its
      // authored short sentences one at a time, waiting for each to finish.
      // A pause invalidates this chain; resume repeats only the interrupted
      // sentence. No new audio or microphone owner is introduced.
      function valid() { return token === generation && !paused && pending === item; }
      function finish() {
        if (!valid()) return;
        item.speaking = false; next.disabled = false; replay.disabled = false; publish();
        try { next.focus(); } catch (e) {}
      }
      function sentence() {
        if (!valid()) return;
        if (item.line >= item.lines.length) { finish(); return; }
        var result;
        try { result = api.instruct(item.lines[item.line]); } catch (e) { result = Promise.resolve(); }
        function after() { if (!valid()) return; item.line++; sentence(); }
        // The voice owner attempts its own fallback. Failure must still
        // leave a usable story card, never false physical completion.
        Promise.resolve(result).then(after, after);
      }
      sentence();
    }
    function show(mode, act, after) {
      var ending = mode === "ending", lines = ending ? story.ending : act.narration;
      previousFocus = document.activeElement;
      pending = { mode: mode, act: ending ? null : story.acts.indexOf(act), lines: lines.slice(), line: 0, speaking: false }; callback = after;
      title.textContent = ending ? story.done.title : act.title; words.textContent = lines.join(" ");
      card.querySelector(".daily-story-eyebrow").textContent = story.title;
      picture.hidden = false; picture.src = ending && story.endingArt ? story.endingArt : story.art;
      next.querySelector("span").textContent = ending ? "We did it!" : current === 0 ? "Let's help!" : "Keep going!";
      card.hidden = false; try { title.focus(); } catch (e) {} speak();
    }
    function actAt(index) {
      for (var i = 0; i < story.acts.length; i++) {
        var at = total === 8 ? story.acts[i].atOlder : story.acts[i].atYounger;
        if (at === index && !seen[i]) return story.acts[i];
      }
      return null;
    }
    function showEnding() {
      endingOwed = false;
      show("ending", null, function () { api.done(); });
    }
    function waitForEnding() {
      endingOwed = true;
      var token = ++generation, stage = current;
      var voice = physicalInstruction && physicalInstruction.stage === stage ? physicalInstruction.promise : Promise.resolve();
      publish();
      function afterVoice() {
        if (token !== generation || paused || !endingOwed || current !== stage) return;
        showEnding();
      }
      // A quick final physical action can finish before its own direction.
      // Wait on that same owner's promise before starting the first ending
      // sentence, rather than letting instruct silently reject every line.
      Promise.resolve(voice).then(afterVoice, afterVoice);
    }
    return {
      init: function (a, n) {
        api = a; total = n === 8 ? 8 : 5; current = -1; paused = false; seen = {}; pending = null; endingOwed = false; physicalInstruction = null;
        build(); var proxy = {};
        Object.keys(a).forEach(function (key) { proxy[key] = a[key]; });
        proxy.instruct = function (text) {
          var result = api.instruct(text);
          physicalInstruction = {stage:current, promise:Promise.resolve(result)};
          return result;
        };
        proxy.done = function () {
          if (paused || pending || endingOwed) return;
          if (current === total - 1) waitForEnding();
          else api.done();
        };
        game.init(proxy, total); publish();
      },
      onWord: function (index) {
        current = index; paused = false; endingOwed = false; physicalInstruction = null; var act = actAt(index);
        if (act) show("act", act, function () { seen[story.acts.indexOf(act)] = true; game.onWord(index); publish(); });
        else { game.onWord(index); publish(); }
      },
      onHelp: function (index) { paused = false; if (game.onHelp) game.onHelp(index); publish(); },
      pause: function () { paused = true; generation++; if (game.pause) game.pause(); publish(); },
      resume: function (playing) {
        paused = playing === false;
        // The shared owner has stopped the interrupted clip before resume.
        // Claim it synchronously, ahead of an obsolete mechanical replay.
        if (endingOwed && playing !== false) { showEnding(); return; }
        if (pending && playing !== false) { speak(); return; }
        if (game.resume) game.resume(playing); publish();
      },
      reset: function () { close(); seen = {}; current = -1; paused = false; game.reset(); publish(); },
      finale: function () { close(); if (game.finale) game.finale(); publish(); },
      destroy: function () {
        generation++; pending = null; endingOwed = false; physicalInstruction = null; listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2]); }); listeners = [];
        if (card && card.parentNode) card.parentNode.removeChild(card); if (game.destroy) game.destroy(); publish();
      }
    };
  }
  window.DailyAdventureNarration = { wrap: wrap };
})();
