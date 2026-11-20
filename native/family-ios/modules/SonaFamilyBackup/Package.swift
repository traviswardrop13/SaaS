// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "SonaFamilyBackup", platforms: [.iOS(.v15), .macOS(.v13)],
    products: [.library(name: "SonaFamilyBackup", targets: ["SonaFamilyBackup"])],
    dependencies: [.package(path: "../SonaFamilyMigration"), .package(path: "../SonaFamilyRules")],
    targets: [.target(name: "SonaFamilyBackup", dependencies: ["SonaFamilyMigration", "SonaFamilyRules"]),
              .testTarget(name: "SonaFamilyBackupTests", dependencies: ["SonaFamilyBackup", "SonaFamilyMigration", "SonaFamilyRules"])])
