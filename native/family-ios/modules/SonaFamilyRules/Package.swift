// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SonaFamilyRules",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [.library(name: "SonaFamilyRules", targets: ["SonaFamilyRules"])],
    dependencies: [.package(path: "../SonaFamilyMigration")],
    targets: [
        .target(name: "SonaFamilyRules", resources: [.copy("Rules")]),
        .testTarget(name: "SonaFamilyRulesTests", dependencies: ["SonaFamilyRules", "SonaFamilyMigration"])
    ]
)
