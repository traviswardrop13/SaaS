// Verbatim content selection from public/charge.html.
function nativeChargeTarget(options) {
    var S = Sona, SOUND = options.sound || Sona.targetSound();
    var run = options.run || null, isDaily = !!run;
    var _runLen = Math.min(Sona.ROT_LEN || 5, Sona.adventureGames().length);
    function runSave() {}
    var POS=(S&&S.soundPos)?S.soundPos(SOUND):"i";
    // Keep the position selected at the start of a daily practice climb.
    // A newly assigned word list can still override the practice bank.
    // The games read the current practice position when they open.
    if(isDaily&&run&&run.active){ if(run.pos&&(!S||!S.FAMILY_POSITIONS||S.FAMILY_POSITIONS.indexOf(run.pos)>=0))POS=run.pos; else{ run.pos=POS; runSave(run); } }
    var RUNG=(S&&S.rungOf)?S.rungOf(SOUND,POS):0;
    // START: the step the day's first round asks ("Each day's practice starts
    // with" in Settings; 0, the sound, unless a grown-up picked a later one).
    // A step started above counts as the child's for the stretch: they climb
    // one past it, as they climb one past what they earned. No round asks a
    // step with nothing in it (STEPS), so none falls back to the sound and
    // earns that empty step on a bare "rrrr".
    var START=(S&&S.ladderStart)?S.ladderStart():0, STEPS=(S&&S.ladderSteps)?S.ladderSteps(SOUND,POS):[0,1,2,3];
    // STEPS: the steps this place has something to ask (Sona.ladderSteps):
    // all four at the start of a word; the syllable step is left out where a
    // place's syllables are not switched on yet, and the sentence step for a
    // place no sentence can hold. The climb moves through these: stepAt(r) is
    // the first one at or above step r.
    function stepAt(r){ for(var k=0;k<STEPS.length;k++){ if(STEPS[k]>=r)return k; } return STEPS.length-1; }
    // ONE counter drives both the header and the ladder step, because they used
    // to read different ones. The header showed today's ring position while the
    // rung read sona.js's PERSISTENT rotation counter, so "Round 3 of 5" could
    // hand a child a sentence, and a fresh day could open at sentences instead of
    // warming up on the sound. Every session now starts at isolation and climbs
    // isolation → syllable → word → sentence, still capped one level
    // above the child's mastered rung so nobody gets pushed past what they own.
    // Free play wraps within the block of five, because the ring keeps counting
    // past the goal: a bonus round is a fresh session on the NEXT sound, and it
    // has to warm up from isolation rather than inherit round six's rung.
    var _ringN=0; try{ var _r0=(S&&S.todayRing)?S.todayRing():null; _ringN=_r0?(_r0.n|0):0; }catch(e){}
    var ROUNDIX = isDaily ? ((run?run.round:0)|0) : (_ringN % _runLen);
    var useRung = STEPS[Math.min(STEPS.length-1, stepAt(START)+ROUNDIX, stepAt(Math.max(RUNG,START))+1)];
    // The round's step is the one its items come from: an empty step walks
    // down to the next one that has something, and the step goes with it, so
    // a win is only ever counted at the step that was really asked.
    var ITEMS=[];
    for(var ur=useRung;ur>=0&&!ITEMS.length;ur--){ try{ ITEMS=(S.ladderContent(SOUND,ur,POS)||[]).filter(function(it){return it&&it.t;}); }catch(e){} if(ITEMS.length)useRung=ur; }
    if(!ITEMS.length){ useRung=0; ITEMS=[{t:(S?S.soundSay(SOUND):"rrrr"),say:(S?S.soundSay(SOUND):"rrrr"),display:(S?S.soundSay(SOUND):"rrrr"),mode:"phoneme",level:"isolation",pos:""}]; }
    // ONE target per round: a single syllable said five times, never a
    // rotating drill list (see → soh → soo confused kids mid-round). The
    // shuffle still varies WHICH syllable each round gets.
    var SEQ=ITEMS.slice(); for(var si=SEQ.length-1;si>0;si--){ var sj=(Math.random()*(si+1))|0, st=SEQ[si]; SEQ[si]=SEQ[sj]; SEQ[sj]=st; }
    var ITEM=SEQ[0];
    // A day that starts above the sound (START) never has a sound round, so
    // its first round carries the mouth cue instead (sayLine). Marked on the
    // item so sayLine reads nothing but ITEM (voicetest3 runs its source).
    if(ITEM&&START>0&&ROUNDIX===0)ITEM.cueFirst=true;
    return {
        sound: SOUND,
        practicePosition: POS,
        masteredRung: RUNG,
        selectedRung: useRung,
        requiredReps: Sona.chargeState().need,
        target: ITEM,
        easier: useRung > 0 ? Sona.stepDown(ITEM, SOUND, POS) : null,
        cue: Sona.cue(SOUND),
        voiceID: Sona.getProfile().voiceId || "",
        voiceOn: Sona.getProfile().voiceOn !== false,
        voiceVolume: Sona.getProfile().volume == null ? 0.8 : Number(Sona.getProfile().volume),
        humanClipsEnabled: Sona.humanClipsOn(),
        praiseLine: Sona.praiseLine(),
        gameTitle: options.game ? Sona.gameMeta(options.game).name : ""
    };
}
