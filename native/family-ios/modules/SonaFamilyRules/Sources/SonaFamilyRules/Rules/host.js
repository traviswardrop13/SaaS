// The native policy context has no browser, network, microphone, timers, or
// persistent storage. Only the Swift host can commit the returned local changes.
(function (root) {
    "use strict";
    function noop() {}
    function storage(values) {
        const raw = Object.assign(Object.create(null), values);
        return {
            getItem: key => Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : null,
            setItem: (key, value) => { raw[String(key)] = String(value); },
            removeItem: key => { delete raw[key]; },
            key: index => Object.keys(raw)[index] || null,
            get length() { return Object.keys(raw).length; },
            snapshot: () => Object.assign({}, raw)
        };
    }
    function element() {
        return { style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
            setAttribute: noop, appendChild: noop, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] };
    }
    const origin = "https://app.speaksona.com";
    let startingStorage;
    root.nativeInstall = function (input) {
        const options = JSON.parse(input);
        startingStorage = options.storage;
        root.window = root;
        root.self = root;
        root.localStorage = storage(options.storage);
        // The new SDK grant and household promises are tracked separately in
        // native records. Expose the decision to the original rules in memory.
        if (options.access) {
            const access = options.access;
            let subscription = {};
            try { subscription = JSON.parse(root.localStorage.getItem("sona.sub.v1") || "{}") || {}; } catch (_) {}
            // The host projects every independent grant, including a verified
            // website revocation. Its false must also mask an older raw cache.
            // This override is only in this isolated rules context.
            root.localStorage.setItem("sona.sub.v1", JSON.stringify(Object.assign({}, subscription, { active: access.premium })));
            if (access.keptFreeVersion) root.localStorage.setItem("sona.freever.v1", "kept");
            if (access.legacyBuddies) root.localStorage.setItem("sona.buddyset.v1", "kept");
        }
        root.sessionStorage = storage({ "sona.moving": "1" });
        root.console = { log: noop, warn: noop, error: noop };
        root.location = { origin, hostname: "app.speaksona.com", href: origin + "/today.html", pathname: "/today.html",
            search: "", hash: "", replace: noop };
        root.history = { replaceState: noop };
        root.navigator = { userAgent: "Sona native policy" };
        root.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios",
            Plugins: options.canSell ? { Purchases: {} } : {} };
        root.document = { body: element(), head: element(), documentElement: element(), visibilityState: "visible",
            cookie: "", referrer: "", addEventListener: noop, removeEventListener: noop, createElement: element, getElementById: () => null,
            querySelector: () => null, querySelectorAll: () => [] };
        root.matchMedia = () => ({ matches: false, addEventListener: noop });
        root.setTimeout = root.setInterval = () => 0;
        root.clearTimeout = root.clearInterval = root.addEventListener = root.removeEventListener = noop;
        root.fetch = () => Promise.reject(new Error("Offline rules context"));
    };

    // Scope captured practice occurrence only around dated mutations. The
    // native install, ownership/access checks and returned summary use NOW.
    function nativeWithPracticeOccurrence(p, operation) {
        if (p.occurredAtMilliseconds == null) return operation();
        const NativeDate = root.Date, ms = p.occurredAtMilliseconds, offset = p.timezoneOffsetMinutes;
        if (!Number.isFinite(ms) || !Number.isInteger(offset) || Math.abs(offset) > 1440 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(p.localDay || "")) throw new Error("Invalid native practice occurrence");
        class OccurrenceDate extends NativeDate {
            constructor(...args) {
                if (args.length > 1) super(NativeDate.UTC(...args) + offset * 60000);
                else super(args.length ? args[0] : ms);
            }
            static now() { return ms; }
            _local() { return new NativeDate(this.getTime() - offset * 60000); }
            getFullYear() { return this._local().getUTCFullYear(); }
            getMonth() { return this._local().getUTCMonth(); }
            getDate() { return this._local().getUTCDate(); }
            getDay() { return this._local().getUTCDay(); }
            getHours() { return this._local().getUTCHours(); }
            getMinutes() { return this._local().getUTCMinutes(); }
            getSeconds() { return this._local().getUTCSeconds(); }
            getTimezoneOffset() { return offset; }
            setDate(value) {
                const local = this._local();
                return this.setTime(local.setUTCDate(value) + offset * 60000);
            }
            setHours(...values) {
                const local = this._local();
                return this.setTime(local.setUTCHours(...values) + offset * 60000);
            }
        }
        const d = new OccurrenceDate();
        const day = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        if (!Number.isFinite(d.getTime()) || day !== p.localDay) throw new Error("Inconsistent native practice day");
        root.Date = OccurrenceDate;
        try { return operation(); } finally { root.Date = NativeDate; }
    }

    function readBooks() {
        const key = Sona.kkey("sona.lib.read.v1");
        try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (_) { return {}; }
    }
    function giftNames(gifts) {
        return (gifts || []).map(gift => {
            const item = gift.buddy ? Sona.CHARACTERS.find(c => c.id === gift.buddy)
                : gift.hat ? Sona.OUTFITS.find(c => c.id === gift.hat)
                : gift.place ? Sona.BACKDROPS.find(c => c.id === gift.place) : null;
            return item ? Object.assign({}, gift, {name: item.name}) : gift;
        });
    }
    function shop() {
        const profile = Sona.getProfile();
        const inventory = { characters: Sona.CHARACTERS, outfits: Sona.OUTFITS, backdrops: Sona.BACKDROPS };
        const equipped = { characters: Sona.buddyId(), outfits: profile.outfit || "none", backdrops: profile.backdrop || "sky" };
        const items = Object.keys(inventory).flatMap(kind => inventory[kind].map(item => Object.assign(
            Sona.shopItem(kind, item.id), { emoji: item.emoji || "", equipped: equipped[kind] === item.id })));
        // Display only: shipping customize.html exposes the same ten-second
        // window. undoBuy remains the sole authority for eligibility and coins.
        const lastBuy = profile.lastBuy, at = lastBuy && Number(lastBuy.at), now = Date.now();
        const refundUntil = lastBuy && Number.isFinite(at) && now >= at && now - at <= 10000 ? at + 10000 : null;
        return { coins: Sona.getCoins(), items, refundUntil };
    }
    function preferences() {
        const profile = Sona.getProfile(), hw = Sona.homework();
        const sounds = Sona.rotSounds();
        const positions = Sona.FAMILY_POSITIONS.map(value => {
            const info = Sona.posInfo(value);
            return { value, enabled: !info.only || (Sona.playStyle() !== "simple" && sounds.some(sound => info.only.includes(sound))) };
        });
        return { name: String(profile.childName || ""), age: String(profile.childAge || ""),
            position: Sona.FAMILY_POSITIONS.includes(profile.wordPosition) ? profile.wordPosition : "i",
            start: ["syllable", "word", "sentence"].includes(profile.ladderStart) ? profile.ladderStart : "",
            assignmentPosition: hw ? String(hw.pos || "mix") : null,
            sound: profile.soundOn !== false && profile.voiceOn !== false && profile.volume > 0,
            positions };
    }
    // The family setup choices come from the same word bank and selection
    // order as onboarding.html. A fresh profile's historical default sounds
    // are not a choice made by this parent.
    function setupLegacyDraft(profile, slot, isSingleChild) {
        if (profile.onboarded) return null;
        try {
            const held = JSON.parse(localStorage.getItem("sona.obdraft.v1") || "null");
            if (!held || typeof held !== "object" || Array.isArray(held)) return null;
            // The old unowned scratchpad can belong only to the original
            // single-child slot. Typed malformed owners are never a match.
            if (Object.prototype.hasOwnProperty.call(held, "kid")) {
                if (typeof held.kid !== "string" || held.kid !== slot) return null;
            } else if (!isSingleChild || slot !== "") return null;
            return held;
        } catch (_) { return null; }
    }
    function setupForm(p) {
        const profile = Sona.getProfile(), children = Sona.kids();
        const active = children.find(child => child.active), slot = active ? active.slot || "" : "";
        const isSingleChild = children.length < 2, second = !isSingleChild;
        const isClinician = profile.role === "slp", rewalk = !!(p && p.rewalk === true);
        const asks = !second && !Sona.setupAsks().asked && !isClinician;
        const sell = asks && !profile.onboarded;
        const knownBuddy = value => Sona.CHARACTERS.some(character => character.id === value);
        const held = setupLegacyDraft(profile, slot, isSingleChild);
        const character = held && knownBuddy(held.character) && Sona.owns("characters", held.character) ? held.character
            : knownBuddy(profile.character) ? profile.character : "fox";
        const interests = ["sports", "music", "dinosaurs", "animals", "space", "building", "food"];
        const first = ["R", "S", "L", "TH"];
        return { name: String(profile.childName || ""), age: String(profile.childAge || ""), character,
            askMinutes: asks, askQuestions: asks, showSales: sell,
            askUpdates: asks && !Sona.parentEmail(), showPlanMoment: sell,
            showTherapistLogin: !second && !profile.onboarded && !Sona.slpVerified(),
            isClinician, rewalk, slot, isSingleChild,
            // A fresh profile's old defaults are not the parent's choice.
            focusSounds: profile.onboarded && Array.isArray(profile.focusSounds) ? profile.focusSounds.slice() : [],
            mode: typeof profile.mode === "string" ? profile.mode : "speech",
            pathReason: typeof profile.pathReason === "string" ? profile.pathReason : "",
            email: typeof profile.email === "string" ? profile.email : "",
            interests: Array.isArray(profile.interests) ? interests.filter(id => profile.interests.includes(id)) : [],
            legacyDraftJSON: localStorage.getItem("sona.obdraft.v1"),
            sounds: first.concat(Sona.ALL_SOUNDS.filter(sound => !first.includes(sound))).map(sound => {
                const words = Sona.WORDS[sound] || [];
                const word = words.find(word => (word.pos || "i") === "i") || words[0];
                return { id: sound, label: Sona.soundLabel(sound),
                    pieces: word ? soundSegments(word.w, sound, word.pos || "i") : [] };
            }) };
    }
    function completeSetup(p) {
        // Root supplies rewalk only from the current process-owned first-game
        // Back action. A delayed ordinary setup cannot rewrite a kept child.
        const profile = Sona.getProfile();
        if (profile.onboarded && p.rewalk !== true) return summary();
        const form = setupForm(p), name = typeof p.name === "string" ? p.name.trim() : "";
        const held = setupLegacyDraft(profile, form.slot, form.isSingleChild);
        const knownBuddy = value => Sona.CHARACTERS.some(character => character.id === value);
        const currentBuddy = knownBuddy(profile.character) ? profile.character : "fox";
        const legacyBuddy = held && knownBuddy(held.character) && Sona.owns("characters", held.character) ? held.character : null;
        const legacyPlay = p.pathReason === "" && (form.rewalk && profile.mode === "play" && (profile.pathReason == null || profile.pathReason === "") ||
            held && held.mode === "play" && (held.pathReason == null || held.pathReason === ""));
        const interests = p.interests == null ? [] : p.interests;
        const interestIDs = ["sports", "music", "dinosaurs", "animals", "space", "building", "food"];
        if (!name || typeof p.age !== "string" || p.age !== "" && (!/^\d{1,2}$/.test(p.age) || Number(p.age) < 2 || Number(p.age) > 14) ||
            typeof p.character !== "string" || !knownBuddy(p.character) || p.character !== currentBuddy && p.character !== legacyBuddy ||
            !Array.isArray(p.focusSounds) || p.focusSounds.some(sound => !Sona.ALL_SOUNDS.includes(sound)) ||
            new Set(p.focusSounds).size !== p.focusSounds.length ||
            !(p.mode === "speech" && p.focusSounds.length > 0 && p.pathReason === "" ||
              p.mode === "play" && p.focusSounds.length === 0 && (p.pathReason === "unsure" || legacyPlay)) ||
            p.minutes != null && (!form.askMinutes || ![3, 5, 10].includes(p.minutes)) ||
            form.showSales && (!Array.isArray(interests) || interests.some(id => !interestIDs.includes(id)) ||
                new Set(interests).size !== interests.length)) {
            throw new Error("Invalid family setup");
        }
        const patch = { childName: name, childAge: p.age, character: p.character,
            mode: p.mode, pathReason: p.pathReason, role: form.isClinician ? "slp" : "parent", focusArea: "articulation",
            focusSounds: p.mode === "play" ? Sona.PLAY_ORDER.slice() : p.focusSounds.slice(), onboarded: true };
        if (form.showSales) patch.interests = interests.slice();
        if (p.minutes != null) {
            patch.dailyMinutes = p.minutes;
            patch.dailyGoal = { 3: 18, 5: 30, 10: 60 }[p.minutes];
        }
        // The typed native repository owns household therapy and report
        // consent atomically. This generic child-only delta never changes
        // email, weeklyEmail, weeklyReport, reportId or setupAsks.
        Sona.saveProfile(patch);
        return summary();
    }
    function soundSegments(word, sound, position) {
        const escaped = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };
        let marked = false;
        return Sona.soundMark(word, sound, position).split(/(<b class="snd">|<\/b>)/).flatMap(part => {
            if (part === '<b class="snd">') { marked = true; return []; }
            if (part === "</b>") { marked = false; return []; }
            return part ? [{ text: part.replace(/&(amp|lt|gt|quot|#39);/g, (_, key) => escaped[key]), marked }] : [];
        });
    }
    function readingWord(p, book) {
        const profile = Sona.getProfile(), age = parseInt(profile.childAge, 10) || 0, norm = Sona.soundNorm(p.sound);
        const hasWord = Sona.ALL_SOUNDS.includes(p.sound) && typeof p.word === "string" && p.word && !(book && age && norm && age < norm);
        const word = hasWord ? (book ? nativeBookWord(p) : p.word) : null;
        const caption = typeof p.caption === "string" ? p.caption : "";
        const pieces = [];
        if (word && caption) {
            const key = word.toLowerCase();
            const token = book ? Array.from(caption.matchAll(/\S+/g)).find(part =>
                part[0].toLowerCase().replace(/[^a-z']/g, "").replace(/^'+|'+$/g, "") === key)
                : Array.from(caption.matchAll(/[a-z']+/gi)).find(part => part[0].toLowerCase() === key);
            if (token) {
                pieces.push({ text: caption.slice(0, token.index), marked: false });
                if (book) pieces.push({ text: token[0], marked: false, key: true });
                else pieces.push(...soundSegments(token[0], p.sound, "i").map(part => ({ ...part, key: true })));
                pieces.push({ text: caption.slice(token.index + token[0].length), marked: false });
            }
        }
        return { word, sound: p.sound || "", position: "", sayings: book ? 1 : Sona.STORY_SAY_TIMES,
            promptPieces: word ? soundSegments(word, p.sound, "i") : [], captionPieces: pieces,
            voiceID: profile.voiceId || "", voiceOn: profile.voiceOn !== false && profile.soundOn !== false,
            volume: profile.volume == null ? 0.8 : Number(profile.volume) };
    }
    function feedGrowth(countOne) {
        const key = Sona.kkey("sona.feed.v1");
        let record = {};
        try { record = JSON.parse(localStorage.getItem(key) || "{}"); } catch (_) {}
        if (!record || typeof record !== "object" || Array.isArray(record)) record = {};
        const old = Number.isSafeInteger(record.fed) ? Math.max(0, record.fed) : 0;
        if (!countOne) return old;
        record.fed = Math.min(Number.MAX_SAFE_INTEGER, old + 1);
        localStorage.setItem(key, JSON.stringify(record));
        return record.fed;
    }
    function parentProgress() {
        const outcomes = Sona.outcomes();
        const week = Sona.momWeek();
        const thisWeek = Sona.weekReps(0, null, true);
        const sounds = Object.keys(outcomes).map(sound => {
            const row = outcomes[sound] || {}, position = Sona.soundPos(sound);
            const count = Math.max(0, Math.floor(Number(typeof row.tries === "number" ? row.tries : row.attempts) || 0));
            const recorded = Sona.ladderWhere(sound);
            const steps = recorded.length ? recorded : [{ pos: position, label: Sona.stepLabel(sound, position) }];
            return { id: sound, title: Sona.soundLabel(sound), count,
                steps: steps.map(step => ({ id: step.pos, position: Sona.posInfo(step.pos).name, label: step.label })) };
        }).filter(row => row.count > 0).sort((a, b) => b.count - a.count);
        return { thisWeek, lastWeek: Sona.weekReps(-1, null, true), gameWeek: Sona.weekReps(0) - thisWeek,
            days: week.days, daysPracticed: week.done, todayIndex: week.todayIx, sounds };
    }
    function rewards(scope) {
        const road = Sona.roadState();
        road.next.gift = giftNames(road.next.gift);
        road.month.steps.forEach(step => { step.gift = giftNames(step.gift); });
        // All authored stops, plus the current bonus stop and the next one.
        // The shipping road generates later stops mathematically as needed.
        const limit = Math.max(Sona.ROAD_STOPS.length, Math.min(road.stop + 1, Sona.ROAD_STOPS.length + 50));
        const stops = [];
        for (let i = 1; i <= limit; i++) {
            const stop = Sona.roadStop(i);
            stops.push(Object.assign({}, stop, { gift: giftNames(stop.gift), reached: road.stop >= i, got: !!road.got[i] }));
        }
        return {
            scope, road, goal: Sona.dayGoal(), stops,
            stickers: Sona.STICKERS.map(item => Object.assign({}, item, { earned: Sona.hasSticker(item.id) }))
        };
    }
    // Read-only presentation from current today.html:513–562,603–609.
    // The existing calendar/access/seen writers remain the only authorities.
    function homePresentation(q) {
        const freeBooks = Sona.freeBooksOnShelf(), booksOpen = Sona.booksOpen();
        const booksTag = Sona.isFree() ? "Free" : booksOpen ? "Included" : freeBooks ?
            (freeBooks === 1 ? "1 free book" : freeBooks + " free books") : "Premium";
        function game(key) {
            const act = Sona.gameAct(key);
            return act && !act.comingSoon && act.available !== false ? act : null;
        }
        function picture(item) {
            if (item && item.kind === "story" && item.story) {
                const story = item.story, paths = [];
                const info = Sona.storyDay(story.id);
                if (info && !info.talk) paths.push("/assets/adventure/" + story.id + "/s01.webp");
                if (story.pic) paths.push(story.pic);
                paths.push("/assets/crafted/echo-welcome.webp");
                return paths;
            }
            const key = item && item.game, crafted = (Sona.CRAFTED_CARDS || {})[key];
            return crafted ? ["/assets/crafted/home-" + crafted + ".webp", "/assets/crafted/echo-welcome.webp"] :
                ["/assets/crafted/echo-welcome.webp"];
        }
        const story = !!(q && q.kind === "story" && q.story), act = q && !story ? game(q.game) : null;
        if (!q || !story && !act) return { card: null, booksTag };
        const done = q.state === "done", next = done ? q.next : null;
        const open = Sona.gameAccess(story ? "adventure" : q.game).allowed;
        const title = done ? (story ? "Day " + q.day + " done!" : "All done for today!") : (story ? q.story.title : act.name);
        const hook = done ? (next && next.kind === "story" ? "Come back tomorrow for Day " + next.day +
            (Sona.storyOpen() ? " and a new game!" : "!") : "Come back tomorrow for a new adventure!") : q.line;
        const shown = next && (next.kind === "story" && next.story || game(next.game)) ? next : q;
        return { booksTag, card: { label: done ? "Tomorrow" : "Today's adventure", title, hook,
            dayLabel: story && !done ? "Day " + q.day : "", done, locked: !done && !open,
            actionLabel: done ? "" : !open ? "Unlock adventure" : q.seen ? "Keep going" : "Start today",
            imagePaths: picture(shown) } };
    }
    function summary() {
        const books = readBooks();
        const quest = Sona.questToday();
        const hw = Sona.homework();
        const sound = Sona.targetSound(), profile = Sona.getProfile();
        const chosen = Sona.homeworkSounds().length || (!Sona.playMode() && Sona.targetSoundOptions().length) || profile.targetSound;
        let gameHistory;
        try { gameHistory = JSON.parse(localStorage.getItem(Sona.kkey("sona.games.v1")) || "{}"); } catch (_) { gameHistory = {}; }
        gameHistory = gameHistory || {};
        return {
            sound,
            bookSound: chosen ? sound : "",
            pinnedSound: profile.targetSound || "",
            soundChoices: Sona.targetSoundOptions(),
            homework: hw ? { id: String(hw.id || ""), title: String(hw.title || ""), note: String(hw.note || ""),
                pos: String(hw.pos || ""), start: String(hw.start || ""), due: String(hw.due || ""), by: String(hw.by || ""),
                sounds: Array.isArray(hw.sounds) ? hw.sounds.map(String) : [],
                repsPerDay: Number.isFinite(Number(hw.repsPerDay)) ? Math.trunc(Number(hw.repsPerDay)) : 0,
                words: Array.isArray(hw.words) ? hw.words.map(String) : undefined } : null,
            playStyle: Sona.playStyle(),
            buddy: Sona.buddyId(),
            goal: Sona.dayGoal(),
            ring: Sona.todayRing(),
            weekReps: Sona.weekReps(0),
            parentProgress: parentProgress(),
            booksRead: Object.keys(books).filter(title => !!books[title]),
            oldReadSounds: Sona.ALL_SOUNDS.filter(sound => gameHistory[sound] && gameHistory[sound].story && gameHistory[sound].story.done),
            bestGameIDs: Sona.GAME_KEYS.filter(game => Sona.gameBest(game) > 0),
            quest,
            home: homePresentation(quest),
            found: Sona.storyFound()
        };
    }
    function execute(command) {
        const p = command.input || {};
        switch (command.operation) {
        case "summary":
        case "ensureCalendar": return summary();
        case "setupForm": return setupForm(p);
        case "completeSetup": return completeSetup(p);
        case "changeFocus":
            if (!Sona.homeworkSounds().length && Sona.ALL_SOUNDS.includes(p.sound)) {
                const current = Sona.targetSoundOptions();
                Sona.saveProfile({ focusSounds: current.includes(p.sound) ? current.filter(sound => sound !== p.sound) : current.concat(p.sound) });
            }
            return summary();
        case "enrollmentSnapshot": {
            const profile = Sona.getProfile(), progress = Sona.getProgress();
            return { childName: String(profile.childName || "").slice(0, 60), age: String(profile.childAge || ""),
                focusSounds: profile.focusSounds || [], dailyGoal: Number(profile.dailyGoal) || null,
                outcomes: Sona.outcomes(), sessions: progress.totals && progress.totals.sessions || 0,
                streak: progress.streak && progress.streak.count || 0 };
        }
        case "practiceTarget": return nativeChargeTarget(p);
        case "attempt":
            if (!Sona.ALL_SOUNDS.includes(p.sound) || !Number.isInteger(p.reps) || p.reps < 1 || p.reps > 5 ||
                typeof p.pass !== "boolean" || !["isolation", "syllable", "word", "sentence"].includes(p.level)) {
                throw new Error("Invalid verified attempt");
            }
            nativeWithPracticeOccurrence(p, () => {
                Sona.logAttempt({game: "charge", sound: p.sound, pass: p.pass, reps: p.reps,
                    word: p.word, level: p.level, pos: p.pos});
                Sona.bumpReps(p.reps);
            });
            return summary();
        case "rungWin":
            return nativeWithPracticeOccurrence(p, () => Sona.rungWin(p.sound, p.rung, p.pos));
        case "roundReady":
            nativeWithPracticeOccurrence(p, () => {
                if (p.advance) Sona.rotAdvance();
                if (Number.isInteger(p.sessionTries) && p.sessionTries > 0) {
                    Sona.recordSession({ activity: "practice", sound: p.sound, tries: p.sessionTries });
                }
            });
            return summary();
        case "targetSound":
            return { saved: Sona.setTargetSound(p.sound), summary: summary() };
        case "bookRead": {
            const read = readBooks();
            if (!read[p.title]) {
                read[p.title] = 1;
                localStorage.setItem(Sona.kkey("sona.lib.read.v1"), JSON.stringify(read));
            }
            return summary();
        }
        case "storySeen": return Sona.storySeen(p.id);
        case "storyPlace": return Sona.storyPlace(p.id, p.page);
        case "storyEnding": return Sona.storyEnding(p.id);
        case "bookWord": return readingWord(p, true);
        case "storyWord": return readingWord(p, false);
        case "questFinish": return Sona.questEnd(p.game);
        case "gameRep": return nativeWithPracticeOccurrence(p, () => Sona.gameRep(p.sound));
        case "speechGame": {
            const game = nativeSayGame(p);
            if (!game) return null;
            for (const target of game.targets) {
                target.promptPieces = soundSegments(target.word, game.sound, target.position);
            }
            return game;
        }
        case "arcadeLevelCatalog": {
            const keys = Object.keys(Sona.PLAY_LEVEL_LINES).concat(["rise"]);
            return { open: Sona.playLevelsOpen(), games: keys.map(key => {
                const access = Sona.gameAccess(key), info = Sona.playLevelInfo(key);
                const best = access && access.allowed ? (info.pick > 1 ? Sona.playBest(key, info.pick) : Sona.gameBest(key)) : 0;
                return { key, name: (Sona.GAME_ACTS[key] && Sona.GAME_ACTS[key].name) || key,
                    allowed: !!(access && access.allowed), info, best };
            }) };
        }
        case "arcadeLevelInfo": return Sona.playLevelInfo(p.game);
        case "arcadeLevelAsk": return Sona.playLevelAsk(p.game);
        case "arcadeLevelSet": return Sona.setPlayLevel(p.game, p.playLevel);
        case "arcadeBest": return p.playLevel === 1 ? Sona.gameBest(p.game) : Sona.playBest(p.game, p.playLevel);
        case "arcadeBestOffer": return nativeWithPracticeOccurrence(p, () =>
            p.playLevel === 1 ? Sona.gameBestOffer(p.game, p.bestCount) : Sona.playBestOffer(p.game, p.playLevel, p.bestCount));
        case "dinoCollection":
        case "dinoCollectionSave": {
            // dino.js recall/remember shape, on its existing child-only key.
            const ids = ["trex", "tri", "steg", "bronto"], key = Sona.kkey("sona.dino.v1");
            let value = null;
            try { value = JSON.parse(localStorage.getItem(key) || "null"); } catch (_) {}
            if (command.operation === "dinoCollectionSave") value = { last: p.dinoLast, got: p.dinoGot };
            const got = [], input = value && Array.isArray(value.got) ? value.got : [];
            input.forEach(id => { if (ids.indexOf(id) >= 0 && got.indexOf(id) < 0) got.push(id); });
            const kept = { last: value && ids.indexOf(value.last) >= 0 ? value.last : "", got };
            if (command.operation === "dinoCollectionSave") localStorage.setItem(key, JSON.stringify(kept));
            return kept;
        }
        case "arcadeCheckpoint": return nativeArcadeCheckpoint(p);
        case "feedGame": return nativeFeedGame(p);
        case "feedCount": return feedGrowth(false);
        case "feedGrowth": return feedGrowth(true);
        case "backupExport": return Sona.exportData();
        case "backupImport": return Sona.importData(p.payload);
        case "backupUndo": return Sona.undoImport(p.payload);
        case "shop": return shop();
        case "preferences": return preferences();
        case "savePreferences": {
            const before = preferences();
            const age = String(p.age || "");
            if (age && (!/^\d{1,2}$/.test(age) || Number(age) < 2 || Number(age) > 14)) throw new Error("Invalid child age");
            const patch = { childName: String(p.name || "").trim().slice(0, 24), childAge: age };
            if (!before.assignmentPosition) {
                if (before.positions.some(position => position.enabled && position.value === p.pos)) patch.wordPosition = p.pos;
                if (["", "syllable", "word", "sentence"].includes(p.start)) patch.ladderStart = p.start;
            }
            Sona.saveProfile(patch);
            return preferences();
        }
        case "turnSoundOn":
            Sona.saveProfile({ volume: 0.8, voiceOn: true, soundOn: true });
            return preferences();
        case "resetProgress":
            Sona.resetProgress();
            return preferences();
        case "equip": return { accepted: Sona.equip(p.kind, p.id), shop: shop() };
        case "buy": {
            const result = Sona.buyItem(p.kind, p.id);
            return { accepted: !!(result && result.ok), shop: shop() };
        }
        case "undoBuy": {
            const result = Sona.undoBuy();
            return { accepted: !!(result && result.ok), shop: shop() };
        }
        case "rewards": return rewards(p.scope);
        case "roadSettle": {
            const settled = Sona.roadSettle();
            const gifts = settled ? settled.rolled.flatMap(month => month.gifts).concat(settled.late.map(item => ({item}))) : [];
            return {accepted: true, snapshot: rewards(p.scope), gifts};
        }
        case "roadOpen": return update(Sona.roadOpen(p.n), p.scope);
        case "monthOpen": return update(Sona.monthOpen(p.n), p.scope);
        case "chestOpen": return update(Sona.chestOpen(), p.scope);
        case "roadRolledSeen":
            Sona.roadRolledSeen();
            return {accepted: true, snapshot: rewards(p.scope), gifts: []};
        default: throw new Error("Invalid native rules operation");
        }
    }
    function update(result, scope) {
        const accepted = Array.isArray(result) || !!(result && result.ok);
        return { accepted, reason: result && result.reason || undefined,
            snapshot: rewards(scope), gifts: Array.isArray(result) ? result : result && result.gifts || [] };
    }
    root.nativeRun = function (input) {
        const command = JSON.parse(input);
        const before = localStorage.snapshot();
        if (command.operation === "ensureCalendar") {
            // CAL1's original boot pass can initialize or repair the active
            // calendar. No other boot writes or other siblings are committed.
            const key = Sona.kkey("sona.quest.v1");
            if (Object.prototype.hasOwnProperty.call(startingStorage, key)) before[key] = startingStorage[key];
            else delete before[key];
        }
        const result = execute(command);
        const after = localStorage.snapshot();
        const changed = {};
        Object.keys(after).forEach(key => {
            // Source usage beacons may mint an analytics fid / played-day
            // throttle. This offline evaluator never commits telemetry state.
            // Every child ledger and every other key still reaches the strict
            // repository boundary; this is not a general household-write bypass.
            if (key === "sona.fid.v1" || key === "sona.played.v1") return;
            if (after[key] !== before[key]) changed[key] = after[key];
        });
        const removed = Object.keys(before).filter(key => !Object.prototype.hasOwnProperty.call(after, key));
        return JSON.stringify({ result: result === undefined ? null : result, changed, removed });
    };
})(globalThis);
