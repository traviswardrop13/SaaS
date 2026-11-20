// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SonaFamilyAccess",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [.library(name: "SonaFamilyAccess", targets: ["SonaFamilyAccess"])],
    dependencies: [.package(path: "../SonaFamilyMigration")],
    targets: [
        .target(name: "SonaFamilyAccess", dependencies: ["SonaFamilyMigration"], resources: [.copy("Resources/FamilyAccessCatalog.json")]),
        .testTarget(name: "SonaFamilyAccessTests", dependencies: ["SonaFamilyAccess"])
    ]
)
