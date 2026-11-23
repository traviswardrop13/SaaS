import Foundation

@main struct SetupFlowChecks {
    static func main() throws {
        var count=0, failures=0
        func check(_ value: Bool, _ text: String) {
            count += 1
            if !value { failures += 1; print("FAIL \(text)") }
        }
        func decode(_ object: [String:Any]) throws -> NativeSetupDraft {
            try JSONDecoder().decode(NativeSetupDraft.self,from:JSONSerialization.data(withJSONObject:object))
        }
        func json(_ object: [String:Any]) throws -> String {
            String(data:try JSONSerialization.data(withJSONObject:object),encoding:.utf8)!
        }
        let sounds: [NativeSetupForm.Sound] = [
            .init(id:"R",label:"R",pieces:[]),.init(id:"S",label:"S",pieces:[.init(text:"sun",marked:false)]),
            .init(id:"TH",label:"TH",pieces:[]),.init(id:"THV",label:"TH",pieces:[])
        ]
        let full=NativeSetupForm(askMinutes:true,sounds:sounds,showSales:true,askQuestions:true,askUpdates:true,showPlanMoment:true)
        let short=NativeSetupForm(sounds:sounds)
        let all: [NativeSetupDraft.Step] = [.welcome,.name,.fruitDemo,.pianoDemo,.rachel,.interests,.therapy,.sounds,.minutes,.updates,.ready]
        check(full.order==all,"fresh first-family sequence matches canonical parent order")
        check(full.orderedSteps(reminderEligible:true)==all+[.reminder],"only confirmed eligible first-family reminder follows ready")
        check(short.order==[.welcome,.name,.sounds,.ready],"second or already-asked family takes short sequence")
        let rewalk=NativeSetupForm(name:"Synthetic",age:"3",askMinutes:true,sounds:sounds,showSales:true,askQuestions:true,askUpdates:true,showPlanMoment:true,rewalk:true,focusSounds:["S"],mode:"speech")
        check(rewalk.order==[.welcome,.name,.therapy,.sounds,.minutes,.updates,.ready],"explicit legacy-unasked rewalk asks questions without reselling")
        check(rewalk.orderedSteps(reminderEligible:true)==rewalk.order,"rewalk never asks trial reminder")
        check(rewalk.initialDraft.rewalk && rewalk.initialDraft.minutes==nil,"rewalk flag survives and existing goal is not replaced by a fresh default")
        check(rewalk.initialDraft.focusSounds==["S"] && rewalk.initialDraft.age=="3","explicit rewalk retains saved real choices")
        let clinician=NativeSetupForm(askMinutes:true,sounds:sounds,showSales:true,askQuestions:true,askUpdates:true,showPlanMoment:true,isClinician:true)
        check(clinician.orderedSteps(reminderEligible:true)==short.order,"family clinician compatibility suppresses sales, household questions, report email and reminder")
        check(clinician.initialDraft.role=="slp" && clinician.initialDraft.minutes==nil,"trusted clinician projection does not set a family goal")
        check(full.initialDraft.focusSounds.isEmpty && full.initialDraft.age.isEmpty,"fresh family has no guessed sound or age")
        check(full.initialDraft.minutes==5 && short.initialDraft.minutes==nil,"fresh five-minute default applies only to asked minutes")
        let defaultSounds=NativeSetupForm(sounds:sounds,focusSounds:["R"],mode:"speech")
        check(defaultSounds.initialDraft.focusSounds.isEmpty,"legacy profile sound defaults are not a choice for unfinished setup")
        for (age,band) in [("3","4"),("5","6"),("7","8"),("14","8"),("","")] {
            var d=NativeSetupForm(age:age,sounds:sounds).initialDraft
            check(d.age==age && d.ageBand==band,"raw age \(age) remains exact while chip projects \(band)")
            d.selectAge("6");d.selectAge("6")
            check(d.age=="6","age retap selects, never clears")
        }
        var draft=full.initialDraft
        check(draft.next(in:full) && draft.step == .name,"welcome goes directly to name")
        check(!draft.next(in:full) && draft.step == .name,"missing name cannot advance")
        draft.name=" \n ";check(!draft.canContinue(in:full),"whitespace name cannot advance")
        draft.name="Synthetic";draft.age="fifteen"
        check(!draft.next(in:full) && draft.step == .name,"corrupt typed age cannot advance")
        draft.age="";check(draft.next(in:full) && draft.step == .fruitDemo,"age is optional and empty age permits name continue")
        check(draft.back(in:full) && draft.step == .name,"back from first demo returns name")
        draft.age="3";_ = draft.next(in:full)
        _ = draft.next(in:full);_ = draft.next(in:full);_ = draft.next(in:full)
        check(draft.step == .interests,"both demos then Rachel reach interests")
        check(draft.next(in:full) && draft.step == .therapy,"no interest choice is required")
        check(!draft.next(in:full),"therapy is never silently answered")
        check(!draft.answerTherapy("unapproved",in:full) && draft.therapy.isEmpty,"unknown therapy answer is ignored")
        check(draft.answerTherapy("t_none",in:full) && draft.step == .sounds,"therapy answer advances on the same tap")
        check(!draft.next(in:full),"zero sound choices cannot advance")
        draft.toggleSound("S")
        check(draft.focusSounds==["S"] && draft.mode=="speech" && draft.pathReason.isEmpty,"one sound tap does not inherit R or an unsure label")
        check(draft.next(in:full) && draft.step == .minutes,"selected canonical sound reaches minutes")
        check(!draft.answerMinutes(15,in:full),"retired minutes option is ignored")
        check(draft.answerMinutes(3,in:full) && draft.step == .updates && draft.minutes==3,"three-minute answer advances immediately")
        check(!draft.next(in:full),"empty email cannot act as report consent")
        draft.email="wrong";check(!draft.next(in:full),"malformed email cannot continue")
        draft.email=" synthetic@example.invalid "
        check(draft.next(in:full) && draft.step == .ready,"valid explicit email reaches ready")
        check(!draft.next(in:full),"ready with no eligible reminder has no automatic next or microphone request")
        check(draft.next(in:full,reminderEligible:true) && draft.step == .reminder,"ready enters only a confirmed eligible reminder")
        check(!draft.next(in:full,reminderEligible:true) && !draft.skipCurrent(in:full),"reminder cannot be answered by generic Continue or Skip")
        check(draft.back(in:full) && draft.step == .ready,"back from reminder returns ready without changing answers")
        draft.step = .updates;let heldEmail=draft.email
        check(draft.back(in:full) && draft.email==heldEmail && draft.step == .minutes,"email back retains typed address")
        draft.step = .interests;draft.toggleInterest("space");draft.toggleInterest("invalid")
        check(draft.interests==["space"],"interests accept fixed source IDs only")
        check(draft.skipCurrent(in:full) && draft.interests.isEmpty && draft.step == .therapy,"interest Skip clears prior choice and advances")
        check(draft.skipCurrent(in:full) && draft.therapy.isEmpty && draft.step == .sounds,"therapy Skip clears answer and advances")
        draft.chooseAllSounds();check(draft.mode=="play" && draft.pathReason=="unsure" && draft.focusSounds.isEmpty,"Not sure chooses existing play path without inventing a target")
        check(draft.next(in:full) && draft.step == .minutes,"play choice can continue")
        check(draft.skipCurrent(in:full) && draft.minutes==nil && draft.step == .updates,"minutes Skip clears default and preserves existing goal contract")
        check(draft.skipCurrent(in:full) && draft.email.isEmpty && draft.step == .ready,"email Skip clears address and advances")
        check(!draft.skipCurrent(in:full),"ready is not a generic skip question")
        var unknown=NativeSetupDraft();unknown.name="Synthetic";unknown.step = .sounds;unknown.toggleSound("UNKNOWN")
        check(!unknown.canContinue(in:full),"unknown saved sound cannot pass canonical sound validation")
        unknown.step = .ready
        check(unknown.normalized(in:full).step == .sounds,"retired invalid sound choice returns a resumed draft to sounds")
        unknown.name="";check(unknown.normalized(in:full).step == .name,"missing required name returns a resumed draft to name")
        var oldStep=NativeSetupDraft();oldStep.name="Synthetic";oldStep.focusSounds=["S"];oldStep.step = .minutes
        check(oldStep.normalized(in:short).step == .ready,"retired ineligible question normalizes to next allowed step")
        oldStep.step = .reminder;check(oldStep.normalized(in:full).step == .ready,"process restart does not assume saved reminder eligibility")
        let legacy: [String:Any] = ["kid":"k4","childName":"Restored Synthetic","childAge":"3","character":"unicorn","role":"slp","mode":"play","focusSounds":[],"slpEvaluated":"yes","goals":"ignored","email":"parent@example.invalid","interests":["space","space","dragons"],"pathReason":"unsure","therapy":"t_yes","minutes":"10","step":"ready","idx":9,"rewalk":true,"receipt":UUID().uuidString,"submitted":true,"premium":true]
        let legacyJSON=try json(legacy)
        let legacyForm=NativeSetupForm(name:"Profile Synthetic",age:"6",character:"unicorn",askMinutes:true,sounds:sounds,showSales:true,askQuestions:true,askUpdates:true,legacyDraftJSON:legacyJSON,slot:"k4",isSingleChild:false)
        let held=legacyForm.initialDraft
        check(held.name=="Restored Synthetic" && held.age=="3" && held.minutes==10,"exact canonical flat saveDraft envelope restores allowed answer fields")
        check(held.mode=="play" && held.pathReason=="unsure" && held.focusSounds.isEmpty,"legacy play reason survives without becoming a new target")
        check(held.character=="unicorn","catalog-validated same-child legacy buddy survives through the form projection")
        let untrustedBuddy = try json(["kid":"","character":"bunny"])
        check(NativeSetupForm(character:"unicorn",sounds:sounds,legacyDraftJSON:untrustedBuddy,isSingleChild:true).initialDraft.character=="unicorn","raw valid-looking buddy cannot replace the host-validated form character")
        let malformedBuddy = try json(["kid":"","character":"not-a-catalog-buddy"])
        check(NativeSetupForm(character:"fox",sounds:sounds,legacyDraftJSON:malformedBuddy,isSingleChild:true).initialDraft.character=="fox","malformed raw legacy buddy cannot replace the validated current buddy")
        check(held.interests==["space"] && held.therapy=="t_yes" && held.email=="parent@example.invalid","legacy fixed answers are filtered and restored")
        check(held.step == .welcome,"canonical obdraft has no step/idx; injected navigation is ignored")
        check(held.role=="parent" && !held.rewalk && !held.submitted,"legacy data cannot mint clinician role, rewalk authority or submitted state")
        let foreign=NativeSetupForm(name:"Profile Synthetic",askMinutes:true,sounds:sounds,legacyDraftJSON:legacyJSON,slot:"k5",isSingleChild:false).initialDraft
        check(foreign.name=="Profile Synthetic" && foreign.minutes==5 && foreign.email.isEmpty,"another named child cannot inherit a draft")
        var noKid=legacy;noKid.removeValue(forKey:"kid")
        let noKidJSON=try json(noKid)
        check(NativeSetupForm(sounds:sounds,legacyDraftJSON:noKidJSON,isSingleChild:true).initialDraft.name=="Restored Synthetic","old unowned draft restores only to original single-child slot")
        check(NativeSetupForm(sounds:sounds,legacyDraftJSON:noKidJSON,slot:"k4",isSingleChild:true).initialDraft.name.isEmpty,"missing kid never crosses into a later named slot")
        check(NativeSetupForm(sounds:sounds,legacyDraftJSON:noKidJSON,isSingleChild:false).initialDraft.name.isEmpty,"missing kid is rejected with multiple children")
        var malformedKid=legacy;malformedKid["kid"]=4
        check(NativeSetupForm(sounds:sounds,legacyDraftJSON:try json(malformedKid),isSingleChild:true).initialDraft.name.isEmpty,"typed non-string kid cannot impersonate original child")
        for invalid in ["{", "[]", "null", "{\"kid\":\"unknown\",\"childName\":\"Foreign\"}"] {
            check(NativeSetupForm(name:"Profile",sounds:sounds,legacyDraftJSON:invalid,slot:"k4").initialDraft.name=="Profile","corrupt or unknown-owned legacy draft is ignored")
        }
        for value: Any in ["", "15", "bogus", NSNull()] {
            var skipped=legacy;skipped["minutes"]=value
            check(NativeSetupForm(askMinutes:true,sounds:sounds,legacyDraftJSON:try json(skipped),slot:"k4").initialDraft.minutes==nil,"restored skip/retired minutes suppress fresh default")
        }
        for value in [3,5,10] {
            var chosen=legacy;chosen["minutes"]=value
            check(NativeSetupForm(askMinutes:true,sounds:sounds,legacyDraftJSON:try json(chosen),slot:"k4").initialDraft.minutes==value,"canonical numeric minutes \(value) survive bridge")
        }
        let rewalkIgnoringLegacy=NativeSetupForm(name:"Real Profile",age:"7",sounds:sounds,rewalk:true,focusSounds:["S"],legacyDraftJSON:legacyJSON,slot:"k4").initialDraft
        check(rewalkIgnoringLegacy.name=="Real Profile" && rewalkIgnoringLegacy.age=="7" && rewalkIgnoringLegacy.focusSounds==["S"],"onboarded explicit rewalk never overlays an obsolete scratchpad")
        let old=try decode(["name":"Old Synthetic","age":"3","character":"fox","focusSounds":["S"],"mode":"speech","step":"buddy"])
        check(old.step == .name && old.minutes==nil && old.role=="parent","old native alias decodes to name and does not invent an old skipped goal")
        var locked=draft;locked.submitted=true
        let receipt=locked.receipt
        let retry=try JSONDecoder().decode(NativeSetupDraft.self,from:JSONEncoder().encode(locked))
        check(retry==locked && retry.receipt==receipt,"submitted payload and receipt round-trip exactly")
        locked.toggleSound("R");locked.selectAge("4");locked.toggleInterest("sports");locked.chooseAllSounds()
        _ = locked.next(in:full);_ = locked.back(in:full);_ = locked.skipCurrent(in:full);_ = locked.answerMinutes(10,in:full);_ = locked.answerTherapy("t_yes",in:full)
        check(locked==retry && locked.normalized(in:clinician)==retry,"uncertain accepted save cannot mutate choices, route or authority under same receipt")
        for brokenReceipt: Any in [NSNull(),"not-a-UUID"] {
            check((try? decode(["submitted":true,"receipt":brokenReceipt]))==nil,"submitted corrupt receipt cannot generate a new save operation")
        }
        check((try? decode(["submitted":true]))==nil,"submitted missing receipt is rejected")
        check((try? decode(["step":"unknown"]))==nil,"unknown saved step cannot route setup")
        let suite="com.sona.synthetic.setup-fidelity."+UUID().uuidString
        let defaults=UserDefaults(suiteName:suite)!
        defer { defaults.removePersistentDomain(forName:suite) }
        let owner="synthetic-origin|original",otherOwner="synthetic-origin|k4"
        let store=NativeSetupDraftStore(defaults:defaults,owner:owner),sibling=NativeSetupDraftStore(defaults:defaults,owner:otherOwner)
        try store.save(retry)
        var bound=retry;bound.owner=owner
        check(store.read()==bound,"native draft is stamped and round-trips to its owner")
        check(sibling.read()==nil,"sibling cannot read another owner key")
        defaults.set(try JSONEncoder().encode(bound),forKey:NativeSetupDraftStore.key(owner:otherOwner))
        check(sibling.read()==nil,"copying owner-stamped draft to sibling key cannot restore it")
        var rejected=false;do { try sibling.save(bound) } catch NativeSetupDraftStore.Failure.ownerMismatch { rejected=true }
        check(rejected,"store cannot write foreign owner draft")
        try sibling.save(NativeSetupDraft());store.remove()
        check(store.read()==nil && sibling.read() != nil,"removal clears only the owned scratchpad")
        check(sounds[1].accessibilityLabel=="S, as in sun" && sounds[2].accessibilityLabel=="TH, unvoiced" && sounds[3].accessibilityLabel=="TH, voiced","sound examples and distinct voiced TH labels retain source accessibility")
        check(NativeSetupHandoff.afterSave(owner:owner,currentOwner:owner,requiresTrialFirst:false,allowsPractice:true) == .microphone,"save routes allowed owner to microphone primer, not direct practice")
        check(NativeSetupHandoff.afterSave(owner:owner,currentOwner:owner,requiresTrialFirst:true,allowsPractice:true) == .store,"due price precedes microphone even with a free practice path")
        check(NativeSetupHandoff.afterSave(owner:owner,currentOwner:owner,requiresTrialFirst:false,allowsPractice:false) == .home,"locked save cannot request microphone or launch practice")
        check(NativeSetupHandoff.afterSave(owner:owner,currentOwner:otherOwner,requiresTrialFirst:false,allowsPractice:true) == .home,"stale save cannot route a sibling")
        let now=Date(timeIntervalSince1970:100000),token=NativeSetupHandoff(owner:owner,createdAt:Date(timeIntervalSince1970:100000))
        check(token.afterStore(currentOwner:owner,allowsPractice:false,now:now) == .home,"declined store grants nothing")
        check(token.afterStore(currentOwner:owner,allowsPractice:true,now:now) == .microphone,"store access returns to explicit microphone step")
        check(token.afterMicrophone(currentOwner:owner,now:now) == .handoff,"microphone completion or Not now reaches hand-phone step")
        check(token.afterHandoff(currentOwner:owner,requiresTrialFirst:false,allowsPractice:true,now:now) == .fruitSlice,"only explicit owned handoff launches first Slice")
        check(token.afterHandoff(currentOwner:owner,requiresTrialFirst:true,allowsPractice:true,now:now) == .store,"handoff rechecks due price")
        check(token.afterHandoff(currentOwner:owner,requiresTrialFirst:false,allowsPractice:false,now:now) == .home,"handoff rechecks current access")
        check(token.afterHandoff(currentOwner:owner,requiresTrialFirst:true,allowsPractice:true,isClinician:true,now:now) == .home,"clinician completion returns Home without family store/game")
        for wrong in [otherOwner,nil] {
            check(token.afterStore(currentOwner:wrong,allowsPractice:true,now:now) == .home && token.afterMicrophone(currentOwner:wrong,now:now) == .home && token.afterHandoff(currentOwner:wrong,requiresTrialFirst:false,allowsPractice:true,now:now) == .home,"owner switch or removal invalidates every delayed handoff phase")
        }
        check(token.isValid(currentOwner:owner,now:now.addingTimeInterval(7199.999)),"marker is valid immediately before two hours")
        for offset in [-1.0,7200,7201] {
            let date=now.addingTimeInterval(offset)
            check(!token.isValid(currentOwner:owner,now:date) && token.afterStore(currentOwner:owner,allowsPractice:true,now:date) == .home && token.afterMicrophone(currentOwner:owner,now:date) == .home && token.afterHandoff(currentOwner:owner,requiresTrialFirst:false,allowsPractice:true,now:date) == .home,"future or expired marker cannot resume any phase")
        }
        var gate=NativeSetupTapGate()
        check(gate.accept(at:100),"first monotonic tap is accepted")
        check(!gate.accept(at:100.1) && !gate.accept(at:100.449),"double tap cannot answer a newly displayed question")
        check(gate.accept(at:100.45),"tap after canonical450ms settle is accepted")
        check(!gate.accept(at:.nan) && !gate.accept(at:.infinity) && !gate.accept(at:99),"nonfinite or reversed clock cannot bypass settle")
        print("Native setup flow checks: \(count-failures)/\(count) passed")
        if failures>0 { exit(1) }
    }
}
