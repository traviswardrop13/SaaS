// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SonaFamilyMigration",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [.library(name: "SonaFamilyMigration", targets: ["SonaFamilyMigration"])],
    targets: [
        .target(name: "SonaFamilyMigration", resources: [.copy("Resources/CaptureLegacyStorage.js")]),
        .testTarget(name: "SonaFamilyMigrationTests", dependencies: ["SonaFamilyMigration"])
    ]
)
