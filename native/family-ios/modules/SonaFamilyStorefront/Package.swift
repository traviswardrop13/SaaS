// swift-tools-version: 5.9
import PackageDescription

// This package deliberately has no RevenueCat dependency. The ordinary native
// preview must remain buildable offline without resolving a purchase SDK.
let package = Package(
    name: "SonaFamilyStorefront",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [.library(name: "SonaFamilyStorefront", targets: ["SonaFamilyStorefront"])],
    dependencies: [.package(path: "../SonaFamilyMigration"), .package(path: "../SonaFamilyAccess")],
    targets: [
        .target(name: "SonaFamilyStorefront", dependencies: ["SonaFamilyMigration", "SonaFamilyAccess"]),
        .testTarget(name: "SonaFamilyStorefrontTests", dependencies: ["SonaFamilyStorefront"])
    ]
)
