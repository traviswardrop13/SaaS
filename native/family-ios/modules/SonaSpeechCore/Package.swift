// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SonaSpeechCore",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [.library(name: "SonaSpeechCore", targets: ["SonaSpeechCore"])],
    targets: [
        .target(name: "SonaSpeechCore", resources: [.copy("Resources/PracticeSyllableTables.json")]),
        .testTarget(name: "SonaSpeechCoreTests", dependencies: ["SonaSpeechCore"], resources: [.copy("Fixtures")])
    ]
)
