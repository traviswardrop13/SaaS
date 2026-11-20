
import Foundation
import XCTest
import SonaFamilyMigration
import SonaFamilyAccess
@testable import ConnectionHost

private enum SyntheticError: Error { case inaccessible }
private final class MemoryCredentials: FamilyConnectionStorage {
 var values:[String:Data]=[:]; var reads:[String]=[]; var unavailable=false
 func read(account:String)throws->Data? { reads.append(account); if unavailable {throw SyntheticError.inaccessible}; return values[account] }
 func write(_ data:Data,account:String)throws { if unavailable {throw SyntheticError.inaccessible}; values[account]=data }
 func delete(account:String)throws { if unavailable {throw SyntheticError.inaccessible}; values.removeValue(forKey:account) }
}
private final class FakeHTTP: URLProtocol {
 static var requests:[URLRequest]=[]
 static var held:FakeHTTP?
 static var holdPath:String?
 static var response:(URLRequest)->String = {_ in #"{"ok":true,"covered":false}"#}
 override class func canInit(with request:URLRequest)->Bool {true}
 override class func canonicalRequest(for request:URLRequest)->URLRequest {request}
 override func startLoading() {
  var copied = request
  if copied.httpBody == nil, let stream = copied.httpBodyStream {
   stream.open(); defer { stream.close() }
   var bytes = Data(); var buffer = [UInt8](repeating:0,count:4096)
   while stream.hasBytesAvailable { let n = stream.read(&buffer,maxLength:buffer.count); if n <= 0 {break}; bytes.append(buffer,count:n) }
   copied.httpBody = bytes
  }
  Self.requests.append(copied)
  if request.url?.path == Self.holdPath {Self.held=self;return}
  finish(Self.response(request))
 }
 func finish(_ body:String) {
  client?.urlProtocol(self,didReceive:HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:nil,headerFields:["Content-Type":"application/json"])!,cacheStoragePolicy:.notAllowed)
  client?.urlProtocol(self,didLoad:Data(body.utf8));client?.urlProtocolDidFinishLoading(self)
 }
 override func stopLoading() {}
}
private func ticket(_ id:String,_ code:String="CLINIC")->String {
 let data=try! JSONSerialization.data(withJSONObject:["t":"enrol","code":code.lowercased(),"cid":id,"exp":9999999999999])
 return data.base64EncodedString().replacingOccurrences(of:"+",with:"-").replacingOccurrences(of:"/",with:"_").replacingOccurrences(of:"=",with:"")+".synthetic"
}
private func household(_ origin:LegacyOrigin = .app, declined:Bool=false)throws->NativeFamilyOrigin {
 let profile=declined ? #"{"childName":"Synthetic","slpShare":false}"# : #"{"childName":"Synthetic"}"#
 let storage:[String:String]=[
  "sona.profile.v1":profile,"sona.profile.v1@k2":profile,
  "sona.pilot.v1":#"{"childId":"child-a","code":"CLINIC","consent":true,"consentAt":"2026-11-19T01:00:00Z"}"#,
  "sona.pilot.v1@k2":#"{"childId":"child-b","code":"CLINIC","consent":false}"#,
  "sona.slpok":"CLINIC","sona.slpticket":ticket("child-a"),"sona.login":"otter1234",
  "sona.caseplan.v1":#"{"active":true,"code":"CLINIC","checked":1}"#]
 let promises:[String:Bool]=["founder":false,"founding":false,"grandfathered":false,"keptFreeVersion":false,"keptLegacyBuddies":false]
 let data=try JSONSerialization.data(withJSONObject:["origin":origin.rawValue,"sourceFingerprint":"synthetic","storage":storage,"activeSlot":"","slots":["","k2"],"slotHighWaterMark":2,"promises":promises])
 return try JSONDecoder().decode(NativeFamilyOrigin.self,from:data)
}
private func saved(_ owner:FamilyConnectionOwner, consent:Bool=false,pending:Bool=true,known:Bool=false)throws->Data {
 let link=FamilyLink(user:"otter1234",clinician:"Synthetic Clinic",code:"CLINIC",ticket:ticket("child-a"),invite:"",childID:"child-a",covered:true,coverageCheckedAt:Date(),consentAt:consent ? Date():nil)
 var value=try JSONSerialization.jsonObject(with:JSONEncoder().encode(link)) as! [String:Any]
 value=["owner":owner.account,"link":value,"needsSharingChoice":pending,"homeworkKnown":known]
 if !pending {value["consentDecisionAt"]=Date().timeIntervalSinceReferenceDate}
 return try JSONSerialization.data(withJSONObject:value)
}
@MainActor final class ConnectionTests:XCTestCase {
 var session:URLSession!;var defaults:UserDefaults!;var suite:String!
 override func setUp() async throws {
  suite="sona.synthetic."+UUID().uuidString;defaults=UserDefaults(suiteName:suite)!
  let config=URLSessionConfiguration.ephemeral;config.protocolClasses=[FakeHTTP.self];session=URLSession(configuration:config)
  FakeHTTP.requests=[];FakeHTTP.held=nil;FakeHTTP.holdPath=nil
  FakeHTTP.response={req in req.url?.path == "/api/homework" ? #"{"ok":true,"hw":null}"# : #"{"ok":true,"covered":false}"#}
 }
 override func tearDown() async throws {session.invalidateAndCancel();defaults.removePersistentDomain(forName:suite)}
 private func store(_ memory:MemoryCredentials)->FamilyConnectionStore {FamilyConnectionStore(client:FamilyLoginClient(session:session),defaults:defaults,storage:memory)}
 func drain(_ store:FamilyConnectionStore)->[FamilyConnectionChange] {var out:[FamilyConnectionChange]=[];while let c=store.change{out.append(c);store.acknowledgeChange(c.id)};return out}
 func waitHeld() async throws {for _ in 0..<1000 {if FakeHTTP.held != nil{return};try await Task.sleep(nanoseconds:1_000_000)};XCTFail("request did not reach synthetic holder")}
 func testArchiveIdentityAndSiblingScope() throws {
  let memory=MemoryCredentials(),store=store(memory),home=try household()
  store.bind(child:home.children[0],household:home,isPreview:false)
  XCTAssertEqual(store.link?.childID,"child-a");XCTAssertEqual(store.link?.user,"otter1234");XCTAssertNotNil(store.link?.consentAt)
  XCTAssertTrue(FakeHTTP.requests.isEmpty)
  store.bind(child:home.children[1],household:home,isPreview:false)
  XCTAssertNil(store.link);XCTAssertNil(store.assignedHomework(on:Date()))
  XCTAssertFalse(store.needsSharingChoice)
  XCTAssertNotEqual(FamilyConnectionOwner(child:home.children[0].id,isPreview:false,generation:UUID()).account,FamilyConnectionOwner(child:home.children[1].id,isPreview:false,generation:UUID()).account)
  XCTAssertFalse(memory.reads.contains("therapist-connection-v1"))
 }
 func testOnlyOriginalPreviewMayReadV1() throws {
  let home=try household()
  XCTAssertTrue(FamilyConnectionOwner(child:home.children[0].id,isPreview:true,generation:UUID()).canReadOriginalPreview)
  XCTAssertFalse(FamilyConnectionOwner(child:home.children[1].id,isPreview:true,generation:UUID()).canReadOriginalPreview)
  let web=try household(.www)
  XCTAssertFalse(FamilyConnectionOwner(child:web.children[0].id,isPreview:true,generation:UUID()).canReadOriginalPreview)
 }
 func testYesRequiresRealSnapshotBeforeAnyRequest() async throws {
  let memory=MemoryCredentials(),home=try household(),owner=FamilyConnectionOwner(child:home.children[0].id,isPreview:false,generation:UUID())
  memory.values[owner.account]=try saved(owner)
  let store=store(memory);store.bind(child:home.children[0],household:home,isPreview:false)
  do {try await store.chooseSharing(true);XCTFail("missing snapshot allowed")}catch{XCTAssertEqual(error as? FamilyClientError,.snapshotRequired)}
  XCTAssertTrue(FakeHTTP.requests.isEmpty)
 }
 func testYesUsesActualSnapshotAndQueuesEveryPatch() async throws {
  let memory=MemoryCredentials(),home=try household(),owner=FamilyConnectionOwner(child:home.children[0].id,isPreview:false,generation:UUID())
  memory.values[owner.account]=try saved(owner)
  let store=store(memory);store.bind(child:home.children[0],household:home,isPreview:false)
  FakeHTTP.response={_ in #"{"ok":true,"hw":null}"#}
  try await store.chooseSharing(true,snapshot:FamilyEnrollmentSnapshot(childName:"Synthetic",age:"6",focusSounds:["S"],dailyGoal:20,outcomes:["S":.object(["tries":.number(12)])],sessions:6,streak:3))
  let request=try XCTUnwrap(FakeHTTP.requests.first{$0.url?.path == "/api/pilot"})
  let json=try JSONSerialization.jsonObject(with:request.httpBody!) as! [String:Any]
  XCTAssertEqual(json["sessions"] as? Int,6);XCTAssertEqual(json["streak"] as? Int,3);XCTAssertEqual(json["childId"] as? String,"child-a")
  XCTAssertFalse((json["outcomes"] as? [String:Any] ?? [:]).isEmpty)
  let changes=drain(store);XCTAssertGreaterThanOrEqual(changes.count,3)
  XCTAssertTrue(changes.allSatisfy{$0.child == owner.child})
  XCTAssertTrue(changes.contains{$0.profilePatch["slpShare"] == .bool(true)})
  XCTAssertTrue(changes.contains{($0.childValues["sona.homework.v1"] ?? "").contains("null")})
 }
 func testCoverageResponseCannotCrossSiblingDuringAwait() async throws {
  let memory=MemoryCredentials(),home=try household(),store=store(memory)
  store.bind(child:home.children[0],household:home,isPreview:false);_ = drain(store)
  FakeHTTP.holdPath="/api/slp/covered"
  let task=Task {await store.refreshCoverage()}
  try await waitHeld();store.bind(child:home.children[1],household:home,isPreview:false)
  FakeHTTP.held!.finish(#"{"ok":true,"covered":false}"#);await task.value
  XCTAssertNil(store.link)
  let changes=drain(store);XCTAssertTrue(changes.allSatisfy{$0.child == home.children[0].id})
  store.bind(child:home.children[0],household:home,isPreview:false)
  XCTAssertEqual(store.link?.covered,false)
 }
 func testStoredYesSurvivesStaleNoAfterInterruptedHandoff() throws {
  let memory=MemoryCredentials(),home=try household(declined:true),owner=FamilyConnectionOwner(child:home.children[0].id,isPreview:false,generation:UUID())
  memory.values[owner.account]=try saved(owner,consent:true,pending:false)
  let store=store(memory);store.bind(child:home.children[0],household:home,isPreview:false)
  XCTAssertNotNil(store.link?.consentAt)
  let changes=drain(store)
  XCTAssertTrue(changes.contains{$0.profilePatch["slpShare"] == .bool(true)})
  XCTAssertTrue(changes.contains{$0.householdValues["sona.caseplan.v1"] != nil})
 }
 func testNoClearsOnlyOwnerHomeworkWithExplicitNull() async throws {
  let memory=MemoryCredentials(),home=try household(),owner=FamilyConnectionOwner(child:home.children[0].id,isPreview:false,generation:UUID())
  memory.values[owner.account]=try saved(owner,consent:true,pending:false,known:true)
  let store=store(memory);store.bind(child:home.children[0],household:home,isPreview:false);_ = drain(store)
  FakeHTTP.response={_ in #"{"ok":true}"#};try await store.stopSharing()
  let changes=drain(store),clear=try XCTUnwrap(changes.first?.childValues["sona.homework.v1"])
  let json=try JSONSerialization.jsonObject(with:Data(clear.utf8)) as! [String:Any]
  XCTAssertTrue(json["hw"] is NSNull)
  XCTAssertEqual(changes.first?.profilePatch["slpShare"],.bool(false));XCTAssertNil(store.link?.consentAt)
 }
 func testCorruptStorageNeverFallsBackToNewCredential() throws {
  let memory=MemoryCredentials(),home=try household(),store=store(memory);memory.unavailable=true
  store.bind(child:home.children[0],household:home,isPreview:false)
  XCTAssertTrue(store.storageUnavailable);XCTAssertNil(store.link);XCTAssertTrue(FakeHTTP.requests.isEmpty)
 }
 func testCoverageRevocationKeepsOtherRealGrants() throws {
  var state=FamilyEntitlementState();state.grants=[.apple,.freeEra,.founder]
  let link=FamilyLink(user:"u",clinician:"",code:"CLINIC",ticket:"synthetic",invite:"",childID:"child-a",covered:false,coverageCheckedAt:Date(),consentAt:nil)
  XCTAssertTrue(FamilyLibraryAccess(link:link,state:state,canSellHere:true).allows(.slice))
 }
 func testProgressUsesRealTotalsOncePerMinuteAndRejectsWrongOwner() async throws {
  let memory=MemoryCredentials(),home=try household(),owner=FamilyConnectionOwner(child:home.children[0].id,isPreview:false,generation:UUID())
  memory.values[owner.account]=try saved(owner,consent:true,pending:false)
  let store=store(memory);store.bind(child:home.children[0],household:home,isPreview:false)
  FakeHTTP.response={_ in #"{"ok":true}"#}
  let snapshot=FamilyEnrollmentSnapshot(childName:"Synthetic",age:"6",focusSounds:["S"],dailyGoal:20,outcomes:["S":.object(["tries":.number(12)])],sessions:6,streak:3)
  let wrongOwner = await store.shareProgress(snapshot:snapshot,owner:home.children[1].id,manual:true)
  XCTAssertFalse(wrongOwner)
  XCTAssertTrue(FakeHTTP.requests.isEmpty)
  let automatic = await store.shareProgress(snapshot:snapshot,owner:owner.child)
  let throttled = await store.shareProgress(snapshot:snapshot,owner:owner.child)
  XCTAssertTrue(automatic);XCTAssertFalse(throttled)
  XCTAssertEqual(FakeHTTP.requests.count,1)
  let manual = await store.shareProgress(snapshot:snapshot,owner:owner.child,manual:true)
  XCTAssertTrue(manual);XCTAssertEqual(FakeHTTP.requests.count,2)
  let body=try JSONSerialization.jsonObject(with:FakeHTTP.requests[0].httpBody!) as! [String:Any]
  XCTAssertEqual(body["source"] as? String,"pilot-progress");XCTAssertEqual(body["sessions"] as? Int,6)
  XCTAssertEqual(Set(body.keys),["source","code","ticket","childId","child","age","focus","goal","outcomes","sessions","streak","consentAt","at"])
 }
 func testEachChildHasOwnMinuteAndNoSharedProgressIdentity() async throws {
  let memory=MemoryCredentials(),home=try household(),a=FamilyConnectionOwner(child:home.children[0].id,isPreview:false,generation:UUID()),b=FamilyConnectionOwner(child:home.children[1].id,isPreview:false,generation:UUID())
  memory.values[a.account]=try saved(a,consent:true,pending:false)
  var object=try JSONSerialization.jsonObject(with:saved(b,consent:true,pending:false)) as! [String:Any]
  var link=object["link"] as! [String:Any];link["childID"]="child-b";link["ticket"]=ticket("child-b");object["link"]=link
  memory.values[b.account]=try JSONSerialization.data(withJSONObject:object)
  let store=store(memory);FakeHTTP.response={_ in #"{"ok":true}"#}
  store.bind(child:home.children[0],household:home,isPreview:false)
  await store.shareProgress(snapshot:FamilyEnrollmentSnapshot(sessions:1),owner:a.child)
  store.bind(child:home.children[1],household:home,isPreview:false)
  await store.shareProgress(snapshot:FamilyEnrollmentSnapshot(sessions:2),owner:b.child)
  store.bind(child:home.children[0],household:home,isPreview:false)
  await store.shareProgress(snapshot:FamilyEnrollmentSnapshot(sessions:1),owner:a.child)
  XCTAssertEqual(FakeHTTP.requests.count,2)
  let bodies=try FakeHTTP.requests.map {try JSONSerialization.jsonObject(with:$0.httpBody!) as! [String:Any]}
  XCTAssertEqual(bodies.map{$0["childId"] as! String},["child-a","child-b"])
  XCTAssertEqual(bodies.map{$0["sessions"] as! Int},[1,2])
 }
 func testProgressDoesNotStartBeforeSharingAnswer() async throws {
  let memory=MemoryCredentials(),home=try household(),owner=FamilyConnectionOwner(child:home.children[0].id,isPreview:false,generation:UUID())
  memory.values[owner.account]=try saved(owner,consent:true,pending:true)
  let store=store(memory);store.bind(child:home.children[0],household:home,isPreview:false)
  await store.shareProgress(snapshot:FamilyEnrollmentSnapshot(sessions:2),owner:owner.child)
  XCTAssertTrue(FakeHTTP.requests.isEmpty)
 }
 func testStopSharingCancelsPendingProgressAndBlocksAnotherSend() async throws {
  let memory=MemoryCredentials(),home=try household(),owner=FamilyConnectionOwner(child:home.children[0].id,isPreview:false,generation:UUID())
  memory.values[owner.account]=try saved(owner,consent:true,pending:false)
  let store=store(memory);store.bind(child:home.children[0],household:home,isPreview:false)
  FakeHTTP.response={_ in #"{"ok":true}"#};FakeHTTP.holdPath="/api/pilot"
  let progress=Task {await store.shareProgress(snapshot:FamilyEnrollmentSnapshot(sessions:2),owner:owner.child)}
  try await waitHeld()
  let duplicate = await store.shareProgress(snapshot:FamilyEnrollmentSnapshot(sessions:2),owner:owner.child,manual:true)
  XCTAssertFalse(duplicate)
  try await store.stopSharing();let cancelled = await progress.value
  XCTAssertFalse(cancelled)
  let afterWithdrawal = await store.shareProgress(snapshot:FamilyEnrollmentSnapshot(sessions:3),owner:owner.child,manual:true)
  XCTAssertFalse(afterWithdrawal)
  XCTAssertNil(store.link?.consentAt)
  XCTAssertEqual(FakeHTTP.requests.filter{$0.url?.path == "/api/pilot"}.count,1)
  XCTAssertEqual(FakeHTTP.requests.filter{$0.url?.path == "/api/pilot/forget"}.count,1)
 }
 func testFoundingProgressExcludesNameAndUnconsentedClientNeverSends() async throws {
  let client=FamilyLoginClient(session:session)
  var link=FamilyLink(user:"",clinician:"",code:"ff-synthetic",ticket:"synthetic",invite:"",childID:"child-a",covered:false,coverageCheckedAt:nil,consentAt:nil)
  try await client.sendProgress(link,snapshot:FamilyEnrollmentSnapshot(childName:"Synthetic private name",sessions:4))
  XCTAssertTrue(FakeHTTP.requests.isEmpty)
  link.consentAt=Date();FakeHTTP.response={_ in #"{"ok":true}"#}
  try await client.sendProgress(link,snapshot:FamilyEnrollmentSnapshot(childName:"Synthetic private name",sessions:4))
  let body=try JSONSerialization.jsonObject(with:FakeHTTP.requests[0].httpBody!) as! [String:Any]
  XCTAssertEqual(body["child"] as? String,"")
  XCTAssertEqual(body["sessions"] as? Int,4)
 }

}
